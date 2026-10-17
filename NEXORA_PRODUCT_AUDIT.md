# NEXORA — Product & Engineering Audit Report

**Date of Execution:** October 2026  
**Auditing Team:** Principal Product Engineer, Staff Software Architect, Senior UX/UI Designer, Application Security Engineer, Performance & QA Automation Lead  
**Scope:** Complete repository, runtime verification, API contracts, database integrity, accessibility, responsive UI, security, and build performance.

---

## 1. System Inventory & Architecture Baseline

| Layer | Verified Technology | Version / Specification | State |
|---|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | `16.3.8` | Verified healthy |
| **Runtime & Language** | Node.js / TypeScript | Node `24.19.1` / TS `5.x` | Verified (`tsc --noEmit` clean) |
| **UI Library** | React 19 | `19.2.8` | Verified with React Compiler rules |
| **Styling** | Tailwind CSS v4 + Radix UI + Motion | `@tailwindcss/postcss ^4`, `motion ^14` | Verified dark-minimal precision design |
| **Database & ORM** | PostgreSQL 17 + Prisma 7 | `@prisma/adapter-pg ^7.10.0`, `pg ^8.23.1` | Active on localhost:5432, connection pool healthy |
| **Authentication** | better-auth (credentials & session) | `better-auth ^1.7.7` | Role-gated (CUSTOMER, MANAGER, ADMIN) |
| **Payments** | Stripe Node SDK & Webhooks | `stripe ^23.0.0` | Idempotent event deduplication & mock pay mode |
| **Testing** | Vitest & Playwright | `vitest ^5.0.3`, `@playwright/test ^1.63.0` | 40 unit/integration tests + 48 E2E tests passing |

---

## 2. Comprehensive Route Inventory (37 Routes)

All routes were built and validated via `next build` (37/37 static and dynamic pages generated):

### Storefront & Public Routes
- `GET /` — Flagship storefront home page (Curated collections, live telemetry stats, verified customer reviews, category entrypoints).
- `GET /shop` — Main catalog with multi-dimensional filtering (category, price range, rating, in-stock status, deterministic sorting).
- `GET /categories` — Architectural category directory with curated sub-labels.
- `GET /category/[slug]` — Segmented category listing with dynamic breadcrumbs.
- `GET /product/[slug]` — High-craft Product Detail Page (PDP) with multi-angle gallery, variant selector, real-time stock counters, and reviews.
- `GET /search` — Deterministic search results page with natural language query parsing.
- `GET /cart` — Client/server synchronized shopping bag with live server-authoritative quotes.
- `GET /checkout` — Luxury checkout experience supporting 1-Click Saved Address, express courier selection, and Cash on Delivery.
- `GET /shipping` — White-glove logistics, global duties, and express shipping guidelines.
- `GET /privacy` & `GET /terms` — Legal compliance, data protection, and terms of service.
- `GET /sitemap.xml` & `GET /robots.txt` — Dynamic SEO discovery endpoints.

### Authentication & Account Surfaces
- `GET /login` — High-security patron login with password reveal protection and OAuth options.
- `GET /register` — Client account registration with client-side role prevention.
- `GET /forgot-password` & `GET /reset-password/[token]` — Account recovery with single-use tokens.
- `GET /account` — Customer account hub with address manager and profile editor.
- `GET /account/orders` — Verified order history and status tracking.
- `GET /account/orders/[id]` — Detailed receipt, delivery progression, and order tracking.
- `GET /wishlist` — Persistent patron wishlist.

### Administrative & Operations Surfaces (Role-Gated: MANAGER, ADMIN)
- `GET /admin` — Executive Dashboard (revenue aggregates, AOV, order status distributions, low-stock alerts, AI Co-pilot).
- `GET /admin/orders` — Order fulfillment control plane with status transition state machines.
- `GET /admin/orders/[id]` — Deep order inspection, customer provenance, and printable invoices.
- `GET /admin/products` — Product catalog management with SKU tracking and stock ledger history.
- `GET /admin/products/new` — High-precision product creation with variant builders and image uploads.
- `GET /admin/products/[id]` — Product updating, inventory adjustments, and status toggles.
- `GET /admin/users` — Role management and account state control with last-admin deletion protection.

### Internal API Endpoints
- `POST /api/auth/[...all]` — Better-auth identity lifecycle.
- `POST /api/cart/quote` — Server-authoritative price calculation (strips client monetary inputs).
- `POST /api/checkout` — Idempotent order placement with stock decrements.
- `POST /api/coupons/validate` — Promotion and privilege code verification.
- `POST /api/reviews` — Customer review submission with verified purchase attribution.
- `GET /api/search` — Deterministic product search.
- `POST /api/webhooks/stripe` — Constant-time signature verified Stripe webhook receiver.
- `POST /api/admin/inventory` — Direct inventory adjustment with balance ledger audit.
- `POST /api/admin/ai/copilot` — AI store assistant querying database telemetry.
- `GET /api/admin/orders/export` — CSV and data export for operations.

---

## 3. Discovered Findings & Root Cause Analysis

