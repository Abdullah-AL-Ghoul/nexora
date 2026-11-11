# NEXORA — Step 02.1.5 through Step 02.1.9.2 Closure Report
**Lock Filesystem Error Classification, Complete Ownership Identity, Atomic Publication, Semantically Accurate Backup Pruning, Path-Type / Inode Safety & POSIX Verification**

- **Project:** NEXORA — Version B
- **Repository:** `https://github.com/Abdullah-AL-Ghoul/nexora`
- **Authorized Branch:** `main`
- **Approved Baseline Commit:** `83a2e100702a27ad99e459e8da11386f871aea06`
- **Completion Commit:** `bea8915fadc8344b35802eed9efd895b72839d87`
- **Linux CI Run (Ubuntu / Node.js 24):** https://github.com/Abdullah-AL-Ghoul/nexora/actions/runs/43048593311 (Status: Success)
- **Execution Date:** November 2026
- **Status:** Complete & Verified

---

## 1. Executive Summary & Defect Remediation Overview

This engineering closure report documents the completion of **STEP 02.1.5 through STEP 02.1.9.2: Lock Filesystem Error Classification, Complete Ownership Identity, Atomic Publication, Backup Cleanup Invariants, Semantically Accurate Backup Pruning Accounting, Artifact Access-Control Hardening, Path-Type / Inode Safety & Genuine POSIX Verification**.

All operational safety gaps, race conditions, classification ambiguities, accounting discrepancies, filesystem access-control findings, and path-type / inode security risks identified during independent architecture reviews across Steps 02.1.5 through 02.1.9.2 have been systematically resolved and verified with automated regression test suites:

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

3. **Ownership Replacement Race Analysis & Threat-Model Documentation (Step 02.1.6 & Step 02.1.9.1):**
   - *Defect Review:* The window between inspecting lock owner metadata and executing `fs.unlinkSync()` could permit an adversarial replacement if another process or human operator forcibly overwrote the lock file out-of-band.
   - *Defensive Mitigation:* Implemented immediate pre-unlink re-verification. Before issuing `fs.unlinkSync()`, `release()` re-reads the lock file from disk. If the file on disk was modified, corrupted, or replaced with a foreign lock between initial read and unlink, the runner detects the mismatch, aborts the unlink, and returns `OWNERSHIP_MISMATCH`.
   - *Threat-Model Limitation & Operational Constraint:*
     - *Limitation:* Node.js standard library and host OS kernels (Win32, POSIX) do not provide a portable atomic `compare-and-unlink` system call. Pre-unlink ownership re-verification exists, but the check and the path-based `unlinkSync()` are not a single atomic operating-system operation. A residual time-of-check to time-of-use (TOCTOU) race remains between the check and unlink.
     - *Required Operational Constraint:* Under Approach 2 (Conservative Fail-Closed Recovery), external actors and operators MUST NOT out-of-band overwrite or delete active lock files while a migration is in progress. Automatic stale-lock reclamation remains strictly forbidden. The residual race is not claimed to be mathematically eliminated; safety is enforced via fail-closed recovery and operational isolation.
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

8. **Filesystem Access-Control Hardening (Step 02.1.9.1 — F-03 Closure):**
   - *Finding Review:* Previously, directories and staging artifacts were created relying on ambient process `umask` without explicit restrictive mode bits.
   - *Resolution:*
     - Backup directory enforced to mode `0700` (`drwx------`). Pre-existing backup directories are inspected and safely tightened to `0700` on POSIX; failure to secure fails closed.
     - Staging directories created with mode `0700`.
     - Staging files created with exclusive `wx` flag and explicit restrictive mode `0600` (`-rw-------`).
     - Hard-link published backup artifacts retain mode `0600` via inode preservation with post-publication verification.
     - Pre-existing Nexora backup artifacts matching `nexora.sqlite.bak_*.sqlite` on POSIX are inspected and tightened to `0600`. Pre-existing files are **never deleted or overwritten**. Collision sentinels remain completely untouched.
     - Migration lock files created exclusively with mode `0600` on POSIX. Parent database directory is never chmodded indiscriminately.
     - Windows NTFS platform limitation is explicitly documented: Windows does not use POSIX permission bits, relying instead on inherited NTFS ACLs of the `.data` directory.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

