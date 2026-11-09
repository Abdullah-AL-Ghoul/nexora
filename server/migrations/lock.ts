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
   * Release the lock if currently held.
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
        // Check for stale lock: if same host and process is dead, or lock is older than 15 minutes
        if (this.isLockStale()) {
          try {
            fs.unlinkSync(this.lockFilePath);
            return false; // Will re-try on next loop iteration
          } catch {
            return false;
          }
        }
        return false;
      }
      throw new MigrationLockError(`Filesystem error acquiring lock at ${this.lockFilePath}: ${err.message}`);
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

  private isLockStale(): boolean {
    const owner = this.readLockOwner();
    if (!owner) return true;

    // If lock is from this exact host, verify if the process still exists
    if (owner.hostname === os.hostname() && owner.pid) {
      try {
        // process.kill(pid, 0) tests if process exists without sending a signal
        process.kill(owner.pid, 0);
        // Process is still running, check age
        const ageMs = Date.now() - new Date(owner.acquiredAt).getTime();
        return ageMs > 15 * 60 * 1000; // 15 minutes max lifespan for migration
      } catch (e: any) {
        // ESRCH means process does not exist -> stale!
        if (e.code === 'ESRCH') return true;
      }
    }

    return false;
  }
}
