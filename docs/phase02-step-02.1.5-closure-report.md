# NEXORA — Step 02.1.5 & Step 02.1.6 Closure Report
**Lock Filesystem Error Classification, Ownership-Safe Release & Atomic Publication Closure**

- **Project:** NEXORA — Version B
- **Repository:** `https://github.com/Abdullah-AL-Ghoul/nexora`
- **Authorized Branch:** `main`
- **Approved Baseline Commit:** `be42002a9addb1e9223c54955cf50eaad71e9143`
- **Execution Date:** November 2026
- **Status:** Complete & Verified

---

## 1. Executive Summary & Defect Remediation Overview

This engineering closure report documents the completion of **STEP 02.1.5 & STEP 02.1.6: Lock Filesystem Error Classification, Ownership-Safe Release & Backup Cleanup Invariants**.

All residual operational safety gaps and inspection race conditions identified during the independent architecture review have been systematically closed and verified with automated regression suites:

1. **Lock Inspection Directly from Storage (Elimination of `fs.existsSync` Blind Spot):**
   - *Defect:* `MigrationLock.release()` previously relied on `fs.existsSync()`. In Node.js, `existsSync()` returns `false` on any access failure (such as `EACCES` or `EPERM`), which caused an inaccessible lock file to be wrongly classified as `ALREADY_ABSENT`, inadvertently wiping `acquired` and `acquisitionToken`.
   - *Resolution:* Eliminated `fs.existsSync()` from lock inspection.
     - Implemented `readLockOwner(): LockOwnerInspection` which performs direct `fs.readFileSync()`.
     - Confirmed absence (`ENOENT`) is cleanly distinguished from filesystem access denial (`EACCES`/`EPERM`) and hardware storage failures (`EIO`).
     - Returns explicit discriminated inspection statuses: `'VALID'`, `'ABSENT'`, `'MALFORMED'`, or `'FILESYSTEM_ERROR'`.
     - `release()` returns `ALREADY_ABSENT` ONLY when genuine absence (`ENOENT`) is confirmed.
     - Filesystem read errors (`EACCES`, `EIO`) return `FILESYSTEM_ERROR` and preserve `acquired` and `acquisitionToken`.
     - Filesystem failures never become `OWNERSHIP_MISMATCH`.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

2. **Malformed Lock Metadata Protection:**
   - *Defect:* Previously, malformed JSON or corrupted files caused `readLockOwner()` to return `null`, which was treated generically without distinguishing format corruption from foreign ownership.
   - *Resolution:* Malformed JSON or corrupted payloads return `{ status: 'MALFORMED' }`. `release()` refuses to delete the file, returns `{ status: 'OWNERSHIP_MISMATCH' }` with descriptive details, and preserves internal acquisition tokens.
   - *Claim Classification:* **Verified by executed test**.

3. **Ownership Replacement Race Analysis & Threat-Model Documentation:**
   - *Defect Review:* The window between inspecting lock owner metadata and executing `fs.unlinkSync()` could permit an adversarial replacement if another process or human operator forcibly overwrote the lock file out-of-band.
   - *Defensive Mitigation:* Implemented immediate pre-unlink re-verification. Before issuing `fs.unlinkSync()`, `release()` re-reads the lock file from disk. If the file on disk was modified, corrupted, or replaced with a foreign lock between initial read and unlink, the runner detects the token mismatch, aborts the unlink, and returns `OWNERSHIP_MISMATCH`.
   - *Deterministic Adversarial Test (Test 22):* Verified via a deterministic test where a foreign lock replaces the file immediately following initial inspection. The runner detects the replacement, does NOT unlink the file, preserves the foreign lock byte-for-byte, and retains its internal tokens.
   - *Threat-Model Limitation & Operational Constraint:*
     - *Limitation:* Node.js standard library and host OS kernels (Win32, POSIX) do not provide a portable atomic `compare-and-unlink` system call. An irreducible sub-microsecond window exists between any user-space check and the OS kernel unlinking the directory entry.
     - *Required Operational Constraint:* Under Approach 2 (Conservative Fail-Closed Recovery), external actors and operators MUST NOT out-of-band overwrite or delete active lock files while a migration is in progress. Automatic stale-lock reclamation remains strictly forbidden.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

