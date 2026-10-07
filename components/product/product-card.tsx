import Image from "next/image";
import Link from "next/link";
import { PackageX } from "lucide-react";

import { cn } from "cn";
import { Price } from "@/components/product/price";
import { RatingStars } from "@/components/product/rating-stars";
import { ProductQuickAdd } from "@/components/product/product-quick-add";
import { discountPercent } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries/catalog";

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isRecentlyAdded(createdAt: Date | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_MS;
}

export function ProductCard({
  product,
  priority = false,
  rank,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Catalog rank for "Hall of Fame" treatment (1-based). */
  rank?: number;
}) {
  const image = product.images[0];
  const hoverImage = product.images[1];
  const percent = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = product.stock <= 0;
  const isNew = isRecentlyAdded(product.createdAt);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all duration-300 hover:border-primary/50 hover:shadow-glow hover:-translate-y-0.5">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Link
          href={`/product/${product.slug}`}
          prefetch={true}
          className="relative block size-full"
          aria-label={product.name}
          tabIndex={-1}
        >
          {image ? (
            <Image
              src={image.url}
              alt={image.alt || product.name}
              fill
              priority={priority}
              loading={priority ? undefined : "lazy"}
              decoding="async"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/50">
              <PackageX className="size-10" aria-hidden="true" />
            </div>
          )}
          {/* Second-angle crossfade on hover. */}
          {hoverImage ? (
            <Image
              src={hoverImage.url}
              alt=""
              aria-hidden="true"
              fill
              loading="lazy"
              decoding="async"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="scale-105 object-cover opacity-0 transition-all duration-700 group-hover:scale-100 group-hover:opacity-100"
            />
          ) : null}
        </Link>

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {rank !== undefined && (
            <span className="inline-flex items-center rounded-md bg-foreground/85 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-background backdrop-blur">
              #{String(rank).padStart(2, "0")}
            </span>
          )}
          {isNew && (
            <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              New
            </span>
          )}
          {percent !== null && (
            <span className="rounded bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums shadow-sm">
              -{percent}%
            </span>
          )}
        </div>

        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Out of stock
            </span>
          </div>
        ) : (
          <div className="absolute inset-x-2.5 bottom-2.5 translate-y-3 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 flex justify-center">
            <ProductQuickAdd productId={product.id} name={product.name} disabled={outOfStock} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {product.category.name}
        </span>
        <h3 className="line-clamp-2 font-medium leading-snug transition-colors group-hover:text-primary">
          <Link
            href={`/product/${product.slug}`}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
          >
            {product.name}
          </Link>
        </h3>

        {product.ratingCount > 0 ? (
          <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
        ) : (
          <span className="text-xs text-muted-foreground">No reviews yet</span>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="sm"
            className={cn(outOfStock && "opacity-60")}
          />
          {product.stock > 0 && product.stock <= 5 && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400/90 font-medium tracking-wide">
              Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
