# NEXORA — Admin Dashboard & Backend Integration Audit
**Phase 04 Deliverable — End-to-End Data Pipeline, RBAC & Content Management Audit**
*Document Version:* 1.0.0  
*Date of Audit:* November 2026  
*Auditors:* Senior Backend Engineer, Principal Software Architect, Security Engineer

---

## 1. Executive Summary & Audit Scope

The user requested an authoritative, evidence-backed inspection of the connection between NEXORA's administrative dashboard, the Express server, and the database. 

We audited:
- Administrative routes and role-based guards.
- The full CRUD lifecycle of products, categories, orders, inventory, and reviews.
- Database schema and persistence mechanics in `.data/nexora.sqlite`.
- File upload handling and asset management.
- Capabilities regarding **Projects (`المشاريع`)** and **Certifications (`الشهادات`)**.

---

## 2. Answers to the 9 Mandatory Investigation Inquiries

### Question 1: Is the storefront actually connected to the admin dashboard?
> **Answer: YES, for Products, Categories, Orders, Inventory, and Reviews.**  
> **Empirical Evidence:**
> When an admin edits or adds a product in `AdminDashboardPage.tsx`, the client dispatches `PUT /api/products/:id` or `POST /api/products` via `src/lib/api.ts`. The Express handler (`server/routes/products.ts`) validates the payload with Zod (`CreateProductSchema`), executes a synchronous SQLite prepared statement against `.data/nexora.sqlite`, and returns the updated product. The public storefront routes (`HomePage`, `ShopPage`, `ProductDetailPage`) query the exact same SQLite table (`products`) via `GET /api/products`. Mutations made in the admin console are immediately visible across the storefront upon page refresh.

---

### Question 2: Is data persisted in the database?
> **Answer: YES, persistently inside SQLite with Write-Ahead Logging (WAL).**  
> **Empirical Evidence:**
> Database file: `C:\Users\abdal\Desktop\nexora\.data\nexora.sqlite`.  
> An automated database census performed during this audit confirms the presence of 9 tables:
> - `categories`: 8 records (the 8 artisanal guilds)
> - `products`: 48 records (fully populated catalog)
> - `orders`: 6 real orders (including test order `NX-1258` recorded during full checkout testing)
> - `order_items`: 8 records
> - `inventory_transactions`: 8 immutable audit logs
> - `coupons`: 3 active promotional codes (`NEXORA10`, `PRECISION50`, `VIP20`)
> - `reviews`: 1 verified product review
> - `users`: 5 registered accounts (Julian Vance [ADMIN], Elena Rostova [MANAGER], Alexander Hayes [CUSTOMER], and two real customer accounts)
> - `newsletter_subscribers`: 1 verified subscriber
> 
> Closing and restarting the server leaves 100% of the data intact. No business data resides in `localStorage`.

---

### Question 3: Does the admin dashboard control the content displayed on the site?
> **Answer: YES, for catalog artifacts, categories, order fulfillment, and reviews.**  
> - **Product Management:** Admins can change prices, update stock, toggle featured/trending status, edit titles, and set `status = 'ACTIVE'` or `'ARCHIVED'`. Archiving a product immediately filters it out of public catalog views (`WHERE status = 'ACTIVE'`).
> - **Order Fulfillment:** Admins can advance order states (`PENDING` $\to$ `PAID` $\to$ `PROCESSING` $\to$ `SHIPPED` $\to$ `DELIVERED`). This updates customer order tracking in `/orders` in real time.
> - **Inventory Control:** Manual stock adjustments require a documented reason and create an immutable record in `inventory_transactions`.
> - **Review Moderation:** Admins can approve or reject customer appraisals. Only approved reviews (`is_approved = 1`) factor into the product's aggregate star rating.

---

### Question 4: Can you add Projects and Certifications without editing code?
> **Answer: NO. (CRITICAL ARCHITECTURAL GAP)**  
> **Empirical Evidence:**
> - A full repository grep for `project` and `certif` confirms there are **zero database tables, zero API endpoints, and zero admin dashboard forms** for Projects or Certifications.
> - In `server/db.ts`, no `projects` or `certifications` table exists.
> - In `AdminDashboardPage.tsx`, the navigation tabs are strictly: `overview`, `products`, `categories`, `orders`, `inventory`, and `users`.
> - Currently, if a user wants to showcase a bespoke commission or display an artisan accreditation, they would be forced to hardcode it into `HomePage.tsx` or `AboutPage.tsx`.
> - **Resolution Required:** We must build dedicated database schemas, backend CRUD routers, admin management forms, and public storefront pages for both Projects and Certifications.

---

