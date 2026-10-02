/**
 * Catalog URL parameter parsing, smart query parsing (deterministic, no AI),
 * and URL building. Shared by /shop, /search, /category/[slug].
 *
 * URL params (user-facing prices are dollars, storage uses cents):
 *   q, category, min, max, rating, stock, sort, page
 */

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "popular", "rating"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PRODUCTS_PER_PAGE = 12;

export type CatalogParams = {
  q: string;
  category: string;
  min?: number;
  max?: number;
  rating?: number;
  inStock: boolean;
  sort: SortOption;
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function toPositiveInt(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** URL prices are user-facing dollars; canonical internal unit is cents. */
function toPriceCents(raw: string): number | undefined {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

export function parseCatalogParams(sp: RawSearchParams): CatalogParams {
  const sortRaw = first(sp.sort);
  const ratingRaw = Number(first(sp.rating));
  return {
    q: first(sp.q).trim().slice(0, 120),
    category: first(sp.category).trim().toLowerCase().slice(0, 80),
    min: toPriceCents(first(sp.min)),
    max: toPriceCents(first(sp.max)),
    rating: Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined,
    inStock: first(sp.stock) === "1",
    sort: (SORT_OPTIONS as readonly string[]).includes(sortRaw) ? (sortRaw as SortOption) : "newest",
    page: Math.max(1, toPositiveInt(first(sp.page)) ?? 1),
  };
}

/**
 * Deterministic smart parsing (M16, no AI):
 *   "black shoes under 100" -> maxPrice=100, q="black shoes"
 *   "headphones over 50"    -> minPrice=50, q="headphones"
 * Only price operators are extracted; the remaining text stays the keyword.
 * Category inference happens in the page against real category data.
 */
export function parseSmartQuery(raw: string): { q: string; min?: number; max?: number } {
  let q = raw.trim();
  let min: number | undefined;
  let max: number | undefined;

  const maxMatch = q.match(/\b(?:under|below|less than|up to|within|<)\s*\$?(\d+(?:\.\d+)?)\b/i);
  if (maxMatch) {
    max = Math.round(Number(maxMatch[1]) * 100); // dollars -> cents
    q = q.replace(maxMatch[0], " ");
  }

  const minMatch = q.match(/\b(?:over|above|more than|greater than|>)\s*\$?(\d+(?:\.\d+)?)\b/i);
  if (minMatch) {
    min = Math.round(Number(minMatch[1]) * 100);
    q = q.replace(minMatch[0], " ");
  }

  return { q: q.replace(/\s+/g, " ").trim(), min, max };
}

/**
 * Merge URL params with smart parsing results. Explicit URL params win
 * over values inferred from the query text.
 */
export function resolveCatalogParams(params: CatalogParams): CatalogParams {
  if (!params.q) return params;
  const smart = parseSmartQuery(params.q);
  return {
    ...params,
    q: smart.q || params.q,
    min: params.min ?? smart.min,
    max: params.max ?? smart.max,
  };
}

/** Build a catalog URL path (e.g. "/shop?category=apparel&sort=rating"). */
export function buildCatalogPath(basePath: string, params: CatalogParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.min !== undefined) sp.set("min", String(params.min / 100));
  if (params.max !== undefined) sp.set("max", String(params.max / 100));
  if (params.rating !== undefined) sp.set("rating", String(params.rating));
  if (params.inStock) sp.set("stock", "1");
  if (params.sort !== "newest") sp.set("sort", params.sort);
  if (params.page > 1) sp.set("page", String(params.page));
  const query = sp.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Return a copy of `params` with the given patch applied, page reset to 1. */
export function withCatalogPatch(
  params: CatalogParams,
  patch: Partial<CatalogParams>
): CatalogParams {
  return { ...params, ...patch, page: patch.page ?? 1 };
}