4. **Backup Artifact Cleanup Invariants & Stale Claim Removal:**
   - *Defect:* Cleanup loops in `server/migrations/backup.ts` previously used `if (fs.existsSync(artifact)) fs.unlinkSync(artifact)`. If `existsSync()` returned `false` due to `EACCES` or `EIO`, the file was not deleted, no exception was caught, and cleanup failures disappeared silently.
   - *Resolution:*
     - Directly issues `fs.unlinkSync()` and `fs.rmdirSync()`.
     - Confirmed absence (`ENOENT`) is safely treated as already cleaned up.
     - Access denial (`EACCES`) and storage errors (`EIO`) are recorded in `cleanupWarnings` (on success) or `cleanupFailures` (on error).
     - Ownership metadata (`ownedStagingFile`, `ownedStagingDir`, `ownedFinalBackupPath`) is retained whenever cleanup cannot be confirmed.
     - Removed obsolete documentation claiming `copyFileSync` fallback; `linkSync` remains the only atomic publication primitive.
     - Pre-existing files and collision sentinels remain 100% byte-for-byte unchanged.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

5. **Absolute Working Database Protection:**
   - Persistent database `.data/nexora.sqlite` was **never migrated or modified** (verified 10 tables, 0 Phase 02 domain tables, 48 products, 5 users, 6 orders intact).
   - *Claim Classification:* **Verified by executed test**.

---

## 2. Evidence-Based Verification Summary

All verification was conducted using the project's native test runner (`vitest`) and compilers:

| Verification Suite | Target | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Migration Suite** | `server/__tests__/migrations.test.ts` | **PASS** | 76 passed (76 tests, 0 failures) |
| **API Suite** | `server/__tests__/api.test.ts` | **PASS** | 30 passed (30 tests, 0 failures) |
| **Models Suite** | `server/__tests__/models.test.ts` | **PASS** | 27 passed (27 tests, 0 failures) |
| **Pricing Suite** | `server/__tests__/pricing.test.ts` | **PASS** | 11 passed (11 tests, 0 failures) |
| **Full Project Test Suite** | `npm test` | **PASS** | 4 test files, 144 passed (144 tests, 0 failures) |
| **TypeScript Typecheck** | `npm run lint` (`tsc --noEmit`) | **PASS** | 0 type errors, 0 warnings |
| **Frontend Production Build** | `npm run build` (`vite build`) | **PASS** | 1711 modules transformed, exit code 0 |
| **Persistent DB Verification** | `.data/nexora.sqlite` | **PASS** | 0 Phase 02 tables, 48 products, 5 users, 6 orders intact |

---

## 3. Detailed Verification Claims & Audit Evidence

### 3.1 Lock Lifecycle & Filesystem Error Classification
- **Test 19 (`Direct lock inspection distinguishes confirmed ENOENT from EACCES and EIO filesystem errors`):**
  - Verified `readLockOwner()` returns `ABSENT` on confirmed `ENOENT`.
  - Injected `EACCES` on read: verified `readLockOwner()` returns `FILESYSTEM_ERROR`, and `release()` returns `FILESYSTEM_ERROR` preserving tokens and acquired state.
  - Injected `EIO` on read: verified `readLockOwner()` returns `FILESYSTEM_ERROR`, and `release()` returns `FILESYSTEM_ERROR` preserving tokens and acquired state.
- **Test 20 (`Filesystem read failure does NOT become OWNERSHIP_MISMATCH`):**
  - Verified that storage errors (`EIO`) during lock inspection strictly yield `FILESYSTEM_ERROR`, never `OWNERSHIP_MISMATCH`.
