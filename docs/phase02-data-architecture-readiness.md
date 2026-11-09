# NEXORA — Phase 02 Data Architecture Readiness & Migration Safety Audit
**Step 02.0 Deliverable — Read-Only Architectural Inspection & Schema Design**
*Document Version:* 1.0.0  
*Audit Date:* November 2026  
*Status:* COMPLETED (READ-ONLY AUDIT)  
*Current Repository Baseline Commit:* `2bc734daa41017f89d97ff8ec49b4fbf38959f1b`  
*Previous Implementation Baseline Commit:* `6ba6c0704018f18d21b322519401046eb3c4ae24`  
*Lead Auditors:* Principal Software Architect, Senior Backend Engineer, Database Reliability Engineer  

---

## 1. Executive Summary

This readiness audit conducts a rigorous, evidence-based, read-only architectural evaluation of the NEXORA platform before implementing **Phase 02 — Data Architecture & Schema Evolution**. 

NEXORA's core commerce engine operates on Node.js 24 (`node:sqlite` in WAL mode) with an authoritative Express 4 API. The current database contains live, persistent production records (48 products, 8 categories, 6 orders, 5 registered user accounts, 3 coupons, 8 inventory transactions, 1 review, and 1 newsletter subscriber).

### Core Audit Outcomes:
1. **Critical Architectural Void Identified:** The current database, TypeScript contracts, and API routes contain **zero data structures for Projects (`المشاريع`), Certifications (`الشهادات`), or Media Assets**.
2. **Migration Vulnerability:** The current schema initialization sequence relies exclusively on unversioned `CREATE TABLE IF NOT EXISTS` commands and an ad-hoc column injection function (`ensureUsersColumn`) executed on every module import. There is no `schema_migrations` tracking table, no atomic migration runner, and no rollback mechanism.
3. **Seed Data Policy Realignment:** The initial draft in `docs/master-development-plan.md` proposed seeding fictional projects and certifications on boot. **This policy is hereby rejected**. In alignment with Step 02.0 directives, production databases will remain strictly empty for these new domains until authentic records are entered through authorized admin workflows.
4. **Scope Adherence:** No application code, database files, or dependencies were modified during this audit. The current task is strictly analytical and diagnostic.

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

### 2.4 Critical Schema Findings
1. **Foreign Key DDL Omission:** Although `PRAGMA foreign_keys=ON` is active, existing tables do not declare explicit `FOREIGN KEY (column) REFERENCES target(id)` constraints in their DDL statements. Relationships (e.g., `order_items.order_id` $\to$ `orders.id`) are enforced purely at the application layer.
2. **Absence of Secondary Indexes:** Only automatic indexes generated by primary keys and unique constraints exist (`sqlite_autoindex_*`). There are **zero secondary indexes** on critical lookup paths (`products(category_id)`, `products(status)`, `orders(user_id)`, `reviews(product_id)`).

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
- `Project`, `ProjectMedia`, `CreateProjectSchema`
- `Certification`, `CertificationMedia`, `CreateCertificationSchema`
- `MediaAsset`, `CreateMediaAssetSchema`

---

## 4. Current Migration Mechanism & Limitations

