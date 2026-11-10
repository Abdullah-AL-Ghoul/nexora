import { DatabaseSync, backup } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { type BackupResult, type PruneResult, MigrationBackupError } from './types.js';

export type { BackupResult, PruneResult };

/**
 * Creates a transactionally consistent, WAL-safe online backup of a file-backed SQLite database
 * using Node.js 24's native `backup()` API.
 *
 * Safety & Ownership Invariants (Step 02.1.4):
 * 1. Fail-Closed Validation:
 *    - In-memory databases throw MigrationBackupError immediately.
 *    - Source file must exist on disk before backup.
 * 2. Exclusive Staging Ownership (Objective C):
 *    - Creates an attempt-owned private staging directory (.tmp_staging_<UUID>) using non-recursive mkdir.
 *    - Pre-creates and reserves the staging file exclusively with 'wx' before sqlite.backup() is invoked.
 *    - If staging reservation collides with an existing file/directory, fails closed without modifying it.
 *    - Cleanup removes ONLY artifacts created and owned by this attempt.
 * 3. Strict Atomic No-Clobber Publication (Objective D):
 *    - Publishes the verified backup strictly using fs.linkSync (hard link).
 *    - A collision at the publication boundary throws MigrationBackupError without modifying the destination.
 *    - If the platform/filesystem does not support atomic hard links, fails closed with MigrationBackupError
 *      and preserves the verified staging artifact for documented operator recovery.
 *    - Pre-existing files and collision sentinels are preserved byte-for-byte.
 * 4. Durability Synchronization & Error Classification (Objective F):
 *    - File fsync is mandatory and fail-closed: if file fsync fails, throws MigrationBackupError before database mutation.
 *    - Directory fsync distinguishes known OS/filesystem limitations (e.g. Win32 EPERM/EISDIR on directory handles)
 *      from true storage I/O failures (e.g. EIO, ENOSPC). True storage failures fail closed.
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

  // Fail closed: source database file must exist on disk before backup.
  // Distinguish confirmed absence (ENOENT) from access denial or other filesystem failures.
  try {
    fs.statSync(dbLocation);
  } catch (statErr: any) {
    if (statErr?.code === 'ENOENT') {
      throw new MigrationBackupError(
        `Source database file does not exist on disk: "${dbLocation}". Cannot perform mandatory migration backup.`
      );
    }
    throw new MigrationBackupError(
      `Cannot access source database file "${dbLocation}" (${statErr?.code}): ${statErr?.message}`,
      statErr
    );
  }

  const dbDir = path.dirname(dbLocation);
  const backupDir = path.join(dbDir, 'backups');

  let ownedStagingDir: string | null = null;
  let ownedStagingFile: string | null = null;
  let ownedFinalBackupPath: string | null = null;

  try {
    try {
      fs.mkdirSync(backupDir, { recursive: true });
    } catch (mkdirErr: any) {
      throw new MigrationBackupError(
        `Failed to create backup directory "${backupDir}": ${mkdirErr?.message}`,
        mkdirErr
      );
    }

    // Generate collision-resistant filename with ISO timestamp and 64-bit cryptographic salt
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    const salt = crypto.randomBytes(8).toString('hex');
    const finalFilename = `nexora.sqlite.bak_${timestamp}_${salt}_pre_v${targetVersion}.sqlite`;
    const finalBackupPath = path.join(backupDir, finalFilename);

    // Initial check: if destination already exists prior to backup, reject immediately
    try {
      fs.statSync(finalBackupPath);
      throw new MigrationBackupError(`Backup destination already exists: ${finalBackupPath}`);
    } catch (statErr: any) {
      if (statErr instanceof MigrationBackupError) throw statErr;
      if (statErr?.code !== 'ENOENT') {
        throw new MigrationBackupError(
          `Failed to inspect backup destination "${finalBackupPath}" (${statErr?.code}): ${statErr?.message}`,
          statErr
        );
      }
      // Confirmed absent (ENOENT) -> safe to proceed
    }

    // Objective C: Exclusive Staging Ownership
    // 1. Create a private attempt staging directory using non-recursive mkdir.
    // If stagingDir already exists, mkdirSync throws EEXIST and ownedStagingDir remains null.
    const attemptId = crypto.randomUUID();
    const stagingDir = path.join(backupDir, `.tmp_staging_${attemptId}`);

    try {
      fs.mkdirSync(stagingDir);
    } catch (mkdirErr: any) {
      if (mkdirErr?.code === 'EEXIST') {
        throw new MigrationBackupError(`Staging reservation collision: directory already exists: ${stagingDir}`);
      }
      throw mkdirErr;
    }

    // Directory successfully created exclusively by this attempt
    ownedStagingDir = stagingDir;

    // 2. Pre-create and reserve staging file exclusively using 'wx' flag
    const stagingFile = path.join(stagingDir, 'staging.sqlite');
    try {
      const stagingFd = fs.openSync(stagingFile, 'wx');
      fs.closeSync(stagingFd);
    } catch (openErr: any) {
      if (openErr?.code === 'EEXIST') {
        throw new MigrationBackupError(`Staging reservation collision: file already exists: ${stagingFile}`);
      }
      throw openErr;
    }

    ownedStagingFile = stagingFile;

    // Execute native online backup API - Node.js 24 returns total pages copied
    const pagesCopied = await backup(db, stagingFile);

    if (typeof pagesCopied !== 'number' || pagesCopied <= 0) {
      throw new MigrationBackupError(`WAL backup failed: non-positive page count returned (${pagesCopied})`);
    }

    // Verify file existence and positive byte count
    let stat: fs.Stats;
    try {
      stat = fs.statSync(stagingFile);
    } catch (statErr: any) {
      throw new MigrationBackupError(`Backup file was not created on disk: ${stagingFile} (${statErr?.message})`, statErr);
    }

    if (stat.size === 0) {
      throw new MigrationBackupError(`Backup file was created with 0 bytes: ${stagingFile}`);
    }

    // Verify database integrity on the backup file and record parity with source
    verifyBackupIntegrity(stagingFile, db);

    // Objective F: Durability synchronization on staging file
    // Open with 'r+' so FlushFileBuffers succeeds on Win32 and fsync on POSIX.
    // If file fsync fails, FAIL CLOSED: abort migration before database mutation.
    let fileSynced = false;
    try {
      const fd = fs.openSync(stagingFile, 'r+');
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

    // Objective D: Strict Atomic No-Clobber Final Backup Publication (Hard-Link Primitive)
    // fs.linkSync creates an atomic directory entry linking directly to the verified staging file.
    // If destination exists, linkSync fails atomically with EEXIST without modifying destination.
    try {
      fs.statSync(finalBackupPath);
      throw new MigrationBackupError(`Backup destination already exists: ${finalBackupPath}`);
    } catch (destStatErr: any) {
      if (destStatErr instanceof MigrationBackupError) throw destStatErr;
      if (destStatErr?.code !== 'ENOENT') {
        throw new MigrationBackupError(
          `Failed to inspect backup destination "${finalBackupPath}" (${destStatErr?.code}): ${destStatErr?.message}`,
          destStatErr
        );
      }
    }

    try {
      fs.linkSync(stagingFile, finalBackupPath);
    } catch (linkErr: any) {
      if (linkErr?.code === 'EEXIST') {
        throw new MigrationBackupError(
          `Backup destination already exists (collision at publication boundary): ${finalBackupPath}`
        );
      }

      // Hard links are the only supported atomic publication primitive.
      // If the platform/filesystem does not support hard links (e.g. cross-device EXDEV, unprivileged EPERM, ENOTSUP),
      // FAIL CLOSED. Do NOT fall back to non-atomic file copying in the migration safety path.
      // Verified staging artifact is preserved for documented operator recovery.
      ownedStagingFile = null;
      ownedStagingDir = null;
      throw new MigrationBackupError(
        `Atomic backup publication failed: filesystem does not support atomic hard links (${linkErr?.code}: ${linkErr?.message}). ` +
        `To ensure fail-closed database safety without risking partial or clobbered backups, migrations cannot proceed without atomic publication primitives. ` +
        `Verified staging backup preserved at "${stagingFile}".`,
        linkErr
      );
    }

    // Mark final backup as owned
    ownedFinalBackupPath = finalBackupPath;

    // Fsync the final backup file to ensure metadata/data durability at final destination
    try {
      const finalFd = fs.openSync(finalBackupPath, 'r+');
      try {
        fs.fsyncSync(finalFd);
      } finally {
        fs.closeSync(finalFd);
      }
    } catch (finalFsyncErr: any) {
      throw new MigrationBackupError(
        `Failed to fsync published backup file at ${finalBackupPath}: ${finalFsyncErr?.message}`,
        finalFsyncErr
      );
    }

    // Objective F: Directory synchronization with explicit error classification
    let directorySynced = false;
    try {
      const dirFd = fs.openSync(backupDir, 'r');
      try {
        fs.fsyncSync(dirFd);
        directorySynced = true;
      } finally {
        fs.closeSync(dirFd);
      }
    } catch (dirErr: any) {
      // Distinguish unsupported platform operations from access denial and true storage failures:
      // 1. Windows FlushFileBuffers on directory handles throws EPERM, EISDIR, or EBADF:
      const isKnownWin32Limitation =
        process.platform === 'win32' && ['EPERM', 'EISDIR', 'EBADF'].includes(dirErr?.code);
      // 2. Specific filesystems where directory fsync is not implemented:
      const isKnownFsLimitation = ['ENOTSUP', 'ENOSYS', 'EINVAL'].includes(dirErr?.code);

      if (isKnownWin32Limitation || isKnownFsLimitation) {
        // Documented platform/filesystem limitation: directory fsync is unsupported by OS
        directorySynced = false;
      } else {
        // EACCES (Permission Denied) or EIO/ENOSPC/EROFS/EDQUOT (Storage I/O failure):
        // MUST FAIL CLOSED: do not silently treat permission denial or storage hardware failures as "unsupported"!
        throw new MigrationBackupError(
          `Directory synchronization failed on ${backupDir} (${dirErr?.code}): ${dirErr?.message}`,
          dirErr
        );
      }
    }

    const cleanupWarnings: string[] = [];

    // Clean up staging files after successful atomic publication
    if (ownedStagingFile) {
      let stagingCleaned = true;
      for (const artifact of [ownedStagingFile, `${ownedStagingFile}-wal`, `${ownedStagingFile}-shm`]) {
        try {
          fs.unlinkSync(artifact);
        } catch (cleanErr: any) {
          if (cleanErr?.code === 'ENOENT') {
            // Confirmed absent: clean
            continue;
          }
          stagingCleaned = false;
          cleanupWarnings.push(`Failed to remove staging artifact "${artifact}" (${cleanErr?.code}): ${cleanErr?.message}`);
        }
      }
      if (stagingCleaned) {
        ownedStagingFile = null;
      }
    }

    if (ownedStagingDir) {
      try {
        fs.rmdirSync(ownedStagingDir);
        ownedStagingDir = null;
      } catch (cleanDirErr: any) {
        if (cleanDirErr?.code === 'ENOENT') {
          // Confirmed absent: clean
          ownedStagingDir = null;
        } else {
          cleanupWarnings.push(`Failed to remove staging directory "${ownedStagingDir}" (${cleanDirErr?.code}): ${cleanDirErr?.message}`);
        }
      }
    }

    return {
      backupPath: finalBackupPath,
      bytes: stat.size,
      pagesCopied,
      fileSynced,
      directorySynced,
      completedAt: new Date().toISOString(),
      ...(cleanupWarnings.length > 0 ? { cleanupWarnings } : {}),
    };
  } catch (err: any) {
    const cleanupFailures: string[] = [];

    // Artifact Ownership Rule:
    // Only clean up the artifacts that were created and owned by this attempt.
    // Never touch or delete pre-existing backup files, collision sentinels, or other attempts' directories.
    if (ownedFinalBackupPath) {
      let finalCleaned = true;
      for (const artifact of [ownedFinalBackupPath, `${ownedFinalBackupPath}-wal`, `${ownedFinalBackupPath}-shm`]) {
        try {
          fs.unlinkSync(artifact);
        } catch (fErr: any) {
          if (fErr?.code === 'ENOENT') {
            continue;
          }
          finalCleaned = false;
          cleanupFailures.push(`Failed to remove unverified published artifact "${artifact}" (${fErr?.code}): ${fErr?.message}`);
        }
      }
      if (finalCleaned) {
        ownedFinalBackupPath = null;
      }
    }

    if (ownedStagingFile) {
      let stagingCleaned = true;
      for (const artifact of [ownedStagingFile, `${ownedStagingFile}-wal`, `${ownedStagingFile}-shm`]) {
        try {
          fs.unlinkSync(artifact);
        } catch (sErr: any) {
          if (sErr?.code === 'ENOENT') {
            continue;
          }
          stagingCleaned = false;
          cleanupFailures.push(`Failed to remove staging file "${artifact}" (${sErr?.code}): ${sErr?.message}`);
        }
      }
      if (stagingCleaned) {
        ownedStagingFile = null;
      }
    }

    if (ownedStagingDir) {
      try {
        fs.rmdirSync(ownedStagingDir);
        ownedStagingDir = null;
      } catch (dErr: any) {
        if (dErr?.code === 'ENOENT') {
          ownedStagingDir = null;
        } else {
          cleanupFailures.push(`Failed to remove staging directory "${ownedStagingDir}" (${dErr?.code}): ${dErr?.message}`);
        }
      }
    }

    let errorToThrow =
      err instanceof MigrationBackupError
        ? err
        : new MigrationBackupError(`WAL backup creation failed for ${dbLocation}: ${err?.message}`, err);

    if (cleanupFailures.length > 0) {
      errorToThrow = new MigrationBackupError(
        `${errorToThrow.message}\n[Artifact Cleanup Warning] ${cleanupFailures.join('; ')}. Orphaned staging artifacts require operator verification at: ${ownedStagingDir || ownedFinalBackupPath}`,
        errorToThrow
      );
      (errorToThrow as any).cleanupFailures = cleanupFailures;
      (errorToThrow as any).orphanedStagingDir = ownedStagingDir;
      (errorToThrow as any).orphanedFinalPath = ownedFinalBackupPath;
    }

    throw errorToThrow;
  }
}/**
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
 * Prunes backups older than the retainCount most recent files in the backup directory.
 * Returns PruneResult containing count of pruned and retained backups, plus any non-fatal filesystem warnings.
 *
 * Operational Observability Contract (Step 02.1.7):
 * - Confirmed ENOENT on the backup directory or candidates is treated as absent (not a failure).
 * - Filesystem errors during readdir, stat, or unlink are recorded with the affected path and error code.
 * - Filesystem warnings are returned to the caller so they can be surfaced in MigrationResult without
 *   failing committed migrations.
 */
