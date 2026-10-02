import type { Metadata } from "next";

import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { EmptyState } from "@/components/catalog/empty-state";
import { FiltersPanel } from "@/components/catalog/filters-panel";
import { Pagination } from "@/components/catalog/pagination";
import { ProductGrid } from "@/components/product/product-grid";
import { parseCatalogParams, resolveCatalogParams } from "@/lib/catalog/params";
import { getCatalogProducts, getCategories } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse the full NEXORA catalog with filters, sorting, and pagination.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = resolveCatalogParams(parseCatalogParams(await searchParams));
  const [result, categories] = await Promise.all([
    getCatalogProducts(params),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The full catalog — filter by category, price, rating, and availability.
        </p>
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
                title="No products found"
                description="Try adjusting or clearing your filters to see more results."
                actionLabel="Clear filters"
                actionHref="/shop"
              />
            ) : (
              <ProductGrid products={result.products} />
            )}
          </div>

          <div className="mt-10">
            <Pagination basePath="/shop" params={params} pageCount={result.pageCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
