# NEXORA — Step 02.1.5 through Step 02.1.8 Closure Report
**Lock Filesystem Error Classification, Complete Ownership Identity, Atomic Publication & Semantically Accurate Backup Pruning Safety Closure**

- **Project:** NEXORA — Version B
- **Repository:** `https://github.com/Abdullah-AL-Ghoul/nexora`
- **Authorized Branch:** `main`
- **Approved Baseline Commit:** `1838c1f82015dc04133e1efe9a6f285d73d084e6`
- **Execution Date:** November 2026
- **Status:** Complete & Verified

---

## 1. Executive Summary & Defect Remediation Overview

This engineering closure report documents the completion of **STEP 02.1.5 through STEP 02.1.8: Lock Filesystem Error Classification, Complete Ownership Identity, Atomic Publication, Backup Cleanup Invariants & Semantically Accurate Backup Pruning Accounting**.

All operational safety gaps, race conditions, classification ambiguities, and accounting discrepancies identified during independent architecture reviews across Steps 02.1.5, 02.1.6, 02.1.7, and 02.1.8 have been systematically resolved and verified with automated regression test suites:

1. **Lock Inspection Directly from Storage (Elimination of `fs.existsSync` Blind Spot — Step 02.1.5 & Step 02.1.6):**
   - *Defect:* `MigrationLock.release()` previously relied on `fs.existsSync()`. In Node.js, `existsSync()` returns `false` on any access failure (such as `EACCES` or `EPERM`), which caused an inaccessible lock file to be wrongly classified as `ALREADY_ABSENT`, inadvertently wiping `acquired` and `acquisitionToken`.
   - *Resolution:* Eliminated `fs.existsSync()` from lock inspection.
     - Implemented `readLockOwner(): LockOwnerInspection` which performs direct `fs.readFileSync()`.
     - Confirmed absence (`ENOENT`) is cleanly distinguished from filesystem access denial (`EACCES`/`EPERM`) and hardware storage failures (`EIO`).
     - Returns explicit discriminated inspection statuses: `'VALID'`, `'ABSENT'`, `'MALFORMED'`, or `'FILESYSTEM_ERROR'`.
     - `release()` returns `ALREADY_ABSENT` ONLY when genuine absence (`ENOENT`) is confirmed.
     - Filesystem read errors (`EACCES`, `EIO`) return `FILESYSTEM_ERROR` and preserve `acquired` and `acquisitionToken`.
     - Filesystem failures never become `OWNERSHIP_MISMATCH`.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

2. **Malformed Lock Metadata Protection (Step 02.1.6):**
   - *Defect:* Previously, malformed JSON or corrupted files caused `readLockOwner()` to return `null`, which was treated generically without distinguishing format corruption from foreign ownership.
   - *Resolution:* Malformed JSON or corrupted payloads return `{ status: 'MALFORMED' }`. `release()` refuses to delete the file, returns `{ status: 'OWNERSHIP_MISMATCH' }` with descriptive details, and preserves internal acquisition tokens.
   - *Claim Classification:* **Verified by executed test**.

3. **Ownership Replacement Race Analysis & Threat-Model Documentation (Step 02.1.6):**
   - *Defect Review:* The window between inspecting lock owner metadata and executing `fs.unlinkSync()` could permit an adversarial replacement if another process or human operator forcibly overwrote the lock file out-of-band.
   - *Defensive Mitigation:* Implemented immediate pre-unlink re-verification. Before issuing `fs.unlinkSync()`, `release()` re-reads the lock file from disk. If the file on disk was modified, corrupted, or replaced with a foreign lock between initial read and unlink, the runner detects the mismatch, aborts the unlink, and returns `OWNERSHIP_MISMATCH`.
   - *Threat-Model Limitation & Operational Constraint:*
     - *Limitation:* Node.js standard library and host OS kernels (Win32, POSIX) do not provide a portable atomic `compare-and-unlink` system call. An irreducible sub-microsecond window exists between any user-space check and the OS kernel unlinking the directory entry.
     - *Required Operational Constraint:* Under Approach 2 (Conservative Fail-Closed Recovery), external actors and operators MUST NOT out-of-band overwrite or delete active lock files while a migration is in progress. Automatic stale-lock reclamation remains strictly forbidden.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

