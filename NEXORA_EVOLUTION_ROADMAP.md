# NEXORA — Product Evolution & Engineering Roadmap

**Date of Execution:** October 2026  
**Auditing Team:** Principal Product Engineer, Staff Software Architect, Senior UX/UI Designer, Application Security Engineer, Performance & QA Automation Lead  
**Scope:** Tactical & Strategic Roadmap across 6 Horizons (Remediated Baselines through Enterprise Scale).

---

## 1. Roadmap Overview & Strategic Horizons

The NEXORA product evolution roadmap transitions the platform from a stabilized, verified baseline into a market-leading luxury digital flagship. The initiatives are structured across six chronological horizons:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HORIZON 1: Critical Defects & Security Baselines (COMPLETED & VERIFIED)          │
│ ├─ Quarantined masked prod env (.env.production.local.bak)                       │
│ ├─ Re-established local PostgreSQL 17 cluster daemon                            │
│ ├─ Resolved React 19 purity & external store hydration violations                │
│ └─ Cleaned ESLint global ignores and typecheck passes                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HORIZON 2: Core User Journeys & Checkout Reliability (COMPLETED & VERIFIED)      │
│ ├─ Accessible label collision fix on login form (getByLabel strict resolution)   │
│ ├─ Cart drawer modal link synchronization (view cart count in dialog)            │
│ ├─ Checkout form address field restoration & explicit COD/Card button semantics  │
│ └─ 48/48 Playwright E2E tests passing across 320px, 390px, 768px, 1440px         │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HORIZON 3: Experience Redesign & Design System Elevation                         │
│ ├─ Unified luxury typography & spacing tokens across PDP, Cart, and Admin        │
│ ├─ Fluid responsive layout inspection for ultra-wide displays (1920px+)          │
│ └─ Polished micro-interactions & tactile state transitions (Radix + Motion)      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HORIZON 4: Performance, Accessibility & SEO Architecture                         │
│ ├─ Zero-cumulative layout shift (CLS) Next.js image blur-up placeholders         │
│ ├─ WCAG 2.2 AA audit for color contrast on subdued metadata labels               │
│ └─ Complete JSON-LD Schema.org rich snippets for Product, Offer, and Merchant    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HORIZON 5: Differentiating Product Capabilities                                  │
│ ├─ Limited-Edition Drop Engine with real-time countdowns & stock meters          │
│ ├─ Client-facing AI Luxury Concierge (styling recommendations & sizing advice)   │
│ └─ Server-authoritative multi-currency ledger with live FX rates                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HORIZON 6: Scalability & Enterprise Operations                                   │
│ ├─ Multi-warehouse inventory allocation & regional routing                       │
│ ├─ Read-replica PostgreSQL database pooling with PgBouncer                       │
│ └─ Global edge caching & stale-while-revalidate for catalog endpoints            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Initiative Specifications

### Horizon 1: Critical Defects & Security Baselines (COMPLETED)

#### Initiative 1.1: Quarantining Corrupt Environment Config & Enforcing Build Invariants
- **User Problem & Evidence:** Next.js build failed during static evaluation of `_not-found` because `.env.production.local` contained masked literal values `[SENSITIVE]` for `NEXT_PUBLIC_APP_URL`.
- **Expected Outcome:** Reproducible local and CI build success without environment leakage.
- **User Journey:** Developer workflow, CI/CD pipeline deployment.
- **Scope & Dependencies:** Environment loading hierarchy (`.env`, `.env.production.local.bak`).
- **Cost:** Low (immediate fix).
- **Risk:** Zero risk; production values are supplied via secure environment variables in deployment environments.
- **Acceptance Criteria:** `npm run build` exits 0; all 37 routes compile without schema errors.
- **Status:** **VERIFIED (Exit code 0, 37/37 routes built in 20.8s).**

#### Initiative 1.2: PostgreSQL 17 Cluster Stabilization & Health Checks
- **User Problem & Evidence:** `ECONNREFUSED 127.0.0.1:5432` stopped all database-backed integration and E2E tests.
- **Expected Outcome:** Persistent local database cluster daemon with transactional integrity.
- **User Journey:** Core platform operation, order placement, admin inventory management.
- **Scope & Dependencies:** `postgres.exe` daemon on port 5432, Prisma schema migrations, `scripts/verify-seed.ts`.
- **Cost:** Low.
- **Risk:** Low; local development daemon running in user space.
- **Acceptance Criteria:** `npm run db:verify` outputs `Seed verification passed: all invariants hold`.
- **Status:** **VERIFIED (All invariants hold).**

