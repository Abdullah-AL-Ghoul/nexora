import { cn } from "cn";
import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/lib/queries/catalog";

export function ProductGrid({
  products,
  className,
  priority = false,
}: {
  products: ProductCardData[];
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4",
        className
      )}
    >
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={priority || index < 4} />
      ))}
    </div>
  );
}
