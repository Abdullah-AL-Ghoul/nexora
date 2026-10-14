import type { Metadata } from "next";

import { CheckoutForm, type SavedAddressProp } from "@/components/checkout/checkout-form";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Checkout — NEXORA Atelier",
  description: "Review your order and complete checkout at NEXORA.",
};

export default async function CheckoutPage() {
  const session = await requireSession();

  // Fetch the patron's default shipping address
  const savedAddress = await prisma.address.findFirst({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      fullName: true,
      line1: true,
      line2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      phone: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
          Atelier Checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every price and stock level is re-checked with the server before you pay.
        </p>
      </header>
      <CheckoutForm 
        userName={session.user.name ?? ""} 
        savedAddress={savedAddress as SavedAddressProp | null} 
      />
    </div>
  );
}
