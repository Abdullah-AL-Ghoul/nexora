import type { Metadata } from "next";

import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Shipping methods, delivery windows, and the 30-day return policy at NEXORA.",
  alternates: { canonical: "/shipping" },
};

const SHIPPING = [
  {
    method: "Standard",
    price: "Free over $100",
    detail: "$9.90 flat below the threshold · 5–7 business days · tracked",
  },
  {
    method: "Express",
    price: "$19.90",
    detail: "1–2 business days · tracked · available on every order",
  },
] as const;

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Shipping & Returns
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Clear, flat, and honest — the same rules apply to every order, and your order history is
        always the single source of truth for status.
      </p>

      <section aria-labelledby="methods" className="mt-10">
        <h2 id="methods" className="text-lg font-semibold text-foreground">
          Shipping methods
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SHIPPING.map((option) => (
            <div key={option.method} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-foreground">{option.method}</p>
                <p className="font-mono text-sm font-semibold text-primary">{option.price}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{option.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="returns" className="mt-10">
        <h2 id="returns" className="text-lg font-semibold text-foreground">
          30-day returns
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Return any item within 30 days of delivery in original condition.</li>
          <li>Refunds are issued to the original payment method and restock immediately.</li>
          <li>
            Orders cancelled before shipping are refunded in full — nothing is ever charged for an
            order we cannot fulfill.
          </li>
          <li>Return shipping is pre-paid; start the process from your order page.</li>
        </ul>
      </section>

      <section aria-labelledby="warranty" className="mt-10">
        <h2 id="warranty" className="text-lg font-semibold text-foreground">
          2-year warranty
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Every product is covered for two years against manufacturing defects. Your order history
          is your proof of purchase — no receipts to keep.
        </p>
      </section>
    </div>
  );
}
