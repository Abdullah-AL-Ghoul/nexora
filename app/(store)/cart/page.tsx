import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your NEXORA cart.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prices and stock are re-checked with the server on every change.
        </p>
      </header>
      <CartView />
    </div>
  );
}