### 4.1 Current Execution Sequence
In [`server/db.ts`](file:///C:/Users/abdal/Desktop/nexora/server/db.ts):
1. **Module Import:** When `server/db.ts` is imported, it synchronously connects to the SQLite file (line 15).
2. **Pragmas:** Executes `PRAGMA foreign_keys=ON;` and `PRAGMA journal_mode=WAL;` (lines 19–20).
3. **DDL Execution:** Synchronously executes a monolithic multi-statement `db.exec(CREATE TABLE IF NOT EXISTS ...)` string (lines 41–177).
4. **Ad-Hoc Column Injection:** Calls `ensureUsersColumn('password_hash', ...)` and `ensureUsersColumn('auth_provider', ...)` using `PRAGMA table_info(users)` (lines 180–186).
5. **Conditional Seed:** Executes `seed()` (line 232), which checks `SELECT COUNT(*) FROM users`. If 0, it seeds default users, categories, and coupons.
6. **Password Backfill:** Executes `ensureSeedPasswords()` (line 247).

### 4.2 Limitations & Risks of the Current Approach
- **No Migration Tracking:** There is no table recording applied migrations, timestamps, or checksums.
- **No Atomicity across Schema Changes:** `db.exec()` with multiple statements does not automatically roll back prior statements if a statement midway fails.
- **Lack of Rollback Strategy:** No automated backup of `.data/nexora.sqlite` is generated prior to running DDL changes.
- **Fragile Column Alterations:** Checking `table_info` in imperative JavaScript functions does not scale and becomes error-prone as schema complexity increases.
- **Test Database Divergence:** While tests use `NEXORA_DB=":memory:"`, running migrations purely via top-level execution makes it difficult to test migration upgrades from version A to version B.

---

## 5. Proposed Projects Data Model

To support bespoke commissions, case studies, and architectural installations without breaking existing commerce features:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL DEFAULT '',
  discipline          TEXT NOT NULL,
  client_type         TEXT NOT NULL DEFAULT 'PRIVATE_COLLECTOR',
  client_name         TEXT,
  description         TEXT NOT NULL DEFAULT '',
  challenge           TEXT NOT NULL DEFAULT '',
  solution            TEXT NOT NULL DEFAULT '',
  materials           TEXT NOT NULL DEFAULT '[]',
  location            TEXT NOT NULL DEFAULT '',
  completion_date     TEXT,
  cover_media_id      TEXT,
  cover_image_url     TEXT NOT NULL DEFAULT '',
  publication_status  TEXT NOT NULL DEFAULT 'DRAFT',
  is_featured         INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
```

### Key Field Design Rules:
- `id`: Stable, collision-resistant identifier (e.g., `proj_1731180000_a1b2c3d4`).
- `slug`: Human-readable, URL-safe unique identifier for `/projects/:slug`.
- `client_type`: Restricted to `'PRIVATE_COLLECTOR' | 'RESIDENTIAL' | 'COMMERCIAL' | 'INSTITUTIONAL'`.
- `publication_status`: Restricted to `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`. Public storefront queries enforce `WHERE publication_status = 'PUBLISHED'`.
- `materials`: JSON-encoded string array (`["Titanium Grade 5", "Solid Black Walnut"]`) for flexible, lightweight attribute filtering.
- `cover_media_id`: Foreign key reference to `media_assets(id)` (nullable).
- `cover_image_url`: Denormalized local or CDN URL path, allowing storefront card feeds to render without joining `media_assets`.

---

## 6. Proposed Certifications Data Model

To support official Swiss watchmaking assay certificates, COSC chronometer accreditations, and leather provenance seals:

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
  publication_status      TEXT NOT NULL DEFAULT 'DRAFT',
  verification_status     TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verification_notes      TEXT NOT NULL DEFAULT '',
  verified_at             TEXT,
  verified_by             TEXT,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
```

### Critical Separation of Concerns:
- **`publication_status`:** `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`. Controls visibility in public customer-facing directories (`/certifications`).
- **`verification_status`:** `'PENDING_VERIFICATION' | 'VERIFIED' | 'EXPIRED' | 'REVOKED'`. Reflects the real-world authentic status of the accreditation. A certification can be `PUBLISHED` while `EXPIRED` (displaying an expiration warning), or `VERIFIED` while held in `DRAFT`.
- **Zero Fabrication Mandate:** Initial database boot must not seed fictional credential numbers or fake testing organizations.

---

## 7. Proposed Media Assets Architecture

To transition NEXORA from plain-text URL inputs to a verified, durable asset library:

```sql
CREATE TABLE IF NOT EXISTS media_assets (
  id                 TEXT PRIMARY KEY,
  original_filename  TEXT NOT NULL,
  stored_filename    TEXT UNIQUE NOT NULL,
  storage_provider   TEXT NOT NULL DEFAULT 'local',
  storage_path       TEXT NOT NULL,
  public_url         TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  file_size          INTEGER NOT NULL,
  width              INTEGER,
  height             INTEGER,
  sha256             TEXT NOT NULL,
  alt_text           TEXT NOT NULL DEFAULT '',
  uploaded_by        TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
```

### Storage Provider Decoupling & Durability Strategy:
- **Development & VPS:** Files are stored under `public/img/uploads/` with `storage_provider = 'local'`.
- **Ephemeral Container / Serverless Production:** On platforms like Cloud Run or Vercel, local container storage is ephemeral. By decoupling `storage_provider` ('local' vs 's3' vs 'gcs'), `storage_path` (bucket key), and `public_url` (CDN URL), the platform can seamlessly transition to AWS S3 or Cloudflare R2 without altering database schemas or frontend components.
- **Deduplication:** The `sha256` column ensures identical files uploaded multiple times can be deduplicated or referenced without redundant storage allocation.

---

## 8. Relationship & Indexing Design

### 8.1 Normalized Gallery & Evidence Junction Tables
Rather than stuffing complex arrays of gallery images into unindexable JSON strings, we introduce normalized junction tables:

#### Project Media (`project_media`):
```sql
CREATE TABLE IF NOT EXISTS project_media (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  media_asset_id  TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'GALLERY',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  caption         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(project_id, media_asset_id, role)
);
```
*Roles permitted:* `'COVER' | 'GALLERY' | 'BEFORE_AFTER_BEFORE' | 'BEFORE_AFTER_AFTER' | 'BLUEPRINT' | 'INSTALLATION'`.

#### Certification Media (`certification_media`):
```sql
CREATE TABLE IF NOT EXISTS certification_media (
  id                TEXT PRIMARY KEY,
  certification_id  TEXT NOT NULL,
  media_asset_id    TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'EVIDENCE_DOCUMENT',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  caption           TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  UNIQUE(certification_id, media_asset_id, role)
);
```
*Roles permitted:* `'BADGE' | 'CERTIFICATE_SCAN' | 'TEST_REPORT' | 'EVIDENCE_DOCUMENT'`.

### 8.2 Performance & Lookup Indexing
To ensure sub-millisecond query performance on public feeds and admin searches:

```sql
-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_pub_featured ON projects(publication_status, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_discipline ON projects(discipline);

-- Certifications indexes
CREATE INDEX IF NOT EXISTS idx_certifications_slug ON certifications(slug);
CREATE INDEX IF NOT EXISTS idx_certifications_pub_ver ON certifications(publication_status, verification_status, sort_order);

-- Media Assets indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256 ON media_assets(sha256);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader ON media_assets(uploaded_by);

-- Junction indexes
CREATE INDEX IF NOT EXISTS idx_project_media_proj ON project_media(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_media_asset ON project_media(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_cert_media_cert ON certification_media(certification_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cert_media_asset ON certification_media(media_asset_id);

-- Secondary indexes for existing tables (Performance Enhancement)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_featured ON products(status, is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, is_approved);
```

---

## 9. Migration Implementation Strategy

### 9.1 The Versioned Migration Architecture
To prevent future migration drift and eliminate unversioned `db.exec()` hacks, we introduce a structured migration runner in `server/migrations/`.

#### Schema Migration Registry Table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version      INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  applied_at   TEXT NOT NULL,
  checksum     TEXT NOT NULL
);
```

### 9.2 Migration Steps
1. **Migration `001_initial_baseline`:**
   - Detects if `users` table already exists.
   - If present, records version `1` in `schema_migrations` as already applied.
   - If absent, provisions the original 9 tables and records version `1`.
2. **Migration `002_projects_certifications_media`:**
   - Executed within a single SQLite transaction (`BEGIN TRANSACTION` ... `COMMIT`).
   - Creates `media_assets`, `projects`, `certifications`, `project_media`, `certification_media`, and all supporting indexes.
   - Records version `2` in `schema_migrations`.
   - If any DDL fails, executes `ROLLBACK`, leaving the existing database completely untouched.

### 9.3 Backup & Safety Protocol
- Before executing any migration on a file-backed database (`DB_PATH !== ':memory:'`), the runner copies `.data/nexora.sqlite` to `.data/nexora.sqlite.bak_<timestamp>`.
- If an unhandled exception occurs, the runner aborts process startup, logs the exact SQLite error, and outputs the restore path.

---

## 10. Seed Data Policy (Strict Compliance with Step 02.0)

### 10.1 Prohibition of Fabricated Production Data
- **Zero Fictional Records on Startup:** The production database will NOT automatically seed mock projects, fake client commissions, fictional Swiss assay certificates, or dummy COSC numbers on server boot.
- **Empty State Guarantee:** The `projects` and `certifications` tables in `.data/nexora.sqlite` will remain empty until authentic records are entered via authorized admin workflows (`ADMIN` role).
- **Storefront Graceful Handling:** Storefront pages (`/projects`, `/certifications`) must implement elegant empty-state illustrations and copy when zero published records exist.

### 10.2 Isolated Test Fixtures
- For automated testing and visual development verification, test records will be housed strictly in `server/__tests__/fixtures/domainFixtures.ts`.
- These fixtures are imported exclusively by unit and integration tests executing against `NEXORA_DB=":memory:"`, ensuring zero leakage into persistent production storage.

---

## 11. Security & Data Integrity Considerations

1. **Foreign Key Enforcement:** Foreign keys on `project_media` and `certification_media` specify `ON DELETE CASCADE` for parent records and `ON DELETE RESTRICT` for media assets. An asset cannot be accidentally deleted if it is linked to an active project or certification.
2. **Slug Collision Defense:** Slugs must be validated server-side using Zod (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Database insertion will enforce `UNIQUE` constraints and return HTTP `409 Conflict` on duplicates.
3. **MIME Type & File Size Whitelisting:** The upcoming media endpoint must reject non-image/non-document uploads, enforce a 10MB file limit, and sanitize file names to prevent path traversal attacks.
4. **RBAC Isolation:** Media uploads and project/certification mutations will be restricted strictly to `ADMIN` and `MANAGER` roles via `authMiddleware` and `requireRole`. Unauthenticated access receives `401`, customer access receives `403`.

---

## 12. Testing & Verification Strategy

### 12.1 Automated Test Suites to Implement in Phase 02
Using the project's native runner (`vitest run`):

1. **`server/__tests__/migrations.test.ts`:**
   - **Fresh Database Test:** Initializes an empty `:memory:` DB $\to$ runs migrations $\to$ verifies all 14 tables and indexes exist.
   - **Upgrade Test:** Initializes pre-Phase-02 baseline schema $\to$ runs migration runner $\to$ verifies existing 48 products, 6 orders, and 5 users remain 100% intact.
   - **Idempotency Test:** Executes migration runner twice in succession $\to$ verifies zero duplicate key or syntax errors.
   - **Transaction Rollback Test:** Introduces simulated syntax error $\to$ verifies migration aborts and rolls back cleanly without partial table creation.
2. **`server/__tests__/models.test.ts`:**
   - **Unique Constraints:** Verifies duplicate slug in `projects` and `certifications` rejects with SQLite constraint violation (`SQLITE_CONSTRAINT`).
   - **Foreign Key Constraints:** Verifies linking `project_media` to a nonexistent `project_id` or `media_asset_id` throws a foreign key constraint error.
   - **Cascading Deletes:** Verifies deleting a project removes its `project_media` rows while preserving the underlying `media_assets` record.
   - **Publication & Verification States:** Verifies invalid enum strings are rejected by Zod schemas.

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
| `server/migrations/index.ts` | **NEW** | Migration coordinator, backup utility, and transaction wrapper |
| `server/migrations/001_baseline.ts` | **NEW** | Idempotent baseline schema definition |
| `server/migrations/002_projects_certs_media.ts` | **NEW** | DDL for projects, certifications, media assets, junction tables, and indexes |
| `src/types/index.ts` | **MODIFY** | Export TypeScript contracts for `Project`, `Certification`, `MediaAsset`, `ProjectMedia`, `CertificationMedia` |
| `server/schemas.ts` | **MODIFY** | Export Zod validation schemas for Project, Certification, and Media creation/updates |
| `server/__tests__/fixtures/domainFixtures.ts` | **NEW** | Isolated test fixtures for automated testing |
| `server/__tests__/migrations.test.ts` | **NEW** | Automated test suite for schema evolution, idempotency, and rollback |

---

## 14. Risks, Dependencies & Unresolved Decisions

### 14.1 Identified Risks & Mitigations
- **Risk:** Existing database corruption during Phase 02 schema execution.
  - *Mitigation:* Automatic `.bak` timestamped file backup generated prior to opening DDL transactions.
- **Risk:** Stale cache or schema mismatch during active server operations.
  - *Mitigation:* Synchronous migration run on application boot before Express listens on port 3000.

### 14.2 Unresolved Architectural Decisions for User Approval
1. **Media Storage Provider in Production:** While local storage (`public/img/uploads/`) is optimal for local development, does the user intend to host production on a stateful VPS (persistent storage) or an ephemeral serverless cloud (requiring S3/R2/GCS)? *Proposed Default:* Start with local storage; schema is already decoupled for instant cloud provider addition.
2. **Gallery Representation on Project Dossiers:** We recommend normalized junction tables (`project_media`) over raw JSON arrays for referential integrity. *Decision:* Adopt normalized junction tables while keeping a denormalized `cover_image_url` on `projects` for fast storefront listings.

---

## 15. Explicit Phase 02 Implementation Acceptance Criteria

Phase 02 implementation will be deemed complete and successful ONLY when all of the following criteria are met with fresh command evidence:

1. **Database Schema:** `projects`, `certifications`, `media_assets`, `project_media`, and `certification_media` tables exist in SQLite with all specified columns and constraints.
2. **Data Preservation:** All 48 existing products, 8 categories, 6 orders, 8 order items, 3 coupons, 8 inventory logs, 1 review, 5 users, and 1 newsletter subscriber remain 100% intact and queryable.
3. **Migration Idempotency:** Restarting the server or re-running the migration script runs in `< 50ms` and makes zero unintended modifications.
4. **Type Safety:** `npm run lint` (`tsc --noEmit`) passes with 0 errors, validating complete type alignment between TypeScript contracts, Zod schemas, and database fields.
5. **Automated Verification:** All new migration and model tests in `server/__tests__/migrations.test.ts` and all 41 existing API tests pass green (`npm test`).
6. **Zero Fictional Data:** Querying `SELECT COUNT(*) FROM projects` and `SELECT COUNT(*) FROM certifications` on the production database returns exactly `0`.
7. **Production Build:** `npm run build` succeeds cleanly in under 5 seconds.

---

## 16. Audit Verification Summary & State Declaration

- **Files Inspected During Audit:**
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
- **Report Created:** `docs/phase02-data-architecture-readiness.md`
- **Application Code Modified:** **NO (0 lines)**
- **Database Records Modified:** **NO (0 records)**

---

**AUDIT VERDICT: READY WITH CONDITIONS**

**Conditions for Phase 02 Implementation Kickoff:**
1. User approves the normalized junction table design (`project_media` and `certification_media`).
2. User confirms the zero-fabrication seed policy (production tables remain empty until real admin entry; test fixtures isolated to tests).
3. User gives explicit command authorization to begin Phase 02 implementation.
