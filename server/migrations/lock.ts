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

const memoryLocks = new Set<string>();

/**
 * MigrationLock provides exclusive acquisition, bounded waiting, and safe release
 * for database migration execution.
 *
 * Mutual-Exclusion Governance (Step 02.1.3):
 * 1. Lock acquisition uses exclusive file creation ('wx').
 * 2. Each successful acquisition generates a unique cryptographic acquisition token (UUID).
 * 3. Locks are NEVER removed solely because of age. Active processes on the same host are never considered stale.
 * 4. Stale removal is permitted ONLY for confirmed dead PIDs on the same host (ESRCH).
 * 5. Pre-Claim Snapshot Verification:
 *    - Re-reads lock file immediately prior to isolation. If content changed, aborts without moving.
 * 6. Atomic Isolation & Post-Isolation Verification:
 *    - Atomically renames stale candidate to unique isolated path (fs.renameSync).
 *    - If reading isolated candidate fails, immediately executes safe restore so main path is never left unprotected.
 *    - Re-verifies content against snapshot. If content differs (TOCTOU race), executes safe restore.
 * 7. Non-Overwriting Safe Restore:
 *    - When restoring, if original lock path already contains a lock, NEVER overwrites it.
 * 8. Strict Token Release Verification:
 *    - release() deletes lock file ONLY if token, PID, and hostname match this specific acquisition instance.
 * 9. Foreign host locks, uncertain ownership, legacy tokenless files, or malformed data fail closed.
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
   * Release the lock if currently held by this specific acquisition instance.
   * Enforces token, PID, and hostname match.
   */
  release(): void {
    if (!this.acquired || !this.acquisitionToken) return;

    if (this.isMemory) {
      memoryLocks.delete(this.lockKey);
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

  private tryAcquireOnce(): boolean {
    if (this.isMemory) {
      if (memoryLocks.has(this.lockKey)) {
        return false;
      }
      this.acquisitionToken = crypto.randomUUID();
      memoryLocks.add(this.lockKey);
      return true;
    }

    if (!this.lockFilePath) return true;

    try {
      const lockDir = path.dirname(this.lockFilePath);
      if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
      }

      const token = crypto.randomUUID();
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
   * Stale removal is ONLY permitted if the process is confirmed dead on the SAME host (ESRCH).
   *
   * Race-Safe Atomic Reclamation Protocol:
   * 1. Inspect lock owner and confirm ESRCH on same host.
   * 2. Snapshot dead content. Re-verify lockFilePath content immediately before claim.
   * 3. Atomically rename dead lock file to isolated reclaim path.
   * 4. Verify candidate file in isolation. On read failure, restore file to prevent leaving system open.
   * 5. If content matches snapshot, unlink isolated candidate.
   * 6. If content mismatch detected, execute safe restore without overwriting newer destination lock.
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
      typeof owner?.token !== 'string' ||
      owner.token.trim().length === 0 ||
      typeof owner?.pid !== 'number' ||
      typeof owner?.hostname !== 'string' ||
      typeof owner?.acquiredAt !== 'string'
    ) {
      // Missing token, legacy lock schema, or malformed fields: fail closed
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
    const staleSnapshot = rawContent;

    // Pre-claim verification: ensure lock file on disk still matches our inspected snapshot
    let currentRaw: string;
    try {
      currentRaw = fs.readFileSync(this.lockFilePath, 'utf8');
    } catch {
      return;
    }

    if (currentRaw !== staleSnapshot) {
      // Lock changed between inspection and claim!
      // An active process or another reclaimer has replaced it -> do NOT touch!
      return;
    }

    // Execute atomic isolation rename:
    const salt = crypto.randomBytes(4).toString('hex');
    const reclaimPath = `${this.lockFilePath}.reclaim_${process.pid}_${Date.now()}_${salt}`;

    try {
      fs.renameSync(this.lockFilePath, reclaimPath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        // Another concurrent process already claimed or removed the dead lock file safely
        return;
      }
      // Any other filesystem error -> fail closed
      return;
    }

    // Post-isolation verification
    let reclaimedContent: string;
    try {
      reclaimedContent = fs.readFileSync(reclaimPath, 'utf8');
    } catch {
      // Read failure after isolation: MUST NOT leave system unprotected!
      this.safeRestoreLock(reclaimPath);
      return;
    }

    if (reclaimedContent === staleSnapshot) {
      // Confirmed: we exclusively and atomically claimed the dead lock. Unlink isolated candidate.
      try {
        fs.unlinkSync(reclaimPath);
      } catch {
        // Ignore unlink error on isolated candidate
      }
    } else {
      // TOCTOU Avoidance: A new lock replaced the dead lock right at the moment of rename!
      // Restore without overwriting any newer lock at destination.
      this.safeRestoreLock(reclaimPath);
    }
  }

  /**
   * Restores an isolated candidate lock back to the original lock file path safely.
   * Guarantees that if the destination path already contains a lock (newer lock created concurrently),
   * the destination is NEVER overwritten.
   */
  private safeRestoreLock(candidatePath: string): void {
    if (!this.lockFilePath) return;

    try {
      // If destination already exists (e.g. active process created a newer lock during reclamation),
      // do NOT overwrite it! Active lock already protects database.
      if (fs.existsSync(this.lockFilePath)) {
        try {
          fs.unlinkSync(candidatePath);
        } catch {
          // Ignore unlink error
        }
        return;
      }

      // Try linkSync first: fails with EEXIST if destination was created concurrently
      try {
        fs.linkSync(candidatePath, this.lockFilePath);
        try {
          fs.unlinkSync(candidatePath);
        } catch {
          // Ignore cleanup error
        }
      } catch (linkErr: any) {
        if (linkErr?.code === 'EEXIST') {
          // Destination was created concurrently! Do not overwrite!
          try {
            fs.unlinkSync(candidatePath);
          } catch {
            // Ignore cleanup error
          }
          return;
        }

        // Fallback for filesystems that do not support hard links:
        if (!fs.existsSync(this.lockFilePath)) {
          try {
            fs.renameSync(candidatePath, this.lockFilePath);
          } catch {
            try {
              fs.unlinkSync(candidatePath);
            } catch {
              // Ignore cleanup error
            }
          }
        } else {
          try {
            fs.unlinkSync(candidatePath);
          } catch {
            // Ignore cleanup error
          }
        }
      }
    } catch {
      // Fail closed
    }
  }

  private readLockOwner(): LockInfo | null {
    if (this.isMemory) {
      return memoryLocks.has(this.lockKey)
        ? {
            token: this.acquisitionToken ?? 'in-memory-token',
            pid: process.pid,
            hostname: os.hostname(),
            acquiredAt: 'in-memory',
            dbPath: this.lockKey,
          }
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
