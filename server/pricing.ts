// Pure pricing/coupon logic — extracted for testability and shared by routes.

export interface CouponLike {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  min_order_amount?: number | null;
  max_discount?: number | null;
  starts_at: string;
  expires_at: string;
  usage_limit: number;
  usage_count: number;
  is_active: number | boolean;
}

export interface DiscountResult {
  valid: boolean;
  discount?: number;
  error?: string;
}

export const FREE_SHIPPING_THRESHOLD = 200;
export const FLAT_SHIPPING = 25;
export const TAX_RATE = 0.08;

/** Validate a coupon and compute the discount for a given pre-discount subtotal. */
export function evaluateCoupon(coupon: CouponLike | undefined | null, subtotal: number): DiscountResult {
  if (!coupon) return { valid: false, error: 'Invalid coupon code.' };
  if (!coupon.is_active) return { valid: false, error: 'This coupon is no longer active.' };

  const now = Date.now();
  if (new Date(coupon.starts_at).getTime() > now) return { valid: false, error: 'This coupon is not yet active.' };
  if (new Date(coupon.expires_at).getTime() < now) return { valid: false, error: 'This coupon has expired.' };
  if (coupon.usage_count >= coupon.usage_limit) return { valid: false, error: 'This coupon has reached its maximum redemptions.' };
  if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
    return { valid: false, error: `Requires a minimum order of $${coupon.min_order_amount}. (Current: $${subtotal.toFixed(2)})` };
  }

  return { valid: true, discount: calculateCouponValue(coupon, subtotal) };
}

/** Raw discount amount for a coupon against a subtotal (no validity checks). */
export function calculateCouponValue(coupon: CouponLike, subtotal: number): number {
  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = (subtotal * coupon.value) / 100;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
  } else {
    discount = Math.min(coupon.value, subtotal);
  }
  return Math.round(discount * 100) / 100;
}

export function calculateShipping(afterDiscount: number): number {
  return afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}

export function calculateTax(afterDiscount: number): number {
  return Math.round(afterDiscount * TAX_RATE * 100) / 100;
}

export function computeOrderTotals(subtotal: number, discount: number): { shipping: number; tax: number; total: number } {
  const afterDiscount = subtotal - discount;
  const shipping = calculateShipping(afterDiscount);
  const tax = calculateTax(afterDiscount);
  const total = Math.round((afterDiscount + shipping + tax) * 100) / 100;
  return { shipping, tax, total };
}
