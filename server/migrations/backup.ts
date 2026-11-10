import { DatabaseSync, backup } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { type BackupResult, MigrationBackupError } from './types.js';

export type { BackupResult };

/**
 * Creates a transactionally consistent, WAL-safe online backup of a file-backed SQLite database
 * using Node.js 24's native `backup()` API.
 *
 * Safety & Ownership Invariants (Step 02.1.3):
 * 1. Fail-Closed Validation:
 *    - In-memory databases throw MigrationBackupError immediately.
 *    - Source file must exist on disk before backup.
 * 2. Collision-Resistant Cryptographic Naming:
 *    - Uses ISO timestamp + 64-bit cryptographic salt + target version.
 * 3. Strict Artifact Ownership:
 *    - Streams backup to a unique, attempt-owned staging file (.tmp_backup_<UUID>.sqlite).
 *    - On collision with a pre-existing destination, the pre-existing file is NEVER unlinked.
 *    - Cleanup handles ONLY artifacts owned and created by the current attempt.
 * 4. Fail-Closed Durability Synchronization:
 *    - Opens backup with 'r+' for Win32 FlushFileBuffers / POSIX fsync compatibility.
 *    - If file fsync fails, throws MigrationBackupError (migrations abort before database mutation).
 *    - Attempts directory sync on POSIX, records OS limitation on Windows (directorySynced: false).
 * 5. Integrity & Parity Verification:
 *    - Verifies pagesCopied > 0, stat size > 0, PRAGMA integrity_check, PRAGMA quick_check,
 *      and exact source table and record count parity.
 *
 * @param db Active DatabaseSync instance
 * @param dbLocation Filesystem location of the database file
 * @param targetVersion The pending migration version being prepared
 * @returns BackupResult containing verified path, size, page count, and sync state
 */
export async function createWalSafeBackup(
  db: DatabaseSync,
  dbLocation: string,
  targetVersion: number
): Promise<BackupResult> {
  // In-memory databases do not support filesystem backups
  if (dbLocation === ':memory:' || dbLocation.startsWith(':memory:')) {
    throw new MigrationBackupError('Cannot create filesystem backup for an in-memory database');
  }

  // Fail closed: source database file must exist on disk before backup
  if (!fs.existsSync(dbLocation)) {
    throw new MigrationBackupError(
      `Source database file does not exist on disk: "${dbLocation}". Cannot perform mandatory migration backup.`
    );
  }

  const dbDir = path.dirname(dbLocation);
  const backupDir = path.join(dbDir, 'backups');
  let ownedArtifactPath: string | null = null;

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate collision-resistant filename with ISO timestamp and 64-bit cryptographic salt
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    const salt = crypto.randomBytes(8).toString('hex');
    const finalFilename = `nexora.sqlite.bak_${timestamp}_${salt}_pre_v${targetVersion}.sqlite`;
    const finalBackupPath = path.join(backupDir, finalFilename);

    // If destination already exists prior to backup, reject with MigrationBackupError.
    // Notice: ownedArtifactPath is still null, guaranteeing pre-existing file is never touched.
    if (fs.existsSync(finalBackupPath)) {
      throw new MigrationBackupError(`Backup destination already exists: ${finalBackupPath}`);
    }

    // Use a unique, attempt-owned staging file for streaming backup
    const attemptId = crypto.randomUUID();
    const stagingPath = path.join(backupDir, `.tmp_backup_${attemptId}.sqlite`);
    ownedArtifactPath = stagingPath;

    // Execute native online backup API - Node.js 24 returns total pages copied
    const pagesCopied = await backup(db, stagingPath);

    if (typeof pagesCopied !== 'number' || pagesCopied <= 0) {
      throw new MigrationBackupError(`WAL backup failed: non-positive page count returned (${pagesCopied})`);
    }

    // Verify file existence and positive byte count
    if (!fs.existsSync(stagingPath)) {
      throw new MigrationBackupError(`Backup file was not created on disk: ${stagingPath}`);
    }

    const stat = fs.statSync(stagingPath);
    if (stat.size === 0) {
      throw new MigrationBackupError(`Backup file was created with 0 bytes: ${stagingPath}`);
    }

    // Verify database integrity on the backup file and record parity with source
    verifyBackupIntegrity(stagingPath, db);

    // Durability synchronization on backup file:
    // Open with 'r+' so FlushFileBuffers succeeds on Win32 and fsync on POSIX.
    // If file fsync fails, FAIL CLOSED: do not allow migrations to proceed without durable backup.
    let fileSynced = false;
    try {
      const fd = fs.openSync(stagingPath, 'r+');
      try {
        fs.fsyncSync(fd);
        fileSynced = true;
      } finally {
        fs.closeSync(fd);
      }
    } catch (syncErr: any) {
      throw new MigrationBackupError(
        `Failed to flush backup file to durable storage via fsync: ${syncErr?.message}`,
        syncErr
      );
    }

    // Promote verified staging file to final backup destination.
    // Check destination again to catch any collision created during staging:
    if (fs.existsSync(finalBackupPath)) {
      throw new MigrationBackupError(`Backup destination already exists: ${finalBackupPath}`);
    }

    try {
      fs.renameSync(stagingPath, finalBackupPath);
      ownedArtifactPath = finalBackupPath;
    } catch (renameErr: any) {
      throw new MigrationBackupError(
        `Failed to promote staging backup file to ${finalBackupPath}: ${renameErr?.message}`,
        renameErr
      );
    }

    // Directory synchronization where supported by OS/filesystem (POSIX)
    let directorySynced = false;
    try {
      const dirFd = fs.openSync(backupDir, 'r');
      try {
        fs.fsyncSync(dirFd);
        directorySynced = true;
      } finally {
        fs.closeSync(dirFd);
      }
    } catch {
      // Documented limitation: directory fsync is unsupported on Windows (Win32) and throws EPERM/EISDIR
      directorySynced = false;
    }

    return {
      backupPath: finalBackupPath,
      bytes: stat.size,
      pagesCopied,
      fileSynced,
      directorySynced,
      completedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    // Artifact Ownership Rule:
    // Only clean up the artifact that was created and owned by this attempt.
    // Never touch or delete pre-existing backup files or collision sentinels.
    if (ownedArtifactPath) {
      for (const artifact of [ownedArtifactPath, `${ownedArtifactPath}-wal`, `${ownedArtifactPath}-shm`]) {
        try {
          if (fs.existsSync(artifact)) {
            fs.unlinkSync(artifact);
          }
        } catch {
          // Ignore cleanup failure on attempt-owned file
        }
      }
    }
    if (err instanceof MigrationBackupError) throw err;
    throw new MigrationBackupError(`WAL backup creation failed for ${dbLocation}: ${err?.message}`, err);
  }
}

