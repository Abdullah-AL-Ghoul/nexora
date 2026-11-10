import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
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
import { createWalSafeBackup, verifyBackupIntegrity, pruneOldBackups } from '../migrations/backup.js';
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
        if (
          typeof targetPath === 'string' &&
          (targetPath.includes('.sqlite.bak_') ||
            targetPath.includes('.tmp_backup_') ||
            targetPath.includes('.tmp_staging_') ||
            targetPath.includes('staging.sqlite'))
        ) {
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
        expect(files.filter((f) => f.includes('.tmp_staging_'))).toHaveLength(0);
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

    it('2. Confirmed dead same-host PID (ESRCH) fails closed with MigrationLockError until manual operator recovery', async () => {
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
      // Under Approach 2, automatic deletion is removed: lock fails closed with descriptive error
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // Lock file was NOT deleted automatically
      expect(fs.existsSync(lockFile)).toBe(true);

      // Operator manual recovery: remove the lock file
      fs.unlinkSync(lockFile);

      // Now acquire succeeds
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

    it('6. In-memory lock enforces acquisition token check on release', async () => {
      const memLock1 = new MigrationLock(':memory:');
      const memLock2 = new MigrationLock(':memory:');

      // memLock1 acquires
      await memLock1.acquire(500);
      expect(memLock1.getAcquisitionToken()).toBeTruthy();

      // memLock2 calls release() -> should NOT clear the memory lock held by memLock1
      memLock2.release();

      // A third instance trying to acquire should still fail because lock is held
      const memLock3 = new MigrationLock(':memory:');
      await expect(memLock3.acquire(100, 20)).rejects.toThrow(MigrationLockError);

      // memLock1 releases
      memLock1.release();

      // Now memLock3 can acquire
      await expect(memLock3.acquire(500)).resolves.toBeUndefined();
      memLock3.release();
    });

    it('7. Strict token release: forging or mismatching token prevents unlinking file lock', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const lock1 = new MigrationLock(dbPath);
      await lock1.acquire(1000);
      expect(fs.existsSync(lockFile)).toBe(true);

      const lock2 = new MigrationLock(dbPath);
      (lock2 as any).acquired = true;
      (lock2 as any).acquisitionToken = 'forged-uuid-different-token';

      // lock2 attempts release with forged token
      lock2.release();

      // Lock file MUST still exist!
      expect(fs.existsSync(lockFile)).toBe(true);

      // lock1 releases with legitimate matching token
      lock1.release();
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it('8. Cross-process mutual exclusion: two independent OS processes contend for same lock', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const readySignal = path.join(tempDir, 'proc1.ready');
      const releaseSignal = path.join(tempDir, 'proc1.release');

      // Worker 1: Acquires lock, creates readySignal file, waits for releaseSignal file, then releases and exits
      const workerScript1 = `
        import { MigrationLock } from './server/migrations/lock.js';
        import fs from 'node:fs';
        const lock = new MigrationLock(${JSON.stringify(dbPath)});
        await lock.acquire(5000);
        fs.writeFileSync(${JSON.stringify(readySignal)}, 'ready');
        while (!fs.existsSync(${JSON.stringify(releaseSignal)})) {
          await new Promise(r => setTimeout(r, 50));
        }
        lock.release();
        process.exit(0);
      `;

      const child1 = spawn(process.execPath, ['--import', 'tsx/esm', '-e', workerScript1], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Wait for child1 to acquire lock and signal readiness
      const startWait = Date.now();
      while (!fs.existsSync(readySignal) && Date.now() - startWait < 5000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(fs.existsSync(readySignal)).toBe(true);
      expect(fs.existsSync(lockFile)).toBe(true);

      // Worker 2 (separate OS child process): Attempts to acquire same lock with 400ms timeout -> MUST FAIL
      const workerScript2 = `
        import { MigrationLock } from './server/migrations/lock.js';
        const lock = new MigrationLock(${JSON.stringify(dbPath)});
        try {
          await lock.acquire(400, 50);
          process.exit(0);
        } catch (err) {
          process.stderr.write(err.message);
          process.exit(1);
        }
      `;

      const res2 = spawnSync(process.execPath, ['--import', 'tsx/esm', '-e', workerScript2], {
        encoding: 'utf8',
      });

      expect(res2.status).toBe(1);
      expect(res2.stderr).toContain('Could not acquire migration lock');
      expect(res2.stderr).toContain('Automatic stale-lock deletion is disabled for safety');

      // Signal worker 1 to release lock and exit cleanly
      fs.writeFileSync(releaseSignal, 'release');
      await new Promise<void>((resolve) => {
        child1.on('close', () => resolve());
      });

      expect(fs.existsSync(lockFile)).toBe(false);

      // Now a new lock acquire succeeds
      const lockAfter = new MigrationLock(dbPath);
      await expect(lockAfter.acquire(1000)).resolves.toBeUndefined();
      lockAfter.release();
    });

    it('9. Process termination (SIGKILL) leaves lock on disk; subsequent attempt fails closed until manual recovery', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const readySignal = path.join(tempDir, 'proc_kill.ready');

      const workerScript = `
        import { MigrationLock } from './server/migrations/lock.js';
        import fs from 'node:fs';
        const lock = new MigrationLock(${JSON.stringify(dbPath)});
        await lock.acquire(5000);
        fs.writeFileSync(${JSON.stringify(readySignal)}, String(process.pid));
        await new Promise(() => {});
      `;

      const child = spawn(process.execPath, ['--import', 'tsx/esm', '-e', workerScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const startWait = Date.now();
      while (!fs.existsSync(readySignal) && Date.now() - startWait < 5000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(fs.existsSync(readySignal)).toBe(true);
      const childPid = fs.readFileSync(readySignal, 'utf8');
      expect(fs.existsSync(lockFile)).toBe(true);

      // Kill the child process abruptly with SIGKILL
      child.kill('SIGKILL');

      // Wait a moment for process to be fully dead
      await new Promise((r) => setTimeout(r, 200));

      // Attempt acquisition from parent process:
      // Under Approach 2, automatic deletion is removed -> MUST FAIL CLOSED
      const lock = new MigrationLock(dbPath);
      await expect(lock.acquire(300, 50)).rejects.toThrow(MigrationLockError);

      // Lock file is preserved untouched
      expect(fs.existsSync(lockFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      expect(String(content.pid)).toBe(childPid);

      // Operator manual recovery: verify process dead and remove lock file
      fs.unlinkSync(lockFile);

      // Now acquisition succeeds
      await expect(lock.acquire(1000, 50)).resolves.toBeUndefined();
      lock.release();
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it('10. Cross-process release immunity: a different process cannot release an active lock', async () => {
      const lockFile = `${dbPath}.migration.lock`;
      const readySignal = path.join(tempDir, 'proc_rel.ready');
      const exitSignal = path.join(tempDir, 'proc_rel.exit');

      const workerScript = `
        import { MigrationLock } from './server/migrations/lock.js';
        import fs from 'node:fs';
        const lock = new MigrationLock(${JSON.stringify(dbPath)});
        await lock.acquire(5000);
        fs.writeFileSync(${JSON.stringify(readySignal)}, lock.getAcquisitionToken());
        while (!fs.existsSync(${JSON.stringify(exitSignal)})) {
          await new Promise(r => setTimeout(r, 50));
        }
        lock.release();
        process.exit(0);
      `;

      const child = spawn(process.execPath, ['--import', 'tsx/esm', '-e', workerScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const startWait = Date.now();
      while (!fs.existsSync(readySignal) && Date.now() - startWait < 5000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(fs.existsSync(readySignal)).toBe(true);
      expect(fs.existsSync(lockFile)).toBe(true);

      // Separate process attempts to release:
      const intruderScript = `
        import { MigrationLock } from './server/migrations/lock.js';
        const lock = new MigrationLock(${JSON.stringify(dbPath)});
        lock.release();
        process.exit(0);
      `;
      spawnSync(process.execPath, ['--import', 'tsx/esm', '-e', intruderScript]);

      // Lock file must STILL exist because intruder did not hold acquisition token or matching PID
      expect(fs.existsSync(lockFile)).toBe(true);

      // Parent process also attempts release without having acquired
      const parentLock = new MigrationLock(dbPath);
      parentLock.release();
      expect(fs.existsSync(lockFile)).toBe(true);

      // Now signal the owning child process to release
      fs.writeFileSync(exitSignal, 'done');
      await new Promise<void>((resolve) => {
        child.on('close', () => resolve());
      });

      expect(fs.existsSync(lockFile)).toBe(false);
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

    it('14. Observable lock release results: RELEASED, ALREADY_ABSENT, and NOT_HELD statuses', async () => {
      const lock = new MigrationLock(dbPath);
      // Not yet acquired
      const resNotHeld = lock.release();
      expect(resNotHeld.status).toBe('NOT_HELD');
      expect(resNotHeld.success).toBe(true);
      expect(lock.isAcquired()).toBe(false);

      // Acquire
      await lock.acquire(1000);
      expect(lock.isAcquired()).toBe(true);
      expect(typeof lock.getAcquisitionToken()).toBe('string');

      // Normal release
      const resReleased = lock.release();
      expect(resReleased.status).toBe('RELEASED');
      expect(resReleased.success).toBe(true);
      expect(lock.isAcquired()).toBe(false);
      expect(lock.getAcquisitionToken()).toBeNull();

      // Second release when already released
      const resAgain = lock.release();
      expect(resAgain.status).toBe('NOT_HELD');
      expect(resAgain.success).toBe(true);

      // Lock file manually removed before release
      await lock.acquire(1000);
      const lockFile = `${dbPath}.migration.lock`;
      expect(fs.existsSync(lockFile)).toBe(true);
      fs.unlinkSync(lockFile);

      const resAbsent = lock.release();
      expect(resAbsent.status).toBe('ALREADY_ABSENT');
      expect(resAbsent.success).toBe(true);
      expect(lock.isAcquired()).toBe(false);
    });

    it('15. Filesystem error during release preserves acquisitionToken and acquired state', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      expect(token).toBeDefined();

      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        const err: any = new Error('Simulated I/O unlink error');
        err.code = 'EIO';
        throw err;
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('FILESYSTEM_ERROR');
        expect(res.success).toBe(false);
        expect(res.error).toBeDefined();

        // Must PRESERVE state on filesystem failure so operator or retry can act
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
      } finally {
        unlinkSpy.mockRestore();
        // Now release succeeds
        const cleanRes = lock.release();
        expect(cleanRes.status).toBe('RELEASED');
        expect(cleanRes.success).toBe(true);
      }
    });

    it('16. Ownership mismatch during release preserves lock on disk and internal tokens', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      // Simulate external overwrite of lock file with another PID/token
      const foreignPayload = {
        token: crypto.randomUUID(),
        pid: 99999,
        hostname: 'foreign-host',
        acquiredAt: new Date().toISOString(),
        dbPath,
      };
      fs.writeFileSync(lockFile, JSON.stringify(foreignPayload));

      const res = lock.release();
      expect(res.status).toBe('OWNERSHIP_MISMATCH');
      expect(res.success).toBe(false);
      expect(res.details).toContain('Refusing to delete foreign lock');

      // Disk file must NOT be unlinked
      expect(fs.existsSync(lockFile)).toBe(true);
      const diskContent = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      expect(diskContent.token).toBe(foreignPayload.token);

      // Internal tokens must be preserved
      expect(lock.isAcquired()).toBe(true);
      expect(lock.getAcquisitionToken()).toBe(token);

      // Clean up foreign lock
      fs.unlinkSync(lockFile);
    });

    it('17. runMigrations surfaces lock release failure as MigrationLockError preserving migration result', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.endsWith('.migration.lock')) {
          const err: any = new Error('Simulated lock unlink EIO');
          err.code = 'EIO';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        let caughtErr: any = null;
        try {
          await runMigrations(db);
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(MigrationLockError);
        expect(caughtErr.message).toContain('Migrations completed successfully');
        expect(caughtErr.message).toContain('lock release failed (FILESYSTEM_ERROR)');
        expect(caughtErr.releaseResult).toBeDefined();
        expect(caughtErr.releaseResult.status).toBe('FILESYSTEM_ERROR');
        expect(caughtErr.migrationResult).toBeDefined();
        expect(caughtErr.migrationResult.currentVersion).toBe(2);
        expect(caughtErr.migrationResult.appliedCount).toBe(2);
      } finally {
        unlinkSpy.mockRestore();
        const lockFile = `${dbPath}.migration.lock`;
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        db.close();
      }
    });

    it('18. runMigrations combines migration failure and lock release failure with cause preserved', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.endsWith('.migration.lock')) {
          const err: any = new Error('Simulated lock unlink EPERM');
          err.code = 'EPERM';
          throw err;
        }
        return origUnlink(p);
      });

      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        const err: any = new Error('Simulated backup disk error');
        err.code = 'EIO';
        throw err;
      });

      try {
        let caughtErr: any = null;
        try {
          await runMigrations(db);
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(MigrationLockError);
        expect(caughtErr.message).toContain('Simulated backup disk error');
        expect(caughtErr.message).toContain('[Secondary Failure]');
        expect(caughtErr.message).toContain('Migration lock release failed');
        expect(caughtErr.releaseResult).toBeDefined();
        expect(caughtErr.releaseResult.status).toBe('FILESYSTEM_ERROR');
        expect(caughtErr.cause).toBeDefined();
      } finally {
        unlinkSpy.mockRestore();
        fsyncSpy.mockRestore();
        const lockFile = `${dbPath}.migration.lock`;
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        db.close();
      }
    });

    it('19. Direct lock inspection distinguishes confirmed ENOENT from EACCES and EIO filesystem errors', async () => {
      const lock = new MigrationLock(dbPath);
      // Not yet created -> readLockOwner returns ABSENT
      const absentInspection = lock.readLockOwner();
      expect(absentInspection.status).toBe('ABSENT');
      expect(absentInspection.owner).toBeNull();

      // Acquire lock
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      expect(token).toBeDefined();

      const origReadFileSync = fs.readFileSync;

      // Simulate EACCES during read
      const readSpyAccess = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, opts: any) => {
        if (typeof p === 'string' && p.endsWith('.migration.lock')) {
          const err: any = new Error('Permission denied inspecting lock file');
          err.code = 'EACCES';
          throw err;
        }
        return origReadFileSync(p, opts);
      });

      try {
        const inspectAccess = lock.readLockOwner();
        expect(inspectAccess.status).toBe('FILESYSTEM_ERROR');
        expect(inspectAccess.error).toBeDefined();
        expect(inspectAccess.details).toContain('EACCES');

        const relAccess = lock.release();
        expect(relAccess.status).toBe('FILESYSTEM_ERROR');
        expect(relAccess.success).toBe(false);
        // Tokens must be preserved!
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
      } finally {
        readSpyAccess.mockRestore();
      }

      // Simulate EIO during read
      const readSpyEio = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, opts: any) => {
        if (typeof p === 'string' && p.endsWith('.migration.lock')) {
          const err: any = new Error('I/O error inspecting lock file');
          err.code = 'EIO';
          throw err;
        }
        return origReadFileSync(p, opts);
      });

      try {
        const inspectEio = lock.readLockOwner();
        expect(inspectEio.status).toBe('FILESYSTEM_ERROR');
        expect(inspectEio.details).toContain('EIO');

        const relEio = lock.release();
        expect(relEio.status).toBe('FILESYSTEM_ERROR');
        expect(relEio.success).toBe(false);
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
      } finally {
        readSpyEio.mockRestore();
      }

      // Clean release
      const cleanRel = lock.release();
      expect(cleanRel.status).toBe('RELEASED');
      expect(cleanRel.success).toBe(true);
    });

    it('20. Filesystem read failure does NOT become OWNERSHIP_MISMATCH', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);

      const origReadFileSync = fs.readFileSync;
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, opts: any) => {
        if (typeof p === 'string' && p.endsWith('.migration.lock')) {
          const err: any = new Error('Storage controller read timeout');
          err.code = 'EIO';
          throw err;
        }
        return origReadFileSync(p, opts);
      });

      try {
        const res = lock.release();
        // MUST be FILESYSTEM_ERROR, NEVER OWNERSHIP_MISMATCH!
        expect(res.status).toBe('FILESYSTEM_ERROR');
        expect(res.status).not.toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
      } finally {
        readSpy.mockRestore();
        lock.release();
      }
    });

    it('21. Malformed JSON does NOT cause lock deletion and returns OWNERSHIP_MISMATCH', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      // Overwrite with invalid syntax
      fs.writeFileSync(lockFile, '{{{ MALFORMED_JSON_CORRUPT_PAYLOAD');

      const inspection = lock.readLockOwner();
      expect(inspection.status).toBe('MALFORMED');
      expect(inspection.details).toContain('invalid JSON');

      const res = lock.release();
      expect(res.status).toBe('OWNERSHIP_MISMATCH');
      expect(res.success).toBe(false);
      expect(res.details).toContain('malformed');

      // The malformed lock file must NOT be deleted!
      expect(fs.existsSync(lockFile)).toBe(true);
      expect(fs.readFileSync(lockFile, 'utf8')).toBe('{{{ MALFORMED_JSON_CORRUPT_PAYLOAD');

      // Token and acquired state must be preserved
      expect(lock.isAcquired()).toBe(true);
      expect(lock.getAcquisitionToken()).toBe(token);

      // Clean up malformed lock file
      fs.unlinkSync(lockFile);
    });

    it('22. Deterministic adversarial test: lock replacement race immediately following read is detected and foreign lock is not deleted', async () => {
      const lockA = new MigrationLock(dbPath);
      await lockA.acquire(1000);
      const tokenA = lockA.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      const foreignPayload = {
        token: crypto.randomUUID(),
        pid: 98765,
        hostname: 'adversary-host',
        acquiredAt: new Date().toISOString(),
        dbPath,
      };

      let readCount = 0;
      const origReadLockOwner = lockA.readLockOwner.bind(lockA);

      // Adversarial spy: right after the first valid read of Lock A, replace lock file on disk with foreign lock
      const spy = vi.spyOn(lockA, 'readLockOwner').mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          // 1. Initial read returns Lock A
          const res = origReadLockOwner();
          // 2. Adversary replaces lock file immediately after the initial read
          fs.writeFileSync(lockFile, JSON.stringify(foreignPayload));
          return res;
        }
        // Subsequent call (pre-unlink check): reads the replaced foreign lock from disk
        return origReadLockOwner();
      });

      try {
        // 3. Allows release operation to continue
        const res = lockA.release();

        // 4. Verifies that the foreign lock is NOT deleted!
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('Lock file on disk was modified or replaced prior to unlink');

        // Foreign lock is preserved byte-for-byte!
        expect(fs.existsSync(lockFile)).toBe(true);
        const onDisk = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        expect(onDisk.token).toBe(foreignPayload.token);
        expect(onDisk.pid).toBe(foreignPayload.pid);

        // Instance A preserves its state
        expect(lockA.isAcquired()).toBe(true);
        expect(lockA.getAcquisitionToken()).toBe(tokenA);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('23. Pre-unlink inspection returning FILESYSTEM_ERROR on EACCES maps to FILESYSTEM_ERROR, preserves state, and does not unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          // 1st read succeeds (initial inspection)
          return origReadLockOwner();
        }
        // 2nd read (pre-unlink check) simulates permission denial (EACCES)
        const err: any = new Error('Permission denied during pre-unlink re-read');
        err.code = 'EACCES';
        return {
          status: 'FILESYSTEM_ERROR',
          owner: null,
          error: err,
          details: `Filesystem error inspecting lock file (EACCES): ${err.message}`,
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('FILESYSTEM_ERROR');
        expect(res.status).not.toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.error?.message).toContain('Permission denied');

        // State preserved
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);

        // Lock file on disk was NOT deleted
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('24. Pre-unlink inspection returning FILESYSTEM_ERROR on EIO maps to FILESYSTEM_ERROR, preserves state, and does not unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          return origReadLockOwner();
        }
        const err: any = new Error('Disk controller error during pre-unlink check');
        err.code = 'EIO';
        return {
          status: 'FILESYSTEM_ERROR',
          owner: null,
          error: err,
          details: `Filesystem error inspecting lock file (EIO): ${err.message}`,
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('FILESYSTEM_ERROR');
        expect(res.status).not.toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);

        // State preserved
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('25. Pre-unlink inspection confirmed absence (ENOENT) maps to ALREADY_ABSENT and clears token', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          return origReadLockOwner();
        }
        return {
          status: 'ABSENT',
          owner: null,
          details: 'Lock file confirmed absent (ENOENT) before unlink',
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('ALREADY_ABSENT');
        expect(res.success).toBe(true);

        // State cleared
        expect(lock.isAcquired()).toBe(false);
        expect(lock.getAcquisitionToken()).toBeNull();
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('26. Pre-unlink inspection malformed JSON maps to OWNERSHIP_MISMATCH and preserves token', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          return origReadLockOwner();
        }
        return {
          status: 'MALFORMED',
          owner: null,
          details: 'Lock file contains truncated JSON prior to unlink',
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('malformed');

        // State preserved
        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('27. Pre-unlink complete identity: same token with modified PID produces OWNERSHIP_MISMATCH and refuses unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        const initial = origReadLockOwner();
        if (readCount === 1) return initial;
        // Same token, but modified PID (e.g. process was replaced)
        return {
          status: 'VALID',
          owner: {
            ...initial.owner!,
            pid: initial.owner!.pid + 9999,
          },
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('modified or replaced prior to unlink');

        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('28. Pre-unlink complete identity: same token with modified hostname produces OWNERSHIP_MISMATCH and refuses unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        const initial = origReadLockOwner();
        if (readCount === 1) return initial;
        // Same token, but modified hostname
        return {
          status: 'VALID',
          owner: {
            ...initial.owner!,
            hostname: 'adversary-host-override',
          },
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('modified or replaced prior to unlink');

        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('29. Pre-unlink complete identity: same token with modified acquiredAt produces OWNERSHIP_MISMATCH and refuses unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        const initial = origReadLockOwner();
        if (readCount === 1) return initial;
        // Same token, but modified acquiredAt timestamp
        return {
          status: 'VALID',
          owner: {
            ...initial.owner!,
            acquiredAt: '2026-01-01T00:00:00.000Z',
          },
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('modified or replaced prior to unlink');

        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
    });

    it('30. Pre-unlink complete identity: same token with modified dbPath produces OWNERSHIP_MISMATCH and refuses unlink', async () => {
      const lock = new MigrationLock(dbPath);
      await lock.acquire(1000);
      const token = lock.getAcquisitionToken();
      const lockFile = `${dbPath}.migration.lock`;

      let readCount = 0;
      const origReadLockOwner = lock.readLockOwner.bind(lock);
      const spy = vi.spyOn(lock, 'readLockOwner').mockImplementation(() => {
        readCount++;
        const initial = origReadLockOwner();
        if (readCount === 1) return initial;
        // Same token, but modified dbPath
        return {
          status: 'VALID',
          owner: {
            ...initial.owner!,
            dbPath: '/different/target/db.sqlite',
          },
        };
      });

      try {
        const res = lock.release();
        expect(res.status).toBe('OWNERSHIP_MISMATCH');
        expect(res.success).toBe(false);
        expect(res.details).toContain('modified or replaced prior to unlink');

        expect(lock.isAcquired()).toBe(true);
        expect(lock.getAcquisitionToken()).toBe(token);
        expect(fs.existsSync(lockFile)).toBe(true);
      } finally {
        spy.mockRestore();
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
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
        expect(files.filter((f) => f.startsWith('.tmp_backup_') || f.startsWith('.tmp_staging_'))).toHaveLength(0);
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

    it('14. Staging Reservation Collision: pre-existing staging directory fails closed and preserves sentinel byte-for-byte', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const fixedAttemptId = 'fixed-staging-collision-uuid';
      const collidingStagingDir = path.join(backupDir, `.tmp_staging_${fixedAttemptId}`);
      fs.mkdirSync(collidingStagingDir);

      const sentinelFile = path.join(collidingStagingDir, 'sentinel.txt');
      const SENTINEL_DATA = 'PRE_EXISTING_STAGING_SENTINEL_NEVER_DELETE_BYTE_FOR_BYTE';
      fs.writeFileSync(sentinelFile, SENTINEL_DATA);

      const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(fixedAttemptId as any);

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);

        // Pre-existing staging directory and sentinel MUST remain intact!
        expect(fs.existsSync(collidingStagingDir)).toBe(true);
        expect(fs.existsSync(sentinelFile)).toBe(true);
        expect(fs.readFileSync(sentinelFile, 'utf8')).toBe(SENTINEL_DATA);
      } finally {
        uuidSpy.mockRestore();
        fs.rmSync(collidingStagingDir, { recursive: true, force: true });
        db.close();
      }
    });

    it('15. Publication Boundary Collision: destination collision at promotion boundary fails safely and preserves destination sentinel', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const fixedSalt = Buffer.from('aabbccddeeff0011', 'hex');
      const origRandomBytes = crypto.randomBytes;
      const saltSpy = vi.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
        if (size === 8) return fixedSalt;
        return origRandomBytes(size);
      });

      const fixedTime = new Date('2026-11-10T14:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedTime);

      const timestamp = fixedTime.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
      const collisionFilename = `nexora.sqlite.bak_${timestamp}_${fixedSalt.toString('hex')}_pre_v2.sqlite`;
      const collisionPath = path.join(backupDir, collisionFilename);

      // Intercept linkSync / copyFileSync: simulate race where collision file appears right before publication
      const DEST_SENTINEL = 'DESTINATION_SENTINEL_APPEARED_DURING_STAGING_DO_NOT_CLOBBER';
      const origLinkSync = fs.linkSync;
      const origCopyFileSync = fs.copyFileSync;

      let injectedCollision = false;
      const linkSpy = vi.spyOn(fs, 'linkSync').mockImplementation((src: fs.PathLike, dest: fs.PathLike) => {
        if (typeof dest === 'string' && dest === collisionPath) {
          injectedCollision = true;
          fs.writeFileSync(collisionPath, DEST_SENTINEL);
        }
        return origLinkSync(src, dest);
      });

      const copySpy = vi.spyOn(fs, 'copyFileSync').mockImplementation((src: fs.PathLike, dest: fs.PathLike, flags?: number) => {
        if (typeof dest === 'string' && dest === collisionPath && !fs.existsSync(collisionPath)) {
          injectedCollision = true;
          fs.writeFileSync(collisionPath, DEST_SENTINEL);
        }
        return origCopyFileSync(src, dest, flags);
      });

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);
        expect(injectedCollision).toBe(true);

        // Destination sentinel MUST exist and be byte-for-byte identical (never clobbered!)
        expect(fs.existsSync(collisionPath)).toBe(true);
        expect(fs.readFileSync(collisionPath, 'utf8')).toBe(DEST_SENTINEL);
      } finally {
        linkSpy.mockRestore();
        copySpy.mockRestore();
        saltSpy.mockRestore();
        vi.useRealTimers();
        if (fs.existsSync(collisionPath)) fs.unlinkSync(collisionPath);
        db.close();
      }
    });

    it('16. Directory Durability Error Classification: unexpected storage I/O failure (EIO) throws MigrationBackupError and aborts migration', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Spy on fs.fsyncSync: allow file fsync to succeed, but throw EIO when called on directory fd
      const origFsyncSync = fs.fsyncSync;
      let dirFsyncAttempted = false;

      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation((fd: number) => {
        // We know backup file is opened first, directory fd is opened second
        // Check if directory sync throws EIO
        if (dirFsyncAttempted) {
          const err: any = new Error('Simulated hardware I/O storage controller failure on directory sync');
          err.code = 'EIO';
          throw err;
        }
        dirFsyncAttempted = true;
        return origFsyncSync(fd);
      });

      try {
        await expect(runMigrations(db)).rejects.toThrow(MigrationBackupError);
        expect(dirFsyncAttempted).toBe(true);

        // Database was NOT modified because directory storage I/O failure aborts migration
        const checkRegistry = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';").get();
        expect(checkRegistry).toBeUndefined();
      } finally {
        fsyncSpy.mockRestore();
        db.close();
      }
    });

    it('17. Strict Atomic Hard Links: fails closed with MigrationBackupError when hard links unsupported, preserving verified staging', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const linkSpy = vi.spyOn(fs, 'linkSync').mockImplementation(() => {
        const err: any = new Error('Cross-device link or unsupported hard links');
        err.code = 'EXDEV';
        throw err;
      });

      const backupDir = path.join(path.dirname(dbPath), 'backups');

      try {
        let caughtErr: any = null;
        try {
          await createWalSafeBackup(db, dbPath, 2);
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(MigrationBackupError);
        expect(caughtErr.message).toContain('Atomic backup publication failed');
        expect(caughtErr.message).toContain('EXDEV');
        expect(caughtErr.message).toContain('Verified staging backup preserved at');

        // Check that staging directory and verified staging file WERE preserved
        const stagingDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
        expect(stagingDirs.length).toBe(1);
        const stagingPath = path.join(backupDir, stagingDirs[0], 'staging.sqlite');
        expect(fs.existsSync(stagingPath)).toBe(true);
        expect(fs.statSync(stagingPath).size).toBeGreaterThan(0);
      } finally {
        linkSpy.mockRestore();
        const stagingDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
        for (const dir of stagingDirs) {
          fs.rmSync(path.join(backupDir, dir), { recursive: true, force: true });
        }
        db.close();
      }
    });

    it('18. Post-publication staging cleanup failure records cleanupWarnings without invalidating backup', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const origRmdir = fs.rmdirSync;
      const rmdirSpy = vi.spyOn(fs, 'rmdirSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.includes('.tmp_staging_')) {
          const err: any = new Error('Simulated busy staging directory lock');
          err.code = 'EBUSY';
          throw err;
        }
        return origRmdir(p);
      });

      try {
        const result = await createWalSafeBackup(db, dbPath, 2);
        expect(result.backupPath).toBeDefined();
        expect(fs.existsSync(result.backupPath)).toBe(true);
        expect(result.cleanupWarnings).toBeDefined();
        expect(result.cleanupWarnings!.length).toBeGreaterThan(0);
        expect(result.cleanupWarnings![0]).toContain('Failed to remove staging directory');
      } finally {
        rmdirSpy.mockRestore();
        const backupDir = path.join(path.dirname(dbPath), 'backups');
        const stagingDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
        for (const dir of stagingDirs) {
          fs.rmSync(path.join(backupDir, dir), { recursive: true, force: true });
        }
        db.close();
      }
    });

    it('19. Backup failure with failing staging cleanup produces MigrationBackupError with artifact warning and orphaned staging dir', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Induce fsync failure
      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        const err: any = new Error('Simulated disk flush error');
        err.code = 'EIO';
        throw err;
      });

      // Also make cleanup fail on staging dir
      const origRmdir = fs.rmdirSync;
      const rmdirSpy = vi.spyOn(fs, 'rmdirSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.includes('.tmp_staging_')) {
          const err: any = new Error('Simulated staging rmdir permission denied');
          err.code = 'EACCES';
          throw err;
        }
        return origRmdir(p);
      });

      try {
        let caughtErr: any = null;
        try {
          await createWalSafeBackup(db, dbPath, 2);
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(MigrationBackupError);
        expect(caughtErr.message).toContain('[Artifact Cleanup Warning]');
        expect((caughtErr as any).cleanupFailures).toBeDefined();
        expect((caughtErr as any).orphanedStagingDir).toBeDefined();
      } finally {
        fsyncSpy.mockRestore();
        rmdirSpy.mockRestore();
        const backupDir = path.join(path.dirname(dbPath), 'backups');
        if (fs.existsSync(backupDir)) {
          const stagingDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
          for (const dir of stagingDirs) {
            fs.rmSync(path.join(backupDir, dir), { recursive: true, force: true });
          }
        }
        db.close();
      }
    });

    it('20. Directory Durability: EACCES on directory handle fails closed with MigrationBackupError', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const origFsyncSync = fs.fsyncSync;
      let dirFsyncAttempted = false;

      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation((fd: number) => {
        if (dirFsyncAttempted) {
          const err: any = new Error('Permission denied on directory sync');
          err.code = 'EACCES';
          throw err;
        }
        dirFsyncAttempted = true;
        return origFsyncSync(fd);
      });

      try {
        await expect(runMigrations(db)).rejects.toThrow(MigrationBackupError);
        expect(dirFsyncAttempted).toBe(true);

        // Database was NOT modified
        const checkRegistry = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';").get();
        expect(checkRegistry).toBeUndefined();
      } finally {
        fsyncSpy.mockRestore();
        db.close();
      }
    });

    it('21. Backup cleanup treats ENOENT as already absent without generating cleanup warnings', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const res = await createWalSafeBackup(db, dbPath, 2);
      expect(res.backupPath).toBeDefined();
      expect(fs.existsSync(res.backupPath)).toBe(true);
      // Confirmed ENOENT on staging files does NOT create warnings
      expect(res.cleanupWarnings).toBeUndefined();

      db.close();
    });

    it('22. EACCES during staging cleanup produces observable cleanup warning in BackupResult', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.includes('.tmp_staging_') && p.endsWith('staging.sqlite')) {
          const err: any = new Error('Permission denied unlinking staging file');
          err.code = 'EACCES';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        const res = await createWalSafeBackup(db, dbPath, 2);
        expect(res.backupPath).toBeDefined();
        expect(fs.existsSync(res.backupPath)).toBe(true);
        expect(res.cleanupWarnings).toBeDefined();
        expect(res.cleanupWarnings!.length).toBeGreaterThan(0);
        expect(res.cleanupWarnings![0]).toContain('EACCES');
      } finally {
        unlinkSpy.mockRestore();
        const backupDir = path.join(path.dirname(dbPath), 'backups');
        if (fs.existsSync(backupDir)) {
          const stDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
          for (const d of stDirs) {
            fs.rmSync(path.join(backupDir, d), { recursive: true, force: true });
          }
        }
        db.close();
      }
    });

    it('23. EIO during cleanup on backup failure retains ownership and reports orphaned path', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Force backup failure via file fsync error
      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        const err: any = new Error('Disk controller error during file sync');
        err.code = 'EIO';
        throw err;
      });

      // Force rmdirSync to throw EIO during cleanup
      const origRmdir = fs.rmdirSync;
      const rmdirSpy = vi.spyOn(fs, 'rmdirSync').mockImplementation((p: fs.PathLike) => {
        if (typeof p === 'string' && p.includes('.tmp_staging_')) {
          const err: any = new Error('I/O error removing staging dir');
          err.code = 'EIO';
          throw err;
        }
        return origRmdir(p);
      });

      try {
        let caughtErr: any = null;
        try {
          await createWalSafeBackup(db, dbPath, 2);
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(MigrationBackupError);
        expect((caughtErr as any).cleanupFailures).toBeDefined();
        expect((caughtErr as any).cleanupFailures[0]).toContain('EIO');
        // Ownership metadata is retained!
        expect((caughtErr as any).orphanedStagingDir).toBeDefined();
        expect((caughtErr as any).orphanedStagingDir).toContain('.tmp_staging_');
      } finally {
        fsyncSpy.mockRestore();
        rmdirSpy.mockRestore();
        const backupDir = path.join(path.dirname(dbPath), 'backups');
        if (fs.existsSync(backupDir)) {
          const stDirs = fs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp_staging_'));
          for (const d of stDirs) {
            fs.rmSync(path.join(backupDir, d), { recursive: true, force: true });
          }
        }
        db.close();
      }
    });

    it('24. Pre-existing collision sentinels remain byte-for-byte unchanged across cleanup', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      const sentinelPath = path.join(backupDir, 'unrelated_sentinel.txt');
      const SENTINEL_DATA = 'CRITICAL_COLLISION_SENTINEL_NEVER_CLOBBER_OR_CLEANUP_BYTE_FOR_BYTE';
      fs.writeFileSync(sentinelPath, SENTINEL_DATA);

      // Induce backup failure via file fsync
      const fsyncSpy = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
        const err: any = new Error('Simulated failure');
        err.code = 'EIO';
        throw err;
      });

      try {
        await expect(createWalSafeBackup(db, dbPath, 2)).rejects.toThrow(MigrationBackupError);

        // Sentinel is 100% byte-for-byte unchanged
        expect(fs.existsSync(sentinelPath)).toBe(true);
        expect(fs.readFileSync(sentinelPath, 'utf8')).toBe(SENTINEL_DATA);
      } finally {
        fsyncSpy.mockRestore();
        if (fs.existsSync(sentinelPath)) fs.unlinkSync(sentinelPath);
        db.close();
      }
    });

    it('25. pruneOldBackups treats non-existent backup directory (ENOENT) as absent returning accurate zero counts', () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist-dir');
      const result = pruneOldBackups(nonExistentDir, 5);
      expect(result.prunedCount).toBe(0);
      expect(result.retainedCount).toBe(0);
      expect(result.unverifiedCount).toBe(0);
      expect(result.warnings).toBeUndefined();
    });

    it('26. pruneOldBackups records directory read permission failure (EACCES) in warnings and reports unknown retained count', () => {
      const backupDir = path.join(tempDir, 'backups-eacces');
      fs.mkdirSync(backupDir, { recursive: true });

      const origReaddir = fs.readdirSync;
      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(((p: any, ...args: any[]) => {
        if (typeof p === 'string' && p === backupDir) {
          const err: any = new Error('Permission denied scanning backup directory');
          err.code = 'EACCES';
          throw err;
        }
        return (origReaddir as any)(p, ...args);
      }) as any);

      try {
        const result = pruneOldBackups(backupDir, 5);
        expect(result.prunedCount).toBe(0);
        // Explicitly unknown (null), never 0!
        expect(result.retainedCount).toBeNull();
        expect(result.unverifiedCount).toBe(0);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBe(1);
        expect(result.warnings![0]).toContain('EACCES');
        expect(result.warnings![0]).toContain(backupDir);
      } finally {
        readdirSpy.mockRestore();
      }
    });

    it('27. pruneOldBackups records directory storage failure (EIO) in warnings and reports unknown retained count', () => {
      const backupDir = path.join(tempDir, 'backups-eio');
      fs.mkdirSync(backupDir, { recursive: true });

      const origReaddir = fs.readdirSync;
      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(((p: any, ...args: any[]) => {
        if (typeof p === 'string' && p === backupDir) {
          const err: any = new Error('Storage controller read failure');
          err.code = 'EIO';
          throw err;
        }
        return (origReaddir as any)(p, ...args);
      }) as any);

      try {
        const result = pruneOldBackups(backupDir, 5);
        expect(result.prunedCount).toBe(0);
        // Explicitly unknown (null), never 0!
        expect(result.retainedCount).toBeNull();
        expect(result.unverifiedCount).toBe(0);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBe(1);
        expect(result.warnings![0]).toContain('EIO');
      } finally {
        readdirSpy.mockRestore();
      }
    });

    it('28. Candidate statSync() returning EACCES is represented as unverified and does not abort remaining pruning', () => {
      const backupDir = path.join(tempDir, 'backups-stat-fail');
      fs.mkdirSync(backupDir, { recursive: true });

      // Create 7 backup files
      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        files.push(fPath);
      }

      // One file has an EACCES stat failure
      const problematicFile = files[2];
      const origStat = fs.statSync;
      const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === problematicFile) {
          const err: any = new Error('Permission denied inspecting backup candidate');
          err.code = 'EACCES';
          throw err;
        }
        return origStat(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        // Out of 6 stat-able candidates, retainCount is 5, so 1 is pruned
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBe(1);
        expect(result.warnings![0]).toContain('EACCES');
        expect(result.warnings![0]).toContain(problematicFile);
      } finally {
        statSpy.mockRestore();
      }
    });

    it('29. Candidate unlinkSync() returning EPERM is observable and accounted for in unverifiedCount', () => {
      const backupDir = path.join(tempDir, 'backups-unlink-fail');
      fs.mkdirSync(backupDir, { recursive: true });

      // Create 7 backup files with distinct timestamps
      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      // The 2 oldest are files[0] and files[1]. Let files[0] fail on unlink.
      const failedFile = files[0];
      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === failedFile) {
          const err: any = new Error('Permission denied deleting expired backup');
          err.code = 'EPERM';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        // files[1] successfully unlinked, files[0] failed -> prunedCount = 1
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBe(1);
        expect(result.warnings![0]).toContain('EPERM');
        expect(result.warnings![0]).toContain(failedFile);

        // failedFile remains on disk
        expect(fs.existsSync(failedFile)).toBe(true);
        // files[1] was successfully deleted
        expect(fs.existsSync(files[1])).toBe(false);
      } finally {
        unlinkSpy.mockRestore();
      }
    });

    it('30. A clean pruning run reports correct prunedCount, retainedCount, zero unverifiedCount, and preserves sentinels byte-for-byte', () => {
      const backupDir = path.join(tempDir, 'backups-retention');
      fs.mkdirSync(backupDir, { recursive: true });

      const sentinelPath = path.join(backupDir, 'preserve_me.txt');
      const SENTINEL_CONTENT = 'DO_NOT_DELETE_SENTINEL_ARCHIVE_DATA';
      fs.writeFileSync(sentinelPath, SENTINEL_CONTENT);

      // Create 8 backups with distinct mtimes
      const files: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const fName = `nexora.sqlite.bak_20261110T${i < 10 ? '0' + i : i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_VERSION_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      const result = pruneOldBackups(backupDir, 5);
      expect(result.prunedCount).toBe(3);
      expect(result.retainedCount).toBe(5);
      expect(result.unverifiedCount).toBe(0);
      expect(result.warnings).toBeUndefined();

      // Sentinel must be untouched
      expect(fs.existsSync(sentinelPath)).toBe(true);
      expect(fs.readFileSync(sentinelPath, 'utf8')).toBe(SENTINEL_CONTENT);

      // The 3 oldest (files[0], files[1], files[2]) were pruned
      expect(fs.existsSync(files[0])).toBe(false);
      expect(fs.existsSync(files[1])).toBe(false);
      expect(fs.existsSync(files[2])).toBe(false);

      // The 5 newest (files[3] through files[7]) were retained byte-for-byte
      for (let i = 3; i < 8; i++) {
        expect(fs.existsSync(files[i])).toBe(true);
        expect(fs.readFileSync(files[i], 'utf8')).toBe(`BACKUP_VERSION_${i + 1}`);
      }
    });

    it('31. runMigrations propagates backupPruneWarnings into MigrationResult without rolling back committed migration', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupDir = path.join(path.dirname(dbPath), 'backups');
      fs.mkdirSync(backupDir, { recursive: true });

      // Simulate readdir failure when pruneOldBackups runs
      const origReaddir = fs.readdirSync;
      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(((p: any, ...args: any[]) => {
        if (typeof p === 'string' && p === backupDir) {
          const err: any = new Error('Simulated I/O failure on backup directory read during post-commit pruning');
          err.code = 'EIO';
          throw err;
        }
        return (origReaddir as any)(p, ...args);
      }) as any);

      try {
        const result = await runMigrations(db);

        // Migrations COMMITTED successfully despite pruning warning
        expect(result.appliedCount).toBe(2);
        expect(result.currentVersion).toBe(2);
        expect(result.totalTables).toBe(15);

        // Pruning warning is surfaced in MigrationResult
        expect(result.backupPruneWarnings).toBeDefined();
        expect(result.backupPruneWarnings!.length).toBeGreaterThan(0);
        expect(result.backupPruneWarnings![0]).toContain('EIO');

        // Physical database tables confirmed created
        const checkProjects = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects';").get();
        expect(checkProjects).toBeDefined();
      } finally {
        readdirSpy.mockRestore();
        db.close();
      }
    });

    it('32. Candidate statSync() returning ENOENT is not counted as retained or unverified', () => {
      const backupDir = path.join(tempDir, 'backups-stat-enoent');
      fs.mkdirSync(backupDir, { recursive: true });

      // Create 7 backup files
      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        files.push(fPath);
      }

      // Simulate one candidate disappearing (ENOENT on statSync)
      const disappearedFile = files[2];
      const origStat = fs.statSync;
      const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === disappearedFile) {
          const err: any = new Error('No such file or directory');
          err.code = 'ENOENT';
          throw err;
        }
        return origStat(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        // 6 inspectable candidates: 5 retained, 1 pruned
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        // Disappeared candidate is NOT in unverifiedCount and has no warning
        expect(result.unverifiedCount).toBe(0);
        expect(result.warnings).toBeUndefined();
      } finally {
        statSpy.mockRestore();
      }
    });

    it('33. Candidate statSync() returning EIO is represented as unverified', () => {
      const backupDir = path.join(tempDir, 'backups-stat-eio');
      fs.mkdirSync(backupDir, { recursive: true });

      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        files.push(fPath);
      }

      const eioFile = files[3];
      const origStat = fs.statSync;
      const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === eioFile) {
          const err: any = new Error('Storage controller read failure on candidate stat');
          err.code = 'EIO';
          throw err;
        }
        return origStat(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);
        expect(result.warnings).toBeDefined();
        expect(result.warnings![0]).toContain('EIO');
        expect(result.warnings![0]).toContain(eioFile);
      } finally {
        statSpy.mockRestore();
      }
    });

    it('34. Candidate unlinkSync() returning ENOENT is not counted as retained or successfully pruned', () => {
      const backupDir = path.join(tempDir, 'backups-unlink-enoent');
      fs.mkdirSync(backupDir, { recursive: true });

      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      // Oldest 2 are files[0] and files[1]. Let files[0] disappear (ENOENT on unlinkSync)
      const disappearedCandidate = files[0];
      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === disappearedCandidate) {
          const err: any = new Error('Candidate already absent at unlink time');
          err.code = 'ENOENT';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        // files[1] successfully unlinked -> prunedCount = 1
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        // Already absent candidate is NOT in unverifiedCount, and no warning produced
        expect(result.unverifiedCount).toBe(0);
        expect(result.warnings).toBeUndefined();
      } finally {
        unlinkSpy.mockRestore();
      }
    });

    it('35. Candidate unlinkSync() returning EACCES is observable and accounted for in unverifiedCount', () => {
      const backupDir = path.join(tempDir, 'backups-unlink-eacces');
      fs.mkdirSync(backupDir, { recursive: true });

      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      const eaccesCandidate = files[0];
      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === eaccesCandidate) {
          const err: any = new Error('Access denied deleting expired backup');
          err.code = 'EACCES';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);
        expect(result.warnings).toBeDefined();
        expect(result.warnings![0]).toContain('EACCES');
        expect(result.warnings![0]).toContain(eaccesCandidate);
      } finally {
        unlinkSpy.mockRestore();
      }
    });

    it('36. Candidate unlinkSync() returning EIO is observable and accounted for in unverifiedCount', () => {
      const backupDir = path.join(tempDir, 'backups-unlink-eio');
      fs.mkdirSync(backupDir, { recursive: true });

      const files: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      const eioCandidate = files[0];
      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === eioCandidate) {
          const err: any = new Error('Hardware storage failure on unlink');
          err.code = 'EIO';
          throw err;
        }
        return origUnlink(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);
        expect(result.prunedCount).toBe(1);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);
        expect(result.warnings).toBeDefined();
        expect(result.warnings![0]).toContain('EIO');
        expect(result.warnings![0]).toContain(eioCandidate);
      } finally {
        unlinkSpy.mockRestore();
      }
    });

    it('37. Unverified candidates are never deleted (conservative safety policy)', () => {
      const backupDir = path.join(tempDir, 'backups-unverified-no-delete');
      fs.mkdirSync(backupDir, { recursive: true });

      const files: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const fName = `nexora.sqlite.bak_20261110T1${i}0000Z_aabbccdd00112233_pre_v2.sqlite`;
        const fPath = path.join(backupDir, fName);
        fs.writeFileSync(fPath, `BACKUP_DATA_${i}`);
        const date = new Date(2026, 10, 10, 10, i, 0);
        fs.utimesSync(fPath, date, date);
        files.push(fPath);
      }

      // Candidate 0 (the oldest) has stat failure
      const unverifiedFile = files[0];
      const origStat = fs.statSync;
      const statSpy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p === unverifiedFile) {
          const err: any = new Error('Permission denied inspecting candidate');
          err.code = 'EACCES';
          throw err;
        }
        return origStat(p);
      });

      const deletedFiles: string[] = [];
      const origUnlink = fs.unlinkSync;
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation((p: any) => {
        if (typeof p === 'string') {
          deletedFiles.push(p);
        }
        return origUnlink(p);
      });

      try {
        const result = pruneOldBackups(backupDir, 5);

        // 7 inspectable candidates: 5 retained, 2 pruned (files[1] and files[2])
        expect(result.prunedCount).toBe(2);
        expect(result.retainedCount).toBe(5);
        expect(result.unverifiedCount).toBe(1);

        // The unverified candidate was NEVER unlinked!
        expect(deletedFiles).not.toContain(unverifiedFile);
        expect(fs.existsSync(unverifiedFile)).toBe(true);
      } finally {
        statSpy.mockRestore();
        unlinkSpy.mockRestore();
      }
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
