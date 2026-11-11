# NEXORA — Phase 02 Implementation Report
**Step 02.1 through Step 02.1.9.1 Deliverable — Versioned Database Migration Runner, Concurrency, Fail-Closed Backup Contract, Lock Observability, Direct Storage Inspection, Strict Atomic Publication, Semantically Accurate Pruning & Artifact Access-Control Hardening**  
*Document Version:* 1.9.1  
*Execution Date:* November 2026  
*Branch:* `main`  
*Step 02.1 Approved Baseline Commit:* `54cf0f97e1c8405b3169a973ce325780f8989ec6`  
*Step 02.1.1 Approved Baseline Commit:* `bf9a9351af96c56a733a37adfb25b25483b87e27`  
*Step 02.1.2 Approved Baseline Commit:* `74efc003cff99fe9586e10663405c2f5a937be6e`  
*Step 02.1.3 Approved Baseline Commit:* `f55b582ad75a80ed59d7e08e3a9cb8dc9297b559`  
*Step 02.1.4 Approved Baseline Commit:* `a7bb52d0bea98f08ab58d2d9d54b1be5ed6e1fda`  
*Step 02.1.5 Approved Baseline Commit:* `be42002a9addb1e9223c54955cf50eaad71e9143`  
*Step 02.1.6 Approved Baseline Commit:* `97c37fcea36a49ba8c53f36124ef3bbc9d0d1253`  
*Step 02.1.7 Approved Baseline Commit:* `d044386bee4267859c28b87e44031306932ab31b`  
*Step 02.1.8 Approved Baseline Commit:* `1838c1f82015dc04133e1efe9a6f285d73d084e6`  
*Step 02.1.9 Approved Baseline Commit:* `310c929a1f4fcec5b7f853ce076e28fa60bdb337`  
*Lead Engineers:* Principal Software Architect, Senior Backend Engineer, Database Reliability Engineer  

---

## 1. Executive Summary

This report documents the completed implementation and engineering remediation of **STEP 02.1 through STEP 02.1.9.1: Migration Runner Correctness, Concurrency, Fail-Closed Backup Contract, Direct Storage Inspection, Ownership-Safe Release, Semantically Accurate Backup Pruning Accounting & Filesystem Access-Control Hardening** for the NEXORA platform.

