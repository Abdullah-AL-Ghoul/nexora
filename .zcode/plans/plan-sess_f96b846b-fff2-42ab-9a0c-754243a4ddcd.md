# خطة تطوير NEXORA — تدقيق كامل + باكند حقيقي + إعادة تصميم هندسية

## نتائج التدقيق الاستكشافي (Phase 0 — مكتمل)

**المشروع**: متجر فاخر تجريبي (React 19 + Vite 8 + Tailwind v4 + Zustand + Express + Firebase Auth + Bun). لا git، لا اختبارات، لا ESLint.

**المشاكل الجوهرية المكتشفة (بأدلة):**
1. **لا باكند فعلي**: كل المنتجات/الطلبات/المخزون/الكوبونات في localStorage عبر `src/lib/db.ts` (785 سطر). "الدفع" يولّد معرفات `pi_test_` وهمية في `server.ts:75`.
2. **تصعيد صلاحيات بالتصميم**: دور ADMIN يُمنح في كود العميل من نص البريد (`App.tsx:44-48`, `LoginPage.tsx:53,86`)، والبوابة الإدارية فحص render فقط. قاعدة Firestore تسمح بكتابة غير مصدَّق على `/users` (`firestore.rules:16`).
3. **نظام تصميم وهمي**: متغيرات CSS في `index.css` غير مسجلة مع Tailwind v4 (لا `@theme`) ولا يستهلكها أحد؛ ~700 صنف لون hex مباشر؛ زر ذهبي مكرر ~54 مرة في 21 ملف؛ لا مكونات Button/Input/Modal أساسية.
4. **ملف عملاق**: `AdminDashboardPage.tsx` بـ1397 سطراً (6 تبويبات + 3 نوافذ مشروطة + كل نماذج CRUD).
5. **مسارات وهمية**: لا router — التنقل بحالة Zustand؛ لا روابط قابلة للمشاركة، لا SEO فعلي (لا robots/sitemap/meta لكل صفحة/canonical/JSON-LD).
6. **جودة أدوات غائبة**: tsconfig بلا strict، zod مثبت وغير مستخدم، `motion` تابع ميت، `AnnouncementBar` كود ميت، أصناف toast `animate-in` لا تعمل (لا tailwindcss-animate)، لا Error Boundary (انهيار = شاشة بيضاء)، لا اختبارات.
7. **أداء**: 11 صفحة مستوردة بنفس الحزمة، Firebase كامل في الحزمة الرئيسية، 4 عائلات خطوط بأوزان كثيرة، صور Unsplash بلا أبعاد (CLS) وبلا srcset.
8. **نقاط قوة تُحفظ**: هوية بصرية داكنة/ذهبية متماسكة، دعم RTL عربي حقيقي، i18n كامل، toast system، حالات فارغة جزئية، Gemini proxy آمن (المفتاح سيرفري).

---

## المعمارية المستهدفة

**باكند حقيقي بلا اعتماد على مفاتيح سحابية إضافية:**
- **Express API موسع** في `server.ts` (يُقسم إلى `server/`): مصادقة عبر التحقق من Firebase ID Token باستخدام `jose` (شهادات Google العامة — لا يحتاج service account)، تخويل أدوار من جدول users في القاعدة، تحقق مدخلات بـ **zod** (مثبّت أصلاً)، تحديد معدل بسيط في الذاكرة، headers أمنية.
- **قاعدة بيانات سيرفرية**: `node:sqlite` مدمجة في Node 24 (صفر تبعيات أصلية، تعمل محلياً وعلى Cloud Run). جداول: users, products, categories, orders, order_items, coupons, reviews, inventory_transactions.
- **تهيئة الأدوار**: ADMIN يُزرع من `ADMIN_EMAILS` في البيئة (افتراضياً ynab2025@gmail.com) — الصلاحية تُفرض سيرفرياً فقط.
- **الدفع**: يبقى محاكاة معلَنة (وضع تجريبي) لكن إنشاء الطلب وخصم المخزون الذري ينتقلان سيرفرياً داخل transaction.
- **الواجهة**: `src/lib/db.ts` يُستبدل بطبقة `src/lib/api.ts` (fetch + ID token)؛ أسماء الدوال نفسها لتقليل الضرر. Firebase يبقى للمصادقة فقط.
- **توجيه حقيقي**: `react-router-dom` بمسارات URL حقيقية (`/`, `/shop`, `/product/:slug`, `/checkout`…) + صفحات `React.lazy` + catch-all في Express.
- **إصلاح `firestore.rules`** (إغلاق ثقب الكتابة غير المصدقة) — تبقى احتياطاً.

---

## مراحل التنفيذ (مع تحقق بعد كل مرحلة)

