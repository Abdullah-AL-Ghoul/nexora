"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart/store";
import { VariantPicker, type VariantOption } from "@/components/product/variant-picker";
import { WishlistButton } from "@/components/product/wishlist-button";
import { ProductShareButton } from "@/components/product/product-share-button";
import { ProductStickyBar } from "@/components/product/product-sticky-bar";
import { ConciergeDialog } from "@/components/concierge/concierge-dialog";

export type ProductActionsProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export function ProductActions({
  product,
  variants,
  isAuthenticated,
  initialInWishlist,
  imageUrl,
}: {
  product: ProductActionsProduct;
  variants: VariantOption[];
  isAuthenticated: boolean;
  initialInWishlist: boolean;
  imageUrl?: string | null;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const selectedVariant = variants.find((variant) => variant.id === variantId) ?? null;
  const available = selectedVariant ? selectedVariant.stock : product.stock;
  const outOfStock = available <= 0;
  const maxQty = Math.max(1, Math.min(available, 99));

  function addToCart() {
    if (outOfStock) return;
    const safeQty = Math.min(qty, maxQty);
    addItem({ productId: product.id, variantId, qty: safeQty });
    toast.success(
      `Added “${product.name}”${selectedVariant ? ` (${selectedVariant.name})` : ""} to cart`
    );
    setQty(1);
    openDrawer();
  }

  return (
    <div className="flex flex-col gap-5">
      {variants.length > 0 && (
        <VariantPicker
          basePrice={product.price}
          variants={variants}
          value={variantId}
          onChange={(next) => {
            setVariantId(next);
            setQty(1);
          }}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-md border border-border">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={qty <= 1}
            onClick={() => setQty((current) => Math.max(1, current - 1))}
            className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span
            className="w-9 text-center text-sm font-medium tabular-nums"
            aria-live="polite"
            aria-label={`Quantity ${qty}`}
          >
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={qty >= maxQty}
            onClick={() => setQty((current) => Math.min(maxQty, current + 1))}
            className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        <Button size="lg" disabled={outOfStock} onClick={addToCart} className="flex-1 sm:flex-none">
          <ShoppingBag className="size-4" aria-hidden="true" />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </Button>

        <WishlistButton
          productId={product.id}
          isAuthenticated={isAuthenticated}
          initialInWishlist={initialInWishlist}
        />

        <ProductShareButton productName={product.name} />
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <ConciergeDialog productName={product.name} />
        <span className="text-[11px] text-muted-foreground tracking-wide font-medium">
          Certified Atelier Guarantee
        </span>
      </div>

      <ProductStickyBar
        product={product}
        selectedVariantName={selectedVariant?.name ?? null}
        selectedVariantId={variantId}
        price={selectedVariant ? product.price + selectedVariant.priceDelta : product.price}
        imageUrl={imageUrl ?? null}
        outOfStock={outOfStock}
      />
    </div>
  );
}
