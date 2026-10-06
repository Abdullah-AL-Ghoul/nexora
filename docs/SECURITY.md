# NEXORA — Security Threat Model & Review

**Scope:** NEXORA platform (Express API + node:sqlite + React SPA + Firebase Auth) as of the 2026-10 evolution pass.
**Method:** static review (grep-audited sinks, auth flows, config) + live behavioral testing (unauthenticated/admin-guard requests) + dependency/config inspection.

---

## Trust boundaries

1. **Browser → Express API** (`/api/*`): every privileged request must carry a Firebase ID token (`Authorization: Bearer …`) verified server-side with `jose` against Google's public JWKS. Roles are stored/determined **server-side only**.
2. **Express → SQLite** (`.data/nexora.sqlite`): all catalog/orders/coupons/inventory live here. Parameterized statements everywhere (no string interpolation of user input into SQL).
3. **Express → Google Gemini** (`/api/market-intelligence`): user query is embedded into a prompt. Prompt-injection surface — mitigated by length cap and read-only grounding tool.
4. **Firebase (Auth + legacy Firestore wishlist sync)**: web config is public by design; authorization enforced by `firestore.rules`.

## Findings

### Confirmed issues — FIXED during this pass

| # | Issue | Root cause | Fix | Validation |
|---|-------|-----------|-----|------------|
| 1 | **Client-side privilege escalation** — any visitor could become ADMIN by typing an email containing "admin" (`App.tsx`, `LoginPage.tsx`), and role lived in `localStorage` | Role derived in browser code; admin gate was a render-only check | Roles are now determined exclusively server-side (`ADMIN_EMAILS` env → `server/auth.ts`); client role is display-only; all write endpoints re-verify role (`requireRole`) | `POST /api/inventory/adjust` without token → **401**; `POST /api/products` without token → **401** (live curl) |
| 2 | **Firestore rules allowed unauthenticated writes** to `/users/{uid}` (`request.auth == null` branch) | Misplaced `||` in rule expression | `firestore.rules` rewritten: user docs writable only by the authenticated owner | Rules file diff |
| 3 | **No input validation on API** — raw `req.body` fed into business logic | No schema layer | All write endpoints validated with **zod** (`server/schemas.ts`); invalid payloads → 400 with field errors | Coupon/stock/order validation tests pass (Vitest, 11/11) |
| 4 | **No rate limiting** on the Gemini proxy | Missing middleware | In-memory sliding-window limiter (20 req/min/IP on `/api/market-intelligence`) | Code review |
| 5 | **No security headers** | Missing middleware | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy: strict-origin-when-cross-origin` set globally | curl headers |
| 6 | **Gemini prompt injection surface** — unbounded user query into prompt | No length cap | Query capped at 1000 chars; error returned beyond | Code review |
| 7 | **Fake Stripe order IDs generated client-side** (`db.ts` fabricated `pi_test_*` before order creation) | Client-side "checkout" | Order creation + atomic stock decrement + inventory ledger moved server-side (Express + SQLite transaction path); payment remains an explicit simulation | Live order journey → persisted order + decremented stock |

### Known, accepted (documented demo behavior)

| Item | Note |
|------|------|
| **`demo` bearer token grants ADMIN** | When no Firebase session exists the client sends `Bearer demo`; the server maps it to an ADMIN demo persona so the showcase (admin console, seeded data) is explorable without sign-in. This is intentional for the local/portfolio demo and **must be removed or gated to `NODE_ENV !== 'production'` + disabled by default before any real deployment** (`server/auth.ts` — single `if` statement). |
| **Payment is simulated** | `/api/checkout/create-intent` and order `paymentStatus: 'SUCCEEDED'` are test-mode theater. No card data is collected, stored, or transmitted. Integrating real Stripe requires a commercial account + server-side webhook reconciliation. |
| **Firebase web config committed** (`firebase-applet-config.json`) | Standard for Firebase web apps — the config identifies the project, it is not a secret. Protection comes from Firestore rules + Auth. |
| **Anonymous Firebase auth fallback** | Wishlist sync historically signed users in anonymously; with the API migration the client keeps wishlist locally and only real sign-ins hit Firestore. |

### Potential (flagged, not exploited)

- **No CSRF token**: API is same-origin JSON-only; `Authorization` header (not cookies) carries identity, which structurally blocks classic CSRF. If cookie sessions are ever introduced, add CSRF protection.
- **Dependency surface**: `firebase` (full SDK), `express` 4, `jose`, `zod`. No `npm audit` was run in this pass — recommend adding it to CI.
- **Admin dashboard renders user-supplied product fields as text** (React escapes by default; no `dangerouslySetInnerHTML` anywhere — grep-confirmed). XSS risk is low but keep it that way.

### Not observed

- SQL injection (all queries parameterized; audit found no concatenation of user input into SQL).
- `eval`/`new Function`/`innerHTML`/`dangerouslySetInnerHTML` usage (grep: zero matches).
- Client-side secrets (`VITE_*`/`NEXT_PUBLIC_*` env leakage: zero matches).
- Open redirects, path traversal, or file-upload endpoints.

## Hardening checklist before real deployment

1. Remove/flag the `demo` ADMIN token path in `server/auth.ts`.
2. Integrate real Stripe (server-side PaymentIntent + webhook to mark orders PAID).
3. Replace the in-memory rate limiter with a persistent store (Redis) if horizontally scaled.
4. Add `helmet` (CSP), `npm audit` in CI, and a service-account-based Firebase Admin for authoritative role management if moving off `ADMIN_EMAILS`.
5. Run `firebase deploy --only firestore:rules` to publish the fixed rules (local edit only until deployed).
