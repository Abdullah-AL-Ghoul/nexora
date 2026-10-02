import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/catalog/empty-state";
import { WishlistRowActions } from "@/components/cart/wishlist-row-actions";
import { RatingStars } from "@/components/product/rating-stars";
import { requireSession } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";
import { getWishlistItems } from "@/lib/queries/wishlist";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Products you saved for later at NEXORA.",
};

export default async function WishlistPage() {
  const session = await requireSession();
  const items = await getWishlistItems(session.user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} saved {items.length === 1 ? "item" : "items"}
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it for later."
          actionLabel="Browse products"
          actionHref="/shop"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <Link
                href={`/product/${product.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
              >
                {product.images[0] && (
                  <Image
                    src={product.images[0].url}
                    alt={product.name}
                    width={80}
                    height={80}
                    className="size-20 object-cover"
                  />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${product.slug}`}
                  className="line-clamp-1 text-sm font-medium transition-colors hover:text-primary"
                >
                  {product.name}
                </Link>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatPrice(product.price)}
                </p>
                {product.ratingCount > 0 && (
                  <RatingStars
                    rating={product.ratingAvg}
                    count={product.ratingCount}
                    className="mt-1"
                  />
                )}
              </div>

              <WishlistRowActions productId={product.id} productName={product.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
