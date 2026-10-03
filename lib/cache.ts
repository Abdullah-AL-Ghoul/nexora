import { unstable_cache } from "next/cache";

/**
 * Tag-based data cache for public, non-personalized catalog queries.
 *
 * - One shared tag, "catalog", is invalidated by any mutation that affects
 *   public catalog data (products, inventory, order fulfillment, refunds).
 * - revalidate acts as a stale-data backstop if an invalidation is missed.
 *
 * Never wrap user-specific queries (orders, wishlist, cart) — those must
 * stay per-request.
 */
export const CATALOG_TAG = "catalog";

export function cachedCatalog<T>(
  keyParts: string[],
  query: () => Promise<T>,
  revalidateSeconds = 300
): Promise<T> {
  return unstable_cache(query, ["nexora-catalog", ...keyParts], {
    tags: [CATALOG_TAG],
    revalidate: revalidateSeconds,
  })();
}
