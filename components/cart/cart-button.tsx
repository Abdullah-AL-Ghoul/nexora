"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { selectCartCount, useCartStore } from "@/lib/cart/store";

export function CartButton() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state._hasHydrated);
  const count = hydrated ? selectCartCount(items) : 0;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
