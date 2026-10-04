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
| **Framework** | React 19 SPA + Express Full-Stack Server |
| **Language** | TypeScript (Strict mode, ES2022) |
| **Styling** | Tailwind CSS v4 (`@import "tailwindcss";`) |
| **Icons** | Lucide React |
| **State Management** | Zustand (Persistent cart, wishlist, and active persona) |
| **Cloud Database & Auth** | Firebase Authentication (Google Sign-In) + Cloud Firestore (`refined-bounty-h83d0`) |
| **Market Intelligence & AI** | Google Gemini 3.5 Flash with Real-Time Google Search Grounding (`googleSearch`) |
| **Payment Flow** | Stripe Test Mode Gateway with 256-bit simulated intent |
| **Validation** | Zod (Schemas & input checks) |

---

## 3. Architecture & Data Flow

```
[Browser Client]
       │
       ▼
[Zustand Client Store] ─── (Cart / Wishlist / Role Selection)
       │
       ▼
[Authoritative Database & Ledger Engine]
  ├── Products & Variants (48 Artifacts across 8 Ateliers)
  ├── Inventory Controller (Atomic Stock Decrement & Transaction Audit Logs)
  ├── Discount & Coupon Engine (NEXORA10, PRECISION50, VIP20)
  ├── Order Management (Unique Order Ref, Courier Tracking, States)
  └── Role-Based Access Control (Customer / Manager / Admin)
```

### Core Business Rules Enforced Server-Side:
1. **Never Trust Client Input**: Prices, item subtotals, tax rates, and discount deductions are calculated strictly inside the database controller.
2. **Atomic Inventory Decrement**: When an order is placed, product and variant stock counts are verified and deducted in an atomic transaction; insufficient stock immediately rejects order creation.
3. **Audit Trail**: Every stock change produces an immutable `InventoryTransaction` record with timestamp, delta, resulting stock, and acting authority.
4. **Server Authorization**: Customer accounts attempting to enter the `/admin` console are blocked by a strict role gate (`403 Unauthorized`).

---

## 4. Key Personas & Test Credentials

The application provides an instant **Persona Switcher** in the header and administration panel to test each role's capabilities:

| Persona | Role | Permissions |
|---|---|---|
| **Alexander Hayes** (`customer@nexora.com`) | `CUSTOMER` | Storefront browsing, cart management, wishlist, checkout, review submissions, and personal order tracking. (Blocked from admin console). |
| **Elena Rostova** (`manager@nexora.com`) | `MANAGER` | Catalog management, stock adjustments, order fulfillment advancement, and review moderation. |
| **Julian Vance** (`admin@nexora.com`) | `ADMIN` | Total platform authority: RBAC user auditor, product CRUD, inventory logs, order updates, and demo state reset. |

---

## 5. Coupon Codes (Active Demo Promotions)

- **`NEXORA10`**: 10% discount on all orders exceeding $100.
- **`PRECISION50`**: $50 flat discount on orders exceeding $250.
- **`VIP20`**: 20% exclusive discount on high-ticket orders exceeding $500.

---

## 6. Key Features Implemented

### Storefront Experience:
- **Hero & Curated Showcase**: Architectural presentation with live catalog metrics.
- **8 Distinct Ateliers**: Timepieces, Audio Engineering, Minimalist Leather, Architectural Workspace, Modern Optics, Technical Apparel, Fine Accessories, Objects of Art.
- **Catalog Filtering**: Instant category tabs, keyword search with deterministic smart parsing (e.g., `under 500`), price range bounds, in-stock toggle, sorting (Price, Newest, Popularity, Rating), and pagination.
- **Product Dossier**: Multi-angle image selector, specification breakdown (Origin, Weight, Materials, SKU), variant selector (Colors, Straps, Materials), review appraisal submission, and complementary works.
- **Cart Bag Drawer**: Live calculation of subtotals, discounts, insured freight, and tax.
- **Full Checkout Flow**: Shipping address validation, freight carrier selection, Stripe Test payment simulator, and instant order ledger recording.
- **Order Tracking**: Detailed timeline (Payment Succeeded $\to$ Ledger Committed $\to$ White-Glove Vault Packing $\to$ Courier Handover).

### Management Console:
- **Overview Analytics**: Gross revenue, orders velocity, average commission value, critical low-stock warnings, weekly volume chart, and guild distribution.
- **Product CRUD**: Add new artifacts, edit existing specifications, or retire products from the catalog.
- **Orders Fulfillment**: Update order statuses (`PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
- **Inventory & Transaction Ledger**: Manual stock adjustment modal with required audit reason and immutable log.
- **Reviews Moderation**: Approve or hide customer appraisals.
- **Role Control**: Real-time permission switching and credential audit.

---

## 7. Execution Commands

```bash
# Development (Express + Vite Server on Port 3000)
npm run dev

# Type-check & Linting
npm run lint

# Production Build
npm run build

# Start Production Server
npm run start
```