- **Test 21 (`Malformed JSON does NOT cause lock deletion and returns OWNERSHIP_MISMATCH`):**
  - Overwrote lock file with invalid JSON syntax.
  - Verified `readLockOwner()` returns `MALFORMED`.
  - Verified `release()` returns `OWNERSHIP_MISMATCH` without unlinking the file.
  - Verified malformed file remains intact on disk, and instance tokens are preserved.
- **Test 22 (`Deterministic adversarial test: lock replacement race immediately following read is detected and foreign lock is not deleted`):**
  - Deterministically injected foreign lock payload onto disk immediately following initial valid read.
  - Pre-unlink check detected the token mismatch.
  - Verified `release()` returned `OWNERSHIP_MISMATCH` and did not invoke `unlinkSync`.
  - Verified foreign lock on disk remained 100% byte-for-byte identical.
  - Verified original lock instance preserved its acquisition token.

### 3.2 Step 02.1.7 Lock Revalidation Classification & Complete Identity
- **Test 23 (`Pre-unlink inspection returning FILESYSTEM_ERROR on EACCES maps to FILESYSTEM_ERROR, preserves state, and does not unlink`):**
  - Verified that access denial (`EACCES`) on pre-unlink inspection strictly yields `FILESYSTEM_ERROR`, never `OWNERSHIP_MISMATCH`.
  - Verified tokens and acquired state are preserved and lock file is untouched.
- **Test 24 (`Pre-unlink inspection returning FILESYSTEM_ERROR on EIO maps to FILESYSTEM_ERROR, preserves state, and does not unlink`):**
  - Verified that storage I/O errors (`EIO`) on pre-unlink inspection strictly yield `FILESYSTEM_ERROR`, preserving state and refusing unlink.
- **Test 25 (`Pre-unlink inspection confirmed absence (ENOENT) maps to ALREADY_ABSENT and clears token`):**
  - Verified confirmed absence (`ENOENT`) prior to unlink maps to `ALREADY_ABSENT`, clearing acquired state and tokens.
- **Test 26 (`Pre-unlink inspection malformed JSON maps to OWNERSHIP_MISMATCH and preserves token`):**
  - Verified corrupted lock file prior to unlink maps to `OWNERSHIP_MISMATCH`, preserving tokens and refusing deletion.
- **Test 27 (`Pre-unlink complete identity: same token with modified PID produces OWNERSHIP_MISMATCH and refuses unlink`):**
  - Verified modified PID with identical token is rejected as `OWNERSHIP_MISMATCH`.
- **Test 28 (`Pre-unlink complete identity: same token with modified hostname produces OWNERSHIP_MISMATCH and refuses unlink`):**
  - Verified modified hostname with identical token is rejected as `OWNERSHIP_MISMATCH`.
- **Test 29 (`Pre-unlink complete identity: same token with modified acquiredAt produces OWNERSHIP_MISMATCH and refuses unlink`):**
  - Verified modified timestamp with identical token is rejected as `OWNERSHIP_MISMATCH`.
- **Test 30 (`Pre-unlink complete identity: same token with modified dbPath produces OWNERSHIP_MISMATCH and refuses unlink`):**
  - Verified modified target dbPath with identical token is rejected as `OWNERSHIP_MISMATCH`.

### 3.3 Backup Cleanup Invariants & Durability
- **Test 21 (`Backup cleanup treats ENOENT as already absent without generating cleanup warnings`):**
  - Verified clean backup execution without spurious cleanup warnings.
- **Test 22 (`EACCES during staging cleanup produces observable cleanup warning in BackupResult`):**
  - Injected `EACCES` on staging file unlink.
  - Verified `BackupResult.cleanupWarnings` captures the `EACCES` failure with artifact path.
- **Test 23 (`EIO during cleanup on backup failure retains ownership and reports orphaned path`):**
  - Injected `EIO` on staging directory `rmdirSync` during backup failure cleanup.
  - Verified `MigrationBackupError` captures `cleanupFailures` and retains `.orphanedStagingDir`.
