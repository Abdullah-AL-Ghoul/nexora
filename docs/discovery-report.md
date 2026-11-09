# NEXORA — Discovery & Project Intelligence Report
**Phase 00 Deliverable — Comprehensive Baseline & Architecture Map**
*Document Version:* 1.0.0  
*Date of Audit:* November 2026  
*Lead Architect & Engineering Team:* Senior Product Designer, Principal UI/UX, Full-Stack Architects, Security & QA Engineers

---

## 1. Executive Summary & Project Identification

**NEXORA** is a full-stack, architectural digital commerce platform engineered for high-ticket artisanal luxury masterworks. The platform encompasses eight specialized craft disciplines (ateliers):
1. **Timepieces (Haute Horlogerie)** — Mechanical column-wheel chronographs, sapphire crystal casebacks, Glucydur balance wheels.
2. **Audio Engineering** — Planar magnetic drivers, pure beryllium diaphragms, machined aircraft-grade aluminum enclosures.
3. **Minimalist Leather** — Full-grain vegetable-tanned French & Tuscan hides, hand-burnished edges, solid brass hardware.
4. **Architectural Workspace** — Solid walnut monitor plinths, anodized aluminum trays, ergonomic desktop sculptures.
5. **Modern Optics** — Japanese beta-titanium frames, Carl Zeiss polarized optics, architectural silhouettes.
6. **Technical Apparel** — Merino wool knits, technical stormproof membranes, tailored ergonomic cuts.
7. **Fine Accessories** — Machined titanium pens, geometric solid cufflinks, everyday carry objects.
8. **Objects of Art** — Lost-wax cast bronze sculptures, hand-thrown minimalist ceramic vessels.

Unlike generic e-commerce templates or synthetic dropshipping sites, NEXORA is built upon an **anti-AI-slop visual constitution** and authoritative server-side mechanics. Pricing, coupon deductions, inventory reservations, and role authorizations are calculated and enforced exclusively on the backend.

---

## 2. Technical Stack Inventory

| Architectural Layer | Technology & Version | Location / Config | Operational Role |
|---|---|---|---|
| **Frontend Framework** | React 19.0.1 (SPA) + React Router DOM 7.18.4 | `src/App.tsx`, `package.json` | Client application with code-split route lazy loading |
| **Build & Dev Tooling** | Vite 8.3.0, TypeScript 7.0.2 (Strict, ES2022) | `vite.config.ts`, `tsconfig.json` | High-speed ESM bundling; production build in ~4.09s |
| **Backend Runtime** | Node.js 24.22.1 + Express 4.21.2 | `server.ts`, `server/` | Authoritative REST API, security headers, rate-limiting, and static file serving |
| **Database Engine** | SQLite via native **`node:sqlite`** (`DatabaseSync`, WAL) | `.data/nexora.sqlite` | Zero external dependencies; ACID transactions, synchronized memory test support (`NEXORA_DB=":memory:"`) |
| **Design & Styling** | Tailwind CSS v4.3.3 (`@tailwindcss/vite`) | `src/index.css`, `DESIGN.md` | Runtime `@theme` tokens; dual-theme (Dark Obsidian / Warm Light) support |
| **Iconography** | Lucide React 0.546.0 | Throughout `src/components/` | Semantic SVG icons; no raw emoji or unstandardized assets |
| **State Management** | Zustand 5.0.15 (with `persist` middleware) | `src/store/useStore.ts` | Cart, wishlist, session tokens, language, and theme persistence |
| **Authentication & RBAC** | First-party Scrypt hashing + **Jose 6.2.12** HS256 JWT | `server/auth.ts`, `server/password.ts` | Multi-role RBAC (`CUSTOMER`, `MANAGER`, `ADMIN`); Firebase Google Auth retained as optional secondary provider |
| **Validation Layer** | Zod 4.6.5 | `server/schemas.ts` | Strict input parsing on all POST/PUT routes |
| **Market Intelligence & AI** | Google Gemini 3.5 Flash via `@google/genai` 2.4.0 | `server.ts` (`/api/market-intelligence`) | Live luxury market intelligence grounded with Google Search (`googleSearch`) |
| **Image Processing** | Sharp 0.35.5 | `package.json`, `scripts/` | Local bundling and WebP image generation |
| **Test Suite** | Vitest 5.0.3 + Supertest 7.3.1 | `server/__tests__/` | 41 automated integration tests (11 pricing/discount + 30 API/RBAC/CRUD) |

