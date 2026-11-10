import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
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

    it('3. Non-empty file-backed DB whose file does not exist on disk throws MigrationBackupError', async () => {
      const db = new DatabaseSync(':memory:');
      const nonExistentPath = path.join(tempDir, 'does_not_exist.sqlite');

      await expect(createWalSafeBackup(db, nonExistentPath, 2)).rejects.toThrow(MigrationBackupError);
      db.close();
    });

    it('4. Calling createWalSafeBackup on in-memory database throws MigrationBackupError', async () => {
      const db = new DatabaseSync(':memory:');

      await expect(createWalSafeBackup(db, ':memory:', 2)).rejects.toThrow(MigrationBackupError);
      db.close();
    });

    it('5. Non-empty file-backed database cannot bypass backup via public options', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Attempt to bypass backup by passing { backup: false } as any
      const result = await runMigrations(db, { backup: false } as any);

      // Backup was NOT bypassed: backupPath must be defined and file must exist
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);

      db.close();
    });

    it('6. Failed backup removes any partial or broken backup files from disk', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');

      // Spy on fs.statSync to simulate detection of a 0-byte or corrupt backup artifact
      const origStatSync = fs.statSync;
      let simulatedFailureTriggered = false;
      const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((targetPath: fs.PathLike, options?: any) => {
        if (typeof targetPath === 'string' && (targetPath.includes('.sqlite.bak_') || targetPath.includes('.tmp_backup_'))) {
          simulatedFailureTriggered = true;
          const res = origStatSync(targetPath, options);
          return { ...res, size: 0 } as any;
        }
        return origStatSync(targetPath, options);
      });

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);
        expect(simulatedFailureTriggered).toBe(true);

        // Verify that partial/corrupted backup artifact was unlinked and does NOT remain on disk
        const files = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
        expect(files.filter((f) => f.includes('.sqlite.bak_'))).toHaveLength(0);
      } finally {
        statSpy.mockRestore();
        db.close();
      }
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
        token: crypto.randomUUID(),
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

    it('2. Confirmed dead same-host PID (ESRCH) is safely cleaned up with token and content verification', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      let deadPid = 999999;
      try {
        process.kill(deadPid, 0);
        deadPid = 999998;
      } catch {
        // Confirmed absent
      }

      const payload = {
        token: crypto.randomUUID(),
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
        token: crypto.randomUUID(),
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

    it('5. Legacy lock file without token fails closed and is never deleted automatically', async () => {
      const lockFile = `${dbPath}.migration.lock`;

      // Legacy lock payload without token
      const legacyPayload = {
        pid: 999999, // dead PID
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(legacyPayload));

      const lock = new MigrationLock(dbPath);
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // File was NOT deleted because token was missing
      expect(fs.existsSync(lockFile)).toBe(true);
      fs.unlinkSync(lockFile);
    });

    it('6. Stale Snapshot Replacement Before Claim: does NOT move or delete concurrent active lock created after snapshot', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const deadPayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: 999999,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        dbPath,
      });
      fs.writeFileSync(lockFile, deadPayload);

      const activePayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      });

      // Spy on fs.readFileSync: first read in handleExistingLockFile sees deadPayload.
      // Immediately after, simulate that Operation C replaces the lock on disk with activePayload.
      let readCount = 0;
      const origReadFileSync = fs.readFileSync;
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((targetPath: fs.PathOrFileDescriptor, options?: any) => {
        if (targetPath === lockFile) {
          readCount++;
          if (readCount === 1) {
            return deadPayload;
          }
          if (!fs.existsSync(lockFile) || origReadFileSync(lockFile, 'utf8') !== activePayload) {
            fs.writeFileSync(lockFile, activePayload);
          }
          return activePayload;
        }
        return origReadFileSync(targetPath, options);
      });

      const lock = new MigrationLock(dbPath);
      try {
        await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

        // Pre-claim verification aborted without calling renameSync!
        // Active lock C was NEVER moved or deleted!
        expect(fs.existsSync(lockFile)).toBe(true);
        expect(origReadFileSync(lockFile, 'utf8')).toBe(activePayload);
      } finally {
        readSpy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('7. New Lock Created During Reclamation: active lock created in original path is NOT replaced by restore', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const deadPayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: 999999,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        dbPath,
      });
      fs.writeFileSync(lockFile, deadPayload);

      const newActivePayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      });

      const origRenameSync = fs.renameSync;
      let simulatedRaceTriggered = false;

      const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((src: fs.PathLike, dest: fs.PathLike) => {
        origRenameSync(src, dest);
        if (typeof src === 'string' && src === lockFile && typeof dest === 'string' && dest.includes('.reclaim')) {
          simulatedRaceTriggered = true;
          // While candidate is isolated, simulate that another process creates a new active lock at lockFile!
          fs.writeFileSync(lockFile, newActivePayload);
          // And candidate file content differs so restore is triggered
          fs.writeFileSync(dest, JSON.stringify({ token: 'diff', pid: 999999, hostname: os.hostname(), acquiredAt: 'now', dbPath }));
        }
      });

      const lock = new MigrationLock(dbPath);
      try {
        await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);
        expect(simulatedRaceTriggered).toBe(true);

        // Destination already existed, so restore must NOT overwrite the new active lock!
        expect(fs.existsSync(lockFile)).toBe(true);
        expect(fs.readFileSync(lockFile, 'utf8')).toBe(newActivePayload);
      } finally {
        renameSpy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('8. Restore Destination Exists: restore operation does not overwrite existing destination file', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const activePayload = JSON.stringify({
        token: 'dest-token-active',
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath,
      });
      fs.writeFileSync(lockFile, activePayload);

      const candidatePath = `${lockFile}.reclaim_test_candidate`;
      fs.writeFileSync(candidatePath, 'candidate_bytes_to_not_overwrite');

      const lock = new MigrationLock(dbPath);
      (lock as any).safeRestoreLock(candidatePath);

      // Destination must still have activePayload, preserved untouched!
      expect(fs.existsSync(lockFile)).toBe(true);
      expect(fs.readFileSync(lockFile, 'utf8')).toBe(activePayload);
      expect(fs.existsSync(candidatePath)).toBe(false);

      fs.unlinkSync(lockFile);
    });

    it('9. Read Failure After Isolation: candidate read failure restores lock and does NOT leave path open', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const deadPayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: 999999,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        dbPath,
      });
      fs.writeFileSync(lockFile, deadPayload);

      const origReadFileSync = fs.readFileSync;
      let failureInjected = false;
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((targetPath: fs.PathOrFileDescriptor, options?: any) => {
        if (typeof targetPath === 'string' && targetPath.includes('.reclaim')) {
          failureInjected = true;
          throw new Error('Simulated I/O read failure on candidate file');
        }
        return origReadFileSync(targetPath, options);
      });

      const lock = new MigrationLock(dbPath);
      try {
        await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);
        expect(failureInjected).toBe(true);

        // Safe restore must have placed the lock back to lockFile
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        readSpy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('10. Concurrent Reclaimers: multiple concurrent reclaimers on dead lock result in exactly one acquisition', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const deadPayload = JSON.stringify({
        token: crypto.randomUUID(),
        pid: 999999,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        dbPath,
      });
      fs.writeFileSync(lockFile, deadPayload);

      const lockA = new MigrationLock(dbPath);
      const lockB = new MigrationLock(dbPath);

      const results = await Promise.allSettled([lockA.acquire(1000, 50), lockB.acquire(200, 50)]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      lockA.release();
      lockB.release();
    });

    it('11. Same PID, Different Acquisition: old lock object cannot release newer lock acquired by same process', async () => {
      const lock1 = new MigrationLock(dbPath);
      const lock2 = new MigrationLock(dbPath);

      // Instance 1 acquires lock
      await lock1.acquire(1000);
      const owner1 = (lock1 as any).readLockOwner();
      expect(owner1.pid).toBe(process.pid);
      expect(typeof owner1.token).toBe('string');

      // Instance 1 releases lock
      lock1.release();
      expect(fs.existsSync(`${dbPath}.migration.lock`)).toBe(false);

      // Instance 2 in the same process acquires lock
      await lock2.acquire(1000);
      const owner2 = (lock2 as any).readLockOwner();
      expect(owner2.pid).toBe(process.pid);
      expect(owner2.token).not.toBe(owner1.token);

      // Accidental release() on the OLD lock1 instance is attempted:
      lock1.release();

      // Lock file must STILL exist because lock1's token !== lock2's token!
      expect(fs.existsSync(`${dbPath}.migration.lock`)).toBe(true);

      // Only lock2 can release it
      lock2.release();
      expect(fs.existsSync(`${dbPath}.migration.lock`)).toBe(false);
    });

    it('12. EPERM on PID check treats lock as active and does NOT delete it', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const payload = {
        token: crypto.randomUUID(),
        pid: 12345,
        hostname: os.hostname(),
        acquiredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(payload));

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        const err: any = new Error('Operation not permitted');
        err.code = 'EPERM';
        throw err;
      });

      const lock = new MigrationLock(dbPath);
      try {
        await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        killSpy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('13. File-backed database cannot disable migration lock via options', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const externalLock = new MigrationLock(dbPath);
      await externalLock.acquire(1000);

      // Attempt to bypass lock with { lock: false } option - must still fail
      await expect(runMigrations(db, { lock: false, lockTimeoutMs: 150 } as any)).rejects.toThrow(MigrationLockError);

      externalLock.release();
      db.close();
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
      expect(fs.existsSync(backupRes.backupPath)).toBe(true);
      expect(backupRes.bytes).toBeGreaterThan(0);
      expect(backupRes.pagesCopied).toBeGreaterThan(0);
      expect(typeof backupRes.pagesCopied).toBe('number');
      expect(backupRes.fileSynced).toBe(true);
      expect(typeof backupRes.directorySynced).toBe('boolean');

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

    it('7 & 8. Pre-existing backup destination collision throws MigrationBackupError and preserves sentinel file byte-for-byte', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const fixedSalt = Buffer.from('1122334455667788', 'hex');
      const origRandomBytes = crypto.randomBytes;
      const saltSpy = vi.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
        if (size === 8) return fixedSalt;
        return origRandomBytes(size);
      });

      const fixedTime = new Date('2026-11-10T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedTime);

      const timestamp = fixedTime.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
      const collisionFilename = `nexora.sqlite.bak_${timestamp}_${fixedSalt.toString('hex')}_pre_v2.sqlite`;
      const collisionPath = path.join(backupDir, collisionFilename);

      const SENTINEL_CONTENT = 'CRITICAL_SENTINEL_BYTES_DO_NOT_DELETE_1234567890';
      fs.writeFileSync(collisionPath, SENTINEL_CONTENT);

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);

        // Sentinel file MUST still exist!
        expect(fs.existsSync(collisionPath)).toBe(true);
        // Sentinel content MUST be identical byte-for-byte (never deleted or modified)
        expect(fs.readFileSync(collisionPath, 'utf8')).toBe(SENTINEL_CONTENT);
      } finally {
        saltSpy.mockRestore();
        vi.useRealTimers();
        fs.unlinkSync(collisionPath);
        db.close();
      }
    });

    it('9. Failed backup unlinks ONLY its own artifact and does not delete unrelated backup files', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const unrelatedBackup = path.join(backupDir, 'nexora.sqlite.bak_UNRELATED_PRIOR_BACKUP.sqlite');
      fs.writeFileSync(unrelatedBackup, 'UNRELATED_VALID_PREVIOUS_BACKUP_CONTENT');

      // Inject failure on fsync
      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        throw new Error('Simulated disk I/O error during fsyncSync');
      });

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);

        // Unrelated backup file must NOT be deleted!
        expect(fs.existsSync(unrelatedBackup)).toBe(true);
        expect(fs.readFileSync(unrelatedBackup, 'utf8')).toBe('UNRELATED_VALID_PREVIOUS_BACKUP_CONTENT');

        // And no staging files linger
        const files = fs.readdirSync(backupDir);
        expect(files.filter((f) => f.startsWith('.tmp_backup_'))).toHaveLength(0);
      } finally {
        fsyncSpy.mockRestore();
        fs.unlinkSync(unrelatedBackup);
        db.close();
      }
    });

    it('10. Concurrent backup attempts use independent unique staging and do not interfere or clean up each other', async () => {
      const db1 = new DatabaseSync(dbPath);
      db1.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db1.exec(BASELINE_DDL);

      const dbPath2 = path.join(tempDir, 'test2.sqlite');
      const db2 = new DatabaseSync(dbPath2);
      db2.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db2.exec(BASELINE_DDL);

      // Run two backups concurrently
      const [bak1, bak2] = await Promise.all([
        createWalSafeBackup(db1, dbPath, 2),
        createWalSafeBackup(db2, dbPath2, 2),
      ]);

      expect(bak1.backupPath).not.toBe(bak2.backupPath);
      expect(fs.existsSync(bak1.backupPath)).toBe(true);
      expect(fs.existsSync(bak2.backupPath)).toBe(true);
      expect(bak1.fileSynced).toBe(true);
      expect(bak2.fileSynced).toBe(true);

      db1.close();
      db2.close();
    });

    it('11. File fsync failure rejects backup with MigrationBackupError and aborts migrations before modifying database', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);
      db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_fsync_fail', 'f@nexora.com', 'F', '2026-01-01');");

      let failureTriggered = false;
      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        failureTriggered = true;
        const err: any = new Error('Simulated disk controller flush failure');
        err.code = 'EIO';
        throw err;
      });

      try {
        await expect(runMigrations(db)).rejects.toThrow(MigrationBackupError);
        expect(failureTriggered).toBe(true);

        // Database was NOT modified: schema_migrations was never created!
        const checkRegistry = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';").get();
        expect(checkRegistry).toBeUndefined();

        // Projects table was never created!
        const checkProjects = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects';").get();
        expect(checkProjects).toBeUndefined();

        // Original user record remains completely intact!
        const user = db.prepare("SELECT * FROM users WHERE id = 'u_fsync_fail';").get() as any;
        expect(user).toBeDefined();
        expect(user.email).toBe('f@nexora.com');
      } finally {
        fsyncSpy.mockRestore();
        db.close();
      }
    });

    it('12 & 13. MigrationResult preserves backupFileSynced and backupDirectorySynced accurately, recording Windows limitation', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const result = await runMigrations(db);
      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.backupPath).toBeDefined();

      // Durability visibility contract:
      expect(result.backupFileSynced).toBe(true);
      expect(typeof result.backupDirectorySynced).toBe('boolean');

      // On Windows host, directory fsync is unsupported by Win32 file systems
      if (process.platform === 'win32') {
        expect(result.backupDirectorySynced).toBe(false);
      }

      db.close();
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