4. **Strict Pre-Unlink Classification & Complete 5-Tuple Ownership Identity (Step 02.1.7):**
   - *Defect:* Previously, the pre-unlink lock inspection mapped all non-VALID results to `OWNERSHIP_MISMATCH`, including confirmed absence and filesystem access denial. Furthermore, pre-unlink validation compared only the UUID acquisition token, omitting PID, hostname, acquisition timestamp, and database path.
   - *Resolution:*
     - Pre-unlink inspection explicitly maps `ABSENT` (`ENOENT`) to `ALREADY_ABSENT`, clearing internal tokens.
     - Pre-unlink inspection maps `FILESYSTEM_ERROR` (`EACCES`/`EIO`) directly to `FILESYSTEM_ERROR`, preserving tokens and refusing unlink.
     - Pre-unlink inspection maps `MALFORMED` to `OWNERSHIP_MISMATCH`, preserving tokens and refusing unlink.
     - Pre-unlink verification asserts the complete 5-tuple ownership identity (`token`, `pid`, `hostname`, `acquiredAt`, `dbPath`). Any variance produces `OWNERSHIP_MISMATCH` and aborts deletion.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

5. **Backup Artifact Cleanup Invariants & Durability (Step 02.1.6):**
   - *Defect:* Cleanup loops in `server/migrations/backup.ts` previously used `if (fs.existsSync(artifact)) fs.unlinkSync(artifact)`. If `existsSync()` returned `false` due to `EACCES` or `EIO`, the file was not deleted, no exception was caught, and cleanup failures disappeared silently.
   - *Resolution:*
     - Directly issues `fs.unlinkSync()` and `fs.rmdirSync()`.
     - Confirmed absence (`ENOENT`) is safely treated as already cleaned up.
     - Access denial (`EACCES`) and storage errors (`EIO`) are recorded in `cleanupWarnings` (on success) or `cleanupFailures` (on error).
     - Ownership metadata (`ownedStagingFile`, `ownedStagingDir`, `ownedFinalBackupPath`) is retained whenever cleanup cannot be confirmed.
     - Removed obsolete documentation claiming `copyFileSync` fallback; `linkSync` remains the only atomic publication primitive.
     - Pre-existing files and collision sentinels remain 100% byte-for-byte unchanged.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

6. **Backup Pruning Observability & Result Accuracy (Step 02.1.7 & Step 02.1.8):**
   - *Defect:* `pruneOldBackups()` previously calculated `retainedCount = validEntries.length - prunedCount`, which excluded candidates whose `statSync()` failed, failed to account for candidates disappearing between inspection and deletion, and reported 0 when directory enumeration failed.
   - *Resolution:*
     - Refactored `PruneResult` contract to distinguish `prunedCount` (successfully deleted), `retainedCount: number | null` (inspectable candidates selected to remain outside the deletion set, or `null` if directory inspection fails, never claiming 0), `unverifiedCount` (candidates with metadata or deletion failures), and `warnings`.
     - Confirmed absent candidates (`ENOENT`) during inspection or deletion are not counted as retained or unverified.
     - Unverified candidates are conservatively preserved and never deleted.
     - Post-commit pruning warnings are surfaced in `MigrationResult.backupPruneWarnings` without rolling back committed migrations.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

7. **Pruning Test Fidelity & Physical State Synchronization (Step 02.1.8.1):**
   - *Improvement:* Enhanced ENOENT regression tests (Tests 32 and 34) to physically unlink candidate files from disk during intercepted calls, verifying physical absence (`fs.existsSync(...) === false`) alongside exact counter assertions.
   - *Claim Classification:* **Verified by executed test**.

8. **Absolute Working Database Protection:**
   - Persistent database `.data/nexora.sqlite` was **never migrated or modified** (verified 10 physical tables, 0 Phase 02 domain tables, 48 products, 5 users, 6 orders intact).
   - *Claim Classification:* **Verified by executed test**.

---

## 2. Evidence-Based Verification Summary

