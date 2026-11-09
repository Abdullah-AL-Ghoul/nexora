# NEXORA — Admin Dashboard & Backend Integration Audit

**Execution Date:** November 2026  
**Auditing Team:** Principal Backend Architect, Application Security Engineer, Full-Stack QA Lead  
**Scope:** Deep verification of Admin Dashboard routes, PostgreSQL database mutations, API contracts, image upload pipelines, caching invalidation, and role-based access control.  

---

## 1. Executive Verdict & Direct Answers to Key Questions

| # | Question from Master Prompt | Verified Verdict | Technical Evidence & Details |
|---|---|---|---|
| **1** | **هل الموقع مرتبط فعليًا بلوحة التحكم؟** | **نعم، مرتبط بنسبة 100% وبشكل مباشر.** | لوحة التحكم تشارك نفس تطبيق Next.js 16 ونفس قاعدة بيانات PostgreSQL 17 عبر Prisma ORM. لا توجد أنظمة منفصلة أو موك، والتكامل ثنائي الاتجاه بالكامل. |
| **2** | **هل البيانات تُحفظ في قاعدة البيانات؟** | **نعم، تُحفظ مباشرة في PostgreSQL.** | كل عملية إنشاء أو تعديل (منتج، مستخدم، مخزون، حالة طلب، استشارة) تنفذ استعلام `prisma.product.create/update` وتكتب في الجداول الفعلية مع الالتزام بقيود المفاتيح الأجنبية والعمليات الذرية (Transactions). |
| **3** | **هل لوحة التحكم تتحكم في المحتوى المعروض في الموقع؟** | **نعم، لجميع المنتجات والأقسام المرتبطة بها.** | عند تعديل منتج أو تغيير حالته إلى `ACTIVE` أو `DRAFT`، أو تعديل السعر، ينعكس ذلك فورًا على واجهة المتجر عبر إعادة التحقق النشط من كاش `revalidateTag("catalog")`. |
| **4** | **هل يمكنني إضافة مشاريع وشهادات دون تعديل الكود؟** | **لا، غير ممكن حاليًا.** | **اكتشاف جوهري:** قاعدة البيانات الحالية لا تحتوي على جدول `Project` أو `Certification`، ولوحة التحكم لا تحتوي على صفحات إدارة لهما. حاليًا يتم إدارة المنتجات والتصنيفات والطلبات والاستشارات فقط. يتطلب ذلك إضافة Schema مخصصة وواجهات إدارة في لوحة التحكم. |
| **5** | **هل رفع الصور والملفات يعمل؟** | **نعم، يعمل محليًا مع وجود قيد في بيئة الإنتاج.** | مسار `POST /api/admin/upload` يستقبل الصور ويحفظها في `public/uploads/` مع توليد لاحقة فريدة. في حال فشل الكتابة على القرص (كما في Vercel Serverless)، يتم التحويل التلقائي إلى Base64 Data URI. يحتاج إلى دعم رفع ملفات PDF للشهادات. |
| **6** | **هل صلاحيات الإدارة آمنة؟** | **نعم، محمية بقوة على مستويين.** | 1) مستوى التوجيه (Middleware / Layout Guards) يمنع أي مستخدم ليس `MANAGER` أو `ADMIN` من رؤية الصفحات. 2) مستوى الـ API (`requireApiRole(STAFF_ROLES)`) يفحص جلسة better-auth في كل مسار خلفي. لا يمكن للمستخدم العادي ترقية نفسه. |
| **7** | **ما الوظائف الناقصة؟** | **1. إدارة المشاريع والأعمال.**<br>**2. إدارة الشهادات والاعتمادات.**<br>**3. إدارة البانرات الترويجية والمحتوى التحريري.**<br>**4. رفع المستندات غير الصور (مثل ملفات PDF للشهادات).** | النظام الحالي متجر تجارة إلكترونية متقدم، لكنه يفتقر إلى قدرات الـ Atelier Portfolio والـ Authenticity Vault التي طلبها المالك. |
| **8** | **ما الذي يحتاج إلى إعادة هيكلة؟** | **نظام تخزين الملفات وتوسيع الـ Schema.** | 1) توسيع Prisma Schema بإضافة جادول `Project` و`Certification`. 2) إضافة شاشات تحكم مخصصة لهما في `/admin/projects` و`/admin/certifications`. 3) استبدال التخزين المحلي المؤقت بحل تخزين دائم (Blob/S3) عند النشر على السحابة. |
| **9** | **هل توجد مشاكل في التزامن أو تحديث البيانات بعد التعديل؟** | **غير موجودة، التزامن مضبوط بعناية.** | النظام يعتمد `revalidateTag("catalog")` عند كل تعديل إداري، مما يبطل كاش صفحات المتجر العامة في لحظتها. طلبات الكارت والتشيك أوت غير مخزنة كاش نهائيًا (`cache: "no-store"`). |

