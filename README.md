# NEXORA — Full-Stack Luxury E-Commerce Platform

NEXORA is a production-grade, architectural e-commerce platform designed and engineered for modern luxury artifacts—spanning Swiss horology, planar audio monitors, vegetable-tanned French leather, and monolithic desktop sculptures.

Built to showcase professional full-stack engineering, strict separation of concerns, authoritative server-side pricing and inventory deduction, multi-role RBAC, and an anti-AI-slop visual constitution.

---

## 1. Project Overview & Positioning

- **Brand**: NEXORA
- **Positioning**: High-ticket artisanal luxury commerce (Timepieces, Acoustic Engineering, Minimalist Leather, Architectural Workspace, Modern Optics, Technical Apparel, Fine Accessories, Objects of Art).
- **Aesthetic Direction**: Dark / Premium / Minimal / Precision
  - **Background**: `#0F1113` (Obsidian)
  - **Surface**: `#171A1F` (Dark Slate)
  - **Accent**: `#C9A961` (Muted Swiss Gold)
  - **Secondary Accent**: `#E7D3A0`
  - **Text**: `#F5F5F5`
  - **Anti-Slop Discipline**: No static candy pill badges, no synthetic purple gradients, clean typographic metadata with subtle dot separators (`·`).

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 SPA + Express Full-Stack Server (single port) |
| **Language** | TypeScript (Strict mode, ES2022) |
| **Styling** | Tailwind CSS v4, `@theme` design tokens with runtime **light/dark themes** |
| **Icons** | Lucide React |
| **State Management** | Zustand (persistent cart, wishlist, session, and theme) |
| **Database** | SQLite via **`node:sqlite`** (`DatabaseSync`, WAL) at `.data/nexora.sqlite` — no native deps, no external service |
| **Auth** | First-party email + password (scrypt hashing) issuing **HS256 JWT sessions** (`jose`); Firebase Google Sign-In kept as an optional secondary provider |
| **Market Intelligence & AI** | Google Gemini 3.5 Flash with Real-Time Google Search Grounding (`googleSearch`) |
| **Payment Flow** | Stripe Test Mode Gateway with 256-bit simulated intent (clearly badged "Test Mode") |
| **Validation** | Zod (Schemas & input checks) |
| **Testing** | Vitest + Supertest (41 server integration tests against an isolated DB) |

---

## 3. Architecture & Data Flow

```
[Browser Client]
       │
       ▼
[Zustand Client Store] ─── (Cart / Wishlist / Theme / JWT session)
       │  (Bearer token on every API call)
       ▼
[Express API — authoritative]
  ├── Auth: register / login / logout (scrypt + jose HS256, roles from DB + ADMIN_EMAILS)
  ├── Products & Variants (48 Artifacts across 8 Ateliers, full CRUD)
  ├── Inventory Controller (Atomic Stock Decrement & Transaction Audit Logs)
  ├── Discount & Coupon Engine (NEXORA10, PRECISION50, VIP20)
  ├── Reviews (aggregate rating recomputed server-side) & Newsletter (deduped)
  ├── Order Management (Unique Order Ref, Courier Tracking, States)
  └── Role-Based Access Control (Customer / Manager / Admin) — 401/403 enforced per route
       │
       ▼
[SQLite — node:sqlite DatabaseSync, WAL]
  .data/nexora.sqlite (see §4)
```

### Core Business Rules Enforced Server-Side:
1. **Never Trust Client Input**: Prices, item subtotals, tax rates, and discount deductions are calculated strictly inside the database controller.
2. **Atomic Inventory Decrement**: When an order is placed, product and variant stock counts are verified and deducted in an atomic transaction; insufficient stock immediately rejects order creation.
3. **Audit Trail**: Every stock change produces an immutable `InventoryTransaction` record with timestamp, delta, resulting stock, and acting authority.
4. **Server Authorization**: Roles live only in the database (seeded accounts, plus `ADMIN_EMAILS` promotion on register). Protected routes return `401` without a valid session and `403` without the required role — the client-side `/admin` guard is UX only. There is **no demo/auto-login path**: no token means guest.

---

## 4. Database & Operations (Where is the DB? How do I connect?)

The database is a **single SQLite file** managed by Node's built-in `node:sqlite` driver — no daemon, no container, no native module compilation:

- **File**: `.data/nexora.sqlite` (created + migrated automatically on first boot; `-shm`/`-wal` sidecar files are normal in WAL mode).
- **Schema**: plain SQL, migrated idempotently at startup (`server/db.ts` — `CREATE TABLE IF NOT EXISTS` + guarded `ALTER TABLE`), so upgrading never loses data.
- **Connect / inspect**:
  ```bash
  # SQLite CLI (if installed)
  sqlite3 .data/nexora.sqlite ".tables"
  sqlite3 .data/nexora.sqlite "SELECT id, email, role FROM users;"

  # Or a GUI: open the file with "DB Browser for SQLite" / DataGrip / DBeaver
  ```
