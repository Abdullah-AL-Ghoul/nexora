import { expect, test } from "@playwright/test";

/**
 * Admin (staff) surface smoke: login, dashboard, product list + filter,
 * order list. Manager+ sections must render seeded data server-side.
 */

const ADMIN = { email: "admin@nexora.demo", password: "NexoraDemo!2026" };

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/login/);
}

test("admin dashboard, products and orders render with real data", async ({ page }) => {
  await signInAsAdmin(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: /products/i })).toBeVisible();
  await expect(page.getByText("DEMO-").first()).toBeVisible();

  // Server-side status filter narrows the table
  await page.getByLabel("Filter by status").selectOption("DRAFT");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/status=DRAFT/);

  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
  await expect(page.getByText("NX-DEMO-").first()).toBeVisible();
});

test("storefront renders on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();

  await page.goto("/shop");
  await expect(page.getByText(/products$/i).first()).toBeVisible();

  // Mobile nav drawer opens
  await page.getByRole("button", { name: /menu/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