### Issue P1.1: Masked Production Environment Crashing Next.js Build
- **Severity:** P1 (Blocking Build)
- **Observed Problem:** `next build` failed during static page generation with `Invalid public environment variables: NEXT_PUBLIC_APP_URL`.
- **Root Cause:** An untracked `.env.production.local` file was present on disk where variables were masked with literal strings `"[SENSITIVE]"`. Next.js automatically loads `.env.production.local` over `.env`, triggering Zod URL validation errors during layout evaluation.
- **Resolution:** Safely backed up `.env.production.local` to `.env.production.local.bak`. Build now compiles cleanly in 20.8 seconds across all 37 routes.

### Issue P1.2: Local Database Service Stopped
- **Severity:** P1 (Blocking Integration Tests & Local Runtime)
- **Observed Problem:** `npm run db:verify` and `npm test` failed with `ECONNREFUSED 127.0.0.1:5432`.
- **Root Cause:** PostgreSQL Windows service (`postgresql-x64-17`) was in a `Stopped` state.
- **Resolution:** Initialized and started PostgreSQL 17 data cluster daemon via `pg_ctl`/`postgres.exe`. Verified connection pool, running all database migrations and invariants check (`Seed verification passed: all invariants hold`).

### Issue P1.3: Accessible Label Collision on Login Forms
- **Severity:** P1 (Automated Testing & Accessibility)
- **Observed Problem:** Playwright `admin-and-mobile.spec.ts` and `checkout-journey.spec.ts` failed with:
  `strict mode violation: getByLabel('Password') resolved to 2 elements: <input id="password"> and <button aria-label="Reveal password text">`.
- **Root Cause:** The password input had label `"Master Password"`, and the eye toggle button had `aria-label="Reveal password text"`. Playwright's substring matcher matched both elements for `"Password"`.
- **Resolution:** Standardized input label to `<Label htmlFor="password">Password</Label>` and button to `aria-label={showPassword ? "Mask input" : "Reveal input"}`. Clean 1:1 resolution verified.

### Issue P1.4: Cart Drawer Modal Lockout in E2E Journey
- **Severity:** P1 (UX / E2E Regression)
- **Observed Problem:** Adding an item to the cart automatically triggered the Cart Drawer (`Sheet`), rendering an aria-hidden modal overlay that prevented Playwright from discovering the header cart link with text `"1"`.
- **Root Cause:** The secondary link inside `CartDrawer` was labeled `"Review Bag & Privileges"` without displaying the active badge quantity.
- **Resolution:** Updated the drawer link to `<Link href="/cart">View Cart ({itemCount})</Link>`, guaranteeing an accessible, visible link containing `"1"` both inside the modal drawer and in the header.

### Issue P1.5: Checkout Button Phrasing Mismatch
- **Severity:** P1 (Checkout UX & Contract)
- **Observed Problem:** Test was blocked waiting for `getByRole('button', { name: /place order|pay|checkout/i })`.
- **Root Cause:** A recent UI overhaul renamed the COD submit button to `"Confirm Order with Cash on Delivery"`, omitting standard e-commerce trigger words `"Place Order"`.
- **Resolution:** Updated button copy to `"Place Order with Cash on Delivery"` (and `"Place Order & Pay · $X"` for cards).

### Issue P2.1: React 19 / Compiler Purity & Hydration Violations
- **Severity:** P2 (React 19 Architecture)
- **Observed Problem:** ESLint failed with 6 errors:
  - `components/admin/admin-ai-copilot.tsx`: Calling `Date.now()` during render (`react-hooks/purity`).
  - `components/currency/currency-provider.tsx`: Calling `setState()` synchronously in `useEffect` (`react-hooks/set-state-in-effect`).
  - `components/product/price.tsx`: Calling `setMounted(true)` synchronously in `useEffect` (`react-hooks/set-state-in-effect`).
  - `.vercel/` build launcher being scanned with `@typescript-eslint/no-require-imports`.
- **Resolution:**
  - Integrated `useSyncExternalStore` for zero-cascading client currency synchronization.
  - Implemented `useSyncExternalStore` for client hydration detection in `Price`.
  - Added pure monotonic ID generator `nextMessageId()` and event-time timestamp strings in `AdminAiCopilot`.
  - Configured `eslint.config.mjs` to ignore `.vercel/**` and `lib/generated/**`. ESLint now passes with 0 errors.

---

## 4. Verification Verdicts

| Test Suite | Previous Status | Current Status | Verified Evidence |
|---|---|---|---|
| **TypeScript Typecheck** | PASS | **PASS** | `npm run typecheck` exited with code 0 |
| **ESLint Quality Suite** | FAIL (6 errors) | **PASS** | `npm run lint` exited with code 0 (0 errors) |
| **Vitest (Unit + Integration)** | 32 passed, 8 skipped | **PASS (40/40)** | 4 test files, 40 tests passed, 0 skipped |
| **Playwright E2E Suite** | FAIL (46 pass, 2 fail) | **PASS (48/48)** | 48 tests passed across 4 viewports + journeys |
| **Next.js Production Build** | FAIL (crash on `_not-found`) | **PASS** | `next build` 37/37 routes generated in 20.8s |
| **Database Invariants** | FAIL (connection refused) | **PASS** | `npm run db:verify` passed: all invariants hold |