---

## 3. Git Status & Codebase Integrity

### 3.1 Version Control State
- **Current Branch:** `main`
- **Latest Commit:** `6ba6c07 Restructure: real auth (kill demo auto-Admin), product CRUD fix, de-demo, heritage seal, local imagery, light/dark theme, 41 tests`
- **Previous Milestones:**
  - `727f557` — Browser QA verification & final evolution report
  - `d7ba125` — A11y enhancements (label associations, radio groups) & security threat model
  - `369e9bb` — Performance (lazy Firebase auth, font trimming) & SEO (per-route meta, JSON-LD)
  - `beb3ba0` — Design token migration (344 hardcoded hex colors migrated to `@theme` tokens)

### 3.2 Working Tree Modifications (Preserved Untouched)
In accordance with Rule 2.1 and Rule 10, all uncommitted user work has been protected:
- **Modified:** `package.json`, `package-lock.json`, `src/data/seedData.ts`, and 37 images in `public/img/*.jpg`.
- **Untracked Additions:**
  - `public/img/*.webp` (modern high-efficiency WebP image variants).
  - `scripts/grade-images.mjs` & `scripts/grade-manifest.json` (image curation and grading pipeline).
  - `src/components/ui/SmartImage.tsx` (progressive image loader with fallback).
  - `src/lib/motion.ts` (centralized motion curve constants).
  - `.zcode/plans/...` (historical workflow plans).
- **Existing Documentation in `docs/`:**
  - `docs/EVOLUTION-REPORT.md` (comprehensive engineering changelog).
  - `docs/SECURITY.md` (security threat model and authorization audit).

---

