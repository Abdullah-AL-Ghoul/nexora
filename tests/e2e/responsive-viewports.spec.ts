import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/shop",
  "/product/aurora-smart-lamp",
  "/cart",
  "/login",
  "/categories",
  "/category/audio",
  "/search",
  "/shipping",
  "/terms",
  "/privacy",
];

const viewports = [
  { name: "Mobile XS (320px)", width: 320, height: 600 },
  { name: "Mobile Standard (390px)", width: 390, height: 844 },
  { name: "Tablet (768px)", width: 768, height: 1024 },
  { name: "Desktop (1440px)", width: 1440, height: 900 },
];

for (const vp of viewports) {
  test.describe(`Viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of routes) {
      test(`no horizontal overflow on ${route}`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300);

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        expect(
          scrollWidth,
          `Route ${route} at ${vp.width}px overflowed: scrollWidth=${scrollWidth} > innerWidth=${innerWidth}`
        ).toBeLessThanOrEqual(innerWidth + 1);
      });
    }
  });
}