9. **Filesystem Path-Type, Inode Safety & Descriptor-Based Protection (Step 02.1.9.2 — F-04 Closure):**
   - *Finding Review:* Previous implementation used `statSync()`, which follows symbolic links, did not inspect hard-link counts (`nlink`), and relied on path-based chmod operations vulnerable to path replacement races.
   - *Resolution:*
     - Backup directory validation uses `fs.lstatSync(backupDir)`: rejects symbolic links with explicit `MigrationBackupError`, requiring a real directory without following or altering target permissions.
     - Existing backup candidates matching `nexora.sqlite.bak_*.sqlite` are inspected using `fs.lstatSync`: symbolic links are rejected with `MigrationBackupError`; regular files are strictly required (`!artStat.isFile()` rejected).
     - Inode & hard-link count policy: candidate artifacts with `nlink > 1` fail closed with `MigrationBackupError` reporting path and `nlink` count to protect external inodes from unauthorized permission modification.
     - `pruneOldBackups()` uses `fs.lstatSync`: symlink candidates and non-regular files are never deleted or followed, incrementing `unverifiedCount` with observable warnings; hard-link candidates (`nlink > 1`) are preserved to protect shared inodes.
     - `createWalSafeBackup()` validates destination with `fs.lstatSync` prior to creation and publication.
     - `MigrationLock` validates lock directory and lock file with `fs.lstatSync`; symbolic links are rejected, with `readLockOwner()` mapping symlink lock files to `MALFORMED`, preventing `release()` from ever unlinking through a symlink.
     - TOCTOU mitigation: on POSIX, descriptor-based operations (`fs.openSync` with `O_RDONLY | (O_NOFOLLOW ?? 0)`, `fs.fstatSync`, and `fs.fchmodSync`) are used to prevent path replacement races between inspection and permission setting.
   - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

10. **Exact Permission Semantics & Owner Deficit Detection (Step 02.1.9.2 — F-06 Closure):**
    - *Finding Review:* Previous permission check only evaluated `(mode & 0o077) !== 0`, which missed owner permission deficits (e.g. `0400`, `0500`, `0000`).
    - *Resolution:*
      - Exact target modes enforced: backup dir `0700`, staging dir `0700`, staging file `0600`, published backup `0600`, lock file `0600`.
      - Directory and artifact remediation detects owner deficits as well as group/other permissions: `(mode & 0o777) !== targetMode`.
      - Effective modes verified post-remediation via `lstatSync` / `fstatSync`; fails closed with `MigrationBackupError` if exact mode is not established.
    - *Claim Classification:* **Verified by executed test** and **Verified by source inspection**.

11. **Genuine POSIX Verification & CI Automation (Step 02.1.9.2 — F-05 Closure):**
    - Established GitHub Actions CI workflow (`.github/workflows/ci.yml`) targeting `ubuntu-latest` with `node-version: 24`.
    - Executes `npm ci`, `npm run lint`, `npm run build`, and `npm test -- --run` on native Linux with 0 skipped POSIX tests.
    - *Claim Classification:* **Verified by automated CI workflow**.

12. **Absolute Working Database Protection:**
    - Persistent database `.data/nexora.sqlite` was **never migrated or modified** (verified 10 physical tables, 0 Phase 02 domain tables, 48 products, 5 users, 6 orders intact).
    - *Claim Classification:* **Verified by executed test**.

---

## 2. Evidence-Based Verification Summary

All verification was conducted using the project's native test runner (`vitest`) and compilers:

