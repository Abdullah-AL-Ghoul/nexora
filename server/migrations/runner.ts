import type { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  type Migration,
  type AppliedMigration,
  type MigrationResult,
  type MigrationRunnerOptions,
  BaselineMismatchError,
  MigrationBackupError,
  MigrationChecksumError,
  MigrationError,
  MigrationExecutionError,
  MigrationLockError,
  MigrationRegistryError,
} from './types.js';
import { MigrationLock } from './lock.js';
import { createWalSafeBackup, pruneOldBackups } from './backup.js';
import { migration001 } from './001_baseline.js';
import { migration002 } from './002_projects_certs_media.js';

export const REGISTERED_MIGRATIONS: Migration[] = [migration001, migration002];

/**
 * Resolves the filesystem path of the main SQLite database file from PRAGMA database_list.
 * Returns ':memory:' ONLY for explicitly in-memory databases.
 * Fails closed with MigrationError if the database location cannot be safely determined.
 */
export function getDbLocation(db: DatabaseSync): string {
  try {
    const list = db.prepare('PRAGMA database_list;').all() as any[];
    if (!Array.isArray(list)) {
      throw new MigrationError('PRAGMA database_list returned non-array result');
    }
    const main = list.find((item) => item.name === 'main');
    if (!main) {
      throw new MigrationError('PRAGMA database_list does not contain "main" database entry');
    }
    if (typeof main.file !== 'string') {
      throw new MigrationError(
        `PRAGMA database_list "main" entry has non-string file property: ${typeof main.file}`
      );
    }
    // In-memory databases report file === ''
    if (main.file === '' || main.file === ':memory:') {
      return ':memory:';
    }
    return main.file;
  } catch (err: any) {
    if (err instanceof MigrationError) throw err;
    throw new MigrationError(`Unable to safely determine SQLite database location: ${err?.message}`, err);
  }
}

/**
 * Validates the schema_migrations registry table and returns applied migrations.
 * This function is strictly read-only and never executes DDL or modifies database state.
 */
export function validateMigrationRegistry(
  db: DatabaseSync,
  registeredMigrations: Migration[]
): AppliedMigration[] {
  // Check if schema_migrations table exists
  const tableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations';")
    .get();

  if (!tableExists) {
    return [];
  }

  // 1. Validate schema_migrations columns and declared types
  const cols = (db.prepare('PRAGMA table_info("schema_migrations");').all() as any[]) ?? [];
  const requiredCols: Record<string, string> = {
    version: 'INTEGER',
    name: 'TEXT',
    applied_at: 'TEXT',
    checksum: 'TEXT',
    execution_time_ms: 'INTEGER',
  };

  for (const [colName, expectedType] of Object.entries(requiredCols)) {
    const col = cols.find((c) => c.name === colName);
    if (!col) {
      throw new MigrationRegistryError(`schema_migrations is missing required column "${colName}"`);
    }
    if ((col.type || '').toUpperCase() !== expectedType) {
      throw new MigrationRegistryError(
        `schema_migrations column "${colName}" has invalid type "${col.type}"; expected "${expectedType}"`
      );
    }
  }

  // 2. Fetch rows ordered by version ASC
  const rows = (db
    .prepare(
      'SELECT version, name, applied_at, checksum, execution_time_ms FROM schema_migrations ORDER BY version ASC;'
    )
    .all() as any[]) ?? [];

  const checksumRegex = /^[a-f0-9]{64}$/i;
  const applied: AppliedMigration[] = [];
  const seenVersions = new Set<number>();
  const registeredMap = new Map<number, Migration>(registeredMigrations.map((m) => [m.version, m]));

  let previousVersion = 0;

  for (const row of rows) {
    const version = Number(row.version);
    const name = String(row.name);
    const applied_at = String(row.applied_at);
    const checksum = String(row.checksum);
    const execution_time_ms = Number(row.execution_time_ms);

    // Duplicate version check
    if (seenVersions.has(version)) {
      throw new MigrationRegistryError(`Duplicate migration version recorded in registry: ${version}`);
    }
    seenVersions.add(version);

    // Checksum format check
    if (!checksumRegex.test(checksum)) {
      throw new MigrationRegistryError(
        `Invalid checksum format recorded for migration version ${version}: "${checksum}" (expected 64-char hex SHA-256)`
      );
    }

    // Unknown version check
    const registered = registeredMap.get(version);
    if (!registered) {
      throw new MigrationRegistryError(
        `Unknown migration version ${version} ("${name}") recorded in schema_migrations; not registered in runner`
      );
    }

    // Name/version mismatch
    if (name !== registered.name) {
      throw new MigrationRegistryError(
        `Migration version ${version} name mismatch: registry has "${name}", registered definition is "${registered.name}"`
      );
    }

    // Historical checksum mismatch
    if (checksum !== registered.checksum) {
      throw new MigrationChecksumError(version, registered.checksum, checksum);
    }

    // Missing earlier version check (no gaps in applied versions)
    if (version !== previousVersion + 1) {
      throw new MigrationRegistryError(
        `Missing earlier migration version: version ${version} is recorded, but expected version ${previousVersion + 1}`
      );
    }
    previousVersion = version;

    applied.push({
      version,
      name,
      applied_at,
      checksum,
      execution_time_ms,
    });
  }

  return applied;
}

