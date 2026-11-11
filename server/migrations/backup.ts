import { DatabaseSync, backup } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { type BackupResult, type PruneResult, MigrationBackupError } from './types.js';

export type { BackupResult, PruneResult };

/**
 * Ensures the backup directory exists with restrictive POSIX access permissions (0700).
 * If the directory already exists with permissive permissions on POSIX, safely tightens it to 0700
 * or fails closed if permissions cannot be secured.
 * Also tightens permissions of any pre-existing Nexora backup artifacts (*.sqlite) to 0600.
 * Does NOT modify unrelated files or collision sentinels.
 * On Windows, POSIX permission bits do not control inherited ACLs; explicit documentation applies.
 */
export function ensureSecureBackupDirectory(backupDir: string): void {
  let dirStat: fs.Stats | null = null;
  try {
    dirStat = fs.lstatSync(backupDir);
  } catch (statErr: any) {
    if (statErr?.code !== 'ENOENT') {
      throw new MigrationBackupError(
        `Failed to inspect backup directory "${backupDir}" (${statErr?.code}): ${statErr?.message}`,
        statErr
      );
    }
  }

  if (dirStat) {
    if (dirStat.isSymbolicLink()) {
      throw new MigrationBackupError(
        `Backup directory "${backupDir}" is a symbolic link. Symbolic-link backup directories are rejected for security.`
      );
    }
    if (!dirStat.isDirectory()) {
      throw new MigrationBackupError(
        `Backup directory path "${backupDir}" exists but is not a directory.`
      );
    }
  }

  if (!dirStat) {
    try {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    } catch (mkdirErr: any) {
      throw new MigrationBackupError(
        `Failed to create backup directory "${backupDir}": ${mkdirErr?.message}`,
        mkdirErr
      );
    }
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(backupDir, 0o700);
      } catch (chmodErr: any) {
        throw new MigrationBackupError(
          `Failed to enforce restrictive mode (0700) on newly created backup directory "${backupDir}": ${chmodErr?.message}`,
          chmodErr
        );
      }
      const recheckNewStat = fs.lstatSync(backupDir);
      if ((recheckNewStat.mode & 0o777) !== 0o700) {
        throw new MigrationBackupError(
          `Newly created backup directory "${backupDir}" effective mode (${(recheckNewStat.mode & 0o777).toString(8)}) is not 0700. Operator intervention required.`
        );
      }
    }
    return;
  }

  // Directory already exists: on POSIX, inspect effective permissions
  if (process.platform !== 'win32') {
    const currentMode = dirStat.mode & 0o777;
    // F-06 Exact Permission Policy: detect owner deficits (0400, 0000, 0500) as well as group/other access
    if (currentMode !== 0o700) {
      try {
        fs.chmodSync(backupDir, 0o700);
      } catch (chmodErr: any) {
        throw new MigrationBackupError(
          `Backup directory "${backupDir}" has invalid permissions (${currentMode.toString(8)}, expected 0700) and could not be tightened to 0700 (${chmodErr?.code}): ${chmodErr?.message}. Operator intervention required to secure backup directory.`,
          chmodErr
        );
      }

      const recheckStat = fs.lstatSync(backupDir);
      if ((recheckStat.mode & 0o777) !== 0o700) {
        throw new MigrationBackupError(
          `Backup directory "${backupDir}" remains invalid (${(recheckStat.mode & 0o777).toString(8)}, expected 0700) after tightening. Operator intervention required.`
        );
      }
    }
  }

  // Inspect pre-existing Nexora backup artifacts on all platforms (path-type, symlink, inode checks)
  // and tighten to exact 0600 on POSIX platforms
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(backupDir);
  } catch (readErr: any) {
    throw new MigrationBackupError(
      `Failed to enumerate backup directory "${backupDir}" to verify artifact permissions: ${readErr?.message}`,
      readErr
    );
  }

  for (const entry of entries) {
    // Narrowly scoped strictly to verified Nexora backup artifacts
    // Never touch unrelated files or collision sentinels
    if (entry.startsWith('nexora.sqlite.bak_') && entry.endsWith('.sqlite')) {
      const artifactPath = path.join(backupDir, entry);
      let artStat: fs.Stats;
      try {
        artStat = fs.lstatSync(artifactPath);
      } catch (artStatErr: any) {
        throw new MigrationBackupError(
          `Failed to inspect existing backup artifact "${artifactPath}": ${artStatErr?.message}`,
          artStatErr
        );
      }

      // F-04: Reject symbolic links without following or altering target
      if (artStat.isSymbolicLink()) {
        throw new MigrationBackupError(
          `Existing backup artifact "${artifactPath}" is a symbolic link. Symbolic-link backup artifacts are rejected for security.`
        );
      }

      // F-04: Require regular file
      if (!artStat.isFile()) {
        throw new MigrationBackupError(
          `Existing backup artifact "${artifactPath}" is not a regular file.`
        );
      }

      // F-04: Hard-link policy: if nlink > 1, multiple links reference this inode.
      // Refuse to modify shared inode permissions to protect external references.
      if (artStat.nlink > 1) {
        throw new MigrationBackupError(
          `Existing backup candidate "${artifactPath}" has multiple hard links (nlink=${artStat.nlink}). ` +
          `Refusing to modify shared inode permissions to protect external references. Operator verification required.`
        );
      }

      // F-06: Enforce exact 0600 mode on POSIX
      if (process.platform !== 'win32') {
        const artMode = artStat.mode & 0o777;
        if (artMode !== 0o600) {
          // Descriptor-based operation for TOCTOU mitigation
          let fd: number | null = null;
          try {
            const openFlags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
            fd = fs.openSync(artifactPath, openFlags);
            const fstat = fs.fstatSync(fd);
            if (fstat.isSymbolicLink() || !fstat.isFile()) {
              throw new MigrationBackupError(
                `Descriptor inspection for "${artifactPath}" revealed non-regular or symlink file.`
              );
            }
            if (fstat.nlink > 1) {
              throw new MigrationBackupError(
                `Existing backup candidate "${artifactPath}" has multiple hard links on descriptor check (nlink=${fstat.nlink}). Refusing to modify permissions.`
              );
            }
            fs.fchmodSync(fd, 0o600);
            const recheckFstat = fs.fstatSync(fd);
            if ((recheckFstat.mode & 0o777) !== 0o600) {
              throw new MigrationBackupError(
                `Existing backup artifact "${artifactPath}" remains invalid (${(recheckFstat.mode & 0o777).toString(8)}, expected 0600) after tightening. Operator intervention required.`
              );
            }
          } catch (artChmodErr: any) {
            if (artChmodErr instanceof MigrationBackupError) throw artChmodErr;
            throw new MigrationBackupError(
              `Failed to secure permissions (0600) on existing backup artifact "${artifactPath}" (${artChmodErr?.code}): ${artChmodErr?.message}. Operator intervention required.`,
              artChmodErr
            );
          } finally {
            if (fd !== null) {
              try {
                fs.closeSync(fd);
              } catch {
                // Ignore close error
              }
            }
          }
        }
      }
    }
  }
}

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
 * 6. Filesystem Access Control & Permission Invariants (Step 02.1.9.1):
 *    - Backup directory created with restrictive mode 0700. Existing permissive backup directories are safely
 *      tightened to 0700 or fail closed with MigrationBackupError.
 *    - Staging directories created with mode 0700; staging files created exclusively with mode 0600.
 *    - Existing Nexora backup artifacts (*.sqlite) in backupDir are tightened to 0600 on POSIX; unrelated sentinels
 *      remain untouched.
 *    - Hard-link published backups retain the 0600 mode from staging file.
 *    - On Windows, POSIX permission bits do not control inherited ACLs; documented platform limitation applies.
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
    // Objective 6: Enforce restrictive permissions on backupDir and existing backup artifacts
    ensureSecureBackupDirectory(backupDir);

    // Generate collision-resistant filename with ISO timestamp and 64-bit cryptographic salt
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    const salt = crypto.randomBytes(8).toString('hex');
    const finalFilename = `nexora.sqlite.bak_${timestamp}_${salt}_pre_v${targetVersion}.sqlite`;
    const finalBackupPath = path.join(backupDir, finalFilename);

    // Initial check: if destination already exists prior to backup, reject immediately
    try {
      fs.lstatSync(finalBackupPath);
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
    // 1. Create a private attempt staging directory using non-recursive mkdir with mode 0700.
    // If stagingDir already exists, mkdirSync throws EEXIST and ownedStagingDir remains null.
    const attemptId = crypto.randomUUID();
    const stagingDir = path.join(backupDir, `.tmp_staging_${attemptId}`);

    try {
      fs.mkdirSync(stagingDir, { mode: 0o700 });
    } catch (mkdirErr: any) {
      if (mkdirErr?.code === 'EEXIST') {
        throw new MigrationBackupError(`Staging reservation collision: directory already exists: ${stagingDir}`);
      }
      throw mkdirErr;
    }

    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(stagingDir, 0o700);
      } catch (chmodErr: any) {
        throw new MigrationBackupError(
          `Failed to enforce restrictive mode (0700) on staging directory "${stagingDir}": ${chmodErr?.message}`,
          chmodErr
        );
      }
      const sStat = fs.lstatSync(stagingDir);
      if ((sStat.mode & 0o777) !== 0o700) {
        throw new MigrationBackupError(
          `Staging directory "${stagingDir}" effective mode (${(sStat.mode & 0o777).toString(8)}) is not 0700.`
        );
      }
    }

    // Directory successfully created exclusively by this attempt
    ownedStagingDir = stagingDir;

    // 2. Pre-create and reserve staging file exclusively using 'wx' flag with mode 0600
    const stagingFile = path.join(stagingDir, 'staging.sqlite');
    try {
      const stagingFd = fs.openSync(stagingFile, 'wx', 0o600);
      fs.closeSync(stagingFd);
    } catch (openErr: any) {
      if (openErr?.code === 'EEXIST') {
        throw new MigrationBackupError(`Staging reservation collision: file already exists: ${stagingFile}`);
      }
      throw openErr;
    }

    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(stagingFile, 0o600);
      } catch (chmodErr: any) {
        throw new MigrationBackupError(
          `Failed to enforce restrictive mode (0600) on staging file "${stagingFile}": ${chmodErr?.message}`,
          chmodErr
        );
      }
      const sfStat = fs.lstatSync(stagingFile);
      if ((sfStat.mode & 0o777) !== 0o600) {
        throw new MigrationBackupError(
          `Staging file "${stagingFile}" effective mode (${(sfStat.mode & 0o777).toString(8)}) is not 0600.`
        );
      }
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
      fs.lstatSync(finalBackupPath);
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

    // On POSIX, verify and enforce that published hard link retains restrictive permissions (0600)
    if (process.platform !== 'win32') {
      try {
        const pubStat = fs.lstatSync(finalBackupPath);
        if ((pubStat.mode & 0o777) !== 0o600) {
          fs.chmodSync(finalBackupPath, 0o600);
          const recheckPub = fs.lstatSync(finalBackupPath);
          if ((recheckPub.mode & 0o777) !== 0o600) {
            throw new MigrationBackupError(
              `Published backup "${finalBackupPath}" effective mode (${(recheckPub.mode & 0o777).toString(8)}) is not 0600.`
            );
          }
        }
      } catch (pubChmodErr: any) {
        if (pubChmodErr instanceof MigrationBackupError) throw pubChmodErr;
        throw new MigrationBackupError(
          `Failed to verify or enforce restrictive mode (0600) on published backup "${finalBackupPath}": ${pubChmodErr?.message}`,
          pubChmodErr
        );
      }
    }

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
 * Prunes backups older than the retainCount most recent inspectable files in the backup directory.
 * Returns PruneResult distinguishing successfully pruned backups, confirmed retained backups,
 * unverified artifacts, and non-fatal filesystem warnings.
 *
 * Operational Observability & Accounting Contract (Step 02.1.8):
 * 1. Directory inspection:
 *    - Confirmed ENOENT: directory absent; returns { prunedCount: 0, retainedCount: 0, unverifiedCount: 0 }.
 *    - Filesystem errors (EACCES, EIO, etc.): directory could not be inspected; returns retainedCount: null (unknown),
 *      unverifiedCount: 0, and records an observable warning.
 * 2. Candidate metadata inspection:
 *    - Confirmed ENOENT on candidate statSync: candidate disappeared; skipped without counting as retained or unverified.
 *    - Filesystem error on statSync (EACCES, EIO, etc.): candidate cannot be safely inspected; increments unverifiedCount,
 *      records an observable warning, and NEVER deletes it (conservative safety policy).
 * 3. Retention & Deletion Policy:
 *    - Sorts all inspectable candidates by modification time descending (newest first).
 *    - Retains up to retainCount newest inspectable candidates (retainedCount = inspectable.length up to retainCount).
 *    - Attempts deletion (fs.unlinkSync) strictly on inspectable candidates beyond retainCount.
 * 4. Candidate deletion:
 *    - Successful unlinkSync: increments prunedCount.
 *    - Confirmed ENOENT on unlinkSync: candidate was already absent; not counted as pruned or retained.
 *    - Deletion failure (EPERM, EACCES, EIO): deletion could not be completed; increments unverifiedCount,
 *      records an observable warning, and does NOT treat as a successful prune.
 * 5. Durability & Non-Interference:
 *    - Unrelated collision sentinels and unverified candidates are never deleted or modified.
 *    - Filesystem warnings are surfaced to the caller for propagation into MigrationResult.backupPruneWarnings.
 */
