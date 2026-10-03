import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { getHomeSections, type CategoryCard } from "@/lib/queries/catalog";

const VALUE_PROPS = [
  { icon: Truck, title: "Free shipping", description: "On orders over $100" },
  { icon: ShieldCheck, title: "2-year warranty", description: "On every product" },
  { icon: RotateCcw, title: "30-day returns", description: "No questions asked" },
  { icon: CreditCard, title: "Secure checkout", description: "Powered by Stripe" },
] as const;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const { featuredCategories, trending, offers, bestSellers, stats } = await getHomeSections();

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(201,169,97,0.16),_transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(201,169,97,0.08),_transparent_50%)]"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:py-28 lg:py-36">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-primary">
            New season · 2026
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Precision-engineered <span className="text-primary">essentials</span> for modern
            living.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Curated electronics, apparel, and workspace gear — premium quality, honest prices,
            delivered fast.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/shop">Explore the collection</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/categories">Browse categories</Link>
            </Button>
          </div>

          <dl className="mt-12 inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-y border-border px-6 py-4 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">Products</dt>
              <dd className="text-lg font-semibold tabular-nums">{stats.productCount}+</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Categories</dt>
              <dd className="text-lg font-semibold tabular-nums">{stats.categoryCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Average rating</dt>
              <dd className="text-lg font-semibold tabular-nums text-primary">
                {stats.averageRating.toFixed(1)} ★
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Reviews</dt>
              <dd className="text-lg font-semibold tabular-nums">{stats.reviewCount}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-label="Why shop with NEXORA" className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 lg:grid-cols-4">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.title} className="flex items-start gap-3">
              <prop.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">{prop.title}</p>
                <p className="text-xs text-muted-foreground">{prop.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-14">
        <section aria-label="Shop by category">
          <SectionHeading title="Shop by category" href="/categories" actionLabel="View all" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {featuredCategories.map((category) => (
              <CategoryTile key={category.id} category={category} />
            ))}
          </div>
        </section>

        <section aria-label="Trending products">
          <SectionHeading title="Trending now" href="/shop?sort=popular" actionLabel="Shop all" />
          <ProductGrid products={trending} />
        </section>

        {offers.length > 0 && (
          <section aria-label="Special offers">
            <SectionHeading title="Special offers" href="/shop?sort=price-asc" actionLabel="View deals" />
            <ProductGrid products={offers} />
          </section>
        )}

        <section aria-label="Best sellers">
          <SectionHeading title="Best sellers" href="/shop?sort=popular" actionLabel="Shop all" />
          <ProductGrid products={bestSellers.slice(0, 4)} />
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card px-6 py-12 text-center sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,169,97,0.12),_transparent_65%)]"
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Eight categories. One standard.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Every product is reviewed for quality, durability, and design before it earns a
              place in the catalog.
            </p>
            <Button asChild className="mt-6">
              <Link href="/categories">Explore all categories</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function CategoryTile({ category }: { category: CategoryCard }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted"
    >
      {category.imageUrl && (
        <Image
          src={category.imageUrl}
          alt={category.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
        <div>
          <p className="font-medium leading-tight transition-colors group-hover:text-primary">
            {category.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {category.productCount} {category.productCount === 1 ? "product" : "products"}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="text-primary opacity-0 transition-opacity group-hover:opacity-100"
        >
          →
        </span>
      </div>
    </Link>
  );
}
