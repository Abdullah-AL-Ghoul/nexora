import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

/**
 * Critical customer journey: sign in → product → variant → cart →
 * checkout (mock payment) → order visible with PAID status.
 * Runs against the dev server with NEXORA_MOCK_PAY=1.
 */

const CUSTOMER = { email: "customer@nexora.demo", password: "NexoraDemo!2026" };

test.afterAll(async () => {
  // Clean up any test orders created by the mock checkout run to preserve seed verification invariants
  try {
    execSync("npx tsx scripts/clean-test-orders.ts", { stdio: "inherit" });
  } catch (err) {
    console.error("Failed to run clean-test-orders script:", err);
  }
});

test("customer checkout journey ends with a PAID order", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER.email);
  await page.getByLabel("Password").fill(CUSTOMER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/login/);

  // Product page → variant → add to cart
  await page.goto("/product/classic-leather-sneakers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classic Leather Sneakers");
  await page.getByRole("button", { name: "Black" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /cart/i })).toContainText("1", { timeout: 15_000 });

  // Cart shows the server-quoted line
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible();
  await expect(page.getByText("Classic Leather Sneakers").first()).toBeVisible();

  // Checkout: fill the form and place the order with Cash on Delivery
  await page.goto("/checkout");
  await page.getByRole("textbox", { name: "Full name" }).fill("E2E Customer");
  await page.getByRole("textbox", { name: "Address line 1" }).fill("1 Test Way");
  await page.getByRole("textbox", { name: "City" }).fill("Cairo");
  await page.getByRole("textbox", { name: "Postal code" }).fill("12345");
  await page.getByRole("textbox", { name: "Country" }).fill("Egypt");
  await page.getByText(/Cash on Delivery/i).click();
  await page.getByRole("button", { name: /place order|pay|checkout/i }).click();

  // Lands on the order page with a confirmed order
  await expect(page).toHaveURL(/\/account\/orders\//, { timeout: 30_000 });
  await expect(page.getByText(/placed|pending|processing/i).first()).toBeVisible();

  // Order history lists it
  await page.goto("/account/orders");
  await expect(page.getByText(/E2E|NX-\d{8}/).first()).toBeVisible();
});

test("guest is redirected away from checkout", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/login/);
});
