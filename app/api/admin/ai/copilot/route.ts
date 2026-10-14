import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;

  try {
    const { message, context } = (await request.json()) as {
      message: string;
      context?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const lower = message.toLowerCase().trim();

    // 1. Fetch real-time store telemetry from database
    const [
      totalProducts,
      lowStockProducts,
      outOfStockCount,
      recentOrders,
      orderCountsByStatus,
      totalCustomers,
      categories,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        where: { stock: { lte: 5 } },
        select: { id: true, name: true, sku: true, stock: true, price: true, status: true },
        take: 10,
        orderBy: { stock: "asc" },
      }),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { products: true } } },
      }),
    ]);

    let response = "";
    let actionItems: Array<{ label: string; action: string; url?: string }> = [];

    // Intent detection
    const isArabic = /[\u0600-\u06FF]/.test(message);

    if (
      lower.includes("stock") ||
      lower.includes("inventory") ||
      lower.includes("مخزون") ||
      lower.includes("نفاذ") ||
      lower.includes("كمية")
    ) {
      if (isArabic) {
        response = `📊 **تقرير فحص المخزون الفوري:**\n\n- إجمالي القطع في الكتالوج: **${totalProducts} منتج**\n- منتجات نفذت بالكامل (0 قطع): **${outOfStockCount}**\n- منتجات في مستوى حرج (أقل من 5 قطع): **${lowStockProducts.length}**\n\n`;
        if (lowStockProducts.length > 0) {
          response += `⚠️ **أبرز القطع التي تحتاج إلى إعادة توريد فورية:**\n` +
            lowStockProducts
              .map(
                (p) =>
                  `• **${p.name}** (SKU: \`${p.sku}\`) — المتبقي: **${p.stock} قطعة** بسعر ${formatPrice(p.price)}`
              )
              .join("\n");
        } else {
          response += `✅ جميع القطع المعروضة في المتجر تتمتع بمستويات مخزون صحية ومستقرة.`;
        }
      } else {
        response = `📊 **Real-time Inventory Telemetry:**\n\n- Total active catalog items: **${totalProducts} pieces**\n- Depleted items (0 stock): **${outOfStockCount}**\n- Critical threshold (≤ 5 units): **${lowStockProducts.length}**\n\n`;
        if (lowStockProducts.length > 0) {
          response += `⚠️ **Priority Restock Candidates:**\n` +
            lowStockProducts
              .map(
                (p) =>
                  `• **${p.name}** (SKU: \`${p.sku}\`) — Stock: **${p.stock} units** (${formatPrice(p.price)})`
              )
              .join("\n");
        } else {
          response += `✅ All catalog pieces are currently well-stocked.`;
        }
      }

      actionItems = [
        { label: isArabic ? "إدارة المخزون والتعديل" : "Manage Inventory", action: "navigate", url: "/admin/products" },
        { label: isArabic ? "إضافة قطعة جديدة" : "Add New Product", action: "navigate", url: "/admin/products/new" },
      ];
    } else if (
      lower.includes("order") ||
      lower.includes("طلب") ||
      lower.includes("مبيعات") ||
      lower.includes("sales") ||
      lower.includes("revenue")
    ) {
      const pendingCount =
        orderCountsByStatus.find((s) => s.status === "PENDING")?._count._all ?? 0;
      const paidTotal =
        orderCountsByStatus
          .filter((s) => s.status === "PAID" || s.status === "DELIVERED")
          .reduce((acc, curr) => acc + (curr._sum.total ?? 0), 0);

      if (isArabic) {
        response = `💼 **ملخص المبيعات وحركة الطلبات:**\n\n- إجمالي الإيرادات المحققة: **${formatPrice(paidTotal)}**\n- طلبات بانتظار التجهيز والشحن: **${pendingCount} طلب**\n- عدد الزبائن المسجلين: **${totalCustomers} عميل**\n\n**أحدث العمليات المسجلة:**\n` +
          recentOrders
            .map(
              (o) =>
                `• طلب رقم \`#${o.orderNumber}\` بقيمة **${formatPrice(o.total)}** [الحالة: ${o.status}]`
            )
            .join("\n");
      } else {
        response = `💼 **Executive Sales & Order Velocity:**\n\n- Gross Settled Revenue: **${formatPrice(paidTotal)}**\n- Pending Orders Awaiting Fulfillment: **${pendingCount} orders**\n- Registered VIP Clientele: **${totalCustomers} patrons**\n\n**Recent Atelier Transactions:**\n` +
          recentOrders
            .map(
              (o) =>
                `• Order \`#${o.orderNumber}\` for **${formatPrice(o.total)}** [${o.status}]`
            )
            .join("\n");
      }

      actionItems = [
        { label: isArabic ? "استعراض جميع الطلبات" : "View All Orders", action: "navigate", url: "/admin/orders" },
        { label: isArabic ? "تصدير كشف المبيعات (CSV)" : "Export Orders CSV", action: "navigate", url: "/api/admin/orders/export" },
      ];
    } else if (
      lower.includes("وصف") ||
      lower.includes("description") ||
      lower.includes("اكتب") ||
      lower.includes("write") ||
      lower.includes("generate")
    ) {
      if (isArabic) {
        response = `✨ **اقتراح وصف تسويقي فاخر لقطعة مجوهرات/ساعات:**\n\n` +
          `**العنوان المقترح:** *تحفة نادرة مستوحاة من التراث الحرفي الرفيع*\n\n` +
          `**الوصف الفاخر:**\n"صُممت هذه القطعة الاستثنائية في أرقى مشاغل NEXORA لتجسد التناغم الأبدي بين الفخامة المعاصرة والحرفية اليدوية المتوارثة. مصقولة يدوياً من أنقى خامات الذهب والبلاتين، وتتميز بتفاصيل دقيقة تعكس بريقاً أخاذاً في كل حركة. كل قطعة تأتي مصحوبة بشهادة أصالة معتمدة وضمان دولي لمدة عامين، لتكون استثماراً خالداً في عالم الأناقة الراقية."\n\n` +
          `**الكلمات المفتاحية (SEO):** ساعات فاخرة، مجوهرات سويسرية، تصميم يدوي، مقتنيات نادرة، هدايا راقية.`;
      } else {
        response = `✨ **Curated Luxury Product Copy:**\n\n` +
          `**Headline:** *An Exemplar of Timeless Horological Excellence*\n\n` +
          `**Luxury Narrative:**\n"Handcrafted in the venerated NEXORA ateliers, this extraordinary creation harmonizes centuries-old Swiss watchmaking mastery with audacious contemporary aesthetics. Finished with meticulous satin-brushed chamfers and powered by a chronometer-certified automatic movement, it presents a statement of effortless distinction for the discerning connoisseur."\n\n` +
          `**SEO Tags:** Haute Horlogerie, Bespoke Timepiece, Swiss Craftsmanship, Collector Watch, Certified Luxury.`;
      }

      actionItems = [
        { label: isArabic ? "إنشاء قطعة بهذا الوصف" : "Create Product with this Copy", action: "navigate", url: "/admin/products/new" },
      ];
    } else {
      // General intelligence summary
      if (isArabic) {
        response = `مرحباً بك! أنا **مساعد NEXORA الذكي (Atelier Executive AI)**.\n\nأنا متصل مباشرة بقاعدة بيانات متجرك ويمكنني مساعدتك في المهام التالية فوراً:\n\n1. **مراقبة وفلترة المخزون**: اطلب مني فحص المنتجات التي أوشكت على النفاذ أو المنتجات الراكدة.\n2. **تحليل المبيعات والإيرادات**: اسألني عن حجم الإيرادات، الطلبات المعلقة، أو تصدير التقارير.\n3. **كتابة نصوص وأوصاف تسويقية فاخرة**: يمكنني صياغة أوصاف احترافية عالية التأثير لأي منتج جديد.\n4. **اقتراح حملات وخصومات**: أستطيع اقتراح استراتيجيات تسعير متناغمة مع هوية متجرك الفاخرة.\n\nكيف يمكنني دعمك في لوحة التحكم اليوم؟`;
      } else {
        response = `Welcome! I am **NEXORA Atelier Executive AI Co-pilot**.\n\nI am directly connected to your live boutique database and can assist you with:\n\n1. **Inventory Telemetry**: Instant low-stock detection, out-of-stock alerts, and restocking advice.\n2. **Order & Revenue Analysis**: Real-time sales metrics, pending order breakdowns, and fulfillment status.\n3. **Haute Copywriting & SEO**: Generating opulent descriptions and high-converting product narratives.\n4. **Atelier Strategic Guidance**: Curating pricing and seasonal promotions tailored to luxury clientele.\n\nWhat would you like to review or accomplish today?`;
      }

      actionItems = [
        { label: isArabic ? "فحص المخزون والقطع الناقصة" : "Inspect Low Stock", action: "query", url: "check stock" },
        { label: isArabic ? "ملخص المبيعات اليوم" : "Review Sales & Orders", action: "query", url: "check orders" },
        { label: isArabic ? "إضافة منتج بصور جديدة" : "Add Product with Images", action: "navigate", url: "/admin/products/new" },
      ];
    }

    return NextResponse.json({
      success: true,
      message: response,
      actionItems,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "AI Co-pilot error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
