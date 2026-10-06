import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard, RotateCcw, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductQuickAdd } from "@/components/product/product-quick-add";
import { getHomeSections, type CategoryCard } from "@/lib/queries/catalog";
import { formatPrice } from "@/lib/format";

const VALUE_PROPS = [
  {
    icon: Truck,
    title: "Express Worldwide Shipping",
    description: "Complimentary on all orders over $100",
  },
  {
    icon: ShieldCheck,
    title: "2-Year Precision Warranty",
    description: "Guaranteed coverage on every item",
  },
  {
    icon: RotateCcw,
    title: "30-Day Effortless Returns",
    description: "Pre-paid shipping, no questions asked",
  },
  {
    icon: CreditCard,
    title: "Encrypted Secure Checkout",
    description: "Institutional-grade payment security",
  },
] as const;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const { featuredCategories, trending, offers, bestSellers, stats } = await getHomeSections();
  const heroProduct = trending[0] ?? null;

  return (
    <>
      {/* Hero Section with Ambient Glow & Floating Product Showcase */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        {/* Ambient radial glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-1/4 h-[550px] w-[550px] rounded-full bg-primary/10 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-10 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Content Column */}
            <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary backdrop-blur">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="tracking-widest uppercase text-[11px]">New Season · 2026</span>
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-foreground leading-[1.08]">
                Precision-engineered{" "}
                <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                  essentials
                </span>{" "}
                for modern living.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Curated high-performance electronics, apparel, and workspace gear. Designed with
                uncompromising standards, crafted for enduring elegance.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <Link href="/shop" prefetch={true} className="gap-2">
                    Explore Collection
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border hover:border-primary/50">
                  <Link href="/categories" prefetch={true}>Browse Categories</Link>
                </Button>
              </div>

              {/* Social proof & customer trust indicator */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-border/80 pt-6 text-xs text-muted-foreground lg:justify-start">
                <div className="flex items-center gap-1 text-primary">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <span className="font-medium text-foreground">
                  {stats.averageRating.toFixed(1)} / 5.0
                </span>
                <span>·</span>
                <span>Based on {stats.reviewCount} verified client reviews</span>
              </div>
            </div>

            {/* Right Showcase Column (Floating Spotlight Card) */}
            {heroProduct && (
              <div className="relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none">
                <div className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-card/90 p-5 shadow-[0_0_50px_-12px_rgba(201,169,97,0.22)] backdrop-blur transition-all duration-300 hover:border-primary/60">
                  <div className="flex items-center justify-between pb-3">
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Sparkles className="size-3" />
                      Featured Drop
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                      {heroProduct.category.name}
                    </span>
                  </div>

                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                    {heroProduct.images[0]?.url ? (
                      <Image
                        src={heroProduct.images[0].url}
                        alt={heroProduct.name}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span className="rounded-md bg-background/90 px-2.5 py-1 font-mono text-sm font-semibold text-primary backdrop-blur">
                        {formatPrice(heroProduct.price)}
                      </span>
                      <ProductQuickAdd
                        productId={heroProduct.id}
                        name={heroProduct.name}
                        disabled={heroProduct.stock <= 0}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                        <Link href={`/product/${heroProduct.slug}`}>{heroProduct.name}</Link>
                      </h3>
                      <p className="text-xs text-muted-foreground">In stock & ready to dispatch</p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="gap-1 text-primary hover:text-primary">
                      <Link href={`/product/${heroProduct.slug}`}>
                        Details
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <dl className="mt-14 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card/60 p-4 sm:grid-cols-4 sm:p-6 backdrop-blur text-center">
            <div className="border-r-0 border-border sm:border-r last:border-r-0">
              <dt className="text-xs text-muted-foreground">Curated Catalog</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {stats.productCount}+
              </dd>
            </div>
            <div className="border-r-0 border-border sm:border-r last:border-r-0">
              <dt className="text-xs text-muted-foreground">Specialized Categories</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {stats.categoryCount}
              </dd>
            </div>
            <div className="border-r-0 border-border sm:border-r last:border-r-0">
              <dt className="text-xs text-muted-foreground">Client Satisfaction</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                {stats.averageRating.toFixed(1)} ★
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Verified Reviews</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {stats.reviewCount}+
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Trust & Precision Value Props */}
      <section aria-label="Why shop with NEXORA" className="border-b border-border bg-card/50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="flex items-start gap-3.5 rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <prop.icon className="size-5 shrink-0" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{prop.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{prop.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Storefront Content Sections */}
      <div className="mx-auto flex max-w-7xl flex-col gap-20 px-4 py-16">
        {/* Curated Categories Bento Grid */}
        <section aria-label="Shop by category">
          <SectionHeading
            title="Curated Categories"
            subtitle="Explore precision instruments and daily essentials tailored to high performance"
            href="/categories"
            actionLabel="View all categories"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCategories.map((category, index) => (
              <CategoryTile key={category.id} category={category} isHero={index === 0} />
            ))}
          </div>
        </section>

        {/* Trending Essentials */}
        <section aria-label="Trending products">
          <SectionHeading
            title="Trending Now"
            subtitle="The most coveted pieces in our active catalog"
            href="/shop?sort=popular"
            actionLabel="Explore all trending"
          />
          <ProductGrid products={trending} />
        </section>

        {/* Special Offers */}
        {offers.length > 0 && (
          <section aria-label="Special offers">
            <SectionHeading
              title="Exclusive Offers"
              subtitle="Limited-time pricing on select seasonal editions"
              href="/shop?sort=price-asc"
              actionLabel="View all offers"
            />
            <ProductGrid products={offers} />
          </section>
        )}

        {/* Best Sellers */}
        <section aria-label="Best sellers">
          <SectionHeading
            title="Hall of Fame · Best Sellers"
            subtitle="Proven customer favorites with the highest verified satisfaction"
            href="/shop?sort=popular"
            actionLabel="Shop best sellers"
          />
          <ProductGrid products={bestSellers.slice(0, 4)} />
        </section>

        {/* Brand Philosophy / Editorial Quality Commitment */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card px-8 py-14 text-center sm:py-20 shadow-[0_0_40px_-10px_rgba(201,169,97,0.12)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,169,97,0.15),_transparent_70%)]"
          />
          <div className="relative mx-auto max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              The NEXORA Standard
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
              Eight categories. Zero compromise.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Every item is tested for durability, ergonomic perfection, and aesthetic purity before
              earning a place in our catalog.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/shop">Start Shopping</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border">
                <Link href="/categories">Discover All Disciplines</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function CategoryTile({ category, isHero = false }: { category: CategoryCard; isHero?: boolean }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      prefetch={true}
      className={`group relative overflow-hidden rounded-xl border border-border bg-muted transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_20px_-5px_rgba(201,169,97,0.18)] ${
        isHero ? "aspect-[4/3] sm:aspect-auto sm:row-span-1" : "aspect-[4/3]"
      }`}
    >
      {category.imageUrl && (
        <Image
          src={category.imageUrl}
          alt={category.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-primary">
            {category.productCount} {category.productCount === 1 ? "Product" : "Products"}
          </span>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {category.name}
          </p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 text-primary transition-all duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