- **Point the app at a different DB** (staging copy, CI, throwaway test):
  ```bash
  NEXORA_DB=":memory:"            # ephemeral in-memory DB (used by the test suite)
  NEXORA_DB="./staging.sqlite"    # any file path
  ```
- **Backup / restore**: stop the server (or run a `CHECKPOINT`), copy the file. Restoring = copying it back.
- **Production path**: the data layer is intentionally boring — every route uses prepared statements through one connection module. Moving to Postgres later means swapping `server/db.ts` to `pg`/`postgres` and changing `AUTOINCREMENT`→`SERIAL`-style column types; route code stays untouched.

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `JWT_SECRET` | HS256 signing secret for session tokens | dev fallback (**set this in production**) |
| `ADMIN_EMAILS` | Comma-separated emails auto-promoted to `ADMIN` on register | — |
| `SEED_USER_PASSWORD` | Password assigned to seeded demo accounts on first boot | `nexora2026` (**change in production**) |
| `NEXORA_DB` | SQLite path or `:memory:` | `.data/nexora.sqlite` |
| `PORT` | HTTP port | `3000` |

---

## 5. Test Credentials (Seeded Accounts)

Accounts are seeded on first boot and sign in through **`/login`** (register creates `CUSTOMER` accounts). There is no persona switcher — sign out truly clears the session, and visiting `/admin` as a guest redirects to the login page.

| Account | Role | Permissions |
|---|---|---|
| **`customer@nexora.com`** | `CUSTOMER` | Storefront browsing, cart management, wishlist, checkout, review submissions, and personal order tracking. (Blocked from admin console.) |
| **`manager@nexora.com`** | `MANAGER` | Catalog management, stock adjustments, order fulfillment advancement, and review moderation. |
| **`admin@nexora.com`** | `ADMIN` | Total platform authority: RBAC user auditor, product CRUD, inventory logs, and order updates. |

All seeded accounts use the default password **`nexora2026`** (override with `SEED_USER_PASSWORD` before first boot). **Change it in any shared/production deployment.**

---

## 6. Coupon Codes (Active Promotions)

- **`NEXORA10`**: 10% discount on all orders exceeding $100.
- **`PRECISION50`**: $50 flat discount on orders exceeding $250.
- **`VIP20`**: 20% exclusive discount on high-ticket orders exceeding $500.

---

## 7. Key Features Implemented

### Storefront Experience:
- **Hero & Curated Showcase**: Architectural presentation with live catalog metrics and a trust marquee.
- **Light & Dark Themes**: Runtime CSS-variable token system with a navbar toggle; choice persists across reloads (no flash-of-wrong-theme), and `on-image` text tokens stay readable over photo scrims in both themes.
- **Real Accounts**: Register / sign in with email + password (scrypt-hashed), HS256 session tokens, guest browsing and guest checkout both supported; Google Sign-In remains as a secondary path.
- **8 Distinct Ateliers**: Timepieces, Audio Engineering, Minimalist Leather, Architectural Workspace, Modern Optics, Technical Apparel, Fine Accessories, Objects of Art.
- **Catalog Filtering**: Instant category tabs, keyword search with deterministic smart parsing (e.g., `under 500`), price range bounds, in-stock toggle, sorting (Price, Newest, Popularity, Rating), and pagination.
- **Product Dossier**: Multi-angle image selector, specification breakdown (Origin, Weight, Materials, SKU), variant selector (Colors, Straps, Materials), review appraisal submission, and complementary works.
- **Cart Bag Drawer**: Live calculation of subtotals, discounts, insured freight, and tax.
- **Full Checkout Flow**: Shipping address validation, freight carrier selection, Stripe Test payment simulator, and instant order ledger recording.
- **Order Tracking**: Detailed timeline (Payment Succeeded $\to$ Ledger Committed $\to$ White-Glove Vault Packing $\to$ Courier Handover).

### Management Console:
- **Overview Analytics**: Gross revenue, orders velocity, average commission value, critical low-stock warnings, and a 7-day revenue chart **computed from real orders** (no fabricated numbers).
- **Product CRUD**: Add new artifacts, edit existing specifications, or retire products from the catalog.
- **Orders Fulfillment**: Update order statuses (`PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
- **Inventory & Transaction Ledger**: Manual stock adjustment modal with required audit reason and immutable log.
- **Reviews Moderation**: Approve or hide customer appraisals.
- **Role Control**: Real-time permission switching and credential audit.

---

## 8. Execution Commands

```bash
# Development (Express + Vite Server on Port 3000)
npm run dev

# Type-check
npm run lint

# Test suite (Vitest + Supertest, isolated in-memory DB)
npm test          # single run
npm run test:watch

# Production Build
npm run build

# Start Production Server (serves dist/ + API)
npm run start
```

---

## 9. Imagery & Brand Assets

All product/hero photography is **bundled locally** under `public/img/` (no third-party hot-links). Brand assets — the heritage-seal favicon, apple-touch icon, and OG cover — live under `public/brand/`. `scripts/bundle-images.mjs` (re)downloads and rewrites the curated set; `scripts/gen-mark.mjs` regenerates the favicon mark.
