import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order and complete checkout at NEXORA.",
};

export default async function CheckoutPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every price and stock level is re-checked with the server before you pay.
        </p>
      </header>
      <CheckoutForm userName={session.user.name ?? ""} />
    </div>
  );
}
