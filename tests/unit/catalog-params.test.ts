import { describe, expect, it } from "vitest";

import {
  buildCatalogPath,
  parseCatalogParams,
  parseSmartQuery,
  resolveCatalogParams,
  withCatalogPatch,
} from "@/lib/catalog/params";

describe("parseCatalogParams", () => {
  it("parses dollars into cents and clamps page", () => {
    const params = parseCatalogParams({ min: "25.50", max: "100", page: "3" });
    expect(params.min).toBe(2550);
    expect(params.max).toBe(10000);
    expect(params.page).toBe(3);
  });

  it("rejects malformed input instead of throwing", () => {
    const params = parseCatalogParams({ min: "abc; DROP TABLE", page: "-2", rating: "9", sort: "hack" });
    expect(params.min).toBeUndefined();
    expect(params.page).toBe(1);
    expect(params.rating).toBeUndefined();
    expect(params.sort).toBe("newest");
  });

  it("caps query length at 120 chars", () => {
    const params = parseCatalogParams({ q: "x".repeat(500) });
    expect(params.q).toHaveLength(120);
  });

  it("parses in-stock flag", () => {
    expect(parseCatalogParams({ stock: "1" }).inStock).toBe(true);
    expect(parseCatalogParams({ stock: "0" }).inStock).toBe(false);
  });
});

describe("parseSmartQuery", () => {
  it("extracts price ceilings and floors from natural text", () => {
    expect(parseSmartQuery("black shoes under 100")).toEqual({ q: "black shoes", max: 10000 });
    expect(parseSmartQuery("headphones over 50")).toEqual({ q: "headphones", min: 5000 });
    expect(parseSmartQuery("watch below $29.99")).toEqual({ q: "watch", max: 2999 });
  });

  it("leaves plain queries untouched", () => {
    expect(parseSmartQuery("leather sneakers")).toEqual({ q: "leather sneakers" });
  });
});

describe("resolveCatalogParams", () => {
  it("explicit URL params win over smart-parsed values", () => {
    const merged = resolveCatalogParams(parseCatalogParams({ q: "shoes under 50", max: "80" }));
    expect(merged.max).toBe(8000);
    expect(merged.q).toBe("shoes");
  });
});

describe("buildCatalogPath", () => {
  it("omits defaults and formats prices back to dollars", () => {
    const path = buildCatalogPath("/shop", {
      q: "",
      category: "watches",
      min: 2500,
      inStock: true,
      sort: "newest",
      page: 1,
    });
    expect(path).toBe("/shop?category=watches&min=25&stock=1");
  });

  it("adds page only above 1", () => {
    const path = buildCatalogPath("/search", {
      q: "watch",
      category: "",
      inStock: false,
      sort: "rating",
      page: 2,
    });
    expect(path).toBe("/search?q=watch&sort=rating&page=2");
  });
});

describe("withCatalogPatch", () => {
  it("resets page when a filter changes", () => {
    const params = parseCatalogParams({ page: "4", category: "watches" });
    const next = withCatalogPatch(params, { category: "apparel" });
    expect(next.category).toBe("apparel");
    expect(next.page).toBe(1);
  });
});