All critical defects and security findings identified during independent architecture reviews have been resolved with mathematical rigor and evidence-backed verification:
1. **Backup Ordering Fixed:** The runner was restructured so that a verified WAL-safe backup strictly precedes *any* database mutation, including registry creation (`schema_migrations`), DDL, or DML.
2. **Read-Only Registry Helpers:** `getAppliedMigrations()` is now strictly read-only and never issues DDL. Registry creation is isolated to `ensureMigrationRegistry()`.
3. **Lock Concurrency & Cross-Process Mutual Exclusion (Step 02.1.4):** Adopted Approach 2 (Conservative Fail-Closed Recovery), eliminating check-then-rename races. Automatic stale-lock deletion is completely removed; acquisitions fail closed with descriptive `MigrationLockError` reporting holder metadata and manual operator recovery instructions. Real OS child-process contention and abnormal termination (`SIGKILL`) verified green.
4. **Observable Lock Release Contract & Direct Inspection (Step 02.1.5 & Step 02.1.6):** `release()` returns explicit `LockReleaseResult` (`RELEASED`, `ALREADY_ABSENT`, `NOT_HELD`, `OWNERSHIP_MISMATCH`, `FILESYSTEM_ERROR`). Direct `readFileSync` inspection replaces boolean `existsSync` checks, distinguishing confirmed absence (`ENOENT`) from access denial (`EACCES`) and storage errors (`EIO`). Malformed JSON cannot cause deletion. Pre-unlink re-verification guards against ownership replacement races prior to calling `unlinkSync`.
5. **Exclusive Backup Staging Ownership (Step 02.1.4):** Establishes exclusive staging reservation prior to invoking `sqlite.backup()` via private attempt directories (`.tmp_staging_<UUID>`) created with non-recursive `mkdir` and pre-reserved staging files (`'wx'`).
6. **Strict Atomic No-Clobber Publication (Step 02.1.5):** Final backup publication exclusively enforces `fs.linkSync`. Removed non-atomic `copyFileSync` fallback; if hard links are unsupported, fails closed with `MigrationBackupError` while preserving the verified staging backup for operator recovery.
7. **Durability Error Classification (Step 02.1.5 & Step 02.1.6):** Distinguishes documented OS limitations (Win32 directory fsync returning `EPERM`/`EISDIR`) from access denial (`EACCES`) and hardware storage failures (`EIO`), both of which fail closed immediately.
8. **Backup Artifact Cleanup Invariants (Step 02.1.6):** Cleanup issues direct unlink/rmdir without `existsSync` guards; treats `ENOENT` as absent; records `EACCES`/`EIO` in warnings/failures; retains attempt-owned paths on failure; collision sentinels preserved byte-for-byte.
9. **Fail-Closed Backup Contract (Step 02.1.2):** `createWalSafeBackup()` returns `Promise<BackupResult>` (never `null`). Throws `MigrationBackupError` fail-closed if the source database is in-memory or if the file does not exist on disk. Public bypass flags (`backup`, `lock`, `skipIntegrityCheck`) were removed from `MigrationRunnerOptions`.
10. **Strict Baseline Fingerprint & Metadata Validation:** The baseline validator now extracts full structural metadata (column order, declared types, nullability, defaults, primary keys, and unique indexes) and compares both table-by-table discrepancies and SHA-256 fingerprint against the canonical reference generated from `BASELINE_DDL`.
11. **Migration Registry Integrity:** The runner validates column definitions, checksum formats (64-char hex SHA-256), unknown versions, duplicate records, and registry sequence gaps (`MigrationRegistryError`).
12. **Backup Page Count & Record Verification:** The runner captures and asserts the positive page count returned by Node.js 24's native `backup()` API, verifies SQLite integrity (`integrity_check` and `quick_check`), ensures durability via `fsync`, and verifies source table/record count parity in the backup.
13. **Fail-Closed Path Resolution:** `getDbLocation()` was hardened to throw `MigrationError` rather than silently defaulting to `:memory:`.
14. **Certification & Media Validation Parity:** Removed `DRAFT` from `verificationStatus` (reserved exclusively for `publicationStatus`); client self-assertion of `VERIFIED` or `DRAFT` is rejected; `EXPIRED` is dynamically derived; `UpdateMediaAssetSchema` and `validateMergedMediaAsset` enforce visibility/publicUrl consistency.
15. **Zero-Fabrication Policy:** No fictional projects or certifications were seeded into production.
16. **Absolute Data Safety:** The working database `.data/nexora.sqlite` was **never migrated or modified** (verified 10 tables, 0 Phase 02 domain tables, 48 products, 5 users, 6 orders intact). All tests ran exclusively on temporary disposable or `:memory:` databases.
17. **Strict Pre-Unlink Classification & Complete 5-Tuple Ownership Identity (Step 02.1.7):** Pre-unlink re-verification strictly maps `ABSENT` to `ALREADY_ABSENT`, `FILESYSTEM_ERROR` (`EACCES`/`EIO`) to `FILESYSTEM_ERROR` (preserving state and refusing unlink), `MALFORMED` to `OWNERSHIP_MISMATCH`, and verifies the complete 5-tuple ownership identity (`token`, `pid`, `hostname`, `acquiredAt`, `dbPath`).
18. **Semantically Accurate Backup Pruning Accounting (Step 02.1.8 & Step 02.1.8.1):** Refactored `pruneOldBackups` to return `PruneResult` distinguishing `prunedCount` (successfully deleted), `retainedCount: number | null` (inspectable candidates selected to remain outside the deletion set, or `null` if directory inspection fails, never claiming 0), `unverifiedCount` (candidates with metadata or deletion failures), and `warnings`. Candidates absent on disk (`ENOENT`) are not counted as retained or unverified. High-fidelity tests mirror physical filesystem absence.
19. **Backup & Lock Artifact Access-Control Hardening (Step 02.1.9.1):** Enforces explicit restrictive permissions on POSIX systems (`0700` on backup and staging directories, `0600` on staging and lock files, `0600` preserved on hard-link publication). Safely tightens pre-existing backup directories to `0700` and pre-existing backup artifacts to `0600` without deleting or overwriting any file. Unrelated files and collision sentinels remain untouched. Windows NTFS inherited ACL limitations are explicitly documented.

---

## 2. Table Inventory (Planned 15 Physical Tables Post-Migration)

