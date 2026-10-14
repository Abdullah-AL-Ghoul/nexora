import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react";

import { CheckoutForm, type SavedAddressProp } from "@/components/checkout/checkout-form";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Atelier Checkout — NEXORA",
  description: "Secure white-glove checkout and encrypted settlement at NEXORA Atelier.",
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* Top Header & Breadcrumb Navigation */}
      <header className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <Link
            href="/cart"
            className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Return to Atelier Bag</span>
          </Link>

          {/* Stepper Indicator */}
          <nav aria-label="Checkout Progress" className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">1. Bag</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-semibold text-primary flex items-center gap-1">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                2
              </span>
              Delivery & Details
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground">3. Settlement</span>
          </nav>

          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Lock className="size-3" />
            <span>Bank-Grade 256-Bit SSL</span>
          </div>
        </div>

        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
            Atelier Checkout
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Real-time stock reservation · White-glove concierge delivery · 100% Authenticity Guarantee
          </p>
        </div>
      </header>

      {/* Main Interactive Checkout Form */}
      <CheckoutForm
        userName={session.user.name ?? ""}
        savedAddress={savedAddress as SavedAddressProp | null}
      />
    </div>
  );
}
