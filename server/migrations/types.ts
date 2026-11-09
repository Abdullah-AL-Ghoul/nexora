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
  durationMs: number;
}

export interface MigrationRunnerOptions {
  backup?: boolean;
  lock?: boolean;
  skipIntegrityCheck?: boolean;
}

// ─── Custom Typed Errors ───────────────────────────────────────────────────────

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class MigrationLockError extends MigrationError {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationLockError';
  }
}

export class MigrationBackupError extends MigrationError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
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