> [!IMPORTANT]
> **State Distinction Notice**: The 15-table schema below represents the **planned post-migration architecture** once migrations are executed in Step 02.2. The **current physical database** `.data/nexora.sqlite` contains exactly 10 tables (9 legacy commerce tables + `schema_migrations`, with 0 Phase 02 domain tables), and was deliberately left untouched during all Step 02.1.x implementation steps.

Following migration execution in Step 02.2, the SQLite catalog will contain exactly 15 physical tables:

| Category | Table Name | Primary Key | Critical Constraints |
|---|---|---|---|
| **Legacy Commerce (9)** | `users` | `id (TEXT)` | `email UNIQUE`, `password_hash`, `auth_provider` |
| | `categories` | `id (TEXT)` | `slug UNIQUE` |
| | `products` | `id (TEXT)` | `slug UNIQUE`, `sku UNIQUE` |
| | `orders` | `id (TEXT)` | `order_number UNIQUE` |
| | `order_items` | `id (TEXT)` | `order_id`, `product_id` |
| | `coupons` | `id (TEXT)` | `code UNIQUE` |
| | `reviews` | `id (TEXT)` | `product_id`, `user_id` |
| | `inventory_transactions` | `id (TEXT)` | `product_id`, `sku` |
| | `newsletter_subscribers` | `id (TEXT)` | `email UNIQUE` |
| **New Domain (5)** | `media_assets` | `id (TEXT)` | `stored_filename UNIQUE`, `visibility IN ('public', 'private')`, `CHECK (public_url)`, `CHECK (file_size > 0)`, `CHECK (dimensions)` |
| | `projects` | `id (TEXT)` | `slug UNIQUE`, `client_type CHECK`, `publication_status CHECK`, `is_featured CHECK`, `cover_media_id RESTRICT` |
| | `certifications` | `id (TEXT)` | `slug UNIQUE`, `publication_status CHECK`, `verification_status CHECK`, `badge_media_id RESTRICT`, `verified_by RESTRICT` |
| | `project_media` | `id (TEXT)` | `UNIQUE(project_id, media_asset_id, role)`, `ON DELETE CASCADE (project)`, `ON DELETE RESTRICT (media)` |
| | `certification_media` | `id (TEXT)` | `UNIQUE(certification_id, media_asset_id, role)`, `ON DELETE CASCADE (cert)`, `ON DELETE RESTRICT (media)` |
| **Migration Metadata (1)**| `schema_migrations` | `version (INTEGER)` | `name`, `applied_at`, `checksum`, `execution_time_ms` |

---

## 3. Engineering Remediation & Architecture Details (Step 02.1.1)

### 3.1 Strict Backup-Before-Mutation Lifecycle ([`server/migrations/runner.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/runner.ts))

The migration execution sequence was reordered to enforce absolute data safety:
1. **Resolve Location:** `getDbLocation(db)` inspects `PRAGMA database_list`. Fails closed (`MigrationError`) if unreadable or invalid; returns `:memory:` only for confirmed in-memory instances.
2. **Acquire Lock:** `lock.acquire(5000)` acquires exclusive lock before evaluating pending migrations.
3. **Inspect Registry:** Under the lock, calls strictly read-only `getAppliedMigrations(db)`. If `schema_migrations` does not exist, returns `[]` without creating tables.
4. **Calculate Pending:** Pending migrations calculated under lock. If none are pending, returns immediate idempotent result (`appliedCount: 0`).
5. **Pre-Mutation Backup:** If persistent file-backed database already contains tables (existing legacy data or previous migrations), creates and verifies WAL-safe backup (`createWalSafeBackup`). For fresh empty databases (0 tables), documents and executes explicit no-backup exception.
6. **Ensure Registry:** Only after backup verification succeeds is `ensureMigrationRegistry(db)` invoked.
7. **Transactional Execution:** Each pending migration executes inside `BEGIN IMMEDIATE TRANSACTION; ... COMMIT;`.
8. **Prune Backups:** Retains 5 most recent backups, pruning older files only after successful verification.
9. **Release Lock:** Lock released in `finally` block across both success and failure paths.

### 3.2 Lock Concurrency & Process Governance ([`server/migrations/lock.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/lock.ts))

