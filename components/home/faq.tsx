import { Reveal } from "@/lib/motion/reveal";

/**
 * Accordion-free FAQ — every item is a native <details> for keyboard and
 * screen-reader friendliness with zero client JS.
 */
const FAQ_ITEMS = [
  {
    q: "How fast is shipping?",
    a: "Standard orders (5–7 business days) ship free over $100; express (1–2 business days) is a flat $19.90. Every order ships with tracking.",
  },
  {
    q: "What is the return policy?",
    a: "30 days, no questions asked. Items can be returned pre-paid in original condition for a full refund; refunds restock immediately and appear on your order history.",
  },
  {
    q: "What does the 2-year warranty cover?",
    a: "Every product is covered for two years against manufacturing defects. Warranty claims are handled from your account — no receipts needed, your order history is the proof.",
  },
  {
    q: "Is checkout secure?",
    a: "Payments are processed by Stripe over encrypted connections. Prices and stock are re-verified by our server before payment, and money is never captured for orders we cannot fulfill.",
  },
  {
    q: "Do products ever go out of stock?",
    a: "Yes — availability is live. The catalog shows real-time stock, badges out-of-stock items, and flags 'Only N left' so you always know what you are buying.",
  },
] as const;

export function Faq() {
  return (
    <Reveal as="section" aria-label="Frequently asked questions">
      <div className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Answers
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Frequently asked questions
        </h2>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-card px-5 py-4 transition-colors open:border-primary/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-open:rotate-45 group-open:border-primary group-open:text-primary"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Reveal>
  );
}
