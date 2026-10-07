/**
 * Captures the visual-audit screenshot set for the redesign.
 * Usage: npx tsx scripts/capture-audit-shots.ts <outdir-prefix>
 * Requires the production server on http://localhost:3000 with seeded data.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const prefix = process.argv[2] ?? ".zcode/design-audit/before";
const BASE = "http://localhost:3000";
const CUSTOMER = { email: "customer@nexora.demo", password: "NexoraDemo!2026" };
const ADMIN = { email: "admin@nexora.demo", password: "NexoraDemo!2026" };

async function signIn(page: Page, creds: { email: string; password: string }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
}

async function settle(page: Page) {
  // Give images/hydration a moment; full-page shots need lazy images loaded.
  await page.waitForLoadState("load").catch(() => undefined);
  await page.waitForTimeout(1800);
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(prefix, `${name}.png`), fullPage: true });
  console.log(`captured ${name}`);
}

async function main() {
  mkdirSync(prefix, { recursive: true });
  const browser: Browser = await chromium.launch();

  // ── Desktop, customer session ──
  const customer = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await customer.newPage();

  await shot(page, "01-home-guest");
  await signIn(page, CUSTOMER);
  await shot(page, "02-home-customer");
  await page.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  await shot(page, "03-shop");
  await page.goto(`${BASE}/search?q=watch`, { waitUntil: "domcontentloaded" });
  await shot(page, "04-search");
  await page.goto(`${BASE}/categories`, { waitUntil: "domcontentloaded" });
  await shot(page, "05-categories");
  await page.goto(`${BASE}/category/watches`, { waitUntil: "domcontentloaded" });
  await shot(page, "06-category");
  await page.goto(`${BASE}/product/classic-leather-sneakers`, { waitUntil: "domcontentloaded" });
  await shot(page, "07-product");

  // add to cart for cart/checkout states
  await page.getByRole("button", { name: "Black" }).click().catch(() => undefined);
  await page.getByRole("button", { name: "Add to cart" }).click().catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
  await shot(page, "08-cart");
  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await shot(page, "09-checkout");
  await page.goto(`${BASE}/account/orders`, { waitUntil: "domcontentloaded" });
  await shot(page, "10-account-orders");
  await page.goto(`${BASE}/wishlist`, { waitUntil: "domcontentloaded" });
  await shot(page, "11-wishlist");
  await customer.close();

  // ── Desktop, admin session ──
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  await signIn(admin, ADMIN);
  await admin.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await shot(admin, "12-admin-dashboard");
  await admin.goto(`${BASE}/admin/products`, { waitUntil: "domcontentloaded" });
  await shot(admin, "13-admin-products");
  await admin.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await shot(admin, "14-admin-orders");
  await admin.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
  await shot(admin, "15-admin-users");
  await adminCtx.close();

  // ── Desktop, guest auth pages + 404 ──
  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const g = await guest.newPage();
  await g.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await shot(g, "16-login");
  await g.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  await shot(g, "17-register");
  await g.goto(`${BASE}/nonexistent-404`, { waitUntil: "domcontentloaded" });
  await shot(g, "18-not-found");
  await guest.close();

  // ── Mobile, customer ──
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mobile.newPage();
  await signIn(m, CUSTOMER);
  await shot(m, "m1-home");
  await m.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  await shot(m, "m2-shop");
  await m.goto(`${BASE}/product/classic-leather-sneakers`, { waitUntil: "domcontentloaded" });
  await shot(m, "m3-product");
  await m.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
  await shot(m, "m4-cart");
  await mobile.close();

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
