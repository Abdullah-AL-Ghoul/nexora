# NEXORA — تقرير التطوير الهندسي الشامل (2026-10-06)

**النطاق:** تطوير كامل للمنصة من عرض تجريبي بواجهة localStorage إلى منصة e-commerce حقيقية بباكند فعلي، مع نظام تصميم، وأداء، وSEO، وأمن، واختبارات.

---

## 1. الملخص التنفيذي (Executive Summary)

حُوّلت NEXORA من تطبيق React ثابت يخزّن كل شيء في `localStorage` (مع ثغرة تصعيد صلاحيات بالتصميم) إلى **منصة متكاملة بباكند حقيقي**: Express API مع SQLite سيرفرية، مصادقة Firebase موثقة بتوقيع رقمي، تخويل أدوار سيرفري، تحقق مدخلات zod، واختبارات Vitest. على مستوى الواجهة: توجيه URL حقيقي (react-router) مع code-splitting لكل صفحة، طبقة API client موحدة، نظام تصميم مسجل (Tailwind v4 `@theme`) مع 344 صنف لون مهاجر من hex صلب إلى tokens، مكونات UI أساسية (Button/Input/Modal/Drawer…) بفخّ تركيز ودعم Esc، وSEO لكل صفحة مع robots.txt/sitemap.xml/JSON-LD.

**النتائج المقاسة:**
- الحزمة الأولية: 450KB → **342KB** (gzip: 139KB → **107KB**) بإخراج Firebase SDK من الحزمة الابتدائية (~24%).
- رحلة شراء كاملة تعمل نهايةً-إلى-نهاية على الخادم: إضافة للسلة → checkout → **طلب محفوظ في SQLite** مع خصم مخزون ذري (بما فيه مخزون المتغيرات).
- 11 اختبار Vitest خضراء، `tsc --noEmit` نظيف بالكامل، بناء الإنتاج ناجح.

---

## 2. المعمارية الحالية

| الطبقة | التقنية |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 (`@theme` tokens) + Zustand (persist للسلة/المفضلة فقط) + react-router-dom v7 |
| Data | طبقة `src/lib/api.ts` موحدة (fetch + Bearer token) — **لا localStorage منطق أعمال بعد الآن** |
| Backend | Express 4 + `node:sqlite` (DatabaseSync، WAL) + zod + jose (تحقق Firebase ID token عبر JWKS من Google) |
| Auth | Firebase Auth (Google + email/password) للهوية؛ الأدوار سيرفري فقط (`ADMIN_EMAILS`) |
| الاختبارات | Vitest — منطق التسعير/الكوبونات (`server/pricing.ts`) |
| الأدوات | git (8 commits مرحلية)، DESIGN.md، docs/SECURITY.md |

**الملفات الحرجة:** `server.ts` (الخادم + robots/sitemap + headers + rate limit) · `server/db.ts` (schema + seed) · `server/routes/*` (7 routers) · `server/pricing.ts` (منطق مشترك) · `src/App.tsx` (Router + lazy + ErrorBoundary + SeoManager) · `src/lib/api.ts` · `src/index.css` (@theme).

---

## 3. المشاكل الجوهرية المكتشفة والعلاج

| # | المشكلة | الخطورة | الجذر | العلاج | التحقق |
|---|---------|---------|-------|--------|--------|
| 1 | لا باكند فعلي — كل "قاعدة البيانات" في localStorage | P0 | `src/lib/db.ts` (785 سطراً) | باكند Express + SQLite كامل (7 routers) + طبقة API | رحلة شراء حية → طلب NX-1258 محفوظ |
| 2 | تصعيد صلاحيات بالتصميم: بريد يحوي "admin" = ADMIN | P0 | كود العميل يشتق الدور | الدور من الخادم حصراً + `requireRole` على كل كتابة | curl بلا توكن → 401 |
| 3 | Firestore rules تسمح كتابة غير مصدّق | P0 | `request.auth == null` في القاعدة | أُغلقت الثغرة | مراجعة القواعد |
| 4 | نظام تصميم وهمي (700 hex صلب، 54 زراً مكرراً) | P1 | لا @theme ولا primitives | @theme كامل + primitives + ترحيل 344 صنفاً | بناء + فحص بصري (الألوان مطابقة) |
| 5 | مسارات وهمية بحالة Zustand | P1 | لا router | react-router + lazy لكل صفحة + جسر توافق `navigate` | URLs حقيقية `/product/:slug` |
| 6 | AdminDashboard مونوليت (1397 سطراً) | P1 | تكديس تدريجي | هاجر للـ API بالكامل؛ التفكيك إلى وحدات أُرجئ (انظر §7) | tsc نظيف + لوحة تعمل بحيّة |
| 7 | لا Error Boundary (انهيار = شاشة بيضاء) | P1 | غياب | ErrorBoundary برسالة + details + زر إعادة | مُختبر فعلياً (التقط حلقة لا نهائية!) |
| 8 | Firebase كامل في الحزمة الأولية | P2 | import ثابت | dynamic import في getToken | 450→342KB |
| 9 | `motion` تابع ميت + AnnouncementBar ميت + أصناف toast وهمية | P2 | بقايا | حُذفت الثلاثة؛ keyframes حقيقية | grep = صفر |
| 10 | مخزون المتغيرات لا يُخصم عند الشراء | P1 | `variantId` يضيع في resolvedItems | أُضيف للمسار | 8→7 بعد طلب |

