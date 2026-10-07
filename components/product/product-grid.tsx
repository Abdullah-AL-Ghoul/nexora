import { cn } from "cn";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/lib/motion/reveal";
import type { ProductCardData } from "@/lib/queries/catalog";

export function ProductGrid({
  products,
  className,
  priority = false,
  rankOffset = 0,
}: {
  products: ProductCardData[];
  className?: string;
  priority?: boolean;
  /** When > 0, cards show their catalog rank (Hall of Fame treatment). */
  rankOffset?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4",
        className
      )}
    >
      {products.map((product, index) => (
        <Reveal key={product.id} delay={Math.min(index * 70, 350)}>
          <ProductCard
            product={product}
            priority={priority || index < 4}
            rank={rankOffset > 0 ? rankOffset + index : undefined}
          />
        </Reveal>
      ))}
    </div>
  );
}
