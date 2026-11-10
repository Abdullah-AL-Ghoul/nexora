import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { type LockReleaseResult, MigrationLockError } from './types.js';

export interface LockInfo {
  token: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
  dbPath: string;
}

export type LockOwnerInspectionStatus = 'VALID' | 'ABSENT' | 'MALFORMED' | 'FILESYSTEM_ERROR';

export interface LockOwnerInspection {
  status: LockOwnerInspectionStatus;
  owner: LockInfo | null;
  pid?: number;
  token?: string;
  hostname?: string;
  acquiredAt?: string;
  dbPath?: string;
  error?: Error;
  details?: string;
}

const memoryLocks = new Map<string, LockInfo>();

/**
 * MigrationLock provides exclusive acquisition, bounded waiting, and safe release
 * for database migration execution.
 *
 * Mutual-Exclusion Governance (Step 02.1.6 - Lock Filesystem Error Classification & Ownership-Safe Release Closure):
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
 * 4. Strict Observable Token-Verified Release & Filesystem Error Classification:
 *    - Direct inspection without boolean existsSync(): distinguishes confirmed absence (ENOENT) from
 *      access denial (EACCES/EPERM), storage I/O failures (EIO), and malformed JSON.
 *    - release() returns an explicit LockReleaseResult (never silently swallows errors).
 *    - Distinguishes RELEASED, ALREADY_ABSENT, NOT_HELD, OWNERSHIP_MISMATCH, and FILESYSTEM_ERROR.
 *    - release() deletes the lock file ONLY if:
 *      a) readLockOwner() confirms VALID metadata,
 *      b) owner.token === this.acquisitionToken,
 *      c) owner.pid === process.pid,
 *      d) owner.hostname === os.hostname(),
 *      e) pre-unlink re-verification confirms lock has not been replaced on disk prior to unlinkSync.
 *    - On FILESYSTEM_ERROR or OWNERSHIP_MISMATCH, acquisitionToken and acquired state are PRESERVED (not wiped).
 *    - A different process, earlier acquisition instance, foreign host, or malformed lock file cannot cause release.
 * 5. Ownership Replacement Race & Threat-Model Limitations (Step 02.1.6):
 *    - User-space filesystem limitation: Standard Node.js library and underlying OS kernels (Win32, POSIX)
 *      do not provide a portable atomic "compare-and-unlink" system call.
 *    - Defensive Mitigation: MigrationLock implements pre-unlink verification immediately before calling
 *      unlinkSync. If an adversarial process replaces the lock file between initial inspection and pre-unlink
 *      check, the runner detects the token mismatch and refuses to delete the foreign lock.
 *    - Residual Window: In theory, if a file were replaced in the irreducible sub-microsecond window strictly
 *      between the pre-unlink check and the OS kernel executing unlinkSync(), a path-based unlink would delete
 *      the newly placed file.
 *    - Required Operational Constraint: Under Approach 2 (Conservative Fail-Closed Recovery), external processes
 *      and operators MUST NOT out-of-band overwrite or delete active lock files while another process is running
 *      migrations. Automatic stale-lock reclamation is forbidden.
 * 6. Parity between In-Memory and File Locks:
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

    const inspection = this.readLockOwner();
    const holderDescription =
      inspection.status === 'VALID' && inspection.owner
        ? `PID ${inspection.owner.pid} on host "${inspection.owner.hostname}" since ${inspection.owner.acquiredAt} (token: ${inspection.owner.token})`
        : inspection.status === 'MALFORMED'
        ? `unparseable or malformed lock file (${inspection.details})`
        : inspection.status === 'FILESYSTEM_ERROR'
        ? `inaccessible lock file due to filesystem error: ${inspection.details}`
        : 'unknown or absent lock';

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
   * Direct filesystem inspection: distinguishes confirmed absence (ENOENT) from access denial (EACCES)
   * and storage failures (EIO). Never swallows filesystem errors.
   * Guards against ownership replacement races prior to calling unlinkSync.
   * Returns an explicit, observable LockReleaseResult.
   */
  release(): LockReleaseResult {
    if (!this.acquired || !this.acquisitionToken) {
      return {
        status: 'NOT_HELD',
        success: true,
        lockPath: this.lockFilePath ?? (this.isMemory ? this.lockKey : null),
        details: 'Lock is not held by this instance',
      };
    }

    if (this.isMemory) {
      const existing = memoryLocks.get(this.lockKey);
      if (!existing) {
        this.acquired = false;
        this.acquisitionToken = null;
        return {
          status: 'ALREADY_ABSENT',
          success: true,
          lockPath: this.lockKey,
          details: 'In-memory lock entry was already absent',
        };
      }
      if (existing.token !== this.acquisitionToken) {
        return {
          status: 'OWNERSHIP_MISMATCH',
          success: false,
          lockPath: this.lockKey,
          details: `In-memory lock token mismatch (held: ${existing.token}, instance: ${this.acquisitionToken})`,
        };
      }

      memoryLocks.delete(this.lockKey);
      this.acquired = false;
      this.acquisitionToken = null;
      return {
        status: 'RELEASED',
        success: true,
        lockPath: this.lockKey,
      };
    }

    if (!this.lockFilePath) {
      this.acquired = false;
      this.acquisitionToken = null;
      return {
        status: 'RELEASED',
        success: true,
        lockPath: null,
      };
    }

    // Direct filesystem inspection (does NOT use fs.existsSync):
    const inspection = this.readLockOwner();

    if (inspection.status === 'ABSENT') {
      // Confirmed genuine absence (ENOENT): safe to treat as ALREADY_ABSENT
      this.acquired = false;
      this.acquisitionToken = null;
      return {
        status: 'ALREADY_ABSENT',
        success: true,
        lockPath: this.lockFilePath,
        details: inspection.details || 'Lock file was confirmed absent on disk (ENOENT)',
      };
    }

    if (inspection.status === 'FILESYSTEM_ERROR') {
      // Access denial, I/O error, or other filesystem failure:
      // PRESERVE acquisition state so caller/operator can diagnose or retry
      return {
        status: 'FILESYSTEM_ERROR',
        success: false,
        lockPath: this.lockFilePath,
        error: inspection.error,
        details: `Failed to inspect lock file before release: ${inspection.details}`,
      };
    }

    if (inspection.status === 'MALFORMED') {
      // Malformed metadata: cannot verify ownership matches this instance.
      // Refuse to delete and preserve tokens.
      return {
        status: 'OWNERSHIP_MISMATCH',
        success: false,
        lockPath: this.lockFilePath,
        details: `Lock file metadata is malformed (${inspection.details}). Refusing to delete unverified lock file.`,
      };
    }

    // inspection.status === 'VALID'
    const owner = inspection.owner!;
    if (
      owner.token !== this.acquisitionToken ||
      owner.pid !== process.pid ||
      owner.hostname !== os.hostname()
    ) {
      // Ownership mismatch:
      // Lock file on disk belongs to a different token, PID, or host.
      // Do NOT delete file, do NOT clear tokens!
      const actualHolder = `PID ${owner.pid} on "${owner.hostname}" (token: ${owner.token})`;
      return {
        status: 'OWNERSHIP_MISMATCH',
        success: false,
        lockPath: this.lockFilePath,
        details: `Lock ownership mismatch: lock file on disk is held by ${actualHolder}, which does not match this instance's token (${this.acquisitionToken}) and PID (${process.pid}). Refusing to delete foreign lock.`,
      };
    }

    // Pre-unlink ownership re-verification (guards against ownership replacement race):
    const preUnlink = this.readLockOwner();
    if (preUnlink.status !== 'VALID' || preUnlink.owner?.token !== this.acquisitionToken) {
      const replacedHolder =
        preUnlink.status === 'VALID'
          ? `PID ${preUnlink.owner?.pid} on "${preUnlink.owner?.hostname}" (token: ${preUnlink.owner?.token})`
          : preUnlink.details || preUnlink.status;
      return {
        status: 'OWNERSHIP_MISMATCH',
        success: false,
        lockPath: this.lockFilePath,
        details: `Lock file on disk was modified or replaced prior to unlink (${replacedHolder}). Refusing to delete foreign lock.`,
      };
    }

    try {
      fs.unlinkSync(this.lockFilePath);
      this.acquired = false;
      this.acquisitionToken = null;
      return {
        status: 'RELEASED',
        success: true,
        lockPath: this.lockFilePath,
      };
    } catch (unlinkErr: any) {
      if (unlinkErr?.code === 'ENOENT') {
        // Confirmed absent at unlink time
        this.acquired = false;
        this.acquisitionToken = null;
        return {
          status: 'ALREADY_ABSENT',
          success: true,
          lockPath: this.lockFilePath,
          details: 'Lock file was already absent at unlink time (ENOENT)',
        };
      }
      // Filesystem failure during unlink: do NOT clear tokens!
      return {
        status: 'FILESYSTEM_ERROR',
        success: false,
        lockPath: this.lockFilePath,
        error: unlinkErr instanceof Error ? unlinkErr : new Error(String(unlinkErr)),
        details: `Failed to unlink lock file at ${this.lockFilePath}: ${unlinkErr?.message}`,
      };
    }
  }

  /**
   * Returns whether the lock is currently considered acquired by this instance.
   */
  isAcquired(): boolean {
    return this.acquired;
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

  /**
   * Inspects the current lock owner directly from storage without relying on boolean existence checks.
   * Distinguishes confirmed absence (ENOENT) from access denial (EACCES/EPERM), storage I/O errors (EIO),
   * malformed JSON metadata, and valid lock information.
   */
  readLockOwner(): LockOwnerInspection {
    if (this.isMemory) {
      const mem = memoryLocks.get(this.lockKey);
      if (!mem) {
        return {
          status: 'ABSENT',
          owner: null,
          details: 'In-memory lock entry is absent',
        };
      }
      return {
        status: 'VALID',
        owner: mem,
        pid: mem.pid,
        token: mem.token,
        hostname: mem.hostname,
        acquiredAt: mem.acquiredAt,
        dbPath: mem.dbPath,
      };
    }

    if (!this.lockFilePath) {
      return {
        status: 'ABSENT',
        owner: null,
        details: 'Lock file path is null',
      };
    }

    let content: string;
    try {
      content = fs.readFileSync(this.lockFilePath, 'utf8');
    } catch (readErr: any) {
      if (readErr?.code === 'ENOENT') {
        return {
          status: 'ABSENT',
          owner: null,
          details: `Lock file confirmed absent (ENOENT): ${this.lockFilePath}`,
        };
      }
      return {
        status: 'FILESYSTEM_ERROR',
        owner: null,
        error: readErr instanceof Error ? readErr : new Error(String(readErr)),
        details: `Filesystem error inspecting lock file (${readErr?.code || 'UNKNOWN'}): ${readErr?.message}`,
      };
    }

    try {
      const parsed = JSON.parse(content);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.token !== 'string' ||
        typeof parsed.pid !== 'number' ||
        typeof parsed.hostname !== 'string'
      ) {
        return {
          status: 'MALFORMED',
          owner: null,
          details: 'Lock file JSON is missing required LockInfo fields (token, pid, hostname)',
        };
      }
      const owner: LockInfo = {
        token: parsed.token,
        pid: parsed.pid,
        hostname: parsed.hostname,
        acquiredAt: String(parsed.acquiredAt || ''),
        dbPath: String(parsed.dbPath || this.lockKey),
      };
      return {
        status: 'VALID',
        owner,
        pid: owner.pid,
        token: owner.token,
        hostname: owner.hostname,
        acquiredAt: owner.acquiredAt,
        dbPath: owner.dbPath,
      };
    } catch (parseErr: any) {
      return {
        status: 'MALFORMED',
        owner: null,
        error: parseErr instanceof Error ? parseErr : new Error(String(parseErr)),
        details: `Lock file contains invalid JSON: ${parseErr?.message}`,
      };
    }
  }
}
