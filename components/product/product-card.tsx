import Image from "next/image";
import Link from "next/link";
import { PackageX } from "lucide-react";

import { cn } from "cn";
import { Price } from "@/components/product/price";
import { RatingStars } from "@/components/product/rating-stars";
import { ProductQuickAdd } from "@/components/product/product-quick-add";
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
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_25px_-5px_rgba(201,169,97,0.16)] hover:-translate-y-0.5"
    >
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
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/50">
              <PackageX className="size-10" aria-hidden="true" />
            </div>
          )}
        </Link>

        {percent !== null && (
          <span className="absolute left-2.5 top-2.5 rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground tabular-nums shadow-sm">
            -{percent}%
          </span>
        )}

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
            <span className="text-[10px] text-amber-400/90 font-medium tracking-wide">
              Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