- **Test 24 (`Pre-existing collision sentinels remain byte-for-byte unchanged across cleanup`):**
  - Verified pre-existing sentinel files in `backups/` directory are never touched or modified during backup failure cleanup.

### 3.4 Step 02.1.7 Backup Pruning Observability
- **Test 25 (`pruneOldBackups treats non-existent backup directory (ENOENT) as absent without warnings`):**
  - Verified `pruneOldBackups` on absent directory returns `{ prunedCount: 0, retainedCount: 0, unverifiedCount: 0 }` with no warnings.
- **Test 26 (`pruneOldBackups records directory read permission failure (EACCES) in warnings without throwing`):**
  - Verified `EACCES` on `readdirSync` is recorded in warnings with affected path.
- **Test 27 (`pruneOldBackups records directory storage failure (EIO) in warnings without throwing`):**
  - Verified `EIO` on `readdirSync` is recorded in warnings without throwing.
- **Test 28 (`pruneOldBackups records candidate stat failure (EACCES/EIO) in warnings and continues pruning valid candidates`):**
  - Verified candidate stat failure is captured in warnings while remaining valid backups are pruned.
- **Test 29 (`pruneOldBackups records expired backup deletion failure (EPERM/EIO) in warnings without aborting other deletions`):**
  - Verified deletion failure is recorded in warnings while other expired backups are pruned.
- **Test 30 (`pruneOldBackups retains exactly 5 newest backups and preserves unrelated sentinel files byte-for-byte`):**
  - Verified exactly 5 newest backups are kept; older files pruned; unrelated sentinels preserved byte-for-byte.
- **Test 31 (`runMigrations propagates backupPruneWarnings into MigrationResult without rolling back committed migration`):**
  - Verified post-commit pruning warnings are surfaced in `MigrationResult.backupPruneWarnings` without rolling back or failing the committed migration.

### 3.5 Step 02.1.8 Backup Pruning Result Accuracy & Unverified Artifact Accounting
- **Semantically Accurate `PruneResult` Contract:**
  ```ts
  export interface PruneResult {
    prunedCount: number;
    retainedCount: number | null;
    unverifiedCount: number;
    warnings?: string[];
  }
  ```
  - `prunedCount`: Exact count of backup files successfully unlinked by this invocation.
  - `retainedCount`: Confirmed count of inspectable backups intentionally retained on disk (`Math.min(validEntries.length, retainCount)`). Mapped strictly to `null` if directory inspection failed (`EACCES`, `EIO`), explicitly representing that the true count is unknown (never claiming 0).
  - `unverifiedCount`: Explicit count of backup candidates whose metadata inspection (`statSync`) or deletion (`unlinkSync`) could not be verified due to non-ENOENT filesystem errors.
  - `warnings`: Detailed list of observable warnings containing affected paths and error codes.
- **Conservative Retention & Accounting Invariants:**
  - `statSync` returning `ENOENT`: candidate confirmed absent; skipped without incrementing retained or unverified count.
  - `statSync` returning `EACCES`/`EIO`: increment `unverifiedCount`, record warning, and NEVER delete the candidate.
  - `unlinkSync` returning `ENOENT`: candidate was already absent; not counted as pruned or retained.
  - `unlinkSync` returning `EPERM`/`EACCES`/`EIO`: increment `unverifiedCount`, record warning, and do not treat as a successful prune.
- **Test 25 (`Directory ENOENT returns accurate zero counts`):**
  - Verified `{ prunedCount: 0, retainedCount: 0, unverifiedCount: 0 }` with no warnings.
- **Test 26 (`Directory EACCES reports an unknown retained count, not zero`):**
  - Verified `retainedCount === null`, `unverifiedCount === 0`, warning recorded.
- **Test 27 (`Directory EIO reports an unknown retained count, not zero`):**
  - Verified `retainedCount === null`, `unverifiedCount === 0`, warning recorded.
