import type { Metadata } from "next";

import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { EmptyState } from "@/components/catalog/empty-state";
import { FiltersPanel } from "@/components/catalog/filters-panel";
import { Pagination } from "@/components/catalog/pagination";
import { ProductGrid } from "@/components/product/product-grid";
import { SearchBox } from "@/components/search/search-box";
import { parseCatalogParams, resolveCatalogParams, type CatalogParams } from "@/lib/catalog/params";
import { getCatalogProducts, getCategories } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the NEXORA catalog by name, brand, SKU, or description.",
};

/**
 * Deterministic category inference: when the query exactly equals a category
 * name or slug, treat it as a category filter instead of a keyword.
 */
function applyCategoryHint(params: CatalogParams, categories: { name: string; slug: string }[]): CatalogParams {
  if (params.category || !params.q) return params;
  const lowered = params.q.toLowerCase();
  const match = categories.find(
    (category) => category.slug === lowered || category.name.toLowerCase() === lowered
  );
  if (!match) return params;
  return { ...params, category: match.slug, q: "" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categories = await getCategories();
  const parsed = parseCatalogParams(await searchParams);
  const params = applyCategoryHint(resolveCatalogParams(parsed), categories);
  const result = await getCatalogProducts(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-col items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find products by name, brand, or SKU. Try “headphones under 100”.
          </p>
        </div>
        <SearchBox defaultValue={parsed.q} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24">
            <FiltersPanel categories={categories} />
          </div>
        </aside>

        <div>
          <CatalogToolbar total={result.total} noun="product" categories={categories} />

          <div className="mt-6">
            {result.products.length === 0 ? (
              <EmptyState
                title="No results"
                description={
                  params.q
                    ? `Nothing matched “${params.q}”. Try different keywords or clear your filters.`
                    : "No products match the current filters."
                }
                actionLabel="Back to shop"
                actionHref="/shop"
              />
            ) : (
              <ProductGrid products={result.products} />
            )}
          </div>

          <div className="mt-10">
            <Pagination basePath="/search" params={params} pageCount={result.pageCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