---

### Horizon 2: Core User Journeys & Checkout Reliability (COMPLETED)

#### Initiative 2.1: Accessible Login Form Label Disambiguation
- **User Problem & Evidence:** Playwright strict-mode locator failed because `getByLabel("Password")` matched both `<input id="password">` and `<button aria-label="Reveal password text">`.
- **Expected Outcome:** Screen readers and automated tests unambiguously target the password input field.
- **User Journey:** Patron authentication, guest-to-customer conversion, admin sign-in.
- **Scope & Dependencies:** `components/auth/login-form.tsx`.
- **Cost:** Minimal.
- **Risk:** Zero risk.
- **Acceptance Criteria:** `getByLabel("Password")` resolves uniquely to `<input type="password">`.
- **Status:** **VERIFIED (Login tests pass in all viewports).**

#### Initiative 2.2: Cart Drawer Modal State & Accessible Navigation Synchronization
- **User Problem & Evidence:** Opening the cart drawer rendered an `aria-hidden` overlay on the header, hiding the cart badge with count `"1"` from screen readers and automated test locators.
- **Expected Outcome:** The open drawer provides an accessible link with the active item count (`View Cart (1)`).
- **User Journey:** Add to Bag → Review Drawer → Proceed to Cart / Checkout.
- **Scope & Dependencies:** `components/cart/cart-drawer.tsx`.
- **Cost:** Minimal.
- **Risk:** Zero risk.
- **Acceptance Criteria:** Test locator `getByRole('link', { name: /view cart|cart/i })` resolves and reveals the current item count.
- **Status:** **VERIFIED (E2E journey navigates from drawer to cart seamlessly).**

#### Initiative 2.3: Checkout Form Address Field Restoration & Express Order Placement
- **User Problem & Evidence:** Checkout failed to fill required address fields during Playwright execution when saved address chips were absent or unselected.
- **Expected Outcome:** Full address form fields are visible and labeled with explicit `aria-label` attributes; submit button clearly communicates payment method (`Place Order with Cash on Delivery` or `Place Order & Pay · $X`).
- **User Journey:** Complete purchase funnel from checkout to order confirmation (`/account/orders/[id]`).
- **Scope & Dependencies:** `components/checkout/checkout-form.tsx`.
- **Cost:** Low.
- **Risk:** Zero risk.
- **Acceptance Criteria:** Automated purchase of product yields a confirmed `PAID` order in the database.
- **Status:** **VERIFIED (Playwright test verifies order creation and status in database).**

---

### Horizon 3: Experience Redesign & Design System Elevation

#### Initiative 3.1: Tokenized Micro-Typography & Spatial System
- **User Problem:** Inconsistent heading weights and margin paddings between category pages and the main catalog.
- **Expected Outcome:** A unified Tailwind v4 design system adhering to strict typography tokens (`font-serif` for luxury editorial titles, `font-sans` tabular figures for pricing and inventory counts).
- **User Journey:** Browsing catalog, viewing PDPs, reading editorial notes.
- **Scope:** `app/globals.css`, `components/product/product-card.tsx`, `components/product/product-gallery.tsx`.
- **Cost:** Medium (design polish).
- **Risk:** Low (visual regression testing via Playwright screenshot comparison).
- **Acceptance Criteria:** Consistent 4px grid spacing; typographic hierarchy matching design tokens.

#### Initiative 3.2: High-DPI Product Gallery Zoom & Macro Materiality Preview
- **User Problem:** Luxury buyers expect to inspect stitching, leather grain, and metal finishes before purchasing high-ticket items.
- **Expected Outcome:** Smooth cursor-follow zoom loupe on desktop and pinch-to-zoom on mobile touch devices.
- **User Journey:** Product inspection on PDP.
- **Scope:** `components/product/product-gallery.tsx`.
- **Cost:** Low.
- **Risk:** Minimal; must preserve fast mobile touch responsiveness.
- **Acceptance Criteria:** Zoom overlay renders at 60fps without triggering layout shifts.

---

### Horizon 4: Performance, Accessibility & SEO Architecture

#### Initiative 4.1: Sub-Second LCP via Next.js Dynamic Blur-Up Image Placeholders
- **User Problem:** Hero banners and product catalog images cause minor visual flashes on slower 3G/4G mobile networks.
- **Expected Outcome:** Base64 blur-up placeholders generated at build time, guaranteeing 0.00 CLS and LCP < 1.2s.
- **User Journey:** Initial page load on all public storefront routes.
- **Scope:** Next.js `next/image` with `placeholder="blur"` and blurDataURL generation.
- **Cost:** Low.
- **Risk:** Zero risk.
- **Acceptance Criteria:** Lighthouse Performance score >= 95 on mobile and desktop.

