// Client-side cart display pricing. Mirrors server/routes/pricing.ts rules — the
// SERVER remains authoritative for orders; these helpers only render the cart.
import type { Coupon } from '../types';

export const FREE_SHIPPING_THRESHOLD = 200;
export const FLAT_SHIPPING = 25;
export const TAX_RATE = 0.08;

export function calculateDiscount(coupon: Coupon | null, subtotal: number): number {
  if (!coupon) return 0;
  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = (subtotal * coupon.value) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = Math.min(coupon.value, subtotal);
  }
  return Math.round(discount * 100) / 100;
}

export function calculateShipping(afterDiscount: number): number {
  const net = Math.max(0, afterDiscount);
  if (net === 0) return 0;
  return net >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}

export function calculateTax(afterDiscount: number): number {
  return Math.round(Math.max(0, afterDiscount) * TAX_RATE * 100) / 100;
}

export function calculateTotal(subtotal: number, coupon: Coupon | null): number {
  const discount = calculateDiscount(coupon, subtotal);
  const net = Math.max(0, subtotal - discount);
  const shipping = calculateShipping(net);
  const tax = calculateTax(net);
  return Math.max(0, Math.round((net + shipping + tax) * 100) / 100);
}