/**
 * Strictly read-only helper to inspect applied migrations without creating tables or modifying state.
 */
export function getAppliedMigrations(db: DatabaseSync): AppliedMigration[] {
  return validateMigrationRegistry(db, REGISTERED_MIGRATIONS);
}

/**
 * Initializes schema_migrations table if not already present.
 * MUST only be invoked after backup completion or on a verified fresh database.
 */
export function ensureMigrationRegistry(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version           INTEGER PRIMARY KEY,
      name              TEXT NOT NULL,
      applied_at        TEXT NOT NULL,
      checksum          TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL
    );
  `);
}

/**
 * Returns the count of physical tables in the database (excluding sqlite internal tables).
 */
export function getPhysicalTableCount(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Executes versioned migrations safely, atomically, and idempotently.
 *
 * Sequence:
 * 1. Resolves database location safely (fails closed if path inspection fails).
 * 2. Acquires exclusive migration lock before reading mutable state.
 * 3. Inspects registry under lock; determines pending migrations.
 * 4. If no pending migrations, returns immediate idempotent result.
 * 5. If persistent database contains existing tables, creates and verifies WAL-safe backup.
 *    (Fresh, completely empty database has explicit no-backup exception).
 * 6. ONLY AFTER backup verification succeeds, provisions migration registry.
 * 7. Executes pending migrations inside atomic transactions.
 * 8. Verifies physical table counts and commits.
 * 9. Prunes old backups only after migration verification.
 * 10. Releases lock in finally.
 */
export async function runMigrations(
  db: DatabaseSync,
  options: MigrationRunnerOptions = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const dbLocation = getDbLocation(db);
  const isMemory = dbLocation === ':memory:' || dbLocation.startsWith(':memory:');

  // Concurrency protection: acquire exclusive migration lock unconditionally
  const lock = new MigrationLock(dbLocation);
  await lock.acquire(options.lockTimeoutMs ?? 5000);

  let backupPath: string | undefined;
  let backupFileSynced: boolean | undefined;
  let backupDirectorySynced: boolean | undefined;
  let backupCleanupWarnings: string[] | undefined;

  let migrationError: unknown = null;
  let finalResult: MigrationResult | null = null;

  try {
    // Re-read migration state while holding the lock
    const applied = getAppliedMigrations(db);
    const appliedVersionMap = new Map<number, AppliedMigration>(applied.map((m) => [m.version, m]));

    // Determine pending migrations in strict numeric ascending order
    const pending = REGISTERED_MIGRATIONS.filter((m) => !appliedVersionMap.has(m.version)).sort(
      (a, b) => a.version - b.version
    );

    // Fast-path idempotency: if another process or prior run applied all migrations, return immediately
    if (pending.length === 0) {
      const currentVersion = applied.length > 0 ? Math.max(...applied.map((m) => m.version)) : 0;
      finalResult = {
        appliedCount: 0,
        appliedVersions: [],
        currentVersion,
        totalTables: getPhysicalTableCount(db),
        baselineCreated: false,
        durationMs: Date.now() - startTime,
      };
      return finalResult;
    }

    // Fail-Closed Backup Contract:
    // If a persistent file-backed database already contains tables (legacy application state or previous migrations),
    // a verified WAL-safe backup MUST precede any DDL, DML, or registry creation.
    // Bypassing backup or proceeding on null/invalid result is strictly forbidden.
    const existingTableCount = getPhysicalTableCount(db);

    if (!isMemory) {
      if (existingTableCount > 0) {
        const backupResult = await createWalSafeBackup(db, dbLocation, pending[0].version);
        if (
          !backupResult ||
          typeof backupResult.backupPath !== 'string' ||
          backupResult.backupPath.length === 0 ||
          typeof backupResult.pagesCopied !== 'number' ||
          backupResult.pagesCopied <= 0
        ) {
          throw new MigrationBackupError(
            `Mandatory backup failed to produce a valid BackupResult for file database: ${dbLocation}`
          );
        }

        // Durability Policy: file fsync MUST be confirmed before modifying database
        if (!backupResult.fileSynced) {
          throw new MigrationBackupError(
            `Mandatory backup failed durability verification: file fsync was not confirmed for ${backupResult.backupPath}`
          );
        }

        backupPath = backupResult.backupPath;
        backupFileSynced = backupResult.fileSynced;
        backupDirectorySynced = backupResult.directorySynced;
        backupCleanupWarnings = backupResult.cleanupWarnings;
      } else {
        // Documented exception: Fresh, empty database (0 application tables) has no existing state to preserve.
      }
    }

    // Only after backup success (or fresh empty database exception) may registry or tables be created
    ensureMigrationRegistry(db);

    const appliedVersions: number[] = [];
    let baselineCreated = false;

    for (const migration of pending) {
      const migrationStart = Date.now();

      try {
        // Begin immediate transaction for atomicity
        db.exec('BEGIN IMMEDIATE TRANSACTION;');

        // Execute migration up logic
        await migration.up(db);

        if (migration.version === 1) {
          baselineCreated = true;
        }

        const executionDuration = Date.now() - migrationStart;
        const nowIso = new Date().toISOString();

        // Record successful migration in registry
        const stmt = db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at, checksum, execution_time_ms) VALUES (?, ?, ?, ?, ?);'
        );
        (stmt as any).run(
          migration.version,
          migration.name,
          nowIso,
          migration.checksum,
          executionDuration
        );

        // Commit transaction
        db.exec('COMMIT;');
        appliedVersions.push(migration.version);
      } catch (err: any) {
        // Rollback transaction on failure
        try {
          db.exec('ROLLBACK;');
        } catch {
          // Ignore rollback error if transaction already failed
        }
        if (
          err instanceof BaselineMismatchError ||
          err instanceof MigrationChecksumError ||
          err instanceof MigrationRegistryError ||
          err instanceof MigrationBackupError ||
          err instanceof MigrationLockError
        ) {
          throw err;
        }
        throw new MigrationExecutionError(migration.version, migration.name, err.message, err);
      }
    }

    // After all pending migrations commit successfully, prune older backups
    if (backupPath) {
      const backupDir = path.dirname(backupPath);
      pruneOldBackups(backupDir, 5);
    }

    const totalTables = getPhysicalTableCount(db);
    const allApplied = getAppliedMigrations(db);
    const currentVersion = allApplied.length > 0 ? Math.max(...allApplied.map((m) => m.version)) : 0;

    finalResult = {
      appliedCount: appliedVersions.length,
      appliedVersions,
      currentVersion,
      totalTables,
      baselineCreated,
      backupPath,
      backupFileSynced,
      backupDirectorySynced,
      ...(backupCleanupWarnings ? { backupCleanupWarnings } : {}),
      durationMs: Date.now() - startTime,
    };

    return finalResult;
  } catch (err) {
    migrationError = err;
    throw err;
  } finally {
    if (lock) {
      const releaseRes = lock.release();
      if (!releaseRes.success) {
        const releaseMsg = `Migration lock release failed (${releaseRes.status}): ${releaseRes.details || releaseRes.error?.message}. Lock file may remain at "${releaseRes.lockPath}". Manual operator intervention may be required.`;
        if (migrationError) {
          // Both migration failed AND lock release failed: preserve both errors
          const combinedErr = new MigrationLockError(
            `${migrationError instanceof Error ? migrationError.message : String(migrationError)}\n[Secondary Failure] ${releaseMsg}`,
            releaseRes,
            migrationError
          );
          throw combinedErr;
        } else {
          // Migrations applied successfully, but lock release failed
          const opErr = new MigrationLockError(
            `Migrations completed successfully (currentVersion ${finalResult?.currentVersion}), but lock release failed (${releaseRes.status}): ${releaseRes.details || releaseRes.error?.message}. Lock file may remain at "${releaseRes.lockPath}".`,
            releaseRes
          );
          (opErr as any).migrationResult = finalResult;
          throw opErr;
        }
      }
    }
  }
}