### Question 5: Does image and file upload work?
> **Answer: NO. (FUNCTIONAL DEFECT)**  
> **Empirical Evidence:**
> - Inspection of lines 1320–1360 of `AdminDashboardPage.tsx` reveals that image fields are simple text inputs:
>   `<input type="text" value={productForm.imageUrl} placeholder="/img/default.jpg or an image URL" />`
> - There is no `<input type="file">`, no drag-and-drop dropzone, and no image upload button.
> - In `server.ts`, there is no multipart middleware (`multer` or `busboy`) installed or configured.
> - Users cannot upload images from their desktop or mobile device. They must manually drop images into `public/img/` and type the file path string by hand into the admin form.
> - **Resolution Required:** Integrate `multer` on the backend, create `/api/upload` endpoint with automated WebP compression via `sharp`, and add a drag-and-drop media uploader component in the admin panel.

---

### Question 6: Are administrative permissions secure?
> **Answer: YES.**  
> **Empirical Evidence:**
> - Authentication is verified using **Jose HS256 JWT tokens** signed by `JWT_SECRET`.
> - The previous security hole (the `demo` token bypass that silently granted admin access to any user) was completely eliminated in commit `6ba6c07`.
> - Every administrative API route enforces `requireRole(user, 'ADMIN')` or `requireRole(user, 'ADMIN', 'MANAGER')`.
> - Requests without an Authorization header receive `401 Unauthorized`. Requests from `CUSTOMER` accounts receive `403 Forbidden`.
> - All 41 integration tests in `server/__tests__/api.test.ts` verify that unauthorized attempts to write products, adjust stock, or view user lists fail with strict 401/403 status codes.
> - Client-side `<RequireRole role="ADMIN">` in `App.tsx` serves as a clean UX guard, while the server enforces real security.

---

### Question 7: What functions are currently missing?
1. **Projects Management Module:** No ability to add, edit, or publish bespoke case studies.
2. **Certifications & Hallmarks Module:** No registry for issuing authorities, credential IDs, and certificate images.
3. **Binary Media Uploader:** No drag-and-drop file upload with automated image optimization.
4. **Rich Content Editor:** Product descriptions are plain text without formatting or bulleted specifications.
5. **Coupons Management Interface in Admin:** Coupons are stored in SQLite (`coupons` table with 3 records), but the admin dashboard lacks a UI tab to create or expire discount codes.
6. **Newsletter Subscribers Export:** Subscribers are stored in SQLite (`newsletter_subscribers`), but the admin dashboard does not have a view to list or export them to CSV.

---

### Question 8: What requires architectural refactoring?
1. **Monolithic Admin Dashboard:** `src/pages/AdminDashboardPage.tsx` is an unwieldy single file of 1,600 lines (70.8 KB). It should be refactored into modular subcomponents:
   - `src/pages/admin/AdminOverviewTab.tsx`
   - `src/pages/admin/AdminProductsTab.tsx`
   - `src/pages/admin/AdminProjectsTab.tsx` (NEW)
   - `src/pages/admin/AdminCertificationsTab.tsx` (NEW)
   - `src/pages/admin/AdminOrdersTab.tsx`
   - `src/pages/admin/AdminInventoryTab.tsx`
   - `src/pages/admin/AdminUsersTab.tsx`
2. **Database Migrations:** Establish an idempotent schema migration mechanism so new tables (`projects`, `certifications`, `media_assets`) are provisioned automatically on server boot without disrupting existing data.

---

### Question 9: Are there synchronization or stale data issues after mutations?
> **Answer: Minor UI refresh friction.**  
> - When an admin updates a product, the admin form updates local state immediately upon a successful 200 response from the API.
> - However, other open browser tabs or the public storefront rely on manual refetching upon navigation. 
> - Adding a global query invalidation trigger or broadcast event will ensure immediate multi-tab synchronization.

---

## 3. Comprehensive Data Flow & Schema Comparison

```
Current Architecture:
Admin Form ──[JSON Text Path]──► PUT /api/products/:id ──► SQLite (products)
                                                                 ▲
Storefront ◄──[JSON Feed]────── GET /api/products ───────────────┘

Proposed Architecture (With Projects, Certifications & Media):
Admin Form ──[Multipart File]──► POST /api/upload ──────────► public/img/uploads/ (Sharp WebP)
                                        │
Admin Form ──[JSON]────────────► POST /api/projects ────────► SQLite (projects)
Admin Form ──[JSON]────────────► POST /api/certifications ──► SQLite (certifications)
Admin Form ──[JSON]────────────► PUT /api/products/:id ─────► SQLite (products)
                                                                 ▲
Storefront ◄──[JSON Feeds]───── GET /api/projects ──────────────┤
Storefront ◄──[JSON Feeds]───── GET /api/certifications ────────┤
Storefront ◄──[JSON Feeds]───── GET /api/products ──────────────┘
```
