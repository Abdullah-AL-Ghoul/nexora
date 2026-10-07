/** Continuation: admin + guest auth + mobile captures. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const prefix = process.argv[2] ?? ".zcode/design-audit/before";
const BASE = "http://localhost:3000";
const CUSTOMER = { email: "customer@nexora.demo", password: "NexoraDemo!2026" };
const ADMIN = { email: "admin@nexora.demo", password: "NexoraDemo!2026" };

async function signIn(page: import("@playwright/test").Page, creds: { email: string; password: string }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
}

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.waitForLoadState("load").catch(() => undefined);
  await page.waitForTimeout(1800);
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.screenshot({ path: path.join(prefix, `${name}.png`), fullPage: true });
  console.log(`captured ${name}`);
}

async function main() {
  mkdirSync(prefix, { recursive: true });
  const browser = await chromium.launch();

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  await signIn(admin, ADMIN);
  await admin.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 60_000 });
  await shot(admin, "12-admin-dashboard");
  await admin.goto(`${BASE}/admin/products`, { waitUntil: "load" });
  await shot(admin, "13-admin-products");
  await admin.goto(`${BASE}/admin/orders`, { waitUntil: "load" });
  await shot(admin, "14-admin-orders");
  await admin.goto(`${BASE}/admin/users`, { waitUntil: "load" });
  await shot(admin, "15-admin-users");
  await adminCtx.close();

  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const g = await guest.newPage();
  await g.goto(`${BASE}/login`, { waitUntil: "load" });
  await shot(g, "16-login");
  await g.goto(`${BASE}/register`, { waitUntil: "load" });
  await shot(g, "17-register");
  await g.goto(`${BASE}/nonexistent-404`, { waitUntil: "load" });
  await shot(g, "18-not-found");
  await guest.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mobile.newPage();
  await signIn(m, CUSTOMER);
  await m.goto(`${BASE}/`, { waitUntil: "load" });
  await shot(m, "m1-home");
  await m.goto(`${BASE}/shop`, { waitUntil: "load" });
  await shot(m, "m2-shop");
  await m.goto(`${BASE}/product/classic-leather-sneakers`, { waitUntil: "load" });
  await shot(m, "m3-product");
  await mobile.close();

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
