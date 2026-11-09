import { DatabaseSync, backup } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { MigrationBackupError } from './types.js';

export interface BackupResult {
  backupPath: string;
  bytes: number;
  pagesCopied: number;
  completedAt: string;
}

/**
 * Creates a transactionally consistent, WAL-safe online backup of a file-backed SQLite database
 * using Node.js 24's native `backup()` API.
 *
 * @param db Active DatabaseSync instance
 * @param dbLocation Filesystem location of the database file
 * @param targetVersion The pending migration version being prepared
 * @returns BackupResult containing the verified backup path, file size, and copied page count
 */
export async function createWalSafeBackup(
  db: DatabaseSync,
  dbLocation: string,
  targetVersion: number
): Promise<BackupResult | null> {
  // In-memory databases do not require filesystem backups
  if (dbLocation === ':memory:' || dbLocation.startsWith(':memory:')) {
    return null;
  }

  // If the source DB file doesn't exist on disk yet (fresh install), nothing to backup
  if (!fs.existsSync(dbLocation)) {
    return null;
  }

  const dbDir = path.dirname(dbLocation);
  const backupDir = path.join(dbDir, 'backups');

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate collision-resistant filename with ISO timestamp and random salt
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
    const salt = Math.random().toString(36).substring(2, 6);
    const filename = `nexora.sqlite.bak_${timestamp}_${salt}_pre_v${targetVersion}.sqlite`;
    const backupPath = path.join(backupDir, filename);

    if (fs.existsSync(backupPath)) {
      throw new MigrationBackupError(`Backup destination already exists: ${backupPath}`);
    }

    // Execute native online backup API - Node.js 24 returns total pages copied
    const pagesCopied = await backup(db, backupPath);

    if (typeof pagesCopied !== 'number' || pagesCopied <= 0) {
      throw new MigrationBackupError(`WAL backup failed: non-positive page count returned (${pagesCopied})`);
    }

    // Verify file existence and positive byte count
    if (!fs.existsSync(backupPath)) {
      throw new MigrationBackupError(`Backup file was not created on disk: ${backupPath}`);
    }

    const stat = fs.statSync(backupPath);
    if (stat.size === 0) {
      throw new MigrationBackupError(`Backup file was created with 0 bytes: ${backupPath}`);
    }

    // Verify database integrity on the backup file and record parity with source
    verifyBackupIntegrity(backupPath, db);

    // Durability synchronization where supported
    try {
      const fd = fs.openSync(backupPath, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // Documented limitation: fsync on read file descriptor is OS/filesystem dependent
    }

    return {
      backupPath,
      bytes: stat.size,
      pagesCopied,
      completedAt: new Date().toISOString(),
    };
  } catch (err: any) {
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
