import { describe, it, expect } from 'vitest';
import {
  evaluateCoupon,
  calculateCouponValue,
  calculateShipping,
  calculateTax,
  computeOrderTotals,
} from '../pricing';

const baseCoupon = {
  id: 'cp_test',
  code: 'TEST10',
  type: 'PERCENTAGE' as const,
  value: 10,
  min_order_amount: null,
  max_discount: null,
  starts_at: '2025-01-01T00:00:00Z',
  expires_at: '2027-01-01T00:00:00Z',
  usage_limit: 10,
  usage_count: 0,
  is_active: 1,
};

describe('evaluateCoupon', () => {
  it('returns valid with discount for an active percentage coupon', () => {
    const r = evaluateCoupon(baseCoupon, 500);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(50);
  });

  it('rejects unknown coupon', () => {
    expect(evaluateCoupon(null, 100)).toEqual({ valid: false, error: 'Invalid coupon code.' });
  });

  it('rejects expired coupon', () => {
    const r = evaluateCoupon({ ...baseCoupon, expires_at: '2020-01-01T00:00:00Z' }, 500);
    expect(r.valid).toBe(false);
  });

  it('rejects inactive coupon', () => {
    expect(evaluateCoupon({ ...baseCoupon, is_active: 0 }, 500).valid).toBe(false);
  });

  it('rejects exceeded usage limit', () => {
    expect(evaluateCoupon({ ...baseCoupon, usage_count: 10, usage_limit: 10 }, 500).valid).toBe(false);
  });

  it('rejects below minimum order amount', () => {
    const r = evaluateCoupon({ ...baseCoupon, min_order_amount: 200 }, 50);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('minimum order of $200');
  });
});

describe('calculateCouponValue', () => {
  it('caps a percentage discount at max_discount', () => {
    const cp = { ...baseCoupon, value: 20, max_discount: 100 };
    expect(calculateCouponValue(cp, 1000)).toBe(100);
  });

  it('fixed coupon cannot exceed subtotal', () => {
    expect(calculateCouponValue({ ...baseCoupon, type: 'FIXED', value: 300 }, 200)).toBe(200);
  });
});

describe('shipping / tax / totals', () => {
  it('free shipping at or above $200', () => {
    expect(calculateShipping(200)).toBe(0);
    expect(calculateShipping(199)).toBe(25);
  });

  it('8% tax rounded to cents', () => {
    expect(calculateTax(100)).toBe(8);
    expect(calculateTax(133.2)).toBeCloseTo(10.66, 2);
  });

  it('computes complete order totals', () => {
    const t = computeOrderTotals(1850, 185);
    expect(t.shipping).toBe(0);
    expect(t.tax).toBe(133.2);
    expect(t.total).toBe(1798.2);
  });
});
