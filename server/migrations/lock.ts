import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { MigrationLockError } from './types.js';

export interface LockInfo {
  token: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
  dbPath: string;
}

const memoryLocks = new Map<string, LockInfo>();

/**
 * MigrationLock provides exclusive acquisition, bounded waiting, and safe release
 * for database migration execution.
 *
 * Mutual-Exclusion Governance (Step 02.1.4 - Approach 2: Conservative Fail-Closed Recovery):
 * 1. Exclusive Acquisition Primitive:
 *    - Uses exclusive file creation flag ('wx') on the filesystem.
 *    - OS kernel guarantees atomic creation across all processes (Windows CREATE_NEW, POSIX O_CREAT|O_EXCL).
 * 2. Cryptographic Acquisition Token:
 *    - Each successful acquisition generates a unique cryptographic UUID token.
 * 3. Conservative Fail-Closed Recovery (Eliminates Check-Then-Rename Race):
 *    - Automatic deletion/reclamation of existing lock files is completely disabled.
 *    - No process ever inspects, renames, unlinks, or modifies another process's lock file.
 *    - If a lock file exists, acquire() retries until timeoutMs, then fails closed with MigrationLockError.
 *    - Detailed holder information (PID, hostname, acquiredAt, dbPath) is reported in the error message.
 *    - Manual Operator Recovery Policy: If a process terminates abnormally or host crashes, the operator
 *      must verify the process is no longer running (via ps/Task Manager) and manually remove the lock file.
 * 4. Strict Token-Verified Release:
 *    - release() deletes the lock file ONLY if:
 *      a) the file exists and is valid JSON,
 *      b) owner.token === this.acquisitionToken,
 *      c) owner.pid === process.pid,
 *      d) owner.hostname === os.hostname().
 *    - A different process, earlier acquisition instance, or foreign host cannot release the lock.
 * 5. Parity between In-Memory and File Locks:
 *    - In-memory locks use Map<string, LockInfo> enforcing the identical token-matching release contract.
 */
export class MigrationLock {
  private readonly lockFilePath: string | null;
  private readonly isMemory: boolean;
  private readonly lockKey: string;
  private acquired = false;
  private acquisitionToken: string | null = null;

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

    // Final attempt before reporting failure
    if (this.tryAcquireOnce()) {
      this.acquired = true;
      return;
    }

    const currentOwner = this.readLockOwner();
    const holderDescription = currentOwner
      ? `PID ${currentOwner.pid} on host "${currentOwner.hostname}" since ${currentOwner.acquiredAt} (token: ${currentOwner.token})`
      : 'unknown or unparseable lock file';

    throw new MigrationLockError(
      `Could not acquire migration lock for ${this.lockKey} within ${timeoutMs}ms. ` +
      `Lock is currently held by ${holderDescription}. ` +
      `Automatic stale-lock deletion is disabled for safety. ` +
      `If the owning process crashed or terminated abnormally, verify process liveness and manually remove ` +
      `the lock file "${this.lockFilePath}" before re-running migrations.`
    );
  }

  /**
   * Release the lock if currently held by this specific acquisition instance.
   * Enforces token, PID, and hostname match.
   */
  release(): void {
    if (!this.acquired || !this.acquisitionToken) return;

    if (this.isMemory) {
      const existing = memoryLocks.get(this.lockKey);
      if (existing && existing.token === this.acquisitionToken) {
        memoryLocks.delete(this.lockKey);
      }
    } else if (this.lockFilePath) {
      try {
        if (fs.existsSync(this.lockFilePath)) {
          const owner = this.readLockOwner();
          // Strict verification: token MUST match this instance's acquisitionToken,
          // AND PID and hostname must match this process.
          if (
            owner &&
            owner.token === this.acquisitionToken &&
            owner.pid === process.pid &&
            owner.hostname === os.hostname()
          ) {
            fs.unlinkSync(this.lockFilePath);
          }
        }
      } catch {
        // Silently ignore unlock errors during teardown
      }
    }

    this.acquired = false;
    this.acquisitionToken = null;
  }

  /**
   * Returns the unique acquisition token if currently acquired by this instance.
   */
  getAcquisitionToken(): string | null {
    return this.acquisitionToken;
  }

  private tryAcquireOnce(): boolean {
    const token = crypto.randomUUID();

    if (this.isMemory) {
      if (memoryLocks.has(this.lockKey)) {
        return false;
      }
      const lockPayload: LockInfo = {
        token,
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath: this.lockKey,
      };
      memoryLocks.set(this.lockKey, lockPayload);
      this.acquisitionToken = token;
      this.acquired = true;
      return true;
    }

    if (!this.lockFilePath) {
      this.acquired = true;
      return true;
    }

    try {
      const lockDir = path.dirname(this.lockFilePath);
      if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
      }

      const lockPayload: LockInfo = {
        token,
        pid: process.pid,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString(),
        dbPath: this.lockKey,
      };

      // Use 'wx' flag (exclusive creation) for atomic file lock
      fs.writeFileSync(this.lockFilePath, JSON.stringify(lockPayload, null, 2), { flag: 'wx' });
      this.acquisitionToken = token;
      this.acquired = true;
      return true;
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        // Lock already held by another process or instance -> fail-closed waiting
        return false;
      }
      throw new MigrationLockError(`Filesystem error acquiring lock at ${this.lockFilePath}: ${err.message}`);
    }
  }

  private readLockOwner(): LockInfo | null {
    if (this.isMemory) {
      return memoryLocks.get(this.lockKey) ?? null;
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
