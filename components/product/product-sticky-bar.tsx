"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "cn";

export function ProductStickyBar({
  product,
  selectedVariantName,
  selectedVariantId,
  price,
  imageUrl,
  outOfStock,
}: {
  product: { id: string; name: string };
  selectedVariantName: string | null;
  selectedVariantId: string | null;
  price: number;
  imageUrl: string | null;
  outOfStock: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  useEffect(() => {
    function handleScroll() {
      // Show when scrolled down 450px
      const scrolled = window.scrollY > 450;
      setVisible(scrolled);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleQuickAdd() {
    if (outOfStock) return;
    addItem({ productId: product.id, variantId: selectedVariantId, qty: 1 });
    toast.success(`Added “${product.name}” to cart`);
    openDrawer();
  }

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg px-4 py-3 shadow-2xl transition-all duration-300 ease-out sm:px-8",
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {imageUrl && (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <Image src={imageUrl} alt="" fill sizes="48px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground">{product.name}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{formatPrice(price)}</span>
              {selectedVariantName && (
                <>
                  <span>·</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                    {selectedVariantName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="default"
            disabled={outOfStock}
            onClick={handleQuickAdd}
            className="gap-2 shadow-sm font-medium"
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            <span>{outOfStock ? "Out of stock" : "Add to cart"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
