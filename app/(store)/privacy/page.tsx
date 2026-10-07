import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How NEXORA collects, uses, and protects customer information.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  {
    title: "What we collect",
    body: "An account requires an email address and a name for order fulfillment. Checkout collects the shipping address you enter. We store order history, wishlists, and newsletter subscriptions you explicitly request.",
  },
  {
    title: "What we never do",
    body: "We never sell or share your personal data with advertisers. Payments are handled entirely by Stripe — card details never touch our servers or database.",
  },
  {
    title: "Sessions and security",
    body: "Sign-in sessions are httpOnly, same-site cookies tied to hashed tokens. Disabling an account revokes every active session immediately. Passwords are hashed with better-auth's salted scheme.",
  },
  {
    title: "Analytics and logging",
    body: "We log server errors and webhook events for reliability only, retaining them for 30 days. Logs never contain secrets or card data.",
  },
  {
    title: "Deleting your data",
    body: "Contact support@nexora.demo to close your account and erase associated personal data, except records we must retain for tax and fraud purposes.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Privacy Policy
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
