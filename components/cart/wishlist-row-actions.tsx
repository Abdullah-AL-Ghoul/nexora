"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart/store";

export function WishlistRowActions({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [pending, setPending] = useState(false);

  async function post(action: "add" | "remove"): Promise<boolean> {
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function moveToCart() {
    setPending(true);
    addItem({ productId, variantId: null, qty: 1 });
    const ok = await post("remove");
    setPending(false);
    if (!ok) {
      toast.error("Added to cart, but couldn't update your wishlist");
      return;
    }
    toast.success(`“${productName}” moved to cart`);
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const ok = await post("remove");
    setPending(false);
    if (!ok) {
      toast.error("Unable to update your wishlist");
      return;
    }
    toast.success("Removed from wishlist");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={moveToCart} disabled={pending}>
        <ShoppingBag className="size-4" aria-hidden="true" />
        Move to cart
      </Button>
      <Button size="sm" variant="outline" onClick={remove} disabled={pending}>
        <Heart className="size-4 fill-primary text-primary" aria-hidden="true" />
        Remove
      </Button>
    </div>
  );
}