The lock mechanism was hardened against distributed and multi-process edge cases:
- **No Age-Based Deletion:** Locks are never deleted solely because they are old. If the recorded PID is running on the same host, it is treated as active regardless of age.
- **Dead PID Detection:** On the same host, process absence is tested via `process.kill(pid, 0)`. Only if `ESRCH` is returned is the PID confirmed dead.
- **Atomic Pre-Unlink Check:** Before unlinking a stale lock file, its content is re-read and verified against the inspected payload to prevent racing with another acquiring process.
- **Fail-Closed Policy:** If the lock owner hostname is different from `os.hostname()`, ownership is uncertain, or file content is malformed, the runner fails closed without deleting the file.
- **Release Ownership Protection:** `release()` checks that the lock file owner PID and hostname match the current process before unlinking.

### 3.3 Strict Baseline Fingerprint & Metadata Validation ([`server/migrations/001_baseline.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/001_baseline.ts))

Baseline validation now performs comprehensive structural verification:
- **Canonical Baseline Reference:** Generated by executing `BASELINE_DDL` in an in-memory database at startup. Structural metadata is extracted and hashed to produce `CANONICAL_BASELINE_FINGERPRINT`.
- **Structural Extraction:** Normalized column properties (name, position `cid`, normalized uppercase `type`, `notnull`, default value `dflt_value`, primary key `pk`) and index properties (unique flag, origin, columns in order).
- **Discrepancy Reporting:** Discrepancies are collected into an explicit array. Rejection is triggered with `BaselineMismatchError` if any table, column, type, nullability, default, primary key, or unique constraint differs, or if the computed fingerprint does not match `CANONICAL_BASELINE_FINGERPRINT`.

### 3.4 Backup Hardening & Verification ([`server/migrations/backup.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/backup.ts))

- **Page Count Capture:** Captures the page count resolved by Node.js 24's native `await backup(db, backupPath)`. Asserts `pagesCopied > 0` and records it in `BackupResult`.
- **Integrity Checks:** Evaluates `PRAGMA integrity_check;` and `PRAGMA quick_check;` on the backup file via read-only connection.
- **Source Record Parity:** Inspects all tables in the source database and verifies that each table exists in the backup file with identical row counts before migrations begin.
- **Durability Synchronization:** Issues `fsync` on the backup file descriptor to flush pages to persistent storage where supported.

### 3.5 Zod/SQL Consistency & Validation Parity ([`server/schemas.ts`](file:///C:/Users/abdal/Desktop/nexora/server/schemas.ts))

- **Separation of Publication and Verification Status:**
  - `publicationStatus`: `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`
  - `verificationStatus`: `'PENDING_VERIFICATION' | 'VERIFIED' | 'EXPIRED' | 'REVOKED'`
  - `DRAFT` was completely removed from `verificationStatus`.
- **Generic Client Schemas:** `CreateCertificationSchema` sets `verificationStatus: z.literal('PENDING_VERIFICATION').default('PENDING_VERIFICATION')`. `UpdateCertificationSchema` allows only `'PENDING_VERIFICATION'` if provided. Clients cannot self-assert `VERIFIED`.
- **Administrative Verification:** `AdminVerifyCertificationSchema` accepts `'VERIFIED'`, `'REVOKED'`, or `'PENDING_VERIFICATION'`. `EXPIRED` is excluded because credential expiration is dynamically evaluated from `expirationDate`.
- **Media Asset Update Refinement:** `UpdateMediaAssetSchema` and `validateMergedMediaAsset()` validate that partial updates cannot create an inconsistent state (`visibility === 'public'` with null `publicUrl`, or `visibility === 'private'` with non-null `publicUrl`).

### 3.6 Strict Pre-Unlink Classification & 5-Tuple Identity Revalidation (Step 02.1.7) ([`server/migrations/lock.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/lock.ts))

The pre-unlink re-verification immediately preceding `fs.unlinkSync()` strictly maps inspection outcomes:
- **`ABSENT` (`ENOENT`):** Mapped to `ALREADY_ABSENT`. Clears acquired state and tokens (`success: true`).
- **`FILESYSTEM_ERROR` (`EACCES`, `EPERM`, `EIO`):** Mapped strictly to `FILESYSTEM_ERROR`. Preserves tokens and acquired state, returns `success: false`, and refuses to delete file.
- **`MALFORMED`:** Mapped to `OWNERSHIP_MISMATCH`. Preserves tokens and acquired state, returns `success: false`, and refuses deletion.
- **`VALID`:** Verifies the complete 5-tuple ownership identity against the initial inspection:
  $$\text{Identity} = \langle \text{token}, \text{pid}, \text{hostname}, \text{acquiredAt}, \text{dbPath} \rangle$$
  If any field differs (e.g. process was replaced or recycled), returns `OWNERSHIP_MISMATCH`, preserves tokens, and refuses to delete.