## 4. Application Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CLIENT (SPA)                          │
│                                                                         │
│  [React 19 Components] ◄──► [Zustand Store (Cart, Wishlist, Theme, Lang)]│
│            │                                                            │
│            ▼                                                            │
│  [Unified API Client: src/lib/api.ts]                                   │
│    - Attaches Authorization: Bearer <JWT>                               │
│    - Handles automatic 401 token eviction & guest fallback              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP / JSON
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS 4 AUTHORITATIVE SERVER                     │
│                                                                         │
│  [Security Headers & In-Memory Rate Limiting]                           │
│  [Route Handlers: server/routes/*]                                      │
│    ├── /api/auth       ── Register, Login (scrypt), Logout, Session     │
│    ├── /api/products   ── Full CRUD, Filtering, Review Aggregation     │
│    ├── /api/categories ── Atelier Listing & Metrics                    │
│    ├── /api/orders     ── Atomic Stock Decrement & Order Ledger         │
│    ├── /api/inventory  ── Stock Adjustments & Immutable Audit Log       │
│    ├── /api/coupons    ── Server-Side Discount Calculation              │
│    ├── /api/newsletter ── Email Subscription with Deduplication         │
│    ├── /api/users      ── RBAC User Management (Admin Only)             │
│    └── /api/market-intelligence ── Gemini 3.5 Flash + Google Search     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Synchronous Prepared Statements
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  SQLITE DATABASE (.data/nexora.sqlite)                  │
│                                                                         │
│  9 Tables in WAL Mode:                                                  │
│  users (5) · categories (8) · products (48) · orders (6)                │
│  order_items (8) · coupons (3) · reviews (1)                            │
│  inventory_transactions (8) · newsletter_subscribers (1)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete Site & Component Inventory

### 5.1 Route Map
| Route Path | Page Component | Access Level | Description |
|---|---|---|---|
| `/` | `HomePage.tsx` | Public | Hero slider, trust marquee, 8 atelier cards, trending products, private dispatch offer, best sellers, architectural manifesto |
| `/shop` | `ShopPage.tsx` | Public | Catalog browser with category tabs, keyword search, price range filter, stock toggle, smart query parser, sort options |
| `/categories` | `CategoriesPage.tsx` | Public | Deep showcase of the 8 artisanal guilds with artifact counters and descriptions |
| `/product/:slug` | `ProductDetailPage.tsx` | Public | Multi-angle image viewer, variant selector, specs table, provenance seal, review submission form, JSON-LD structured data |
| `/checkout` | `CheckoutPage.tsx` | Public (Guest & Auth) | Shipping address validation, freight carrier selection, coupon code input, Stripe Test Mode simulator |
| `/order-success/:orderId` | `OrderSuccessPage.tsx` | Public | Order confirmation ledger, order summary, courier tracking timeline |
| `/orders` | `OrdersPage.tsx` | Customer / Admin | Historical order ledger and tracking status |
| `/wishlist` | `WishlistPage.tsx` | Public (Persisted) | Saved collectibles grid with one-click transfer to cart |
| `/about` | `AboutPage.tsx` | Public | Brand constitution, 3 architectural tenets, atelier philosophy |
| `/admin` | `AdminDashboardPage.tsx` | Guarded (`ADMIN` only) | Operations console: Revenue Analytics, Product CRUD, Categories, Orders fulfillment, Inventory ledger, User auditor |
| `/login` | `LoginPage.tsx` | Public | First-party email/password sign-in & registration; optional Google Firebase sign-in |
| `*` | `NotFound` (in `App.tsx`) | Public | Luxury-styled 404 error screen with bilingual redirection |

### 5.2 Global Drawers & Modals
- `CartDrawer.tsx` — Slide-out drawer displaying live cart items, subtotal, discount, freight, taxes, and direct checkout CTA.
- `QuickViewModal.tsx` — Fast modal inspection of any artifact directly from product grids.
- `MarketIntelligenceModal.tsx` — Real-time luxury auction and horological provenance modal powered by Gemini 3.5 Flash and Google Search grounding.
- `ToastContainer.tsx` — Floating toast notification center with accessible auto-dismissal.

---

## 6. Product Identity & Problem Formulation

### 6.1 What is NEXORA?
NEXORA is a **curated digital atelier and luxury commerce house** dedicated to permanent, tactile masterworks. It bridges the gap between traditional European guild craftsmanship (Geneva watchmakers, Tuscan tanners, Japanese lens-crafters) and modern architectural minimalism.

### 6.2 The Problem NEXORA Solves
Modern consumers face a flood of disposable, trend-chasing consumer goods, synthetic dropshipping stores, and soulless algorithmic marketplaces. High-net-worth collectors and discerning patrons seek products built to outlast decades, backed by authentic provenance, certified origin, repairable mechanical movements, and white-glove fulfillment.

### 6.3 The Primary Visitor Action
Visitors are invited to:
1. Explore curated artisanal masterworks across eight disciplines.
2. Inspect technical specifications (materials, calibers, weight, origin).
3. Acquire artifacts through an authoritative, secure luxury checkout experience.
4. Verify provenance and auction market intelligence via AI research grounding.

### 6.4 The Discrepancy Discovered During Audit
The user's master prompt requested an audit of **Projects (`المشاريع`)** and **Certifications (`الشهادات`)**, including their presentation and administration from the dashboard.
- **Audited Fact:** NEXORA was developed strictly as a luxury e-commerce product platform (`products` and `categories`).
- **Critical Finding:** There is currently **no database table, no API endpoint, and no admin screen for Projects or Certifications**.
- **Strategic Recommendation:** We must expand NEXORA's architecture from pure e-commerce into a dual-engine platform: **Storefront Products + Bespoke Commissions/Architectural Projects + Verified Guild Certifications**.