export function pruneOldBackups(backupDir: string, retainCount = 5): PruneResult {
  const warnings: string[] = [];
  let dirEntries: string[];

  try {
    dirEntries = fs.readdirSync(backupDir);
  } catch (readDirErr: any) {
    if (readDirErr?.code === 'ENOENT') {
      return { prunedCount: 0, retainedCount: 0 };
    }
    return {
      prunedCount: 0,
      retainedCount: 0,
      warnings: [
        `Failed to inspect backup directory for pruning at "${backupDir}" (${readDirErr?.code ?? 'UNKNOWN'}): ${readDirErr?.message ?? String(readDirErr)}`,
      ],
    };
  }

  const validEntries: { path: string; mtime: number }[] = [];
  for (const f of dirEntries) {
    if (f.startsWith('nexora.sqlite.bak_') && f.endsWith('.sqlite')) {
      const fullPath = path.join(backupDir, f);
      try {
        const stat = fs.statSync(fullPath);
        validEntries.push({ path: fullPath, mtime: stat.mtimeMs });
      } catch (statErr: any) {
        if (statErr?.code === 'ENOENT') {
          continue;
        }
        warnings.push(
          `Failed to stat backup candidate "${fullPath}" (${statErr?.code ?? 'UNKNOWN'}): ${statErr?.message ?? String(statErr)}`
        );
      }
    }
  }

  // Sort newest first
  validEntries.sort((a, b) => b.mtime - a.mtime);

  let prunedCount = 0;
  if (validEntries.length > retainCount) {
    const toDelete = validEntries.slice(retainCount);
    for (const item of toDelete) {
      try {
        fs.unlinkSync(item.path);
        prunedCount++;
      } catch (unlinkErr: any) {
        if (unlinkErr?.code === 'ENOENT') {
          continue;
        }
        warnings.push(
          `Failed to delete expired backup "${item.path}" (${unlinkErr?.code ?? 'UNKNOWN'}): ${unlinkErr?.message ?? String(unlinkErr)}`
        );
      }
    }
  }

  const retainedCount = validEntries.length - prunedCount;
  return {
    prunedCount,
    retainedCount,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