export function pruneOldBackups(backupDir: string, retainCount = 5): PruneResult {
  const warnings: string[] = [];
  let dirEntries: string[];

  try {
    dirEntries = fs.readdirSync(backupDir);
  } catch (readDirErr: any) {
    if (readDirErr?.code === 'ENOENT') {
      return { prunedCount: 0, retainedCount: 0, unverifiedCount: 0 };
    }
    return {
      prunedCount: 0,
      retainedCount: null,
      unverifiedCount: 0,
      warnings: [
        `Failed to inspect backup directory for pruning at "${backupDir}" (${readDirErr?.code ?? 'UNKNOWN'}): ${readDirErr?.message ?? String(readDirErr)}`,
      ],
    };
  }

  let unverifiedCount = 0;
  const validEntries: { path: string; mtime: number }[] = [];

  for (const f of dirEntries) {
    if (f.startsWith('nexora.sqlite.bak_') && f.endsWith('.sqlite')) {
      const fullPath = path.join(backupDir, f);
      try {
        const lstat = fs.lstatSync(fullPath);
        if (lstat.isSymbolicLink()) {
          unverifiedCount++;
          warnings.push(
            `Backup candidate "${fullPath}" is a symbolic link. Symbolic links are not managed by backup pruning.`
          );
          continue;
        }
        if (!lstat.isFile()) {
          unverifiedCount++;
          warnings.push(
            `Backup candidate "${fullPath}" is not a regular file; skipping pruning.`
          );
          continue;
        }
        if (lstat.nlink > 1) {
          unverifiedCount++;
          warnings.push(
            `Backup candidate "${fullPath}" has multiple hard links (nlink=${lstat.nlink}); skipping deletion to preserve shared inode.`
          );
          continue;
        }
        const stat = fs.statSync(fullPath);
        validEntries.push({ path: fullPath, mtime: stat.mtimeMs });
      } catch (statErr: any) {
        if (statErr?.code === 'ENOENT') {
          // Candidate confirmed absent: not retained, not unverified
          continue;
        }
        unverifiedCount++;
        warnings.push(
          `Failed to stat backup candidate "${fullPath}" (${statErr?.code ?? 'UNKNOWN'}): ${statErr?.message ?? String(statErr)}`
        );
      }
    }
  }

  // Sort newest first
  validEntries.sort((a, b) => b.mtime - a.mtime);

  // Identify confirmed inspectable candidates to retain
  const retainedCandidates = validEntries.slice(0, retainCount);
  const candidatesToDelete = validEntries.slice(retainCount);

  let prunedCount = 0;
  for (const item of candidatesToDelete) {
    try {
      fs.unlinkSync(item.path);
      prunedCount++;
    } catch (unlinkErr: any) {
      if (unlinkErr?.code === 'ENOENT') {
        // Candidate was already absent prior to unlink: not pruned by this invocation, not retained
        continue;
      }
      // Deletion failed: candidate remaining state could not be confirmed / remains on disk
      unverifiedCount++;
      warnings.push(
        `Failed to delete expired backup "${item.path}" (${unlinkErr?.code ?? 'UNKNOWN'}): ${unlinkErr?.message ?? String(unlinkErr)}`
      );
    }
  }

  return {
    prunedCount,
    retainedCount: retainedCandidates.length,
    unverifiedCount,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