All verification was conducted using the project's native test runner (`vitest`) and compilers:

| Verification Suite | Target | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Migration Suite** | `server/__tests__/migrations.test.ts` | **PASS** | 97 passed (97 tests, 0 failures) |
| **API Suite** | `server/__tests__/api.test.ts` | **PASS** | 30 passed (30 tests, 0 failures) |
| **Models Suite** | `server/__tests__/models.test.ts` | **PASS** | 27 passed (27 tests, 0 failures) |
| **Pricing Suite** | `server/__tests__/pricing.test.ts` | **PASS** | 11 passed (11 tests, 0 failures) |
| **Full Project Test Suite** | `npm test` | **PASS** | 4 test files, 165 passed (165 tests, 0 failures) |
| **TypeScript Typecheck** | `npm run lint` (`tsc --noEmit`) | **PASS** | 0 type errors, 0 warnings |
| **Frontend Production Build** | `npm run build` (`vite build`) | **PASS** | 1711 modules transformed, exit code 0 |
| **Persistent DB Verification** | `.data/nexora.sqlite` | **PASS** | 0 Phase 02 tables, 48 products, 5 users, 6 orders intact |

> [!NOTE]
> **Historical Test Suite Progression**:
> - Step 02.1 Baseline: 56 migration tests (124 project total)
> - Step 02.1.5 Baseline: 76 migration tests (144 project total)
> - Step 02.1.7 Baseline: 91 migration tests (159 project total)
> - Step 02.1.8 / 02.1.8.1 Final: 97 migration tests (165 project total across 4 test suites)

---

## 3. Detailed Verification Claims & Audit Evidence

### 3.1 Lock Lifecycle & Filesystem Error Classification (Step 02.1.5 & Step 02.1.6)
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

### 3.2 Step 02.1.7 Lock Revalidation Classification & Complete 5-Tuple Identity
- **Test 23 (`Pre-unlink inspection returning FILESYSTEM_ERROR on EACCES maps to FILESYSTEM_ERROR, preserves state, and does not unlink`):**
  - Verified access denial (`EACCES`) on pre-unlink inspection strictly yields `FILESYSTEM_ERROR`, never `OWNERSHIP_MISMATCH`.
  - Verified tokens and acquired state are preserved and lock file is untouched.
- **Test 24 (`Pre-unlink inspection returning FILESYSTEM_ERROR on EIO maps to FILESYSTEM_ERROR, preserves state, and does not unlink`):**
  - Verified storage I/O errors (`EIO`) on pre-unlink inspection strictly yield `FILESYSTEM_ERROR`, preserving state and refusing unlink.
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

### 3.3 Backup Cleanup Invariants & Durability (Step 02.1.6)
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

#### Exact Semantic Contract of `PruneResult` Counters
```ts
export interface PruneResult {
  prunedCount: number;
  retainedCount: number | null;
  unverifiedCount: number;
  warnings?: string[];
}
```

1. **`prunedCount` (number):**
   - The exact count of backup candidate files that were successfully unlinked from storage by this specific invocation.
   - Candidates that disappear before unlinking (`ENOENT`) are not counted as pruned.
   - Candidates whose unlinking fails (`EPERM`, `EACCES`, `EIO`) are not counted as pruned.

2. **`retainedCount` (number | null):**
   - The count of inspectable candidate paths selected by this invocation to remain outside the deletion set (`Math.min(validEntries.length, retainCount)`).
   - Returns strictly `null` if the backup directory cannot be enumerated (`EACCES`, `EIO`), explicitly communicating that the retained count is unknown rather than claiming zero.
   - Does NOT include unverified candidates (candidates whose metadata inspection failed).

3. **`unverifiedCount` (number):**
   - The count of individually enumerated candidate entries whose metadata inspection (`statSync`) or deletion (`unlinkSync`) could not be verified due to non-ENOENT filesystem errors (`EACCES`, `EPERM`, `EIO`).
   - Does NOT include candidates confirmed absent via `ENOENT`.
   - When directory enumeration fails, `unverifiedCount` is `0`, meaning no individual candidate was enumerated and classified; this does not prove that no unknown artifacts exist.