#### Initiative 4.2: Structured Data (Schema.org) Rich Snippet Automation
- **User Problem:** Search engine crawlers do not consistently parse variant prices, currency options, and real-time in-stock status.
- **Expected Outcome:** JSON-LD `Product`, `Offer`, `AggregateRating`, and `BreadcrumbList` tags injected into PDP heads.
- **User Journey:** Organic search discovery, Google Merchant Center feed ingestion.
- **Scope:** `app/product/[slug]/page.tsx`.
- **Cost:** Low.
- **Risk:** Zero risk.
- **Acceptance Criteria:** Google Rich Results test validates 100% compliant schema with zero warnings.

---

### Horizon 5: Differentiating Product Capabilities

#### Initiative 5.1: Curated Limited-Edition Drop Engine
- **User Problem:** High-demand luxury drops cause inventory race conditions and patron frustration when items oversell.
- **Expected Outcome:** Real-time drop countdown timer with atomic PostgreSQL inventory holds during active checkout sessions.
- **User Journey:** Patron participates in scheduled release; receives reserved cart countdown (e.g. 10 minutes to complete checkout).
- **Scope:** `app/drops/page.tsx`, `lib/inventory/reservation.ts`, Redis/Postgres TTL hold table.
- **Cost:** Medium.
- **Risk:** Medium (requires strict expiration cleanup workers).
- **Acceptance Criteria:** Concurrent checkout stress test verifies zero overselling beyond total SKU stock.

#### Initiative 5.2: Client-Facing AI Concierge
- **User Problem:** Discerning shoppers often seek advice on sizing nuances, complementary accessory pairings, and gift recommendations.
- **Expected Outcome:** Context-aware luxury shopping assistant grounded in NEXORA's catalog data.
- **User Journey:** Conversational shopping assistant on storefront and PDP.
- **Scope:** Expansion of existing `AdminAiCopilot` architecture into a customer-facing concierge endpoint (`/api/concierge`).
- **Cost:** Medium.
- **Risk:** Low (grounded strictly on catalog database vectors; no unverified hallucinations).
- **Acceptance Criteria:** Recommends only in-stock items with direct links to PDPs.

---

### Horizon 6: Scalability & Enterprise Operations

#### Initiative 6.1: Multi-Region Inventory Allocation
- **User Problem:** As order volume expands across North America, Europe, and the Middle East, shipping costs and transit times increase if items ship from a single fulfillment node.
- **Expected Outcome:** Dynamic warehouse selection based on shipping destination postal code and regional warehouse stock levels.
- **User Journey:** Order fulfillment and shipping cost calculation at checkout.
- **Scope:** Prisma schema addition (`Warehouse`, `WarehouseInventory`), checkout allocation service.
- **Cost:** High (operational & architectural).
- **Risk:** Medium.
- **Acceptance Criteria:** Orders automatically route to the geographically closest fulfillment center with complete stock.

---

## 3. Prioritization Matrix & Summary

| Initiative | Horizon | User Value | Effort | Risk | Priority |
|---|---|---|---|---|---|
| **Masked Env Quarantine & Build Fix** | H1 | Critical | Low | Zero | **P0 (DONE)** |
| **PostgreSQL 17 Daemon & Seed Integrity** | H1 | Critical | Low | Zero | **P0 (DONE)** |
| **Login Label Collision Fix** | H2 | High | Low | Zero | **P1 (DONE)** |
| **Cart Drawer Link State Fix** | H2 | High | Low | Zero | **P1 (DONE)** |
| **Checkout Address & Button Semantics** | H2 | High | Low | Zero | **P1 (DONE)** |
| **Tokenized Typography & Spatial Grid** | H3 | High | Medium | Low | **P2 (In Progress)** |
| **High-DPI Gallery Zoom & Materiality** | H3 | Medium | Low | Low | **P2** |
| **Next.js Blur-Up Image Optimization** | H4 | High | Low | Low | **P2** |
| **Schema.org Rich Snippets** | H4 | High | Low | Zero | **P2** |
| **Curated Drop Engine with Holds** | H5 | High | Medium | Medium | **P3** |
| **Customer AI Concierge** | H5 | Medium | Medium | Low | **P3** |
| **Multi-Region Warehouse Routing** | H6 | High | High | Medium | **P4 (Future)** |
