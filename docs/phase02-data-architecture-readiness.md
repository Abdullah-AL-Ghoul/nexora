# NEXORA — Phase 02 Data Architecture Readiness & Migration Safety Audit
**Step 02.0, 02.0.1 & 02.0.2 Deliverable — Read-Only Architectural Inspection, Schema Design & Final Readiness Closure**  
*Document Version:* 1.2.0 (Final Closed Specification)  
*Audit & Publication Date:* November 2026  
*Status:* COMPLETED (READ-ONLY ARCHITECTURE SPECIFICATION)  
*Current Repository Baseline Commit:* `bc312ebd51a97d92d252dd697e2cb29761bee16a`  
*Lead Auditors:* Principal Software Architect, Senior Backend Engineer, Database Reliability Engineer  

---

## 1. Executive Summary

This document constitutes the final, evidence-based architectural readiness specification for **Phase 02 — Data Architecture & Schema Evolution**. It synthesizes all findings from the read-only inspection of Step 02.0, incorporates all review amendments from Step 02.0.1, and integrates the Node.js 24 native backup API clarifications from Step 02.0.2.

NEXORA's core commerce engine operates on Node.js 24 (`node:sqlite` in WAL mode) with an authoritative Express 4 API. The current database contains live, persistent production records (48 products, 8 categories, 6 orders, 5 registered user accounts, 3 coupons, 8 inventory transactions, 1 review, and 1 newsletter subscriber).

### Core Audit & Specification Outcomes:

1. **Accurate Physical Table Census (15 Total):**
   - **9 Legacy Existing Tables:** `users`, `categories`, `products`, `orders`, `order_items`, `coupons`, `reviews`, `inventory_transactions`, `newsletter_subscribers`.
   - **5 New Domain Tables:** `projects`, `certifications`, `media_assets`, `project_media`, `certification_media`.
   - **1 Migration Metadata Table:** `schema_migrations`.
   - **Total Expected Tables after Phase 02:** Exactly **15 physical tables**. All obsolete references to 14 tables across test plans, documentation, and acceptance criteria have been eliminated.

2. **SQLite WAL-Safe Online Backup Architecture (`sqlite.backup()` vs. `VACUUM INTO`):**
   - File-copying `.data/nexora.sqlite` directly while under WAL mode is unsafe because uncommitted or uncheckpointed pages reside in `.data/nexora.sqlite-wal`.
   - **Node.js 24 Native Backup Capabilities Clarification:** Node.js 24 (`node:sqlite`) natively provides a top-level asynchronous function `import { backup } from 'node:sqlite'`, distinct from a hypothetical instance method on `DatabaseSync` (`DatabaseSync.prototype.backup` does not exist).
   - In addition, SQLite 3.27+ natively supports the SQL statement `VACUUM INTO 'target_path.sqlite'`.
   - Both mechanisms safely snapshot an active WAL database without database shutdown, external file-system locks, or uncheckpointed frame corruption.
   - Comprehensive comparative evaluation between `sqlite.backup()` and `VACUUM INTO` has been conducted, documenting the rationale for the migration runner's backup strategy.

3. **Strict Baseline Fingerprinting (Migration 001):**
   - Checking for `users` alone is insufficient. Migration 001 executes a rigorous validation of all 9 legacy tables, their column definitions, data types, primary keys, and unique indexes against a canonical schema dictionary.
   - Any partial initialization or structural drift aborts migration immediately with a descriptive error.

4. **Comprehensive Database Constraints & Referential Integrity:**
   - Database-level `CHECK` constraints are added for publication statuses, verification statuses, storage providers, asset visibility, media roles, positive file sizes, and non-negative integers. Zod validation complements database constraints rather than replacing them.
   - Deletion of referenced media assets is strictly prevented via `ON DELETE RESTRICT`.
   - Existing 9 legacy tables and records are preserved with zero destructive recreation.

5. **Private vs. Public Media Visibility & Scoped Deduplication:**
   - Media assets declare explicit `visibility` (`'public' | 'private'`). Confidential certification scans and test reports are stored outside public web roots with `public_url = NULL` and served strictly through authenticated, role-authorized streaming endpoints.
   - SHA-256 deduplication is enforced at the application layer supported by a scoped index (`sha256, visibility`) to prevent cross-visibility privacy leaks.

6. **Certification Expiration & Verification Semantics:**
   - `expiration_date` is the authoritative temporal boundary. Effective status is dynamically evaluated (`CASE WHEN ... < date('now') THEN 'EXPIRED'`) to prevent stale states.
   - Strict publication rules govern each status. Zero fabricated credentials or external verifications will be generated.

7. **Index Optimization:**
   - Redundant indexes on columns that already have `UNIQUE` constraints (e.g., `projects.slug`, `certifications.slug`) have been removed. Purpose-built composite indexes serve real query paths.

8. **Scope Adherence:**
   - **Application source code modified: NO.**
   - **Database modified: NO.**
   - **Existing records modified: NO.**
   - **Dependencies installed: NO.**
   - **Deployment performed: NO.**

---

## 2. Verified Existing Database Schema

An empirical, read-only inspection was performed against `.data/nexora.sqlite` via Node.js 24 `DatabaseSync` in read-only mode (`{ readOnly: true }`).