| Verification Suite | Target | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Migration Suite** | `server/__tests__/migrations.test.ts` | **PASS** | 117 tests total (103 passed, 14 skipped on Windows, 0 failures; 117 passed on Linux) |
| **API Suite** | `server/__tests__/api.test.ts` | **PASS** | 30 passed (30 tests, 0 failures) |
| **Models Suite** | `server/__tests__/models.test.ts` | **PASS** | 27 passed (27 tests, 0 failures) |
| **Pricing Suite** | `server/__tests__/pricing.test.ts` | **PASS** | 11 passed (11 tests, 0 failures) |
| **Full Project Test Suite** | `npm test` | **PASS** | 4 test files, 185 tests (171 passed, 14 skipped on Windows, 0 failures; 185 passed on Linux) |
| **TypeScript Typecheck** | `npm run lint` (`tsc --noEmit`) | **PASS** | 0 type errors, 0 warnings |
| **Frontend Production Build** | `npm run build` (`vite build`) | **PASS** | 1711 modules transformed, exit code 0 |
| **Persistent DB Verification** | `.data/nexora.sqlite` | **PASS** | 0 Phase 02 tables, 48 products, 5 users, 6 orders intact |

> [!NOTE]
> **Historical Test Suite Progression**:
> - Step 02.1 Baseline: 56 migration tests (124 project total)
> - Step 02.1.5 Baseline: 76 migration tests (144 project total)
> - Step 02.1.7 Baseline: 91 migration tests (159 project total)
> - Step 02.1.8 / 02.1.8.1 Final: 97 migration tests (165 project total)
> - Step 02.1.9.1 Access-Control Baseline: 107 migration tests (175 project total; 168 passed, 7 skipped on Windows)
> - Step 02.1.9.2 Path & Inode Safety Final: 117 migration tests (185 project total; 171 passed, 14 skipped on Windows, 0 failures; 185 passed on Linux POSIX)

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
   - Count of inspectable candidate paths selected by this invocation to remain outside the deletion set (`Math.min(validEntries.length, retainCount)`). This is an operation-level selection count, not an atomic filesystem census.
   - Returns strictly `null` if the backup directory cannot be enumerated (`EACCES`, `EIO`), explicitly communicating that the retained count is unknown rather than claiming zero.
   - Does NOT include unverified candidates (candidates whose metadata inspection failed).

3. **`unverifiedCount` (number):**
   - The count of individually enumerated candidate entries whose metadata inspection (`statSync`) or deletion (`unlinkSync`) could not be verified due to non-ENOENT filesystem errors (`EACCES`, `EPERM`, `EIO`).
   - Does NOT include candidates confirmed absent via `ENOENT`.
   - When directory enumeration fails, `unverifiedCount` is `0`, meaning no individual candidate was enumerated and classified; this does not prove that no unknown artifacts exist.

4. **`warnings` (string[] | undefined):**
   - Detailed array of diagnostic warnings recording exact file paths, filesystem operations, and system error codes for all non-fatal failures encountered during pruning.

### 3.6 Step 02.1.9.1 Filesystem Access-Control Hardening & Regression Evidence

#### Invariants & Policies
- **Backup Directory:** Enforced to mode `0700` (`drwx------`).
- **Staging Directory:** Enforced to mode `0700` (`drwx------`).
- **Staging File:** Created exclusively via `fs.openSync(stagingFile, 'wx', 0o600)` with explicit `fs.chmodSync(stagingFile, 0o600)`.
- **Published Backup Artifact:** Retains `0600` mode via inode preservation through hard link (`fs.linkSync`), with post-publication mode verification.
- **Migration Lock File:** Created exclusively with `mode: 0o600` and enforced via `fs.chmodSync(this.lockFilePath, 0o600)` on POSIX. Parent database directory is never chmodded indiscriminately.
- **Pre-Existing Backup Directory & Artifacts:**
  - Permissive backup directories (`(mode & 0o077) !== 0`) are safely tightened to `0700`. If tightening fails or directory remains permissive, fails closed with `MigrationBackupError`.
  - Permissive pre-existing backup artifacts matching `nexora.sqlite.bak_*.sqlite` are safely tightened to `0600`.
  - Pre-existing backup files are **never deleted or overwritten**.
  - Unrelated files and collision sentinels are completely untouched.
