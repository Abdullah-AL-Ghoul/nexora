import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { EmptyState } from "@/components/catalog/empty-state";
import { FiltersPanel } from "@/components/catalog/filters-panel";
import { Pagination } from "@/components/catalog/pagination";
import { ProductGrid } from "@/components/product/product-grid";
import { parseCatalogParams, resolveCatalogParams, type CatalogParams } from "@/lib/catalog/params";
import { getCatalogProducts, getCategories, getCategoryBySlug } from "@/lib/queries/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  if (!category) return { title: "Category" };
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name} at NEXORA.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  // The category comes from the path (canonical); query params carry the rest.
  const parsed = parseCatalogParams(await searchParams);
  const catalogParams: CatalogParams = resolveCatalogParams({
    q: parsed.q,
    category: slug,
    min: parsed.min,
    max: parsed.max,
    rating: parsed.rating,
    inStock: parsed.inStock,
    sort: parsed.sort,
    page: parsed.page,
  });

  const [result, categories] = await Promise.all([
    getCatalogProducts(catalogParams),
    getCategories(),
  ]);
  const basePath = `/category/${slug}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted-foreground">
          <Link href="/categories" className="transition-colors hover:text-primary">
            Categories
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">{category.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{category.name}</h1>
        {category.description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{category.description}</p>
        )}
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
                title="Nothing here yet"
                description="No products in this category match your filters."
                actionLabel="Clear filters"
                actionHref={basePath}
              />
            ) : (
              <ProductGrid products={result.products} />
            )}
          </div>

          <div className="mt-10">
            <Pagination basePath={basePath} params={catalogParams} pageCount={result.pageCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
