import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MigrationLockError } from './types.js';

export interface LockInfo {
  pid: number;
  hostname: string;
  acquiredAt: string;
  dbPath: string;
}

const memoryLocks = new Set<string>();

/**
 * MigrationLock provides exclusive acquisition, bounded waiting, and safe release
 * for database migration execution.
 *
 * Governance:
 * 1. Lock acquisition uses exclusive file creation ('wx').
 * 2. Locks are NEVER removed solely because of age.
 * 3. Active processes on the same host are never considered stale.
 * 4. Stale removal is permitted ONLY for confirmed dead PIDs on the same host (ESRCH),
 *    with pre-deletion content verification to prevent race conditions.
 * 5. Foreign host locks, uncertain ownership, or malformed lock data fail closed.
 * 6. Release is verified to ensure only the owning process can delete the lock file.
 */
export class MigrationLock {
  private readonly lockFilePath: string | null;
  private readonly isMemory: boolean;
  private readonly lockKey: string;
  private acquired = false;

  constructor(dbLocation: string) {
    this.lockKey = dbLocation;
    this.isMemory = dbLocation === ':memory:' || dbLocation.startsWith(':memory:');
    if (!this.isMemory && dbLocation) {
      const dir = path.dirname(dbLocation);
      const base = path.basename(dbLocation);
      this.lockFilePath = path.join(dir, `${base}.migration.lock`);
    } else {
      this.lockFilePath = null;
    }
  }

  /**
   * Acquire exclusive lock with bounded waiting.
   * @param timeoutMs Maximum time to wait in ms (default 5000ms)
   * @param pollIntervalMs Interval between retries in ms (default 100ms)
   */
  async acquire(timeoutMs = 5000, pollIntervalMs = 100): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.tryAcquireOnce()) {
        this.acquired = true;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Attempt one last time or report failure with ownership details
    if (this.tryAcquireOnce()) {
      this.acquired = true;
      return;
    }

    const currentOwner = this.readLockOwner();
    throw new MigrationLockError(
      `Could not acquire migration lock for ${this.lockKey} within ${timeoutMs}ms. ` +
      `Current lock holder: ${JSON.stringify(currentOwner ?? 'unknown')}`
    );
  }

  /**
   * Release the lock if currently held by this process.
   */
  release(): void {
    if (!this.acquired) return;

    if (this.isMemory) {
      memoryLocks.delete(this.lockKey);
    } else if (this.lockFilePath) {
      try {
        if (fs.existsSync(this.lockFilePath)) {
          const owner = this.readLockOwner();
          // Only remove if this process owns the lock
          if (owner && owner.pid === process.pid && owner.hostname === os.hostname()) {
            fs.unlinkSync(this.lockFilePath);
          }
        }
      } catch {
        // Silently ignore unlock errors during teardown
      }
    }

    this.acquired = false;
  }

  private tryAcquireOnce(): boolean {
    if (this.isMemory) {
      if (memoryLocks.has(this.lockKey)) {
        return false;
      }
      memoryLocks.add(this.lockKey);
      return true;
    }

    if (!this.lockFilePath) return true;

    try {
      const lockDir = path.dirname(this.lockFilePath);
      if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
      }

      const lockPayload: LockInfo = {
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath: this.lockKey,
      };

      // Use 'wx' flag (exclusive creation) for atomic file lock
      fs.writeFileSync(this.lockFilePath, JSON.stringify(lockPayload, null, 2), { flag: 'wx' });
      return true;
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        // Inspect lock file for staleness under strict safety rules
        this.handleExistingLockFile();
        return false;
      }
      throw new MigrationLockError(`Filesystem error acquiring lock at ${this.lockFilePath}: ${err.message}`);
    }
  }

  /**
   * Handles an existing lock file.
   * Stale removal is ONLY permitted if the process is confirmed dead on the SAME host (ESRCH),
   * and the lock content has not changed since inspection.
   * If foreign host, uncertain ownership, malformed data, or process is alive, fails closed (no deletion).
   */
  private handleExistingLockFile(): void {
    if (!this.lockFilePath || !fs.existsSync(this.lockFilePath)) {
      return;
    }

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(this.lockFilePath, 'utf8');
    } catch {
      return;
    }

    let owner: LockInfo;
    try {
      owner = JSON.parse(rawContent);
    } catch {
      // Malformed lock data: fail closed (do NOT delete automatically)
      return;
    }

    if (
      typeof owner?.pid !== 'number' ||
      typeof owner?.hostname !== 'string' ||
      typeof owner?.acquiredAt !== 'string'
    ) {
      // Uncertain or malformed schema: fail closed
      return;
    }

    // Foreign host: ownership cannot be safely verified locally -> fail closed
    if (owner.hostname !== os.hostname()) {
      return;
    }

    // Same host: test if process exists using process.kill(pid, 0)
    let isAlive = false;
    try {
      process.kill(owner.pid, 0);
      isAlive = true;
    } catch (e: any) {
      if (e.code === 'EPERM') {
        // Process exists (permission denied to signal) -> active!
        isAlive = true;
      } else if (e.code === 'ESRCH') {
        // Process does not exist -> confirmed dead!
        isAlive = false;
      } else {
        // Uncertain error -> fail closed
        isAlive = true;
      }
    }

    // Rule: Never remove a lock solely because it is old if owner is alive
    if (isAlive) {
      return;
    }

    // Owning process is confirmed dead (ESRCH) on this host.
    // Verify lock file has not changed since inspection before unlinking.
    try {
      const currentContent = fs.readFileSync(this.lockFilePath, 'utf8');
      if (currentContent === rawContent) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch {
      // Ignore if unlinked by another connection
    }
  }

  private readLockOwner(): LockInfo | null {
    if (this.isMemory) {
      return memoryLocks.has(this.lockKey)
        ? { pid: process.pid, hostname: os.hostname(), acquiredAt: 'in-memory', dbPath: this.lockKey }
        : null;
    }

    if (!this.lockFilePath || !fs.existsSync(this.lockFilePath)) return null;
    try {
      const content = fs.readFileSync(this.lockFilePath, 'utf8');
      return JSON.parse(content) as LockInfo;
    } catch {
      return null;
    }
  }
}