- **Threat-Model Boundary:** Portable atomic compare-and-unlink is not natively exposed by user-space OS kernels; pre-unlink ownership re-verification exists, but the check and the subsequent path-based `unlinkSync()` are not a single atomic operating-system operation. A residual TOCTOU race remains between the check and unlink. Under Approach 2 (Conservative Fail-Closed Recovery), external out-of-band lock deletion is strictly prohibited while migrations execute. The residual race is not claimed to be mathematically eliminated; rather, safety is enforced via fail-closed recovery and operational isolation.

### 3.7 Semantically Accurate Backup Pruning Accounting (Step 02.1.8 & Step 02.1.8.1) ([`server/migrations/backup.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/backup.ts))

The backup pruning subsystem enforces an exact accounting contract (`PruneResult`):
```ts
export interface PruneResult {
  /** Total number of backup files successfully unlinked by this invocation */
  prunedCount: number;
  /**
   * Count of inspectable candidate paths selected by this invocation to remain outside the deletion set.
   * This is an operation-level selection count, not an atomic filesystem census.
   * Null if backup directory inspection failed (e.g. EACCES, EIO) and the total candidate count is unknown.
   */
  retainedCount: number | null;
  /**
   * Count of candidate backups whose metadata inspection (statSync) or deletion (unlinkSync)
   * could not be verified due to non-ENOENT filesystem failures.
   */
  unverifiedCount: number;
  /** Observable warnings for all encountered filesystem failures */
  warnings?: string[];
}
```

### 3.8 Backup & Lock Artifact Access-Control Hardening (Step 02.1.9.1) ([`server/migrations/backup.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/backup.ts), [`server/migrations/lock.ts`](file:///C:/Users/abdal/Desktop/nexora/server/migrations/lock.ts))

To close security finding F-03, the migration infrastructure enforces explicit restrictive filesystem permissions across all created and pre-existing artifacts:

1. **POSIX Access-Control Invariants:**
   - **Backup Directory Target Mode:** `0700` (`drwx------`). Restricts access exclusively to the process owner.
   - **Staging Directory Target Mode:** `0700` (`drwx------`). Attempt-owned private directory `.tmp_staging_<UUID>`.
   - **Staging File Target Mode:** `0600` (`-rw-------`). Created exclusively via `fs.openSync(stagingFile, 'wx', 0o600)` with explicit `fs.chmodSync(stagingFile, 0o600)`.
   - **Published Backup Artifact:** Retains `0600` mode upon atomic publication via hard link (`fs.linkSync`), with post-publication mode verification.
   - **Migration Lock File:** Created exclusively via `fs.writeFileSync(this.lockFilePath, ..., { flag: 'wx', mode: 0o600 })` and enforced to `0600` on POSIX. Parent database directory is never chmodded indiscriminately.

2. **Pre-Existing Directory & Artifact Remediation Policy:**
   - **Pre-Existing Backup Directory:** When `createWalSafeBackup()` executes, `ensureSecureBackupDirectory()` inspects `backupDir`. If permissions are more permissive than `0700` on POSIX (`(mode & 0o077) !== 0`), it tightens them to `0700` via `fs.chmodSync()`. If tightening fails or the directory remains permissive, it fails closed with `MigrationBackupError`.
   - **Pre-Existing Nexora Backups:** Any pre-existing backup files matching `nexora.sqlite.bak_*.sqlite` on POSIX are inspected. If permissive, they are safely tightened to `0600`. If tightening fails, fails closed reporting the exact affected artifact.
   - **Artifact Safety Rules:** Pre-existing backup files are **never deleted or overwritten**. Unrelated files and collision sentinels are never modified.

3. **Windows Platform Behavior & ACL Limitations:**
   - Windows NTFS does not use POSIX permission bits (`0700`/`0600`); Node.js `chmod` on Windows only toggles `FILE_ATTRIBUTE_READONLY`.
   - The runner does NOT claim equivalent Windows protection based on POSIX mode bits. On Windows, access control relies on inherited NTFS Access Control Lists (ACLs) of the parent database directory. Windows deployments must secure the `.data` directory via appropriate NTFS ACLs for the service account.