---

## 2. In-Depth Technical Verification of Admin Surfaces

### 2.1 Product Catalog Management (`/admin/products/*`)
- **Creation Flow (`/admin/products/new`):**
  - Form built with React Hook Form + Zod schema validation.
  - Generates auto-slug from product title, parses price into integer cents (e.g., $1,250.00 $\rightarrow$ `125000`), validates SKU uniqueness.
  - Image upload directly integrated via `ImageUploader` component.
  - When submitted, issues `POST /api/admin/products`. Creates `Product`, `ProductImage` records, and initializes an `InventoryTransaction` with reason `SEED` or `RESTOCK`.
  - Triggers `revalidateTag("catalog")`. Product appears instantly on `/shop` and `/`.

- **Update Flow (`/admin/products/[id]`):**
  - Fetches existing product data including all images and variants.
  - Allows editing title, description, category, price, compareAtPrice, status (`DRAFT`, `ACTIVE`, `ARCHIVED`).
  - Dedicated **Inventory Adjustment Panel** (`components/admin/inventory-adjust.tsx`):
    - Admin can adjust stock with reasons: `RESTOCK`, `ADJUSTMENT`, `RETURN`, `CANCELLATION`.
    - Double-entry ledger audit: logs `delta`, `balanceAfter`, and `actorId` (the authenticated admin user).

### 2.2 Order Processing Control Plane (`/admin/orders/*`)
- **State Machine Integrity:**
  Orders follow a deterministic state transition machine:
  $$\text{PENDING} \xrightarrow{\text{Payment}} \text{PAID} \xrightarrow{\text{Fulfillment}} \text{PROCESSING} \xrightarrow{\text{Dispatch}} \text{SHIPPED} \xrightarrow{\text{Delivery}} \text{DELIVERED}$$
  $$\text{Or: PENDING/PAID} \xrightarrow{\text{Cancel/Refund}} \text{CANCELLED} / \text{REFUNDED}$$
- **Restock on Cancellation:**
  If an admin marks an order as `CANCELLED` or `REFUNDED`, the system automatically increments product stock and logs an `InventoryTransaction` with reason `CANCELLATION` or `RETURN`.
- **Export & Print Capabilities:**
  - `GET /api/admin/orders/export`: Generates real-time CSV of filtered orders for operations.
  - Printable invoice/packing slip generated directly from `/admin/orders/[id]` via print stylesheets.

### 2.3 User Administration & Security Controls (`/admin/users`)
- **Access Rule:** Gated strictly to `ADMIN` role (`MANAGER` cannot access).
- **Role Assignment:** Allows modifying roles between `CUSTOMER`, `MANAGER`, and `ADMIN`.
- **Active State:** Allows deactivating accounts (instantly revoking their Better-Auth sessions).
- **Last-Admin Protection:** Built-in SQL safeguard: `if (targetUser.role === 'ADMIN' && adminCount <= 1)` $\rightarrow$ rejects deletion/demotion with `400 Bad Request` to prevent self-lockout.