/**
 * Verifies integrity of a backup SQLite file using PRAGMA integrity_check and PRAGMA quick_check,
 * and confirms that all committed source tables and row counts are preserved.
 */
export function verifyBackupIntegrity(backupPath: string, sourceDb?: DatabaseSync): void {
  let verifier: DatabaseSync | null = null;
  try {
    verifier = new DatabaseSync(backupPath, { readOnly: true });

    const integrityRows = (verifier.prepare('PRAGMA integrity_check;').all() as any[]) ?? [];
    const integrityOk = integrityRows.length === 1 && integrityRows[0]?.integrity_check === 'ok';

    const quickRows = (verifier.prepare('PRAGMA quick_check;').all() as any[]) ?? [];
    const quickOk = quickRows.length === 1 && quickRows[0]?.quick_check === 'ok';

    if (!integrityOk || !quickOk) {
      throw new MigrationBackupError(
        `Backup file failed SQLite integrity check: integrity_check=${JSON.stringify(integrityRows)}, quick_check=${JSON.stringify(quickRows)}`
      );
    }

    // If source database was provided, verify all committed tables and row counts match
    if (sourceDb) {
      const sourceTables = (sourceDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        .all() as { name: string }[]) ?? [];

      for (const { name: tbl } of sourceTables) {
        const backupTableCheck = verifier
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?;")
          .get(tbl);
        if (!backupTableCheck) {
          throw new MigrationBackupError(
            `Backup verification failed: table "${tbl}" from source database is missing in backup`
          );
        }

        const sourceCount = (sourceDb.prepare(`SELECT count(*) as c FROM "${tbl}";`).get() as any)?.c ?? 0;
        const backupCount = (verifier.prepare(`SELECT count(*) as c FROM "${tbl}";`).get() as any)?.c ?? 0;

        if (backupCount !== sourceCount) {
          throw new MigrationBackupError(
            `Backup verification failed: row count mismatch for table "${tbl}" (source=${sourceCount}, backup=${backupCount})`
          );
        }
      }
    }
  } catch (err: any) {
    if (err instanceof MigrationBackupError) throw err;
    throw new MigrationBackupError(`Failed to verify backup integrity on ${backupPath}: ${err.message}`, err);
  } finally {
    if (verifier) {
      try {
        verifier.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Prunes backups older than the 5 most recent files in the backup directory.
 */
export function pruneOldBackups(backupDir: string, retainCount = 5): void {
  try {
    if (!fs.existsSync(backupDir)) return;

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('nexora.sqlite.bak_') && f.endsWith('.sqlite'))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        return { path: fullPath, mtime: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length > retainCount) {
      const toDelete = files.slice(retainCount);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
        } catch {
          // Ignore deletion error for individual backup
        }
      }
    }
  } catch {
    // Ignore pruning errors
  }
}
