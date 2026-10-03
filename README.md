# NEXORA — Modern Commerce Platform

A full-stack e-commerce platform built with Next.js 16 (App Router), React 19, TypeScript, Prisma 7 (PostgreSQL), better-auth, Stripe, Tailwind CSS v4, and shadcn/ui.

**Design language:** Premium · Dark · Minimal · Precision (see [DESIGN.md](./DESIGN.md)).

## Feature map

| Area | What's included |
|---|---|
| Storefront | Home with trending/offers/best-sellers, catalog with filters (category, price, rating, availability), deterministic smart search ("shoes under 100"), product pages with variants/gallery/reviews, wishlist |
| Cart & checkout | Client cart (IDs only) with **server-authoritative pricing** (`/api/cart/quote`), coupons, shipping rules, Stripe Checkout, idempotent order creation |
| Payments | Stripe webhook with constant-time signature verification, two-layer idempotency (event dedup + PENDING claim), `checkout.session.expired` / `charge.refunded` / `payment_intent.payment_failed` handling, automatic refund when fulfillment is impossible |
| Inventory | Guarded stock decrements (`stock >= qty`) inside the fulfillment transaction, full inventory ledger with `balanceAfter` + actor, restock on cancel/refund |
| Admin | Role-gated (MANAGER/ADMIN) dashboard with SQL aggregates, product CRUD + inventory adjustments, order state machine, admin-only user management with last-admin protection |
| Auth | better-auth credentials, roles (`CUSTOMER`/`MANAGER`/`ADMIN`) that clients cannot self-assign, disabled-account session revocation, rate-limited auth endpoints |
| SEO | Dynamic `sitemap.xml`, `robots.txt` (admin/api/account blocked), canonical URLs, Open Graph/Twitter cards, JSON-LD Product schema, noindex on private sections |
| Data caching | Tag-based cache (`catalog` tag) for public catalog queries with active invalidation from every mutation; user-specific data always per-request |

## Getting started

```bash
npm install
cp .env.example .env         # fill in the values (Postgres URL + secrets)
npm run db:migrate           # create schema
npm run db:seed              # demo data (destructive — dev only!)
npm run dev
```

### Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@nexora.demo` | `NexoraDemo!2026` |
| Manager | `manager@nexora.demo` | `NexoraDemo!2026` |
| Customer | `customer@nexora.demo` | `NexoraDemo!2026` |

> ⚠️ `prisma/seed.ts` is **destructive** — it wipes all tables. Never point `DATABASE_URL` at a shared or production database and run it.

### Stripe (test mode only)

1. Copy the **test** secret key into `STRIPE_SECRET_KEY` and the publishable key into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Expose the webhook locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Without Stripe keys the app runs the local mock payment flow (requires `NEXORA_MOCK_PAY=1`, automatically disabled in production builds).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest (unit + integration against the dev DB) |
| `npm run test:e2e` | Playwright (starts its own dev server on :3100 with mock pay) |
| `npm run db:generate` / `db:migrate` / `db:deploy` | Prisma client / dev migration / production migration |
| `npm run db:seed` / `db:verify` | Seed demo data / assert seed invariants |
| `npm run db:studio` / `db:reset` | Prisma Studio / drop + recreate + seed |

## Architecture notes

- **Server-first rendering.** Pages are async server components; `"use client"` exists only for interaction islands (filters, forms, cart store, gallery).
- **The server owns money.** Client payloads are strict-zod, money-field-free; totals, discounts, shipping, and stock are recomputed from the database on every quote and at order creation.
- **Commerce reliability.** Fulfillment happens exactly once per order (webhook claim + PENDING→PAID claim), stock decrements are guarded, refunds/cancellations restock through the ledger, and duplicate checkouts collapse via an idempotency key.
- **Cache discipline.** Public catalog queries are cached under one `catalog` tag; every mutation that affects public data revalidates it. Orders, wishlist, and cart quotes are never cached.
- **Env validation.** `lib/env.ts` parses and validates environment variables with zod; secrets are never printed or shipped to the client.

## Known trade-offs (deliberate)

- Product search is SQL `ILIKE` — fine at demo scale, would warrant `pg_trgm`/`tsvector` at 10k+ products.
- Rate limiting is in-memory (single-node). A multi-node deployment needs a shared store.
- The npm audit reports advisories in `mysql2`, an unused optional transitive dependency of Prisma (this project is PostgreSQL-only); the only "fix" would be downgrading Prisma, which is not worth it.
