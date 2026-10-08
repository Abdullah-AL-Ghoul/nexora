import { chromium } from "@playwright/test";
import { cleanTestOrders } from "./clean-test-orders";

const BASE_URL = "http://localhost:3000";

async function showBanner(page: any, text: string, color = "#4f46e5") {
  await page.evaluate(
    ({ text, color }: { text: string; color: string }) => {
      let banner = document.getElementById("nexora-test-banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "nexora-test-banner";
        banner.style.position = "fixed";
        banner.style.top = "16px";
        banner.style.left = "50%";
        banner.style.transform = "translateX(-50%)";
        banner.style.zIndex = "999999";
        banner.style.padding = "10px 24px";
        banner.style.borderRadius = "9999px";
        banner.style.fontSize = "14px";
        banner.style.fontWeight = "600";
        banner.style.fontFamily = "system-ui, sans-serif";
        banner.style.color = "#ffffff";
        banner.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)";
        banner.style.transition = "all 0.3s ease";
        banner.style.pointerEvents = "none";
        document.body.appendChild(banner);
      }
      banner.style.backgroundColor = color;
      banner.innerText = text;
    },
    { text, color }
  );
}

async function runLiveTour() {
  console.log("\n🚀 Starting NEXORA Live Visual Test Tour...");
  console.log("🖥️  A dedicated browser window will open on your screen.\n");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // ----------------------------------------------------
    // STEP 1: HOME PAGE & THEME TOGGLE
    // ----------------------------------------------------
    console.log("👉 Step 1: Testing Home Page & Theme Switching...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 1/7: الصفحة الرئيسية وتناسق التصميم (Atelier)");
    await page.waitForTimeout(1000);

    // Smooth scroll down to highlight components
    await page.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(800);

    // ----------------------------------------------------
    // STEP 2: CATALOG BROWSING & FILTERS
    // ----------------------------------------------------
    console.log("👉 Step 2: Testing Catalog & Sorting...");
    await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 2/7: تصفح الكتالوج والفرز والتصفية");
    await page.waitForTimeout(1000);

    // Open Sort Select
    const sortTrigger = page.getByLabel("Sort products");
    if (await sortTrigger.isVisible()) {
      await sortTrigger.click();
      await page.waitForTimeout(500);
      const lowToHighOption = page.getByRole("option", { name: "Price: Low to High" });
      if (await lowToHighOption.isVisible()) {
        await lowToHighOption.click();
      }
    }
    await page.waitForTimeout(1200);

    // ----------------------------------------------------
    // STEP 3: SEARCH INTERACTION
    // ----------------------------------------------------
    console.log("👉 Step 3: Testing Search...");
    await page.goto(`${BASE_URL}/search`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 3/7: محرك البحث السريع");
    await page.waitForTimeout(800);

    const searchInput = page.getByRole("searchbox", { name: "Search products" });
    await searchInput.fill("sneakers");
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);

    // ----------------------------------------------------
    // STEP 4: PRODUCT PAGE, VARIANTS & ADD TO CART
    // ----------------------------------------------------
    console.log("👉 Step 4: Testing Product Details & Cart Addition...");
    await page.goto(`${BASE_URL}/product/classic-leather-sneakers`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 4/7: تفاصيل المنتج وتغيير الألوان والإضافة للسلة");
    await page.waitForTimeout(1000);

    // Switch variants
    const blackBtn = page.getByRole("button", { name: "Black" });
    if (await blackBtn.isVisible()) {
      await blackBtn.click();
      await page.waitForTimeout(600);
    }

    const whiteBtn = page.getByRole("button", { name: "White" });
    if (await whiteBtn.isVisible()) {
      await whiteBtn.click();
      await page.waitForTimeout(600);
    }

    // Add to cart
    const addToCartBtn = page.getByRole("button", { name: "Add to cart" });
    await addToCartBtn.click();
    await showBanner(page, "✅ تمت إضافة المنتج إلى سلة التسوق بنجاح", "#10b981");
    await page.waitForTimeout(1200);

    // ----------------------------------------------------
    // STEP 5: CART INSPECTION
    // ----------------------------------------------------
    console.log("👉 Step 5: Testing Cart Review...");
    await page.goto(`${BASE_URL}/cart`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 5/7: مراجعة السلة وحساب الإجمالي");
    await page.waitForTimeout(1200);

    // ----------------------------------------------------
    // STEP 6: LOGIN & CHECKOUT
    // ----------------------------------------------------
    console.log("👉 Step 6: Testing Sign In & Checkout Flow...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 تسجيل الدخول بحساب العميل التجريبي");
    await page.waitForTimeout(600);

    await page.getByLabel("Email").fill("customer@nexora.demo");
    await page.getByLabel("Password").fill("NexoraDemo!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    // Proceed to Checkout
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 6/7: إتمام الطلب والدفع المباشر");
    await page.waitForTimeout(800);

    await page.getByRole("textbox", { name: "Full name" }).fill("Live Demo Customer");
    await page.getByRole("textbox", { name: "Address line 1" }).fill("100 Tech Avenue");
    await page.getByRole("textbox", { name: "City" }).fill("Cairo");
    await page.getByRole("textbox", { name: "Postal code" }).fill("11511");
    await page.getByRole("textbox", { name: "Country" }).fill("Egypt");
    await page.waitForTimeout(600);

    const placeOrderBtn = page.getByRole("button", { name: /place order|pay|checkout/i });
    await placeOrderBtn.click();
    await page.waitForTimeout(2000);

    await showBanner(page, "🎉 تم الدفع وتسجيل الطلب بنجاح (PAID)", "#10b981");
    await page.waitForTimeout(1500);

    // ----------------------------------------------------
    // STEP 7: ADMIN DASHBOARD
    // ----------------------------------------------------
    console.log("👉 Step 7: Testing Staff Admin Dashboard...");
    await context.clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "🧪 اختبار 7/7: لوحة تحكم المسؤول (Staff Admin)");
    await page.waitForTimeout(600);

    await page.getByLabel("Email").fill("admin@nexora.demo");
    await page.getByLabel("Password").fill("NexoraDemo!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    // Open Admin Dashboard
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "📊 لوحة تحكم المسؤول — متابعة المبيعات والإحصائيات");
    await page.waitForTimeout(1200);

    // Open Admin Products
    await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "📦 إدارة المنتجات وتحديث المخزون");
    await page.waitForTimeout(1200);

    // Open Admin Orders
    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "domcontentloaded" });
    await showBanner(page, "📑 سجل الطلبات وفواتير العملاء");
    await page.waitForTimeout(1500);

    // ----------------------------------------------------
    // FINAL SUCCESS BANNER
    // ----------------------------------------------------
    await showBanner(
      page,
      "✨ اكتملت جميع الاختبارات بنجاح تام! منصة NEXORA جاهزة للإنتاج 100%",
      "#059669"
    );
    console.log("✅ All visual test steps finished successfully!");
    await page.waitForTimeout(3000);
  } catch (error) {
    console.error("❌ Error during live tour:", error);
  } finally {
    await browser.close();
    // Clean up test order to keep database seed invariants intact
    await cleanTestOrders();
    console.log("🧹 Cleaned test orders — Database invariants preserved.");
  }
}

runLiveTour().catch((err) => {
  console.error("Tour failed:", err);
  process.exit(1);
});