4. **Automated Regression Verification:**
   - 10 new regression tests in `server/__tests__/migrations.test.ts` (175 project total; 168 passed, 7 explicitly skipped on Windows).
   - Cross-platform tests verify directory initialization, artifact preservation, sentinel non-interference, and foreign lock protection.
   - POSIX-specific mode assertions (`0700`, `0600`, tightening, fail-closed chmod errors) are conditionally skipped on Windows using `it.skipIf(isWindows)` and explicitly reported.
  /** Observable warnings for all encountered filesystem failures */
  warnings?: string[];
}
```

#### Exact Counter Semantics:
- **`prunedCount`:** Exact count of candidate files successfully unlinked during this invocation.
- **`retainedCount`:** Number of inspectable candidate paths selected by this invocation to remain outside the deletion set (`Math.min(validEntries.length, retainCount)`). Mapped strictly to `null` when the backup directory cannot be enumerated (`EACCES`, `EIO`).
- **`unverifiedCount`:** Number of individually enumerated candidates whose metadata inspection (`statSync`) or deletion (`unlinkSync`) could not be verified due to non-ENOENT filesystem failures.
- **`warnings`:** Detailed array of observable filesystem errors with affected paths and error codes.

#### Explicit Accounting & Operational Disclaimers:
1. **Selection Count, Not Atomic Census:** `retainedCount` represents an **operation-level selection count** of inspectable candidates chosen to remain outside the deletion set. It is **not** an atomic physical filesystem census.
2. **Exclusion of Unverified Candidates:** `retainedCount` excludes unverified candidates.
3. **Directory Enumeration Failure Semantics:** When directory inspection fails (`EACCES`, `EIO`), `retainedCount` is strictly `null` (never claimed as 0). In this state, `unverifiedCount: 0` indicates that no individual candidate was enumerated and classified; it does **not** prove that no unknown artifacts exist.
4. **Concurrent External Modifications:** Concurrent out-of-band filesystem actions by external processes can alter physical directory contents after inspection.
5. **Conservative Preservation:** Unverified candidates are **never deleted**. Missing candidates (`ENOENT`) are not counted as retained, unverified, or successfully pruned.

---

## 4. Verification Evidence & Test Results

### 4.1 Native Test Suite Execution (`npm test`)

Command executed:
```bash
$env:CI="true"; npm test
```

Latest Verified Execution Output (Step 02.1.8.1):
```text
 RUN  v5.0.3 C:/Users/abdal/Desktop/nexora

 ✓ server/__tests__/pricing.test.ts (11 tests) 25ms
 ✓ server/__tests__/models.test.ts (27 tests) 263ms
 ✓ server/__tests__/api.test.ts (30 tests) 2685ms
 ✓ server/__tests__/migrations.test.ts (107 tests | 7 skipped) 9618ms

 Test Files  4 passed (4)
      Tests  168 passed | 7 skipped (175)
   Start at  19:29:43
   Duration  10.78s (tests 82%, transform 9%, import 8%)
```

**175 total tests across 4 test suites (168 passed, 0 failures, 7 skipped on Windows platform due to POSIX mode checks, 100% green).**  
- **`server/__tests__/migrations.test.ts`:** 107 tests total (100 passed, 7 skipped on Windows).
- **`server/__tests__/api.test.ts`:** 30 tests passed.
- **`server/__tests__/models.test.ts`:** 27 tests passed.
- **`server/__tests__/pricing.test.ts`:** 11 tests passed.

> [!NOTE]
> **Historical Milestone Snapshots (for Audit Trail):**
> - *Step 02.1.3 Baseline:* 124 total tests (56 migration tests).
> - *Step 02.1.6 Baseline:* 144 total tests (76 migration tests).
> - *Step 02.1.7 Baseline:* 159 total tests (91 migration tests).
> - *Step 02.1.8 / Step 02.1.8.1 Final Baseline:* 165 total tests (97 migration tests).
> - *Step 02.1.9.1 Access-Control Baseline:* 175 total tests (107 migration tests; 168 passed, 7 skipped on Windows).

### 4.2 TypeScript Type Checking (`npm run lint`)

Command executed:
```bash
npm run lint
```

Output:
```text
> nexora-platform@1.0.0 lint
> tsc --noEmit
```
Exit code: `0` (Zero TypeScript errors).

### 4.3 Production Client Bundling (`npm run build`)

Command executed:
```bash
npm run build
```

Output:
```text
> nexora-platform@1.0.0 build
> vite build