---

## 4. تحسينات UI/UX
- حالات تحميل/خطأ/فراغ **لكل صفحة** (Loader ذهبي موحد، ErrorState بإعادة محاولة، Empty states).
- رسائل خطأ فعلية من الخادم تظهر للمستخدم (مخزون غير كافٍ، كوبون مرفوض…).
- UX writing: نفس النبرة الفاخرة مع رسائل "ماذا حدث + ماذا تفعل".
- جسر توافق للملاحة: 60 استدعاء `navigate()` القديم يعمل عبر react-router دون كسر.
- Cache-آمن: debounce للبحث في المتجر (300ms)، إعادة ضبط الصفحة عند تغيير الفلاتر.

## 5. نظام التصميم (DESIGN.md)
- **Tokens:** 15 لوناً دلالياً (ink/surface/elevated/raised/line/gold/fg/status…)، مقياس radius، ظلال (card/overlay/gold)، خطوط (display=Cinzel, sans=Jakarta+Cairo, mono)، easing موحد `cubic-bezier(0.16,1,0.3,1)`.
- **Primitives:** Button (4 variants × 3 sizes + loading)، Input/Textarea/Select/Field، Modal (فخّ تركيز + Esc + scroll-lock + aria-modal)، Drawer (RTL-aware)، Card/Badge/Skeleton/CardSkeletonGrid/EmptyState/ErrorState/Spinner.
- **الحركة:** keyframes حقيقية (toast/drawer/modal/fade) + احترام `prefers-reduced-motion` عالمياً.
- ترحيل آلي بقابلة للتكرار: `scripts/tokens.mjs` (344 استبدالاً، صفر hex متبقٍ).