**A. الأساس الأمني**: `git init` + commit أساسي (نقطة تراجع)؛ تثبيت التبعيات (bun أو npm)؛ تشغيل التطبيق والتحقق أنه يعمل؛ لقطات baseline للصفحات الرئيسية (قبل/بعد).

**B. الباكند الحقيقي**: بناء `server/` (routes, auth, rbac, sqlite schema, seed, zod schemas, tests) — نقل كامل منطق `db.ts` (كوبونات، ضريبة/شحن، مخزون ذري، تحليلات) سيرفرياً. اختبارات Vitest لمنطق التسعير/الكوبون/المخزون. تحقق: اختبارات خضراء + curl على نقاط النهاية (مرفوض غير المصدق، مرفوض غير الإداري).

**C. ترحيل الواجهة**: `api.ts` client؛ استبدال استدعاءات db.ts؛ إزالة persist المحسوبة؛ إصلاح تسجيل الدخول (الدور يأتي من الاستجابة السيرفية)؛ react-router + lazy. تحقق: `tsc --noEmit` + رحلة شراء كاملة في المتصفح.

**D. نظام التصميم**: تسجيل `@theme` في index.css (ألوان semantically مسماة: bg/surface/border/gold/status-success/warn/danger) + مقياس typography + radius/shadow tokens + استخراج مكونات `Button, Input, Select, Textarea, Modal (مع focus trap/Esc/aria-modal), Drawer, Card, Badge, Skeleton, EmptyState, ErrorState` في `src/components/ui/`. إصلاح toast animation بـ CSS keyframes حقيقية + دعم prefers-reduced-motion. إزالة `motion` (غير مستخدم) و`AnnouncementBar` (ميت). تحديث تدريجي: مكونات المشتري أولاً ثم الإداري.

**E. إعادة تصميم الصفحات**: ترقية Home/Shop/Product/Checkout (هرمية بصرية، حالات التحميل/الخطأ/الفراغ لكل صفحة، UX writing عربي/إنجليزي محسّن)؛ **تفكيك AdminDashboardPage** إلى `pages/admin/` (6 تبويبات كمكونات + نماذج + جداول من المكونات الأساسية). تحقق: لقطات قبل/بعد + visual judge على الصفحات الرئيسية.

**F. الوصولية**: skip-link، إدارة focus في النوافذ/الدرج، aria للـ nav/modals، تباين الألوان، أحجام لمس ≥44px، تنقل كيبورد كامل في رحلتي الشراء والإداري، `html lang/dir` ديناميكيان (موجود جزئياً).

**G. الأداء**: code-splitting، تقليم أوزان الخطوط، `width/height` للصور + `fetchpriority` للـ hero، مراجعة حجم الحزمة (vite build + تحليل)، Lighthouse عبر المتصفح إن أمكن. توثيق ما قيس وما لم يقس بصدق.

**H. SEO**: meta لكل صفحة (hook خفيف document.title/description)، canonical، og:image، JSON-LD (Product/ProductDetail، Organization)، `robots.txt` + `sitemap.xml` مولّد من الكتالوج، عناوين h1-h3 سليمة، alt نصوص.

**I. الأمن**: نموذج تهديد مكتوب (docs/SECURITY.md): ما أُصلح (RBAC سيرفري، zod، rate limit، headers، حدود طول استعلام Gemini، rules) / ما تبقى معلَن (دفع محاكى، Firebase web config عام).

**J. اختبار المتصفح النهائي**: رحلات كاملة (تصفح→تفاصيل→سلة→checkout→طلب، wishlist، تسجيل دخول Google+بريد، إداري: CRUD منتج + تنفيذ طلب + مخزون) عبر desktop/tablet/mobile + LTR/RTL + كيبورد فقط. إصلاح ما يُكتشف.

**K. التقرير النهائي**: بالعربية (المصطلحات بالإنجليزية) حسب القسم 30 من النص المرفق — Executive Summary، المشاكل (P0-P3 بحالة DONE/PARTIAL/NOT VERIFIED)، القياسات الفعلية، المتبقي، الخطوات التالية المبررة.

## مخاطر وتراجع
- git commit قبل كل مرحلة رئيسية = تراجع فوري.
- `node:sqlite` يتطلب Node ≥22.5 — سأتحقق من الإصدار أول شيء؛ البديل المخطط: better-sqlite3 أو lowdb.
- Firebase Auth محلياً (localhost) مضبوط أصلاً في المشروع؛ إن فشل Google sign-in محلياً يبقى email/password + demo.
- `GEMINI_API_KEY`: إن غاب .env، تُختبر نافذة Market Intelligence بحالة الخطأ فقط (وهي حالة مشروعة نُحسّنها).

## خارج النطاق (مبرر)
- Stripe حقيقي (يتطلب مفاتيح حساب تجاري)، نشر فعلي، ترحيل بيانات إنتاج (لا يوجد)، i18n لغات إضافية.