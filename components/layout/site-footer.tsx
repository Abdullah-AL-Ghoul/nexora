import Link from "next/link";
import { Lock } from "lucide-react";

import { NewsletterForm } from "@/components/home/newsletter-form";

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/categories", label: "Categories" },
      { href: "/search", label: "Search" },
      { href: "/shop?sort=rating", label: "Top rated" },
      { href: "/shop?sort=price-asc", label: "Offers" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/account", label: "My account" },
      { href: "/account/orders", label: "Orders" },
      { href: "/wishlist", label: "Wishlist" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/shipping", label: "Shipping & returns" },
      { href: "mailto:support@nexora.demo", label: "support@nexora.demo" },
    ],
  },
] as const;

const PAYMENT_METHODS = ["Visa", "Mastercard", "Amex", "Apple Pay", "Stripe"] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      {/* Newsletter band */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Join the NEXORA list
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              First access to seasonal drops and member pricing. One email per season.
            </p>
          </div>
          <NewsletterForm compact />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-lg font-semibold tracking-[0.28em] text-foreground">
            NEX<span className="text-primary">O</span>RA
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Precision-engineered essentials across eight disciplines — curated for durability,
            designed for the long run, and backed by a 2-year warranty on every item.
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
            {PAYMENT_METHODS.map((method) => (
              <span
                key={method}
                className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {column.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 NEXORA. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            <Lock className="size-3" aria-hidden="true" />
            Encrypted checkout · payments powered by Stripe (test mode)
          </p>
        </div>
      </div>
    </footer>
  );
}
