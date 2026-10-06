import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/lib/queries/catalog";

export function RelatedProducts({
  products,
  categoryName,
  categorySlug,
}: {
  products: ProductCardData[];
  categoryName?: string;
  categorySlug?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-20 border-t border-border pt-14" aria-label="Related products">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Curated Recommendations</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            You May Also Like
          </h2>
          {categoryName && (
            <p className="mt-1 text-sm text-muted-foreground">
              More hand-selected precision essentials from {categoryName}
            </p>
          )}
        </div>
        <Link
          href={categorySlug ? `/category/${categorySlug}` : "/shop"}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <span>Explore collection</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
