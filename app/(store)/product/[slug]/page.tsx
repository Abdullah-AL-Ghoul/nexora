import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Price } from "@/components/product/price";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductGrid } from "@/components/product/product-grid";
import { RatingStars } from "@/components/product/rating-stars";
import { ReviewSection } from "@/components/product/review-section";
import { VariantPicker } from "@/components/product/variant-picker";
import {
  getProductBySlug,
  getRelatedProducts,
  getReviewStats,
} from "@/lib/queries/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

function StockStatus({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <p className="text-sm font-medium text-muted-foreground">Out of stock</p>;
  }
  if (stock <= 3) {
    return <p className="text-sm font-medium text-primary">Only {stock} left in stock</p>;
  }
  return <p className="text-sm font-medium text-foreground/80">In stock</p>;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [stats, related] = await Promise.all([
    getReviewStats(product.id),
    getRelatedProducts(product, 4),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/shop" className="transition-colors hover:text-primary">
          Shop
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/category/${product.category.slug}`} className="transition-colors hover:text-primary">
          {product.category.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-5">
          <div>
            <Link
              href={`/category/${product.category.slug}`}
              className="text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
            >
              {product.category.name}
            </Link>
            <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2">
              {stats.count > 0 ? (
                <a href="#reviews" className="transition-opacity hover:opacity-80">
                  <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No reviews yet</span>
              )}
            </div>
          </div>

          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="lg"
          />

          <StockStatus stock={product.stock} />

          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {product.description}
          </p>

          {product.variants.length > 0 && (
            <VariantPicker
              basePrice={product.price}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                name: variant.name,
                priceDelta: variant.priceDelta,
                stock: variant.stock,
              }))}
            />
          )}

          <div className="flex flex-col gap-3">
            <Button size="lg" disabled className="w-full sm:w-auto">
              <ShoppingBag className="size-4" aria-hidden="true" />
              Add to cart
            </Button>
            <p className="text-xs text-muted-foreground">
              Secure checkout · Free shipping over $100 · 30-day returns
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-5 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="tabular-nums">{product.sku}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Brand</dt>
              <dd>{product.brand}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Category</dt>
              <dd>
                <Link
                  href={`/category/${product.category.slug}`}
                  className="transition-colors hover:text-primary"
                >
                  {product.category.name}
                </Link>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Availability</dt>
              <dd>{product.stock > 0 ? `${product.stock} in stock` : "Unavailable"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-16">
        <ReviewSection
          stats={stats}
          reviews={product.reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            verifiedPurchase: review.verifiedPurchase,
            createdAt: review.createdAt,
            user: review.user,
          }))}
        />
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-label="Related products">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">You may also like</h2>
            <Link
              href="/shop"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              View all →
            </Link>
          </div>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