- **Test 28 (`Candidate statSync() returning EACCES is represented as unverified`):**
  - Verified `unverifiedCount === 1`, `retainedCount === 5`, `prunedCount === 1`.
- **Test 29 (`Candidate unlinkSync() returning EPERM is observable and accounted for in unverifiedCount`):**
  - Verified `unverifiedCount === 1`, `retainedCount === 5`, `prunedCount === 1`.
- **Test 30 (`A clean pruning run reports correct prunedCount, retainedCount, and zero unverifiedCount`):**
  - Verified clean retention preserves exactly 5 newest backups and sentinels byte-for-byte.
- **Test 32 (`Candidate statSync() returning ENOENT is not counted as retained or unverified`):**
  - Verified candidate disappearing during inspection is not counted as retained or unverified.
- **Test 33 (`Candidate statSync() returning EIO is represented as unverified`):**
  - Verified candidate stat storage failure increments `unverifiedCount`.
- **Test 34 (`Candidate unlinkSync() returning ENOENT is not counted as retained or successfully pruned`):**
  - Verified candidate disappearing before deletion is not counted as pruned or retained.
- **Test 35 (`Candidate unlinkSync() returning EACCES is observable and accounted for in unverifiedCount`):**
  - Verified candidate unlink access denial increments `unverifiedCount` and records warning.
- **Test 36 (`Candidate unlinkSync() returning EIO is observable and accounted for in unverifiedCount`):**
  - Verified candidate unlink I/O error increments `unverifiedCount` and records warning.
- **Test 37 (`Unverified candidates are never deleted (conservative safety policy)`):**
  - Verified unverified candidate is never selected for unlink and remains intact on disk.

---

## 4. Modified Source Code Inventory

| File | Nature of Changes |
| :--- | :--- |
| `server/migrations/types.ts` | Refined `PruneResult` contract with `retainedCount: number | null` and `unverifiedCount: number`; documented count semantics. |
| `server/migrations/backup.ts` | Implemented Step 02.1.8 pruning accounting: directory inspection failure reports `retainedCount: null`; confirmed absent candidates (`ENOENT`) not counted as retained or unverified; candidate `statSync`/`unlinkSync` errors accounted in `unverifiedCount` with warnings; unverified candidates are never deleted. |
| `server/migrations/runner.ts` | Maintains post-commit pruning warnings propagation into `MigrationResult.backupPruneWarnings` without rolling back committed migrations. |
| `server/migrations/lock.ts` | Retains all Step 02.1.7 lock safety and 5-tuple ownership identity verification invariants. |
| `server/__tests__/migrations.test.ts` | Added 6 new regression tests (Tests 32-37 under Backup Pruning) and refined existing tests to assert exact `retainedCount: null`, `unverifiedCount`, and absent candidate handling (total: 97 migration tests, 165 project tests). |
| `docs/phase02-step-02.1.5-closure-report.md` | Updated closure report with Step 02.1.8 remediation details, test counts, and evidence. |
| `docs/phase02-implementation-report.md` | Updated Phase 02 implementation report with Step 02.1.8 defect resolutions and test evidence. |

---

## 5. Canonical Definition of Done Verdict

```text
VERDICT: PASS
EVIDENCE: npm test passed (4 test files, 165 tests passed, 0 failures; 97 migration tests in server/__tests__/migrations.test.ts); npm run lint passed (tsc --noEmit, 0 errors); npm run build passed (vite build, 1711 modules transformed, exit code 0); .data/nexora.sqlite verified untouched (10 tables, 0 Phase 02 tables, 48 products, 5 users, 6 orders).
CHANGES: server/migrations/backup.ts, server/migrations/types.ts, server/__tests__/migrations.test.ts, docs/phase02-step-02.1.5-closure-report.md, docs/phase02-implementation-report.md
UNVERIFIED: Persistent database production rollout (intentionally prohibited until explicitly authorized in Step 02.2).
ROLLBACK: git checkout d044386bee4267859c28b87e44031306932ab31b
```
