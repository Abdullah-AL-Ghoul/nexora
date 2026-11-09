import type { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  type Migration,
  type AppliedMigration,
  type MigrationResult,
  type MigrationRunnerOptions,
  BaselineMismatchError,
  MigrationChecksumError,
  MigrationExecutionError,
} from './types.js';
import { MigrationLock } from './lock.js';
import { createWalSafeBackup, pruneOldBackups } from './backup.js';
import { migration001 } from './001_baseline.js';
import { migration002 } from './002_projects_certs_media.js';

export const REGISTERED_MIGRATIONS: Migration[] = [migration001, migration002];

/**
 * Resolves the filesystem path of the main SQLite database file from PRAGMA database_list.
 * Returns ':memory:' for in-memory databases.
 */
export function getDbLocation(db: DatabaseSync): string {
  try {
    const list = (db.prepare('PRAGMA database_list;').all() as any[]) ?? [];
    const main = list.find((item) => item.name === 'main');
    if (main && main.file && typeof main.file === 'string' && main.file.length > 0) {
      return main.file;
    }
  } catch {
    // fallback
  }
  return ':memory:';
}

/**
 * Initializes schema_migrations table if not already present.
 */
function ensureMigrationRegistry(db: DatabaseSync): void {
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
 * Retrieves list of applied migrations from schema_migrations table.
 */
export function getAppliedMigrations(db: DatabaseSync): AppliedMigration[] {
  ensureMigrationRegistry(db);
  const rows = db
    .prepare(
      'SELECT version, name, applied_at, checksum, execution_time_ms FROM schema_migrations ORDER BY version ASC;'
    )
    .all() as any[];
  return rows.map((r) => ({
    version: Number(r.version),
    name: String(r.name),
    applied_at: String(r.applied_at),
    checksum: String(r.checksum),
    execution_time_ms: Number(r.execution_time_ms),
  }));
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
 * Executes versioned migrations safely and idempotently.
 *
 * Sequence:
 * 1. Inspects existing migration registry.
 * 2. Validates checksum of previously applied migrations.
 * 3. If pending migrations exist:
 *    - Acquires exclusive migration lock.
 *    - Creates WAL-safe backup (for file-backed databases).
 *    - Applies pending migrations inside atomic transactions.
 *    - Validates schema and physical table count.
 *    - Prunes older backups.
 *    - Releases migration lock.
 */
export async function runMigrations(
  db: DatabaseSync,
  options: MigrationRunnerOptions = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const dbLocation = getDbLocation(db);
  const isMemory = dbLocation === ':memory:' || dbLocation.startsWith(':memory:');

  ensureMigrationRegistry(db);
  const applied = getAppliedMigrations(db);
  const appliedVersionMap = new Map<number, AppliedMigration>(applied.map((m) => [m.version, m]));

  // Verify checksums of all previously applied migrations against registered definitions
  for (const registered of REGISTERED_MIGRATIONS) {
    const historical = appliedVersionMap.get(registered.version);
    if (historical) {
      if (historical.checksum !== registered.checksum) {
        throw new MigrationChecksumError(
          registered.version,
          registered.checksum,
          historical.checksum
        );
      }
    }
  }

  // Determine pending migrations in strict numeric ascending order
  const pending = REGISTERED_MIGRATIONS.filter((m) => !appliedVersionMap.has(m.version)).sort(
    (a, b) => a.version - b.version
  );

  // If no pending migrations, return immediately (fast-path idempotency)
  if (pending.length === 0) {
    const currentVersion = applied.length > 0 ? Math.max(...applied.map((m) => m.version)) : 0;
    return {
      appliedCount: 0,
      appliedVersions: [],
      currentVersion,
      totalTables: getPhysicalTableCount(db),
      baselineCreated: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Concurrency protection: acquire exclusive migration lock
  const shouldLock = options.lock !== false;
  const lock = shouldLock ? new MigrationLock(dbLocation) : null;
  if (lock) {
    await lock.acquire(5000);
  }

  let backupPath: string | undefined;

  try {
    // WAL-safe backup creation for file-backed databases before executing DDL
    const shouldBackup = options.backup !== false && !isMemory;
    if (shouldBackup) {
      const backupResult = await createWalSafeBackup(db, dbLocation, pending[0].version);
      if (backupResult) {
        backupPath = backupResult.backupPath;
      }
    }

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
        if (err instanceof BaselineMismatchError || err instanceof MigrationChecksumError) {
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

    return {
      appliedCount: appliedVersions.length,
      appliedVersions,
      currentVersion,
      totalTables,
      baselineCreated,
      backupPath,
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (lock) {
      lock.release();
    }
  }
}