### 2.4 Private Consultation Queue (`/admin/consultations`)
- Displays inbound luxury concierge booking requests from patrons.
- Admins can update status: `NEW` $\rightarrow$ `CONTACTED` $\rightarrow$ `CLOSED`.
- Internal admin notes field for client profiling and consultation history.

---

## 3. Storage & File Upload Pipeline Audit

### 3.1 Local Filesystem Engine (`app/api/admin/upload/route.ts`)
- **Validation:**
  - MIME-type whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`.
  - Max size: 10MB per file.
  - Sanitizes extension and generates tamper-resistant filename: `product-${Date.now()}-${random}.${ext}`.
- **Dual-Storage Strategy:**
  1. Primary: Writes to `public/uploads/filename` and returns URL path `/uploads/filename`.
  2. Fallback: If filesystem write throws (e.g. read-only serverless disk), converts the buffer to Base64 `data:${mimeType};base64,...` so the product creation never fails.
- **Identified Limitations:**
  - PDF documents (essential for certificates) are rejected by the MIME whitelist.
  - Base64 data strings can cause PostgreSQL row bloat if 5MB+ images are uploaded frequently.
  - Recommend adding PDF support and integrating Vercel Blob for persistent serverless asset hosting.

---

## 4. Blueprint for Required Missing Features

To fulfill the user's explicit vision of managing **Projects** and **Certifications** directly from the admin dashboard without writing code, the following architectural expansion is required:

### 4.1 Schema Addition: Bespoke Projects (`Project`)
```prisma
enum ProjectStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Project {
  id          String        @id @default(cuid())
  title       String
  slug        String        @unique
  client      String?       // e.g. "Private Collector, Geneva"
  category    String        // e.g. "Horology", "Acoustics", "Haute Joaillerie"
  summary     String
  description String        @db.Text
  coverImage  String
  gallery     String[]      // JSON or array of image URLs
  year        Int           @default(2026)
  materials   String[]      // e.g. ["18K Rose Gold", "Grade 5 Titanium", "Sapphire"]
  status      ProjectStatus @default(DRAFT)
  featured    Boolean       @default(false)
  sortOrder   Int           @default(0)
  demoUrl     String?       // Live Showcase or Video link
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status, sortOrder])
  @@index([category])
}
```

### 4.2 Schema Addition: Authenticity Certifications (`Certification`)
```prisma
enum CertificateStatus {
  ACTIVE
  EXPIRED
  REVOKED
}

model Certification {
  id             String            @id @default(cuid())
  title          String            // e.g. "Chronometer Precision Master Accredit"
  slug           String            @unique
  issuingBody    String            // e.g. "Contrôle Officiel Suisse des Chronomètres (COSC)"
  credentialId   String            // e.g. "NX-CHRONO-2026-089"
  credentialUrl  String?           // Verification registry URL
  issueDate      DateTime
  expiryDate     DateTime?
  description    String?           @db.Text
  badgeImage     String            // Seal or badge graphic URL
  documentUrl    String?           // PDF certificate or cryptographic proof
  skillsOrDomain String[]          // e.g. ["Caliber Calibration", "Hand-Finishing", "ISO 3159"]
  status         CertificateStatus @default(ACTIVE)
  sortOrder      Int               @default(0)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([status, sortOrder])
}
```

### 4.3 Required Admin Interfaces to Build
1. `/admin/projects`: List of bespoke projects with draft/published badges and quick edit.
2. `/admin/projects/new` & `[id]`: Rich form with multi-image gallery upload, materials tagger, and client provenance.
3. `/admin/certifications`: Gallery of active credentials and seals.
4. `/admin/certifications/new` & `[id]`: Credential editor with PDF/image uploader and verification link builder.
5. Corresponding public storefront pages: `/projects` (Atelier Showcase) and `/certifications` (Proof of Authenticity).