### 2.1 Pragmas & Connection State
- **Foreign Key Enforcement:** `PRAGMA foreign_keys = 1` (Active, enabled synchronously at [`server/db.ts:19`](file:///C:/Users/abdal/Desktop/nexora/server/db.ts#L19)).
- **Journal Mode:** `PRAGMA journal_mode = 'wal'` (Write-Ahead Logging enabled for file-backed storage at [`server/db.ts:20`](file:///C:/Users/abdal/Desktop/nexora/server/db.ts#L20); in-memory tests use memory journaling).

### 2.2 Table-by-Table Schema Census

| Table Name | Live Record Count | Primary Key | Unique Constraints | Foreign Keys Declared in DDL | JSON Columns |
|---|---|---|---|---|---|
| `users` | 5 | `id (TEXT)` | `email (TEXT)` | None declared | None |
| `categories` | 8 | `id (TEXT)` | `slug (TEXT)` | None declared | None |
| `products` | 48 | `id (TEXT)` | `slug (TEXT)`, `sku (TEXT)` | None declared | `images`, `variants`, `materials` |
| `orders` | 6 | `id (TEXT)` | `order_number (TEXT)` | None declared | `shipping_address` |
| `order_items` | 8 | `id (TEXT)` | None | None declared | None |
| `coupons` | 3 | `id (TEXT)` | `code (TEXT)` | None declared | None |
| `reviews` | 1 | `id (TEXT)` | None | None declared | None |
| `inventory_transactions` | 8 | `id (TEXT)` | None | None declared | None |
| `newsletter_subscribers` | 1 | `id (TEXT)` | `email (TEXT)` | None declared | None |

### 2.3 Detailed Column Definitions & Nullability
- **`users`:** `id` (PK), `email` (NOT NULL, UNIQUE), `name` (NOT NULL), `role` (NOT NULL, DEFAULT 'CUSTOMER'), `phone` (NULLABLE), `avatar` (NULLABLE), `created_at` (NOT NULL), `password_hash` (NULLABLE), `auth_provider` (NOT NULL, DEFAULT 'local').
- **`categories`:** `id` (PK), `name` (NOT NULL), `slug` (NOT NULL, UNIQUE), `description` (NOT NULL, DEFAULT ''), `image_url` (NOT NULL, DEFAULT ''), `item_count` (NOT NULL, DEFAULT 0).
- **`products`:** `id` (PK), `name` (NOT NULL), `slug` (NOT NULL, UNIQUE), `tagline` (NOT NULL, DEFAULT ''), `description` (NOT NULL, DEFAULT ''), `price` (REAL, NOT NULL), `compare_at_price` (REAL, NULLABLE), `sku` (NOT NULL, UNIQUE), `stock` (INTEGER, NOT NULL, DEFAULT 0), `category_id` (TEXT, NOT NULL), `category_name` (TEXT, NOT NULL), `images` (TEXT, NOT NULL, DEFAULT '[]'), `variants` (TEXT, NOT NULL, DEFAULT '[]'), `rating` (REAL, NOT NULL, DEFAULT 5.0), `reviews_count` (INTEGER, NOT NULL, DEFAULT 0), `status` (TEXT, NOT NULL, DEFAULT 'ACTIVE'), `is_featured` (INTEGER, NOT NULL, DEFAULT 0), `is_best_seller` (INTEGER, NOT NULL, DEFAULT 0), `is_trending` (INTEGER, NOT NULL, DEFAULT 0), `materials` (TEXT, NOT NULL, DEFAULT '[]'), `dimensions` (TEXT, NULLABLE), `weight` (TEXT, NULLABLE), `origin` (TEXT, NULLABLE), `created_at` (TEXT, NOT NULL), `updated_at` (TEXT, NOT NULL).
- **`orders`:** `id` (PK), `order_number` (NOT NULL, UNIQUE), `user_id` (NOT NULL), `customer_name` (NOT NULL), `customer_email` (NOT NULL), `subtotal` (REAL, NOT NULL), `discount` (REAL, NOT NULL, DEFAULT 0), `shipping` (REAL, NOT NULL, DEFAULT 0), `tax` (REAL, NOT NULL, DEFAULT 0), `total` (REAL, NOT NULL), `status` (NOT NULL, DEFAULT 'PENDING'), `payment_status` (NOT NULL, DEFAULT 'PENDING'), `payment_method` (NOT NULL, DEFAULT ''), `stripe_payment_intent_id` (NULLABLE), `shipping_address` (NOT NULL, DEFAULT '{}'), `tracking_number` (NULLABLE), `shipping_carrier` (NULLABLE), `notes` (NULLABLE), `created_at` (NOT NULL), `updated_at` (NOT NULL).
- **`order_items`:** `id` (PK), `order_id` (NOT NULL), `product_id` (NOT NULL), `product_name` (NOT NULL), `product_image` (NOT NULL, DEFAULT ''), `sku` (NOT NULL), `variant_name` (NULLABLE), `unit_price` (REAL, NOT NULL), `quantity` (INTEGER, NOT NULL), `total_price` (REAL, NOT NULL).
- **`coupons`:** `id` (PK), `code` (NOT NULL, UNIQUE), `type` (NOT NULL), `value` (REAL, NOT NULL), `min_order_amount` (NULLABLE), `max_discount` (NULLABLE), `starts_at` (NOT NULL), `expires_at` (NOT NULL), `usage_limit` (NOT NULL, DEFAULT 1), `usage_count` (NOT NULL, DEFAULT 0), `is_active` (NOT NULL, DEFAULT 1), `description` (NOT NULL, DEFAULT '').
- **`reviews`:** `id` (PK), `product_id` (NOT NULL), `user_id` (NOT NULL), `user_name` (NOT NULL), `user_avatar` (NULLABLE), `rating` (INTEGER, NOT NULL), `title` (NOT NULL, DEFAULT ''), `comment` (NOT NULL, DEFAULT ''), `is_verified_purchase` (NOT NULL, DEFAULT 0), `is_approved` (NOT NULL, DEFAULT 1), `created_at` (NOT NULL).
- **`inventory_transactions`:** `id` (PK), `product_id` (NOT NULL), `product_name` (NOT NULL), `sku` (NOT NULL), `variant_id` (NULLABLE), `type` (NOT NULL), `quantity` (INTEGER, NOT NULL), `stock_after` (INTEGER, NOT NULL), `reason` (NOT NULL, DEFAULT ''), `performed_by` (NOT NULL), `created_at` (NOT NULL).
- **`newsletter_subscribers`:** `id` (PK), `email` (NOT NULL, UNIQUE), `locale` (NOT NULL, DEFAULT 'ar'), `source` (NOT NULL, DEFAULT 'footer'), `created_at` (NOT NULL).

### 2.4 Legacy Preservation Invariant
The existing 9 tables lack declared foreign-key clauses in their legacy DDL, but maintain integrity through the Express application layer. To prevent data corruption or breaking existing storefront checkout and order pipelines:
- **No table reconstruction (`ALTER TABLE ... RENAME / RECREATE`) will be performed on the 9 legacy tables.**
- New domain tables declare explicit foreign keys, check constraints, and indexes.
- All existing records remain 100% untouched.

---

## 3. Existing TypeScript Contracts & Schemas

### 3.1 Domain Interfaces ([`src/types/index.ts`](file:///C:/Users/abdal/Desktop/nexora/src/types/index.ts))
The client contract defines:
- `User`, `Role` ('CUSTOMER' | 'MANAGER' | 'ADMIN')
- `Address`, `Category`, `Product`, `ProductVariant`, `ProductImage`, `Review`
- `CartItem`, `CartSummary`, `WishlistItem`
- `Order`, `OrderItem`, `OrderStatus`, `PaymentStatus`
- `Coupon`, `InventoryTransaction`, `AdminAnalytics`

### 3.2 Server Validation Schemas ([`server/schemas.ts`](file:///C:/Users/abdal/Desktop/nexora/server/schemas.ts))
Zod validation schemas exist for:
- `PaginationSchema`, `ProductFilterSchema`
- `CreateProductSchema` (validates `images` as array of `{ id, url, altText, isPrimary, order }`)
- `CreateCategorySchema`, `CreateOrderSchema`, `ValidateCouponSchema`, `StockAdjustSchema`, `ReviewSchema`

### 3.3 Integration Gap
There are **zero TypeScript interfaces or Zod schemas** for:
- `Project`, `ProjectMedia`, `CreateProjectSchema`, `UpdateProjectSchema`
- `Certification`, `CertificationMedia`, `CreateCertificationSchema`, `UpdateCertificationSchema`
- `MediaAsset`, `CreateMediaAssetSchema`

---

## 4. Current Migration Mechanism & Limitations

### 4.1 Current Execution Sequence
In [`server/db.ts`](file:///C:/Users/abdal/Desktop/nexora/server/db.ts):
1. **Module Import:** Synchronously connects to the SQLite file upon import.
2. **Pragmas:** Executes `PRAGMA foreign_keys=ON;` and `PRAGMA journal_mode=WAL;`.
3. **DDL Execution:** Synchronously executes a monolithic multi-statement `db.exec(CREATE TABLE IF NOT EXISTS ...)` string.
4. **Ad-Hoc Column Injection:** Calls `ensureUsersColumn()` using `PRAGMA table_info(users)`.
5. **Conditional Seed:** Executes `seed()`, checking `SELECT COUNT(*) FROM users`. If 0, seeds default users, categories, and coupons.
6. **Password Backfill:** Executes `ensureSeedPasswords()`.

### 4.2 Limitations & Risks of the Current Approach
- **No Migration Tracking:** No record of applied migrations, timestamps, or checksums.
- **No Atomicity across Schema Changes:** `db.exec()` with multiple statements does not automatically roll back prior statements if an error occurs midway.
- **Lack of Rollback Strategy:** No automated backup of `.data/nexora.sqlite` is generated prior to running DDL changes.
- **Fragile Column Alterations:** Checking `table_info` in imperative JavaScript functions does not scale and becomes error-prone as schema complexity increases.

---

## 5. Proposed Projects Data Model

The `projects` table supports bespoke architectural installations, private commissions, and craft case studies.

```sql
CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL DEFAULT '',
  discipline          TEXT NOT NULL,
  client_type         TEXT NOT NULL DEFAULT 'PRIVATE_COLLECTOR' 
                      CHECK (client_type IN ('PRIVATE_COLLECTOR', 'RESIDENTIAL', 'COMMERCIAL', 'INSTITUTIONAL')),
  client_name         TEXT,
  description         TEXT NOT NULL DEFAULT '',
  challenge           TEXT NOT NULL DEFAULT '',
  solution            TEXT NOT NULL DEFAULT '',
  materials           TEXT NOT NULL DEFAULT '[]',
  location            TEXT NOT NULL DEFAULT '',
  completion_date     TEXT,
  cover_media_id      TEXT,
  cover_image_url     TEXT NOT NULL DEFAULT '',
  publication_status  TEXT NOT NULL DEFAULT 'DRAFT' 
                      CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  is_featured         INTEGER NOT NULL DEFAULT 0 
                      CHECK (is_featured IN (0, 1)),
  sort_order          INTEGER NOT NULL DEFAULT 0 
                      CHECK (sort_order >= 0),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT
);
```

### Key Field Design Rules:
- `id`: Stable identifier (e.g., `proj_1731180000_a1b2c3d4`).
- `slug`: Human-readable, URL-safe unique identifier for `/projects/:slug`. (Unique index is automatically created by SQLite for `UNIQUE` constraint).
- `client_type`: Constrained by database-level `CHECK` to `'PRIVATE_COLLECTOR' | 'RESIDENTIAL' | 'COMMERCIAL' | 'INSTITUTIONAL'`.
- `publication_status`: Constrained to `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`. Public queries enforce `WHERE publication_status = 'PUBLISHED'`.
- `is_featured`: Enforced boolean flag (`0` or `1`).
- `sort_order`: Non-negative display order for editorial sequencing.
- `materials`: JSON-encoded string array (`["Titanium Grade 5", "Solid Black Walnut"]`).
- `cover_media_id`: Foreign key reference to `media_assets(id)` with `ON DELETE RESTRICT` preventing accidental deletion of active cover assets.
- `cover_image_url`: Denormalized URL path allowing fast card rendering without multi-table joins.

---

## 6. Proposed Certifications Data Model

The `certifications` table models official Swiss watchmaking assay certificates, COSC chronometer accreditations, and leather provenance seals.

```sql
CREATE TABLE IF NOT EXISTS certifications (
  id                      TEXT PRIMARY KEY,
  slug                    TEXT UNIQUE NOT NULL,
  title                   TEXT NOT NULL,
  issuing_organization    TEXT NOT NULL,
  credential_id           TEXT NOT NULL DEFAULT '',
  credential_url          TEXT,
  issue_date              TEXT NOT NULL,
  expiration_date         TEXT,
  applicable_disciplines  TEXT NOT NULL DEFAULT '[]',
  skills_standards        TEXT NOT NULL DEFAULT '',
  badge_media_id          TEXT,
  badge_image_url         TEXT NOT NULL DEFAULT '',
  publication_status      TEXT NOT NULL DEFAULT 'DRAFT' 
                          CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  verification_status     TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' 
                          CHECK (verification_status IN ('PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED', 'REVOKED')),
  verification_notes      TEXT NOT NULL DEFAULT '',
  verified_at             TEXT,
  verified_by             TEXT,
  sort_order              INTEGER NOT NULL DEFAULT 0 
                          CHECK (sort_order >= 0),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (badge_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
);
```

### 6.1 Certification Expiration & Verification Semantics

To eliminate stale verification states and establish unambiguous business logic:

1. **Temporal Truth & Expiration Handling:**
   - `expiration_date` is the authoritative temporal boundary (ISO 8601 string `YYYY-MM-DD`).
   - A credential with `expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE` is factually expired, regardless of whether a background worker has executed.
   - **Effective Verification Status:** Both application contracts and SQL query helpers derive effective verification dynamically:
     ```sql
     CASE 
       WHEN verification_status != 'REVOKED' 
            AND expiration_date IS NOT NULL 
            AND expiration_date < date('now') 
       THEN 'EXPIRED' 
       ELSE verification_status 
     END AS effective_verification_status
     ```
   - This ensures that an accreditation whose expiration date elapsed yesterday will immediately present as expired across all API responses without relying on external cron jobs.

2. **Storefront Publication Policy by Verification State:**
   - **`VERIFIED` (Active):** When `publication_status = 'PUBLISHED'`, displayed prominently in `/certifications` with a verified seal, issuer link, and verified timestamp.
   - **`EXPIRED`:** When `publication_status = 'PUBLISHED'`, the credential **must never** be displayed as an active certification. It is automatically routed to an "Archived & Historical Accreditations" section with an explicit amber "Expired" notice and expiry date.
   - **`PENDING_VERIFICATION`:** By default, credentials pending verification remain in `publication_status = 'DRAFT'`. If an administrator explicitly publishes a pending credential, it displays a neutral grey badge labeled "Verification In Progress" without implying official accreditation.
   - **`REVOKED`:** **Strictly prohibited from public storefront display.** The application layer automatically transitions `publication_status` to `'ARCHIVED'` upon recording revocation. Revoked credentials remain visible only within the protected admin auditing console.

3. **Auditing & Accountability:**
   - `verified_at`: ISO 8601 timestamp recording exactly when verification occurred.
   - `verified_by`: Foreign key reference to `users(id)` recording the administrator or compliance officer who performed the verification. Protected by `ON DELETE RESTRICT` to preserve compliance audit trails.
   - `verification_notes`: Mandated explanation of verification methodology (e.g., registry lookup ID, direct issuer confirmation email).

4. **Zero Fabrication Mandate:**
   - Zero fictional credentials, dummy COSC numbers, or fake accreditation bodies will be seeded into production databases.

---

## 7. Proposed Media Assets Architecture

The `media_assets` table provides a centralized, secure digital asset repository for both public storefront imagery and confidential accreditation documentation.

```sql
CREATE TABLE IF NOT EXISTS media_assets (
  id                 TEXT PRIMARY KEY,
  original_filename  TEXT NOT NULL,
  stored_filename    TEXT UNIQUE NOT NULL,
  storage_provider   TEXT NOT NULL DEFAULT 'local' 
                     CHECK (storage_provider IN ('local', 's3', 'gcs')),
  storage_path       TEXT NOT NULL,
  public_url         TEXT,
  visibility         TEXT NOT NULL DEFAULT 'public' 
                     CHECK (visibility IN ('public', 'private')),
  mime_type          TEXT NOT NULL,
  file_size          INTEGER NOT NULL 
                     CHECK (file_size > 0),
  width              INTEGER,
  height             INTEGER,
  sha256             TEXT NOT NULL,
  alt_text           TEXT NOT NULL DEFAULT '',
  uploaded_by        TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)),
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);
```

### 7.1 Media Visibility & Confidentiality Architecture

1. **Public Assets (`visibility = 'public'`):**
   - Stored in the public static directory: `public/img/uploads/` (or a public cloud bucket/CDN).
   - `public_url` is populated (e.g., `/img/uploads/projects/hero_a1b2.webp`).
   - Served directly by Vite/Express static middleware or CDN edge caches with high-performance cache headers.

2. **Private Assets (`visibility = 'private'`):**
   - Used for sensitive compliance documentation: original assay certificates, hallmarking registration deeds, audit reports, supplier provenance contracts.
   - Stored strictly outside the public web root: `.data/private_uploads/` (or an authenticated private cloud bucket).
   - `public_url` is set to `NULL`.
   - **Never accessible via static file URLs.**
   - Served exclusively through an authenticated, role-authorized streaming endpoint:
     `GET /api/admin/media/:id/download`
   - Access requires valid authentication (`authMiddleware`) and role authorization (`requireRole('ADMIN')` or `'MANAGER'`).
   - Served with strict privacy headers:
     ```http
     Cache-Control: private, no-store, max-age=0
     Content-Disposition: attachment; filename="<original_filename>"
     X-Content-Type-Options: nosniff
     ```

### 7.2 SHA-256 Deduplication Strategy

- **Constraint Evaluation:** Enforcing a global `UNIQUE(sha256)` constraint at the database level is intentionally avoided. A global unique constraint would prevent different administrators from uploading the same image with different context-specific `alt_text` or original filenames, and could inadvertently link a private document with a public asset.
- **Scoped Deduplication Policy:**
  - The `sha256` column is indexed alongside visibility: `idx_media_assets_hash_vis ON media_assets(sha256, visibility)`.
  - Upon upload, the backend computes the file's SHA-256 hash.
  - For **public assets**, the service checks for an existing record with matching `sha256` and `visibility = 'public'`. If a match is found, the physical file on disk is reused, avoiding redundant disk/cloud storage allocation.
  - For **private assets**, cross-tenant and cross-visibility deduplication is strictly prohibited to prevent information leakage through timing attacks.

---

## 8. Relationship & Indexing Design

### 8.1 Normalized Gallery & Evidence Junction Tables

Normalized junction tables replace unindexable JSON strings, providing strict referential integrity:

#### Project Media (`project_media`):
```sql
CREATE TABLE IF NOT EXISTS project_media (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  media_asset_id  TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'GALLERY' 
                  CHECK (role IN ('COVER', 'GALLERY', 'DIAGRAM', 'BEFORE_AFTER_BEFORE', 'BEFORE_AFTER_AFTER', 'BLUEPRINT', 'INSTALLATION')),
  sort_order      INTEGER NOT NULL DEFAULT 0 
                  CHECK (sort_order >= 0),
  caption         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(project_id, media_asset_id, role)
);
```

#### Certification Media (`certification_media`):
```sql
CREATE TABLE IF NOT EXISTS certification_media (
  id                TEXT PRIMARY KEY,
  certification_id  TEXT NOT NULL,
  media_asset_id    TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'EVIDENCE_DOCUMENT' 
                    CHECK (role IN ('BADGE', 'CERTIFICATE_SCAN', 'TEST_REPORT', 'EVIDENCE_DOCUMENT', 'AUDIT_REPORT')),
  sort_order        INTEGER NOT NULL DEFAULT 0 
                    CHECK (sort_order >= 0),
  caption           TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(certification_id, media_asset_id, role)
);
```

### 8.2 Index Review & Optimization
- **Redundant Indexes Removed:** SQLite automatically generates unique indexes for columns declared with `UNIQUE` (`sqlite_autoindex_projects_1`, `sqlite_autoindex_certifications_1`). Redundant declarations (`CREATE INDEX idx_projects_slug ...`) have been removed.
- **Purpose-Built Query Indexes Retained:** Indexes are targeted exclusively to real query paths to eliminate full table scans and provide $O(\log N)$ B-tree lookups:

```sql
-- Projects composite indexes
CREATE INDEX IF NOT EXISTS idx_projects_pub_featured_sort 
  ON projects(publication_status, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_discipline 
  ON projects(discipline);

-- Certifications composite indexes
CREATE INDEX IF NOT EXISTS idx_certifications_pub_verif 
  ON certifications(publication_status, verification_status, sort_order);

-- Media Assets indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_hash_vis 
  ON media_assets(sha256, visibility);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader 
  ON media_assets(uploaded_by);

-- Junction table indexes (Ordered lookups & referential integrity checks)
CREATE INDEX IF NOT EXISTS idx_project_media_proj 
  ON project_media(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_media_asset 
  ON project_media(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_cert_media_cert 
  ON certification_media(certification_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cert_media_asset 
  ON certification_media(media_asset_id);

-- Secondary indexes for legacy commerce tables (Performance enhancement)
CREATE INDEX IF NOT EXISTS idx_products_category 
  ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_featured 
  ON products(status, is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user 
  ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order 
  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product 
  ON reviews(product_id, is_approved);
```

---

## 9. Migration Implementation Strategy

### 9.1 The 15-Table Physical Inventory
Following completion of Phase 02, the database contains exactly **15 physical tables**:

| Category | Table Count | Table Names |
|---|---|---|
| **Legacy Commerce Tables** | 9 | `users`, `categories`, `products`, `orders`, `order_items`, `coupons`, `reviews`, `inventory_transactions`, `newsletter_subscribers` |
| **New Domain Tables** | 5 | `projects`, `certifications`, `media_assets`, `project_media`, `certification_media` |
| **Migration Metadata Table** | 1 | `schema_migrations` |
| **TOTAL PHYSICAL TABLES** | **15** | Verified via `SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'` |

---

### 9.2 SQLite WAL-Safe Backup Architecture

Direct file copying of `.data/nexora.sqlite` while under WAL mode is unsafe because uncommitted or uncheckpointed pages reside in `.data/nexora.sqlite-wal`. A standard filesystem copy captures the main `.sqlite` file in an inconsistent state relative to the shared memory (`.sqlite-shm`) and WAL journal (`.sqlite-wal`), risking database corruption upon recovery.

#### 9.2.1 Node.js 24 Backup Capabilities: `sqlite.backup()` vs. `VACUUM INTO`

To establish a verified, consistent backup strategy, we evaluated both native SQLite backup mechanisms supported under Node.js 24:

1. **Top-Level Asynchronous `backup(sourceDb, path, options)` from `node:sqlite`:**
   - **Nature:** An official native asynchronous utility function exported directly by `node:sqlite` (`import { backup } from 'node:sqlite'`).
   - **Mechanism:** Directly binds to SQLite's C-level Online Backup API (`sqlite3_backup_init()`, `sqlite3_backup_step()`, `sqlite3_backup_finish()`).
   - **Execution Model:** Returns a `Promise<void>`, executing non-blockingly across event-loop ticks while incrementally copying database pages from source to destination file.
   - **WAL Handling:** Safely acquires a shared read-lock on the source database, reading all committed pages from both the main file and the active WAL log frames without interrupting concurrent read operations.
   - **Distinction from Class Instance Methods:** Crucially distinct from a hypothetical `DatabaseSync` instance method: `DatabaseSync.prototype` does *not* expose `db.backup()`. The function must be imported as a top-level named export: `backup(dbInstance, destinationPath)`.

2. **Synchronous SQL Statement `VACUUM INTO 'target_path.sqlite'`:**
   - **Nature:** Built-in SQLite SQL statement supported natively since SQLite 3.27.0.
   - **Mechanism:** Executed via `db.exec("VACUUM INTO '...';")` on an open connection.
   - **Execution Model:** Executes synchronously within the active connection, creating a brand new, fully compacted, standalone non-WAL SQLite database file at the specified target path.
   - **WAL Handling:** Flushes and integrates all committed WAL journal frames and main database pages into the vacuumed destination file.
   - **Resource Profile:** Reconstructs B-trees and compacts free pages, requiring temporary disk space proportional to the active database size.

#### 9.2.2 Comparative Analysis & Strategy Selection Rationale

| Evaluation Criterion | `node:sqlite` `backup(sourceDb, path)` | `VACUUM INTO 'target.sqlite'` |
|---|---|---|
| **API Interface** | Native Node.js top-level async function | Native SQLite SQL statement |
| **Execution Paradigm** | Asynchronous (`Promise<void>`) | Synchronous (`db.exec()`) |
| **Event Loop Impact** | Non-blocking (runs on libuv worker/ticks) | Synchronous block during snapshot |
| **WAL Consistency** | 100% Consistent (via `sqlite3_backup_*`) | 100% Consistent (compresses WAL frames) |
| **Compaction** | Page-by-page mirror (preserves page order) | Rebuilds and compacts B-tree storage |
| **Disk Overhead** | Minimal (exact page copy) | Requires disk space for vacuum reconstruction |
| **Startup Alignment** | Ideal for async migration lifecycle (`runMigrations()`) | Ideal for synchronous CLI scripts |

**Architectural Decision & Rationale:**
- In NEXORA, the migration runner in `server/migrations/runner.ts` operates as an asynchronous initialization module: `export async function runMigrations(db: DatabaseSync): Promise<void>`.
- The primary backup engine will utilize `backup(db, targetPath)` from `node:sqlite`, leveraging the official asynchronous SQLite online backup API to perform a non-blocking, transactionally consistent snapshot of all WAL pages.
- Alternatively, `VACUUM INTO` remains fully supported as a synchronous CLI fallback for offline maintenance scripts.
- Both methods guarantee zero uncheckpointed WAL page loss and satisfy the strict integrity requirement.

#### 9.2.3 Step-by-Step Backup Protocol
1. **Directory Provisioning:** The runner ensures `.data/backups/` exists.
2. **Target Naming:** Backup filename follows the convention:  
   `.data/backups/nexora.sqlite.bak_<YYYYMMDDTHHmmssZ>_pre_v<version>.sqlite`  
   *(e.g., `.data/backups/nexora.sqlite.bak_20261109T213000Z_pre_v2.sqlite`)*.
3. **Execution Ordering:** Executed **after** opening the SQLite connection in WAL mode, but **strictly before** initiating any migration transaction or DDL statement.
4. **Command Execution:**
   ```typescript
   await backup(db, backupPath);
   ```
5. **Completion Verification:** The runner verifies that `fs.existsSync(backupPath)` is true and `fs.statSync(backupPath).size > 0`.
6. **Integrity Verification:**
   - The runner opens a temporary read-only connection: `new DatabaseSync(backupPath, { readOnly: true })`.
   - Executes `PRAGMA integrity_check;` and `PRAGMA quick_check;`.
   - Asserts result is `[{ integrity_check: 'ok' }]`.
   - Closes the temporary connection.
7. **Failure Handling:** If backup creation or integrity check fails, the runner throws `MigrationBackupError`, logs full diagnostics, and **halts process startup immediately** before mutating the database.
8. **Retention Policy:** The runner keeps the last 5 successful backups in `.data/backups/` and automatically prunes older backups.
9. **Emergency Restore Procedure:**
   - Terminate active Node.js processes.
   - Rename failed database: `mv .data/nexora.sqlite .data/nexora.sqlite.failed_<timestamp>`.
   - Remove stale journal files: `rm -f .data/nexora.sqlite-wal .data/nexora.sqlite-shm`.
   - Copy verified backup: `cp .data/backups/<backup_file>.sqlite .data/nexora.sqlite`.
   - Verify integrity via CLI (`node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('.data/nexora.sqlite'); console.log(db.prepare('PRAGMA integrity_check').all()); db.close();"`) and restart server.

---

### 9.3 Strict Legacy Baseline Detection (Migration 001)

Migration 001 validates the legacy database state before registering baseline version 1:

1. **Table Existence Check:** Queries `sqlite_master` for all 9 expected legacy tables.
   - If 0 tables exist $\to$ Fresh database: executes baseline DDL, records version 1.
   - If all 9 tables exist $\to$ Validates schema structure against canonical baseline specification.
   - If 1 to 8 tables exist $\to$ Incomplete/corrupt state: throws `BaselineMismatchError` and halts.
2. **Column & Constraint Inspection:**
   - Iterates through all 9 tables, running `PRAGMA table_info(tableName)` and `PRAGMA index_list(tableName)`.
   - Validates that essential columns (`users.password_hash`, `users.auth_provider`, `products.sku`, `orders.order_number`) exist with matching data types and primary key designations.
3. **Schema Fingerprint Verification:**
   - Generates a deterministic SHA-256 fingerprint from the normalized DDL of all 9 tables:
     ```typescript
     const tables = db.prepare(
       "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
     ).all();
     const fingerprint = crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex');
     ```
4. **Recording Migration:**
   - Inserts record into `schema_migrations`:
     ```sql
     CREATE TABLE IF NOT EXISTS schema_migrations (
       version           INTEGER PRIMARY KEY,
       name              TEXT NOT NULL,
       applied_at        TEXT NOT NULL,
       checksum          TEXT NOT NULL,
       execution_time_ms INTEGER NOT NULL
     );
     ```

---

### 9.4 Domain Evolution (Migration 002)

1. Executes within a single atomic SQLite transaction (`BEGIN TRANSACTION` ... `COMMIT`).
2. Creates `media_assets`, `projects`, `certifications`, `project_media`, `certification_media`, and all supporting indexes.
3. Records version `2` with execution timing and SHA-256 script checksum.
4. If any error occurs, executes `ROLLBACK`, leaving the existing database completely intact.

---

## 10. Seed Data Policy (Strict Compliance)

### 10.1 Prohibition of Fabricated Production Data
- **Zero Fictional Records on Startup:** The production database will NOT automatically seed mock projects, fake client commissions, fictional Swiss assay certificates, or dummy COSC numbers on server boot.
- **Empty State Guarantee:** The `projects` and `certifications` tables in `.data/nexora.sqlite` will remain empty until authentic records are entered via authorized admin workflows (`ADMIN` role).
- **Storefront Graceful Handling:** Storefront pages (`/projects`, `/certifications`) must implement elegant empty-state illustrations and copy when zero published records exist.

### 10.2 Isolated Test Fixtures
- For automated testing and visual development verification, test records will be housed strictly in `server/__tests__/fixtures/domainFixtures.ts`.
- These fixtures are imported exclusively by unit and integration tests executing against `NEXORA_DB=":memory:"`, ensuring zero leakage into persistent production storage.

---

## 11. Security & Data Integrity Considerations

1. **Foreign Key Enforcement & Cascade Rules:**
   - `project_media` and `certification_media` specify `ON DELETE CASCADE` for parent entities and `ON DELETE RESTRICT` for media assets.
   - Deleting a project removes its gallery links, but preserves the underlying media assets in `media_assets`.
   - An asset referenced as a cover (`projects.cover_media_id`), badge (`certifications.badge_media_id`), or junction item cannot be deleted until all references are explicitly removed.
2. **Server-Side Validation:** Zod schemas in `server/schemas.ts` enforce strict string lengths, URL formats, ISO dates, and enum constraints prior to database execution.
3. **MIME Type & File Size Whitelisting:** The upcoming media endpoint must reject non-image/non-document uploads, enforce a 10MB file limit, and sanitize file names to prevent path traversal attacks.
4. **RBAC Isolation:** Media uploads and project/certification mutations are restricted strictly to `ADMIN` and `MANAGER` roles via `authMiddleware` and `requireRole`. Unauthenticated access receives `401`, customer access receives `403`.

---

## 12. Testing & Verification Strategy

### 12.1 Automated Test Suites to Implement in Phase 02
Using the project's native runner (`vitest run`):

1. **`server/__tests__/migrations.test.ts`:**
   - **Fresh Database Test:** Initializes an empty `:memory:` DB $\to$ runs migrations $\to$ verifies exactly **15 physical tables** and all specified indexes exist.
   - **Upgrade Test:** Initializes pre-Phase-02 baseline schema $\to$ runs migration runner $\to$ verifies existing 48 products, 6 orders, and 5 users remain 100% intact.
   - **WAL-Safe Backup Verification Test:** Verifies `backup(db, targetPath)` or `VACUUM INTO` creates a valid standalone backup file matching `PRAGMA integrity_check = 'ok'`.
   - **Strict Baseline Mismatch Test:** Simulates an incomplete baseline (e.g., missing `orders` table) $\to$ asserts migration aborts with `BaselineMismatchError` without marking version 1.
   - **Idempotency Test:** Executes migration runner twice in succession $\to$ verifies zero duplicate key or syntax errors in $< 50\text{ms}$.
   - **Transaction Rollback Test:** Introduces simulated syntax error $\to$ verifies migration aborts and rolls back cleanly without partial table creation.
2. **`server/__tests__/models.test.ts`:**
   - **Unique Constraints:** Verifies duplicate slug in `projects` and `certifications` rejects with SQLite constraint violation (`SQLITE_CONSTRAINT`).
   - **Check Constraints:** Verifies invalid `publication_status`, `verification_status`, `client_type`, negative file sizes, or invalid dimensions throw SQLite constraint errors.
   - **Foreign Key Constraints:** Verifies linking `project_media` to a nonexistent `project_id` or `media_asset_id` throws a foreign key constraint error.
   - **Referential Deletion Protection:** Verifies attempting to delete a media asset referenced by `project_media` or `cover_media_id` throws `SQLITE_CONSTRAINT_TRIGGER / RESTRICT`.
   - **Effective Expiration Derivation:** Verifies credentials past their `expiration_date` evaluate dynamically to `effective_verification_status = 'EXPIRED'`.
   - **Private Media Protection:** Verifies private assets have `public_url = NULL` and require admin authentication to access.

### 12.2 Verification Commands (Confirmed from `package.json`)
```bash
# Execute test suite against isolated in-memory DB
npm test

# Verify strict TypeScript compliance
npm run lint

# Verify production ESM bundling
npm run build
```

---

## 13. Files Expected to Change in Phase 02

| File Path | Nature of Change | Justification |
|---|---|---|
| `server/db.ts` | **MODIFY** | Integrate versioned migration runner and export new typed query helpers |
| `server/migrations/runner.ts` | **NEW** | Migration coordinator, `sqlite.backup()` utility, baseline fingerprinting, and transaction wrapper |
| `server/migrations/001_baseline.ts` | **NEW** | Strict baseline validation and idempotent legacy schema definition |
| `server/migrations/002_projects_certs_media.ts` | **NEW** | DDL for projects, certifications, media assets, junction tables, check constraints, and composite indexes |
| `src/types/index.ts` | **MODIFY** | Export TypeScript contracts for `Project`, `Certification`, `MediaAsset`, `ProjectMedia`, `CertificationMedia` |
| `server/schemas.ts` | **MODIFY** | Export Zod validation schemas for Project, Certification, and Media creation/updates |
| `server/__tests__/fixtures/domainFixtures.ts` | **NEW** | Isolated test fixtures for automated testing |
| `server/__tests__/migrations.test.ts` | **NEW** | Automated test suite for schema evolution, idempotency, baseline detection, and rollback |
| `server/__tests__/models.test.ts` | **NEW** | Automated tests for database constraints, foreign keys, and effective status logic |

---

## 14. Risks, Dependencies & Closed Decisions

All previous architectural decisions are now formally closed and resolved:

1. **WAL Backup Mechanism:** Resolved $\to$ Evaluated native `sqlite.backup()` and `VACUUM INTO`. Both guarantee complete WAL consistency. Selected `backup()` from `node:sqlite` as primary asynchronous runner method with `VACUUM INTO` as synchronous CLI fallback.
2. **Baseline Detection:** Resolved $\to$ Multi-table structure, column, and cryptographic fingerprint verification. Eliminates fragile single-table checks.
3. **Table Census:** Resolved $\to$ Exactly 15 physical tables (9 legacy + 5 domain + 1 metadata).
4. **Database Constraints:** Resolved $\to$ Database-level `CHECK` constraints on all enum and numeric fields complement Zod schemas. `ON DELETE RESTRICT` protects referenced media.
5. **Media Visibility & Deduplication:** Resolved $\to$ Explicit `visibility` column. Private documents stored in `.data/private_uploads/` with authenticated streaming endpoint. Application-level deduplication scoped to public assets.
6. **Certification Expiration Semantics:** Resolved $\to$ Temporal truth via `expiration_date` with dynamic derivation to prevent stale states. Explicit storefront display policies per state.
7. **Index Cleanliness:** Resolved $\to$ Redundant unique indexes removed; composite query indexes retained.

---

## 15. Explicit Phase 02 Implementation Acceptance Criteria

Phase 02 implementation will be deemed complete and successful ONLY when all of the following criteria are met with fresh command evidence:

1. **Table Count:** Querying `SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'` returns exactly **15**.
2. **Data Preservation:** All 48 existing products, 8 categories, 6 orders, 8 order items, 3 coupons, 8 inventory logs, 1 review, 5 users, and 1 newsletter subscriber remain 100% intact and queryable.
3. **Migration Idempotency:** Restarting the server or re-running the migration runner completes in $< 50\text{ms}$ with zero unintended modifications.
4. **Backup & Safety:** A verified, integrity-checked backup file exists in `.data/backups/` matching `PRAGMA integrity_check = 'ok'` prior to schema changes.
5. **Type Safety:** `npm run lint` (`tsc --noEmit`) passes with 0 errors, validating complete type alignment between TypeScript contracts, Zod schemas, and database fields.
6. **Automated Verification:** All new migration and model tests in `server/__tests__/migrations.test.ts` and `server/__tests__/models.test.ts`, plus all 41 existing API tests, pass green (`npm test`).
7. **Zero Fictional Data:** Querying `SELECT COUNT(*) FROM projects` and `SELECT COUNT(*) FROM certifications` on the production database returns exactly `0`.
8. **Production Build:** `npm run build` succeeds cleanly in under 5 seconds.

---

## 16. Audit Verification Summary & State Declaration

- **Files Inspected During Audit & Amendments:**
  - `server/db.ts`
  - `server/routes/seed.ts`
  - `server/routes/products.ts`
  - `server/routes/orders.ts`
  - `server/routes/categories.ts`
  - `server/routes/inventory.ts`
  - `server/routes/users.ts`
  - `server/schemas.ts`
  - `src/types/index.ts`
  - `src/lib/api.ts`
  - `docs/master-development-plan.md`
  - `PLAN.md`
  - `.data/nexora.sqlite` (read-only inspection via `inspect_db_schema.mjs`)
- **Document Updated:** `docs/phase02-data-architecture-readiness.md`
- **Application Code Modified:** **NO (0 lines)**
- **Database Modified:** **NO (0 changes)**
- **Existing Records Modified:** **NO (0 records)**
- **Dependencies Installed:** **NO (0 packages)**
- **Deployment Performed:** **NO**

---

**FINAL READINESS VERDICT: READY**

All critical architectural ambiguities, review amendments, and safety requirements identified across STEP 02.0, STEP 02.0.1, and STEP 02.0.2 are formally closed and specified. The specification is complete, robust, and immediately actionable for Step 02.1 execution upon user authorization.