## 6. الوصولية
- skip-link، `:focus-visible` ذهبي موحد، فخّ تركيز في Modal/Drawer مع إعادة التركيز عند الإغلاق.
- ربط 10 من حقول checkout بعناوينها (htmlFor/id) + تحويل اختيار الشحن من label-onClick إلى **radio group حقيقي** (كيبورد + قارئ شاشة).
- تباين: fg-muted (#9CA3AF) على ink = ~7:1 (AA/AAA). aria-live للـ toasts.

## 7. الأداء (قياسات فعلية)
| القياس | قبل | بعد |
|---|---|---|
| الحزمة الأولية (JS) | 450.35 KB | **342.65 KB** (−24%) |
| gzip أولي | 139.03 KB | **107.34 KB** |
| Firebase | في الحزمة الأولية | chunk كسول (يُحمَّل مع /login فقط) |
| الخطوط | 4 عائلات (منها 800 وTajawal) | 3 عائلات، أوزان مقصوصة |
| Code-splitting | لا شيء (كل شيء بحزمة واحدة) | 11 chunk صفحة + chunk مشترك |

## 8. Core Web Vitals
**LCP/INP/CLS لم تُقس بقياس مخبري معزول (Lighthouse) في هذه الجولة** — بيئة الاختبار كانت dev server عبر Vite middleware (أرقام الإنتاج ستكون أفضل من الملاحظة). عوامل CLS المُعالجة هيكلياً: aspect-ratio ثابت لبطاقات المنتجات، lazy-loading للصور أسفل الطية، preconnect للخطوط. يوصى بتشغيل Lighthouse على بناء الإنتاج كخطوة تالية.

## 9. SEO
- meta لكل مسار (title/description/canonical/og) عبر `SeoManager` + تجاوز ديناميكي في صفحة المنتج.
- **JSON-LD** نوع Product (سعر/عملة/توفر/تقييم تجميعي) في صفحة المنتج.
- `robots.txt` (يمنع admin/checkout/login) + `sitemap.xml` **مولّد من الكتالوج الحي** (48 منتجاً).
- إصلاحات: favicon SVG inline، theme-color، og:image، lang/dir على html، trim للخطوط.

## 10. الأمن (docs/SECURITY.md — التفاصيل الكاملة)
- **مؤكد ومُصلح:** تصعيد الصلاحيات، ثغرة Firestore rules، غياب التحقق (zod الآن)، غياب rate-limit والـ headers، حقن Gemini غير المحدود، توليد معرفات دفع في العميل.
- **معلن ومقبول (عرض تجريبي):** توكن `demo` يمنح ADMIN محلياً للاستعراض — **يجب إزالته قبل أي نشر حقيقي** (موثق بموقعه في الكود)؛ الدفع محاكاة؛ Firebase web config عام بالتصميم.
- **غير ملاحظ:** SQLi (كل الاستعلامات parameterized)، XSS sinks (صفر dangerouslySetInnerHTML)، أسرار في العميل.

## 11. اختبار المتصفح (Phase J)
| الصفحة | الحالة | الملاحظة |
|---|---|---|
| Home (desktop+mobile) | ✅ | hero، شبكات المنتجات، لا أخطاء |
| Shop | ✅ | 8 بطاقات/صفحة، فلاتر تعمل، لا أخطاء |
| Product | ✅ | متغيرات بالمخزون، CTA، صور |
| Checkout→OrderSuccess | ✅ | رحلة كاملة: $1,998 → طلب محفوظ + خصم مخزون + صفحة نجاح |
| Admin | ✅ | تحليلات حية ($10,346، 6 طلبات، مخزون منخفض=3) |
| Categories/Orders/Wishlist/About | ✅ | بلا أخطاء، عناوين صحيحة |
| أنواع الجهاز | ✅ | 1440px + 390px، RTL سليم في الجميع |

الفحص البصري النهائي: القاضي البصري الآلي غير متاح في هذه البيئة (provider missing)، فاعتُمد الفحص البصري المباشر على اللقطات المحفوظة في `.qa/after/` — الخلاصة: **pass** على الصفحات الخمس (مع ملاحظة أن صور بعض المنتجات من بيانات البذور الأصلية، وليست خللاً برمجياً).

## 12. المتبقي (بشفافية)

| البند | الحالة |
|---|---|
| تفكيك AdminDashboardPage إلى وحدات | **PARTIAL** — هاجر للـ API بالكامل ويعمل؛ الوكيل المكلف بالتفكيك نفدت رصيده بعد إنشاء ملفين جزئيين (حُذفا)؛ التفكيك الكامل خطوة موصى بها |
| قياس CWV بـ Lighthouse على بناء إنتاج | **NOT VERIFIED** (بيئة dev فقط) |
| الدفع الحقيقي (Stripe) | **خارج النطاق** (يتطلب حساب تجاري) — محاكاة معلَنة |
| نشر الإنتاج + نشر firestore.rules | **NOT DONE** — القواعد المصلحة محلية حتى `firebase deploy --only firestore:rules` |
| إزالة توكن demo-ADMIN | **PENDING** قبل أي نشر حقيقي (موثق في docs/SECURITY.md §Hardening) |
| ESLint/Prettier + `npm audit` في CI | **NOT DONE** (lint = tsc فقط، كما وُلد المشروع) |

## 13. الخطوات التالية الموصى بها (مبررة بالأولوية)
1. **P0 قبل النشر:** إزالة/تقييد مسار توكن demo-ADMIN في `server/auth.ts` (سطر واحد) + نشر firestore.rules.
2. **P1:** تفكيك `AdminDashboardPage.tsx` إلى `src/pages/admin/` (العقد واضحة بعد ترحيل API — وكيل التفكيك يحتاج نصف رصيد فقط).
3. **P1:** Lighthouse على `vite build` + `npm start` لتثبيت أرقام CWV الإنتاجية.
4. **P2:** Stripe حقيقي (PaymentIntent سيرفري + webhook)، ESLint + GitHub Actions CI.
5. **P3:** استخدام primitives الجديدة تدريجياً في بقية الصفحات (54 زراً ما زالت hand-rolled) لإنهاء توحيد النظام.
