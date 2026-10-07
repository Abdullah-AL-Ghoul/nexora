import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern purchases and use of the NEXORA platform.",
  alternates: { canonical: "/terms" },
};

const SECTIONS = [
  {
    title: "The platform",
    body: "NEXORA is a demonstration commerce platform. Catalog items, inventory, and reviews are seeded demo data; the commerce engine itself (pricing, checkout, payments, fulfillment) is fully functional in Stripe test mode.",
  },
  {
    title: "Orders and pricing",
    body: "All prices are in USD and computed server-side at checkout — client-displayed prices are indicative only. An order becomes binding when payment is captured; stock is verified again at fulfillment, and any order we cannot fulfill is refunded automatically.",
  },
  {
    title: "Accounts",
    body: "You are responsible for activity under your account. Staff roles are granted by administrators only and can never be self-assigned. Accounts may be disabled for abuse, which revokes all active sessions.",
  },
  {
    title: "Acceptable use",
    body: "No scraping, credential stuffing, coupon abuse, or attempts to bypass server-side authorization. Public API surfaces are rate-limited; abusive traffic is rejected with HTTP 429.",
  },
  {
    title: "Payments",
    body: "Payments run through Stripe in test mode on this demo. No real money is ever charged. In a production deployment, refunds follow the 30-day policy on the Shipping & Returns page.",
  },
] as const;

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: October 2026 · Applies to the NEXORA demo platform.
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title} aria-labelledby={section.title.replace(/\s+/g, "-")}>
            <h2
              id={section.title.replace(/\s+/g, "-")}
              className="text-lg font-semibold text-foreground"
            >
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
