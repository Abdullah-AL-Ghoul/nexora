"use client";

import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/cart/store";

export function ProductQuickAdd({
  productId,
  name,
  disabled = false,
}: {
  productId: string;
  name: string;
  disabled?: boolean;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    addItem({ productId, variantId: null, qty: 1 });
    openDrawer();
    toast.success(`Added "${name}" to cart`);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      aria-label={`Quick add ${name} to cart`}
      className="group/btn relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-card/90 px-3 py-2 text-xs font-medium text-foreground backdrop-blur shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      <ShoppingBag className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" aria-hidden="true" />
      <span>Quick Add</span>
    </button>
  );
}