- **Windows Platform Behavior:** Windows NTFS does not use POSIX permission bits; Node.js `chmod` on Windows only toggles `FILE_ATTRIBUTE_READONLY`. Access control on Windows relies on inherited NTFS ACLs of the `.data` directory. Deployments on Windows must secure the parent directory via NTFS ACLs for the service account.

#### Regression Test Evidence (Tests 1–10 under Filesystem Access-Control)
- **Test 1 (`Newly created backup directory is initialized without clobbering`):**
  - Confirmed directory creation without touching existing files. (Passed on Windows & POSIX).
- **Test 2 (`Newly created backup directory receives restrictive mode 0700 on POSIX`):**
  - Confirmed mode `0700`. (Conditionally skipped on Windows).
- **Test 3 (`Newly created staging directory and staging file receive restrictive modes (0700 / 0600) on POSIX`):**
  - Confirmed staging dir `0700` and staging file `0600`. (Conditionally skipped on Windows).
- **Test 4 (`Published hard-link backup retains expected restrictive file permissions (0600) on POSIX`):**
  - Confirmed published backup inode retains `0600`. (Conditionally skipped on Windows).
- **Test 5 (`Existing permissive backup directory is safely tightened to 0700 on POSIX`):**
  - Confirmed `0777` directory is tightened to `0700`. (Conditionally skipped on Windows).
- **Test 6 (`Existing backup artifacts are never deleted or overwritten by permission remediation`):**
  - Pre-existing backup and collision sentinel files verified 100% byte-for-byte intact after `ensureSecureBackupDirectory()`. (Passed on Windows & POSIX).
- **Test 7 (`Permission tightening failure on backup directory fails closed with MigrationBackupError`):**
  - Injected `EACCES` on directory chmod; verified fail-closed `MigrationBackupError`. (Conditionally skipped on Windows).
- **Test 8 (`Permission tightening failure on existing backup artifact fails closed with MigrationBackupError`):**
  - Injected `EPERM` on artifact chmod; verified fail-closed `MigrationBackupError` reporting affected file. (Conditionally skipped on Windows).
- **Test 9 (`Lock file permissions are restrictive (0600) after acquisition on POSIX`):**
  - Confirmed lock file mode `0600` on POSIX. (Conditionally skipped on Windows).
- **Test 10 (`Foreign lock files and collision sentinels remain untouched across permission checks and acquisitions`):**
  - Confirmed foreign lock file is preserved 100% byte-for-byte and acquisition fails closed. (Passed on Windows & POSIX).

### 3.8 Path-Type, Inode Safety & Exact Permission Evidence (Step 02.1.9.2 Tests 1–10)
- **Test 1 (`Symbolic-link backup directory is rejected without modifying external target`):**
  - Confirmed `MigrationBackupError` thrown with explicit symlink rejection message; target canary content and mode unchanged.
- **Test 2 (`Existing backup artifact that is a symbolic link is rejected without modifying target`):**
  - Confirmed symlink artifact rejected with `MigrationBackupError`; target file secret data and mode unchanged.
- **Test 3 (`Existing backup artifact with multiple hard links (nlink > 1) fails closed without modifying permissions`):**
  - Confirmed `MigrationBackupError` thrown reporting `nlink > 1`; shared external file content and mode unchanged.
- **Test 4 (`Non-regular filesystem entry matching backup pattern is rejected`):**
  - Confirmed subdirectory matching backup artifact pattern rejected with `MigrationBackupError` ("is not a regular file").
- **Test 5 (`Existing directory with owner deficits (0400, 0500) is tightened to exact 0700 on POSIX`):**
  - Confirmed directory permissions tightened from `0500` and `0400` to exact `0700`.
- **Test 6 (`Existing backup artifact with owner deficit (0400) is tightened to exact 0600 on POSIX`):**
  - Confirmed existing backup artifact permissions tightened from `0400` to exact `0600`.
- **Test 7 (`pruneOldBackups skips symlink candidates without deleting or following them`):**
  - Confirmed symlink candidate not deleted, external target file intact, `unverifiedCount >= 1`, warning recorded.
