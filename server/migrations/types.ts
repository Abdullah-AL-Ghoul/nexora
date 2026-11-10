import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  checksum: string;
  up: (db: DatabaseSync) => void | Promise<void>;
}

export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: string;
  checksum: string;
  execution_time_ms: number;
}

export interface MigrationResult {
  appliedCount: number;
  appliedVersions: number[];
  currentVersion: number;
  totalTables: number;
  baselineCreated: boolean;
  backupPath?: string;
  backupFileSynced?: boolean;
  backupDirectorySynced?: boolean;
  backupCleanupWarnings?: string[];
  backupPruneWarnings?: string[];
  durationMs: number;
}

export interface BackupResult {
  backupPath: string;
  bytes: number;
  pagesCopied: number;
  fileSynced: boolean;
  directorySynced: boolean;
  completedAt: string;
  cleanupWarnings?: string[];
}

export interface PruneResult {
  prunedCount: number;
  retainedCount: number;
  warnings?: string[];
}

export type LockReleaseStatus =
  | 'RELEASED'
  | 'ALREADY_ABSENT'
  | 'NOT_HELD'
  | 'OWNERSHIP_MISMATCH'
  | 'FILESYSTEM_ERROR';

export interface LockReleaseResult {
  status: LockReleaseStatus;
  success: boolean;
  lockPath: string | null;
  error?: Error;
  details?: string;
}

export interface MigrationRunnerOptions {
  /** Optional maximum time to wait for migration lock acquisition in milliseconds (default 5000ms) */
  lockTimeoutMs?: number;
}

// ─── Custom Typed Errors ───────────────────────────────────────────────────────

export class MigrationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class MigrationLockError extends MigrationError {
  constructor(
    message: string,
    public readonly releaseResult?: unknown,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'MigrationLockError';
  }
}

export class MigrationBackupError extends MigrationError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MigrationBackupError';
  }
}

export class BaselineMismatchError extends MigrationError {
  constructor(message: string, public readonly discrepancies: string[] = []) {
    super(message + (discrepancies.length > 0 ? `:\n  - ${discrepancies.join('\n  - ')}` : ''));
    this.name = 'BaselineMismatchError';
  }
}

export class MigrationChecksumError extends MigrationError {
  constructor(
    public readonly version: number,
    public readonly expectedChecksum: string,
    public readonly recordedChecksum: string
  ) {
    super(
      `Migration version ${version} checksum mismatch! Expected ${expectedChecksum}, but database recorded ${recordedChecksum}. Historical migrations must not be modified.`
    );
    this.name = 'MigrationChecksumError';
  }
}

export class MigrationExecutionError extends MigrationError {
  constructor(
    public readonly version: number,
    public readonly migrationName: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Migration ${version} (${migrationName}) failed: ${message}`);
    this.name = 'MigrationExecutionError';
  }
}

export class MigrationRegistryError extends MigrationError {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationRegistryError';
  }
}