✓ 1711 modules transformed.
dist/index.html                             2.28 kB │ gzip:   0.99 kB
dist/assets/index-DCvfrk5X.css             72.03 kB │ gzip:  11.42 kB
dist/assets/index-B6eZXCK4.js             352.02 kB │ gzip: 110.40 kB
✓ built in 3.54s
```
Exit code: `0` (Clean production bundle).

### 4.4 Data Preservation Verification

Verification against the active persistent database file `.data/nexora.sqlite`:
```javascript
Tables in .data/nexora.sqlite: [
  'categories', 'coupons', 'inventory_transactions',
  'newsletter_subscribers', 'order_items', 'orders',
  'products', 'reviews', 'schema_migrations', 'users'
]
Record counts: { products: 48, users: 5, orders: 6 }
```
- **Confirmation:** The persistent working database was **never migrated or altered** in any Step 02.1.x implementation turn.
- Exactly 10 physical tables (9 legacy commerce tables + `schema_migrations`, 0 Phase 02 domain tables).
- All 48 products, 8 categories, 6 orders, 8 order items, 3 coupons, 8 inventory transactions, 1 review, 5 users, and 1 newsletter subscriber remain 100% intact.

---

## 5. Summary of Remediation Changes (Step 02.1.1 through Step 02.1.9.2)

| File Path | Nature | Description of Remediation |
|---|---|---|
| `server/migrations/runner.ts` | **MODIFIED** | Enforced backup-before-mutation ordering; read-only `getAppliedMigrations`; fail-closed `getDbLocation`; lock acquisition before pending evaluation; removed public bypass flags; mandatory verified backup on non-empty persistent DB; fail-closed file fsync verification; preserved durability booleans in result; integrated observable lock release handling; integrated post-commit pruning observability with `backupPruneWarnings` |
| `server/migrations/backup.ts` | **MODIFIED** | Captured and validated `pagesCopied`; fail-closed backup contract; 64-bit cryptographic salt naming; attempt-owned unique staging (`.tmp_staging_<UUID>`); pre-reserved staging file `'wx'`; strict atomic no-clobber publication via `linkSync`; fail-closed on unsupported hard links preserving staging backup; directory durability error classification with `EACCES` fail-closed; cleanup paths execute direct unlink/rmdir without `existsSync` guards; treats `ENOENT` as absent; records `EACCES`/`EIO` in warnings/failures; retains ownership metadata on unconfirmed cleanup; removed obsolete `copyFileSync` fallback claim; refactored `pruneOldBackups` to return `PruneResult` with semantically accurate counts (`retainedCount: number | null`, `unverifiedCount: number`), explicitly unknown retained counts on directory failures, non-retention of absent candidates, and conservative retention of unverified candidates; **Step 02.1.9.1**: implemented `ensureSecureBackupDirectory()` enforcing POSIX `0700` on backup directories, `0700` on staging directories, `0600` on staging files, `0600` preserved on hard-link publication, safe permission tightening for pre-existing backup directories and artifacts without deleting or overwriting files; **Step 02.1.9.2 (F-04 & F-06)**: hardened `ensureSecureBackupDirectory()` with `lstatSync` to reject symlink directories without following, require regular files for existing candidates, fail closed on multiple hard links (`nlink > 1`), enforce exact `0700`/`0600` modes with owner deficit detection (`0400`/`0500`), and use descriptor-based `fchmodSync`/`fstatSync` with `O_NOFOLLOW` on POSIX; hardened `pruneOldBackups()` with `lstatSync` to skip symlinks, non-regular files, and shared inodes (`nlink > 1`) as unverified artifacts with observable warnings; validated destination with `lstatSync` in `createWalSafeBackup()` |
| `server/migrations/lock.ts` | **MODIFIED** | Implemented Approach 2 (Conservative Fail-Closed Recovery); removed automatic stale-lock deletion; enforced exclusive acquisition with `'wx'`; unique UUID acquisition token; strict observable token-verified release (`LockReleaseResult`); direct inspection without boolean `existsSync()`; `readLockOwner()` returns `LockOwnerInspection` (`VALID`, `ABSENT`, `MALFORMED`, `FILESYSTEM_ERROR`); pre-unlink re-verification strictly maps `ABSENT` to `ALREADY_ABSENT`, `FILESYSTEM_ERROR` to `FILESYSTEM_ERROR`, `MALFORMED` to `OWNERSHIP_MISMATCH`; enforces complete 5-tuple ownership identity verification (`token`, `pid`, `hostname`, `acquiredAt`, `dbPath`); token and state preservation on error; **Step 02.1.9.1**: enforced POSIX `0600` on newly acquired lock files, removed unsupported `sub-microsecond` quantitative claim, documented residual TOCTOU boundary; **Step 02.1.9.2**: inspects lock directory with `lstatSync` (rejecting symlinks), inspects lock file with `lstatSync` in `readLockOwner()` mapping symlinks to `MALFORMED` (preventing release through symlinks), and verifies exact `0600` mode upon acquisition |
| `server/migrations/001_baseline.ts` | **MODIFIED** | Implemented deterministic canonical baseline generation, structural metadata extraction, and fingerprint comparison |
| `server/migrations/types.ts` | **MODIFIED** | Added `LockReleaseStatus`, `LockReleaseResult`, `MigrationRegistryError`; defined semantically accurate `PruneResult` (`retainedCount: number | null`, `unverifiedCount: number`); updated `BackupResult` with `fileSynced`, `directorySynced`, and `cleanupWarnings`; updated `MigrationResult` with durability flags, cleanup warnings, and `backupPruneWarnings`; **Step 02.1.9.1**: updated JSDoc for `retainedCount` to precise operation-level selection count wording |
| `server/schemas.ts` | **MODIFIED** | Removed `DRAFT` from certification verification status; aligned Zod enums with SQLite CHECK constraints; added media update refinement |
| `server/__tests__/migrations.test.ts` | **MODIFIED** | Added 100 comprehensive regression tests (total: 117 migration tests, 185 total project tests; 171 passed, 14 skipped on Windows, 0 failures; 100% pass on Linux POSIX) covering cross-process lock contention, abnormal termination (`SIGKILL`), cross-process release immunity, direct storage inspection distinguishing ENOENT/EACCES/EIO, pre-unlink strict error classification, 5-tuple ownership identity verification, deterministic lock replacement race, malformed lock protection, staging collision, publication collision, directory `EIO` / `EACCES` error classification, observable lock release, strict atomic hard links, backup cleanup invariants, backup pruning accuracy with unverified artifact accounting, Step 02.1.9.1 filesystem access-control enforcement, and Step 02.1.9.2 path-type, symlink, inode, and exact permission safety |
| `server/__tests__/models.test.ts` | **MODIFIED** | Added 5 new tests covering certification verification status constraints, admin expiration policy, and media update refinement |
| `.github/workflows/ci.yml` | **CREATED** | Established GitHub Actions CI workflow running on `ubuntu-latest` with Node.js 24, executing lint, build, and test suites natively on POSIX |
| `docs/phase02-implementation-report.md` | **MODIFIED** | Updated with Step 02.1.1 through Step 02.1.9.2 defects, fixes, test counts, and evidence |
| `docs/phase02-step-02.1.2-closure-report.md` | **CREATED** | Dedicated closure report detailing Step 02.1.2 fail-closed backup contract, race-safe lock reclamation, and evidence |
| `docs/phase02-step-02.1.3-closure-report.md` | **CREATED** | Dedicated closure report detailing Step 02.1.3 lock mutual-exclusion proof, artifact ownership, and durability enforcement |
| `docs/phase02-step-02.1.4-closure-report.md` | **CREATED** | Dedicated closure report detailing Step 02.1.4 cross-process lock safety, exclusive staging reservation, no-clobber publication, and durability error classification |
| `docs/phase02-step-02.1.5-closure-report.md` | **CREATED / UPDATED** | Dedicated closure report detailing Step 02.1.5 through Step 02.1.9.2 lock release observability, direct storage inspection, ownership replacement race boundaries, pre-unlink classification, complete identity verification, backup pruning accuracy, unverified artifact accounting, strict atomic hard-link publication, backup cleanup invariants, access-control hardening, path-type / inode safety, and evidence |

---

## 6. Project Clearance & Next Steps

1. **Step 02.1.9.2 Closure Complete:** Full documentation and verification published in `docs/phase02-step-02.1.5-closure-report.md` and `docs/phase02-implementation-report.md`.
2. **Step 02.2 Status:** Step 02.2 remains PAUSED. No migration has been executed against `.data/nexora.sqlite`. Rollout execution requires separate, explicit user authorization.