- **Test 8 (`pruneOldBackups skips hard-linked candidates (nlink > 1) without deleting shared inode`):**
  - Confirmed hard-linked candidate not deleted, external shared file intact, `unverifiedCount >= 1`, warning recorded.
- **Test 9 (`MigrationLock rejects lock file that is a symbolic link and does not delete target on release`):**
  - Confirmed `readLockOwner()` returns `MALFORMED`, `release()` returns `NOT_HELD`, external secret file preserved intact.
- **Test 10 (`MigrationLock rejects lock directory that is a symbolic link`):**
  - Confirmed `MigrationLock.acquire()` fails closed with `MigrationLockError` when lock directory is a symbolic link.

---

## 4. Modified Source Code Inventory

| File | Nature of Changes |
| :--- | :--- |
| `server/migrations/backup.ts` | Hardened `ensureSecureBackupDirectory()` with `lstatSync` (symlink rejection, regular file check, `nlink > 1` hard link protection); enforced exact `0700`/`0600` modes with owner deficit detection; descriptor-based `fchmodSync` / `fstatSync` with `O_NOFOLLOW` on POSIX; hardened `pruneOldBackups` with `lstatSync` to skip symlinks, non-regular files, and shared inodes (`nlink > 1`); validated `finalBackupPath` destination with `lstatSync`. |
| `server/migrations/lock.ts` | Hardened `MigrationLock` to inspect lock directory with `lstatSync` (rejecting symlink directories); hardened `readLockOwner()` with `lstatSync` to map symlink lock files to `MALFORMED`, preventing `release()` from unlinking through symlinks; enforced exact `0600` verification on acquisition. |
| `server/migrations/types.ts` | Updated `retainedCount` JSDoc to precise operation-level selection count wording. |
| `server/migrations/runner.ts` | Maintained all Step 02.1.8 and 02.1.7 invariants; integrated secure backup directory enforcement and pruning observability. |
| `server/__tests__/migrations.test.ts` | Added 10 new regression tests covering F-04 (symlink backup dir/artifact rejection, hard-link `nlink > 1` protection, non-regular file rejection, symlink lock rejection, pruning symlink/hardlink protection) and F-06 (exact `0700`/`0600` modes with owner deficits `0400`/`0500`), bringing suite total to 117 migration tests (185 project total; 171 passed, 14 skipped on Windows, 0 failures; 100% pass on Linux POSIX). |
| `.github/workflows/ci.yml` | Added GitHub Actions CI workflow running on `ubuntu-latest` with `node-version: 24`, executing `npm ci`, `npm run lint`, `npm run build`, and `npm test -- --run` for genuine Linux POSIX verification. |
| `docs/phase02-step-02.1.5-closure-report.md` | Consolidated engineering closure report covering Step 02.1.5 through Step 02.1.9.2 with access-control, path-type, and inode safety invariants, test evidence, and updated totals. |
| `docs/phase02-implementation-report.md` | Consolidated Phase 02 implementation report updated to v1.9.2, covering Step 02.1 through Step 02.1.9.2 with verified test counts, schema state distinction, and audit snapshots. |

---

## 5. Canonical Definition of Done Verdict

```text
VERDICT: PASS
EVIDENCE: npm test passed (4 test files, 185 tests total: 171 passed, 14 skipped on Windows due to POSIX mode checks, 0 failures; 117 migration tests in server/__tests__/migrations.test.ts); npm run lint passed (tsc --noEmit, 0 errors); npm run build passed (vite build, 1711 modules transformed, exit code 0); .data/nexora.sqlite verified untouched (10 tables, 0 Phase 02 tables, 48 products, 5 users, 6 orders).
CHANGES: server/migrations/backup.ts, server/migrations/lock.ts, server/__tests__/migrations.test.ts, .github/workflows/ci.yml, docs/phase02-step-02.1.5-closure-report.md, docs/phase02-implementation-report.md
UNVERIFIED: Persistent database production rollout (intentionally prohibited until explicitly authorized in Step 02.2).
ROLLBACK: git checkout 83a2e100702a27ad99e459e8da11386f871aea06
```
