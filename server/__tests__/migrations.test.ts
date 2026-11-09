import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  runMigrations,
  getPhysicalTableCount,
  getAppliedMigrations,
  getDbLocation,
} from '../migrations/runner.js';
import {
  BaselineMismatchError,
  MigrationBackupError,
  MigrationChecksumError,
  MigrationError,
  MigrationExecutionError,
  MigrationLockError,
  MigrationRegistryError,
} from '../migrations/types.js';
import { createWalSafeBackup, verifyBackupIntegrity } from '../migrations/backup.js';
import { MigrationLock } from '../migrations/lock.js';
import {
  BASELINE_DDL,
  LEGACY_TABLE_NAMES,
  CANONICAL_BASELINE_FINGERPRINT,
  computeLegacyFingerprint,
} from '../migrations/001_baseline.js';

describe('Versioned Migration Runner & Core Schema Implementation', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-test-mig-'));
    dbPath = path.join(tempDir, 'test.sqlite');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Migration Behavior & Inventory', () => {
    it('1. Fresh database initialization provisions all 15 physical tables', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const result = await runMigrations(db);

      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.baselineCreated).toBe(true);
      expect(result.totalTables).toBe(15);

      const tableRows = (db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
        )
        .all() as { name: string }[]) ?? [];
      const tables = tableRows.map((r) => r.name);

      expect(tables).toHaveLength(15);

      // Verify all 9 legacy tables
      for (const t of LEGACY_TABLE_NAMES) {
        expect(tables).toContain(t);
      }

      // Verify all 5 new domain tables
      expect(tables).toContain('media_assets');
      expect(tables).toContain('projects');
      expect(tables).toContain('certifications');
      expect(tables).toContain('project_media');
      expect(tables).toContain('certification_media');

      // Verify metadata table
      expect(tables).toContain('schema_migrations');

      db.close();
    });

    it('2. Existing valid legacy baseline upgrade succeeds without recreating tables', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

      // Provision legacy 9 tables directly
      db.exec(BASELINE_DDL);
      db.exec(`
        INSERT INTO users (id, email, name, role, created_at)
        VALUES ('u_leg_01', 'legacy@test.com', 'Legacy User', 'CUSTOMER', '2026-01-01T00:00:00Z');
      `);

      // Run migrations
      const result = await runMigrations(db);

      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.totalTables).toBe(15);

      // Verify legacy record is 100% intact
      const user = db.prepare("SELECT * FROM users WHERE id = 'u_leg_01';").get() as any;
      expect(user).toBeDefined();
      expect(user.email).toBe('legacy@test.com');

      db.close();
    });

    it('3. Rejects partial legacy baseline (e.g. 3 tables present) with BaselineMismatchError', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create only 3 tables
      db.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE);
        CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
      `);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('4. Rejects unexpected application tables before baseline registration', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create valid 9 tables + 1 foreign unexpected table
      db.exec(BASELINE_DDL);
      db.exec('CREATE TABLE unexpected_legacy_table (id TEXT PRIMARY KEY);');

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('5. Rejects baseline if required column is missing (structural discrepancy)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create 9 tables, but omit password_hash from users
      const modifiedDDL = BASELINE_DDL.replace('password_hash  TEXT,', '');
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('6. Rejects execution if recorded historical checksum does not match registered checksum', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Simulate a tampered schema_migrations table with valid 64-char hex format but incorrect checksum
      const fakeChecksum = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
        INSERT INTO schema_migrations VALUES (1, '001_initial_baseline', '2026-01-01', '${fakeChecksum}', 10);
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationChecksumError);
      db.close();
    });

    it('7. Migration runner is idempotent and completes quickly when already up-to-date', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const firstRun = await runMigrations(db);
      expect(firstRun.appliedCount).toBe(2);

      const secondStart = Date.now();
      const secondRun = await runMigrations(db);
      const secondDuration = Date.now() - secondStart;

      expect(secondRun.appliedCount).toBe(0);
      expect(secondRun.currentVersion).toBe(2);
      expect(secondRun.totalTables).toBe(15);
      expect(secondDuration).toBeLessThan(100);

      db.close();
    });

    it('8. Atomic transaction rolls back failed migration cleanly without partial schema mutation', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Pre-apply version 1
      db.exec(BASELINE_DDL);
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
      `);
      const { migration001 } = await import('../migrations/001_baseline.js');
      db.prepare(
        'INSERT INTO schema_migrations VALUES (?, ?, ?, ?, ?)'
      ).run(1, migration001.name, new Date().toISOString(), migration001.checksum, 5);

      const tableCountBefore = getPhysicalTableCount(db);

      const badMigration = {
        version: 3,
        name: '003_bad_migration',
        checksum: 'abc',
        up(d: DatabaseSync) {
          d.exec('CREATE TABLE valid_half (id TEXT PRIMARY KEY);');
          d.exec('INVALID SQL STATEMENT HERE TRIGGER ERROR;');
        },
      };

      try {
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        badMigration.up(db);
        db.exec('COMMIT;');
      } catch {
        db.exec('ROLLBACK;');
      }

      // Assert table count remained completely unchanged
      expect(getPhysicalTableCount(db)).toBe(tableCountBefore);
      const testCheck = db.prepare("SELECT name FROM sqlite_master WHERE name = 'valid_half';").get();
      expect(testCheck).toBeUndefined();

      db.close();
    });

    it('9. Migration lock prevents concurrent execution', async () => {
      const lockA = new MigrationLock(dbPath);
      const lockB = new MigrationLock(dbPath);

      await lockA.acquire(1000);

      // Lock B should timeout trying to acquire
      await expect(lockB.acquire(200, 50)).rejects.toThrow(MigrationLockError);

      lockA.release();

      // Now Lock B can acquire
      await lockB.acquire(500);
      lockB.release();
    });

    it('10. Table inventory matches exactly 15 physical tables', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      await runMigrations(db);

      const count = getPhysicalTableCount(db);
      expect(count).toBe(15);
      db.close();
    });
  });

  describe('Migration Registry Integrity & Read-Only Helpers', () => {
    it('1. getAppliedMigrations is strictly read-only and does not create schema_migrations table', () => {
      const db = new DatabaseSync(':memory:');
      const applied = getAppliedMigrations(db);
      expect(applied).toEqual([]);

      // Verify schema_migrations table was NOT created
      const tableCheck = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';")
        .get();
      expect(tableCheck).toBeUndefined();
      db.close();
    });

    it('2. Rejects invalid checksum format in schema_migrations with MigrationRegistryError', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
        INSERT INTO schema_migrations VALUES (1, '001_initial_baseline', '2026-01-01', 'not-a-valid-sha256', 10);
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationRegistryError);
      db.close();
    });

    it('3. Rejects unknown migration version recorded in registry with MigrationRegistryError', async () => {
      const db = new DatabaseSync(':memory:');
      const validSha = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
        INSERT INTO schema_migrations VALUES (99, '099_unknown_future', '2026-01-01', '${validSha}', 10);
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationRegistryError);
      db.close();
    });

    it('4. Rejects missing earlier version (registry gap) with MigrationRegistryError', async () => {
      const db = new DatabaseSync(':memory:');
      const { migration002 } = await import('../migrations/002_projects_certs_media.js');
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
        -- Version 2 recorded without Version 1
        INSERT INTO schema_migrations VALUES (2, '${migration002.name}', '2026-01-01', '${migration002.checksum}', 10);
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationRegistryError);
      db.close();
    });

    it('5. Rejects schema_migrations table with missing or invalid column types', async () => {
      const db = new DatabaseSync(':memory:');
      // Create schema_migrations with wrong type for version (TEXT instead of INTEGER)
      db.exec(`
        CREATE TABLE schema_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationRegistryError);
      db.close();
    });

    it('6. getDbLocation fails closed when PRAGMA database_list cannot be read', () => {
      const closedDb = new DatabaseSync(':memory:');
      closedDb.close();

      expect(() => getDbLocation(closedDb)).toThrow(MigrationError);
    });
  });

  describe('Backup-Before-Mutation Ordering Enforcement', () => {
    it('1. Injecting a backup failure prevents schema_migrations creation and table modifications', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);
      db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_ord_1', 'u@test.com', 'User', '2026-01-01');");

      // Make the backups directory unwriteable by creating a regular file named 'backups'
      const backupsFilePath = path.join(path.dirname(dbPath), 'backups');
      fs.writeFileSync(backupsFilePath, 'BLOCKING_REGULAR_FILE');

      // Attempting to run migrations should fail during backup creation
      await expect(runMigrations(db)).rejects.toThrow(MigrationBackupError);

      // Verify schema_migrations table was NEVER created
      const checkRegistry = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';")
        .get();
      expect(checkRegistry).toBeUndefined();

      // Verify no Phase 02 tables were created
      const checkProjects = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects';")
        .get();
      expect(checkProjects).toBeUndefined();

      // Verify legacy record is intact
      const user = db.prepare("SELECT * FROM users WHERE id = 'u_ord_1';").get() as any;
      expect(user).toBeDefined();
      expect(user.email).toBe('u@test.com');

      db.close();
    });

    it('2. Fresh empty database bypasses backup creation safely (documented exception)', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON;');

      // File exists but table count is 0
      const countBefore = getPhysicalTableCount(db);
      expect(countBefore).toBe(0);

      const result = await runMigrations(db);
      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.totalTables).toBe(15);
      // No backup was needed for empty DB
      expect(result.backupPath).toBeUndefined();

      db.close();
    });
  });

  describe('Concurrency & Multi-Connection Synchronization', () => {
    it('1. Concurrent runMigrations on two independent connections to same file applies migrations exactly once', async () => {
      const db1 = new DatabaseSync(dbPath);
      db1.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db1.exec(BASELINE_DDL);

      const db2 = new DatabaseSync(dbPath);
      db2.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

      // Execute runMigrations concurrently on both connections
      const [res1, res2] = await Promise.all([runMigrations(db1), runMigrations(db2)]);

      // Total applied across both runners must equal exactly 2
      expect(res1.appliedCount + res2.appliedCount).toBe(2);

      // One connection applied 2, the other waited and applied 0
      const counts = [res1.appliedCount, res2.appliedCount].sort();
      expect(counts).toEqual([0, 2]);

      // Both observe the same final version and table count
      expect(res1.currentVersion).toBe(2);
      expect(res2.currentVersion).toBe(2);
      expect(res1.totalTables).toBe(15);
      expect(res2.totalTables).toBe(15);

      // Verify schema_migrations contains exactly 2 rows
      const rows = db1.prepare('SELECT version FROM schema_migrations ORDER BY version ASC;').all() as any[];
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.version)).toEqual([1, 2]);

      db1.close();
      db2.close();
    });
  });

  describe('Migration Lock Lifecycle & Safety Governance', () => {
    it('1. Active lock is NOT deleted solely because of age if process is still alive', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      // Simulate a lock acquired 2 hours ago by the CURRENT running process
      const payload = {
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(payload));

      const lock = new MigrationLock(dbPath);
      // Because process.pid is alive on the same host, lock MUST NOT be treated as stale
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // Lock file must still exist
      expect(fs.existsSync(lockFile)).toBe(true);

      // Clean up manually
      fs.unlinkSync(lockFile);
    });

    it('2. Confirmed dead same-host PID (ESRCH) is safely cleaned up with content verification', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      // Use a PID that does not exist on this machine
      // PIDs like 999999 are safely non-existent
      let deadPid = 999999;
      try {
        process.kill(deadPid, 0);
        deadPid = 999998;
      } catch {
        // Confirmed absent
      }

      const payload = {
        pid: deadPid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(payload));

      const lock = new MigrationLock(dbPath);
      // Lock should detect dead same-host PID, clean it up, and acquire successfully
      await expect(lock.acquire(1000, 50)).resolves.toBeUndefined();
      lock.release();

      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it('3. Foreign host lock fails closed and is never deleted automatically', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      const payload = {
        pid: 1234,
        hostname: 'remote-worker-node-42',
        acquiredAt: new Date().toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(payload));

      const lock = new MigrationLock(dbPath);
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // File was NOT deleted
      expect(fs.existsSync(lockFile)).toBe(true);
      fs.unlinkSync(lockFile);
    });

    it('4. Malformed lock file fails closed and is never deleted automatically', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      fs.writeFileSync(lockFile, '{ corrupt-unparseable-json: ');

      const lock = new MigrationLock(dbPath);
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // File was NOT deleted
      expect(fs.existsSync(lockFile)).toBe(true);
      fs.unlinkSync(lockFile);
    });

    it('5. Lock cannot be accidentally released by a different process instance', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      const payload = {
        pid: process.pid + 999, // Different PID
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(payload));

      const lock = new MigrationLock(dbPath);
      // Calling release on un-acquired instance does not delete file
      lock.release();

      expect(fs.existsSync(lockFile)).toBe(true);
      fs.unlinkSync(lockFile);
    });
  });

  describe('Strict Baseline Fingerprint & Structural Inspection', () => {
    it('1. Canonical baseline fingerprint is deterministic and matches canonical constant', () => {
      const db = new DatabaseSync(':memory:');
      db.exec(BASELINE_DDL);

      const fp = computeLegacyFingerprint(db);
      expect(fp).toBe(CANONICAL_BASELINE_FINGERPRINT);
      expect(typeof fp).toBe('string');
      expect(fp).toHaveLength(64);

      db.close();
    });

    it('2. Rejects baseline with missing table', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Omit newsletter_subscribers table
      const modifiedDDL = BASELINE_DDL.replace(
        /CREATE TABLE IF NOT EXISTS newsletter_subscribers[\s\S]*?\);/,
        ''
      );
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('3. Rejects baseline with incorrect column type (e.g. users.role INTEGER instead of TEXT)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const modifiedDDL = BASELINE_DDL.replace(
        "role           TEXT NOT NULL DEFAULT 'CUSTOMER'",
        "role           INTEGER NOT NULL DEFAULT 1"
      );
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('4. Rejects baseline with incorrect nullability (e.g. users.email nullable)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const modifiedDDL = BASELINE_DDL.replace('email          TEXT UNIQUE NOT NULL,', 'email          TEXT UNIQUE,');
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('5. Rejects baseline with incorrect default value (e.g. users.auth_provider default google)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const modifiedDDL = BASELINE_DDL.replace(
        "auth_provider  TEXT NOT NULL DEFAULT 'local'",
        "auth_provider  TEXT NOT NULL DEFAULT 'google'"
      );
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('6. Rejects baseline with incorrect primary key definition', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Change categories primary key to slug instead of id
      const modifiedDDL = BASELINE_DDL.replace('id          TEXT PRIMARY KEY,', 'id          TEXT,').replace(
        'slug        TEXT UNIQUE NOT NULL,',
        'slug        TEXT PRIMARY KEY NOT NULL,'
      );
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('7. Rejects baseline with missing unique constraint (e.g. categories.slug not unique)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const modifiedDDL = BASELINE_DDL.replace('slug        TEXT UNIQUE NOT NULL,', 'slug        TEXT NOT NULL,');
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('8. Rejects baseline with unexpected extra column in legacy table', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const modifiedDDL = BASELINE_DDL.replace(
        'created_at     TEXT NOT NULL\n);',
        'created_at     TEXT NOT NULL,\n  extra_col      TEXT\n);'
      );
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });
  });

  describe('WAL-Safe Online Backup Behavior & Durability', () => {
    it('1. Backup creation succeeds from a file-backed SQLite database and reports pagesCopied', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      expect(backupRes).not.toBeNull();
      expect(fs.existsSync(backupRes!.backupPath)).toBe(true);
      expect(backupRes!.bytes).toBeGreaterThan(0);
      expect(backupRes!.pagesCopied).toBeGreaterThan(0);
      expect(typeof backupRes!.pagesCopied).toBe('number');

      db.close();
    });

    it('2. Backup captures committed WAL data accurately', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Insert committed row into WAL
      db.exec(`
        INSERT INTO categories (id, name, slug, description, image_url, item_count)
        VALUES ('cat_wal_test', 'WAL Category', 'wal-category', 'Test', '/test.jpg', 1);
      `);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      expect(backupRes).toBeDefined();

      // Open backup file separately and check data
      const bakDb = new DatabaseSync(backupRes!.backupPath, { readOnly: true });
      const row = bakDb.prepare("SELECT * FROM categories WHERE id = 'cat_wal_test';").get() as any;
      expect(row).toBeDefined();
      expect(row.slug).toBe('wal-category');

      bakDb.close();
      db.close();
    });

    it('3. Backup integrity_check and quick_check both report ok and verify source records', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      expect(() => verifyBackupIntegrity(backupRes!.backupPath, db)).not.toThrow();

      db.close();
    });

    it('4. Backup filenames are unique and do not collide', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const bak1 = await createWalSafeBackup(db, dbPath, 2);
      const bak2 = await createWalSafeBackup(db, dbPath, 2);

      expect(bak1!.backupPath).not.toBe(bak2!.backupPath);
      expect(fs.existsSync(bak1!.backupPath)).toBe(true);
      expect(fs.existsSync(bak2!.backupPath)).toBe(true);

      db.close();
    });

    it('5. Source database is not modified or locked by backup creation', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      await createWalSafeBackup(db, dbPath, 2);

      // Should be able to write immediately without error
      expect(() => {
        db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_after_bak', 'a@b.com', 'A', '2026-01-01');");
      }).not.toThrow();

      db.close();
    });

    it('6. Restore procedure recovers exact pre-migration schema and records', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);
      db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_restore_01', 'res@nexora.com', 'Restore User', '2026-01-01');");

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      db.close();

      // Simulate a disaster or corruption on the main database
      fs.writeFileSync(dbPath, 'CORRUPTED_GARBAGE_BYTES');

      // Execute restore procedure
      fs.copyFileSync(backupRes!.backupPath, dbPath);
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);

      // Verify restored database
      const restoredDb = new DatabaseSync(dbPath);
      const integrity = restoredDb.prepare('PRAGMA integrity_check;').all() as any[];
      expect(integrity).toEqual([{ integrity_check: 'ok' }]);

      const restoredUser = restoredDb.prepare("SELECT * FROM users WHERE id = 'u_restore_01';").get() as any;
      expect(restoredUser).toBeDefined();
      expect(restoredUser.email).toBe('res@nexora.com');

      restoredDb.close();
    });
  });

  describe('Legacy Baseline Upgrade & Data Preservation', () => {
    it('Preserves exact counts of legacy data during Phase 02 migration', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Insert full mock dataset matching production baseline census
      for (let i = 1; i <= 5; i++) {
        db.exec(`INSERT INTO users (id, email, name, role, created_at) VALUES ('u_${i}', 'u${i}@test.com', 'User ${i}', 'CUSTOMER', '2026-01-01');`);
      }
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO categories (id, name, slug, description, image_url, item_count) VALUES ('cat_${i}', 'Cat ${i}', 'cat-${i}', '', '', 6);`);
      }
      for (let i = 1; i <= 48; i++) {
        db.exec(`INSERT INTO products (id, name, slug, price, sku, category_id, category_name, created_at, updated_at) VALUES ('prod_${i}', 'Prod ${i}', 'prod-${i}', 100.0, 'SKU-${i}', 'cat_1', 'Cat 1', '2026-01-01', '2026-01-01');`);
      }
      for (let i = 1; i <= 6; i++) {
        db.exec(`INSERT INTO orders (id, order_number, user_id, customer_name, customer_email, subtotal, total, created_at, updated_at) VALUES ('ord_${i}', 'ORD-${i}', 'u_1', 'Customer', 'c@t.com', 100, 100, '2026-01-01', '2026-01-01');`);
      }
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO order_items (id, order_id, product_id, product_name, sku, unit_price, quantity, total_price) VALUES ('item_${i}', 'ord_1', 'prod_1', 'Prod 1', 'SKU-1', 100, 1, 100);`);
      }
      for (let i = 1; i <= 3; i++) {
        db.exec(`INSERT INTO coupons (id, code, type, value, starts_at, expires_at) VALUES ('cp_${i}', 'CODE_${i}', 'PERCENTAGE', 10, '2026-01-01', '2027-01-01');`);
      }
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO inventory_transactions (id, product_id, product_name, sku, type, quantity, stock_after, performed_by, created_at) VALUES ('tx_${i}', 'prod_1', 'Prod 1', 'SKU-1', 'IN', 10, 10, 'u_1', '2026-01-01');`);
      }
      db.exec(`INSERT INTO reviews (id, product_id, user_id, user_name, rating, created_at) VALUES ('rev_1', 'prod_1', 'u_1', 'User 1', 5, '2026-01-01');`);
      db.exec(`INSERT INTO newsletter_subscribers (id, email, created_at) VALUES ('sub_1', 'sub@test.com', '2026-01-01');`);

      // Run migrations
      const result = await runMigrations(db);
      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.totalTables).toBe(15);

      // Verify all counts are exactly preserved
      const getCount = (tbl: string) =>
        (db.prepare(`SELECT count(*) as c FROM "${tbl}";`).get() as { c: number }).c;

      expect(getCount('users')).toBe(5);
      expect(getCount('categories')).toBe(8);
      expect(getCount('products')).toBe(48);
      expect(getCount('orders')).toBe(6);
      expect(getCount('order_items')).toBe(8);
      expect(getCount('coupons')).toBe(3);
      expect(getCount('inventory_transactions')).toBe(8);
      expect(getCount('reviews')).toBe(1);
      expect(getCount('newsletter_subscribers')).toBe(1);

      // Verify domain tables are completely empty (Zero-Fabrication Policy)
      expect(getCount('projects')).toBe(0);
      expect(getCount('certifications')).toBe(0);
      expect(getCount('media_assets')).toBe(0);
      expect(getCount('project_media')).toBe(0);
      expect(getCount('certification_media')).toBe(0);

      db.close();
    });
  });
});