4. **`warnings` (string[] | undefined):**
   - Detailed array of diagnostic warnings recording exact file paths, filesystem operations, and system error codes for all non-fatal failures encountered during pruning.

#### Explicit Semantic Disclaimers & Operational Boundaries
- **Operation-Level Selection vs. Atomic Census:** `retainedCount` is an *operation-level selection count* (the number of inspected candidates selected by this invocation to remain outside the deletion set), NOT an atomic filesystem census.
- **Exclusion of Unverified Candidates:** Unverified candidates are excluded from `retainedCount` and tracked exclusively under `unverifiedCount`.
- **Directory Enumeration Failure Semantics:** When directory enumeration fails (`readdirSync` throws `EACCES` or `EIO`), `retainedCount` must be `null` (never `0`), and `unverifiedCount: 0` denotes that zero individual candidates could be enumerated and inspected—it does not certify that no unknown artifacts reside in the directory.
- **Concurrent External Changes:** Concurrent external filesystem modifications can alter physical directory contents after inspection. Node.js standard library does not provide atomic directory snapshotting.

#### Regression Test Evidence (Tests 25–37)
- **Test 25 (`Directory ENOENT returns accurate zero counts`):**
  - Confirmed `{ prunedCount: 0, retainedCount: 0, unverifiedCount: 0 }` with no warnings.
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
- **Test 32 (`Candidate statSync() returning ENOENT is not counted as retained or unverified` — High-Fidelity Disk Deletion):**
  - Candidate physically removed from disk during intercepted call using original unlink.
  - Verified candidate is physically absent on disk (`fs.existsSync(disappearedFile) === false`).
  - Verified candidate is neither retained nor unverified nor counted as pruned (`prunedCount: 1`, `retainedCount: 5`, `unverifiedCount: 0`, `warnings: undefined`).
- **Test 33 (`Candidate statSync() returning EIO is represented as unverified`):**
  - Verified candidate stat storage failure increments `unverifiedCount`.
- **Test 34 (`Candidate unlinkSync() returning ENOENT is not counted as retained or successfully pruned` — High-Fidelity Disk Deletion):**
  - Candidate physically removed from disk during intercepted call using original unlink.
  - Verified candidate is physically absent on disk (`fs.existsSync(disappearedCandidate) === false`).
  - Verified not counted as successfully pruned or retained (`prunedCount: 1`, `retainedCount: 5`, `unverifiedCount: 0`, `warnings: undefined`).
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
| `server/migrations/lock.ts` | Retains all Step 02.1.7 lock safety, pre-unlink classification, and 5-tuple ownership identity verification invariants. |
| `server/__tests__/migrations.test.ts` | Enhanced Tests 32 and 34 to physically delete candidates during intercepted calls asserting physical absence (`fs.existsSync(...) === false`); verified all 97 migration tests (165 project tests total). |
| `docs/phase02-step-02.1.5-closure-report.md` | Consolidated engineering closure report covering Step 02.1.5 through Step 02.1.8 with exact counter semantics, disclaimers, test evidence, and updated totals. |
| `docs/phase02-implementation-report.md` | Consolidated Phase 02 implementation report updated to v1.8.0, covering Step 02.1 through Step 02.1.8 with verified test counts, schema state distinction, and audit snapshots. |

---

## 5. Canonical Definition of Done Verdict

```text
VERDICT: PASS
EVIDENCE: npm test passed (4 test files, 165 tests passed, 0 failures; 97 migration tests in server/__tests__/migrations.test.ts); npm run lint passed (tsc --noEmit, 0 errors); npm run build passed (vite build, 1711 modules transformed, exit code 0); .data/nexora.sqlite verified untouched (10 tables, 0 Phase 02 tables, 48 products, 5 users, 6 orders).
CHANGES: server/__tests__/migrations.test.ts, docs/phase02-step-02.1.5-closure-report.md, docs/phase02-implementation-report.md
UNVERIFIED: Persistent database production rollout (intentionally prohibited until explicitly authorized in Step 02.2).
ROLLBACK: git checkout 1838c1f82015dc04133e1efe9a6f285d73d084e6
```
