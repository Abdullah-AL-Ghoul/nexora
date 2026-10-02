import Image from "next/image";
import Link from "next/link";
import { PackageX } from "lucide-react";

import { cn } from "cn";
import { Price } from "@/components/product/price";
import { RatingStars } from "@/components/product/rating-stars";
import { discountPercent } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries/catalog";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const image = product.images[0];
  const percent = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = product.stock <= 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={product.name}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            <PackageX className="size-10" aria-hidden="true" />
          </div>
        )}

        {percent !== null && (
          <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
            -{percent}%
          </span>
        )}

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {product.category.name}
        </span>
        <h3 className="line-clamp-2 font-medium leading-snug transition-colors group-hover:text-primary">
          {product.name}
        </h3>
        {product.ratingCount > 0 ? (
          <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
        ) : (
          <span className="text-xs text-muted-foreground">No reviews yet</span>
        )}
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          size="sm"
          className={cn("mt-auto pt-1", outOfStock && "opacity-60")}
        />
      </div>
    </Link>
  );
}
