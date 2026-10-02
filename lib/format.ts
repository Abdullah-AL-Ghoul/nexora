const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** Money is stored as integer cents (Stripe-compatible). */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "$120" style discount percentage, or null when not discounted. */
export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
