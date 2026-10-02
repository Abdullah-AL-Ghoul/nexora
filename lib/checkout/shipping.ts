/**
 * Shipping price resolution (integer cents).
 * Pure function — used on the server (authoritative) and the client
 * (display only; the server always recomputes at order creation).
 */

export type ShippingMethod = "standard" | "express";

export const SHIPPING_METHODS: Record<
  ShippingMethod,
  { label: string; description: string }
> = {
  standard: { label: "Standard", description: "5–7 business days" },
  express: { label: "Express", description: "1–2 business days" },
};

export const FREE_SHIPPING_THRESHOLD = 10_000; // $100.00
export const STANDARD_SHIPPING_PRICE = 990; // $9.99
export const EXPRESS_SHIPPING_PRICE = 1_990; // $19.99

/** Shipping (cents) for a method against the discounted subtotal (cents). */
export function resolveShipping(
  method: ShippingMethod,
  discountedSubtotal: number
): number {
  if (method === "express") return EXPRESS_SHIPPING_PRICE;
  return discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_PRICE;
}
