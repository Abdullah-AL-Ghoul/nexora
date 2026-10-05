import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';
import { ValidateCouponSchema } from '../schemas.js';

export function couponsRouter() {
  const router = express.Router();

  // GET /api/coupons/validate?code=&subtotal=
  router.get('/validate', async (req: Request, res: Response) => {
    try {
      const parsed = ValidateCouponSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid params', details: parsed.error.flatten() });
      const { code, subtotal } = parsed.data;

      const coupon = await get<any>('SELECT * FROM coupons WHERE UPPER(code) = ?', [code.trim().toUpperCase()]);
      if (!coupon) return res.json({ valid: false, error: 'Invalid coupon code.' });

      const { evaluateCoupon } = await import('../pricing.js');
      const result = evaluateCoupon(coupon, subtotal);
      if (!result.valid || result.discount === undefined) {
        return res.json({ valid: false, error: result.error ?? 'Invalid coupon.' });
      }

      res.json({ valid: true, discount: result.discount, coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to validate coupon' });
    }
  });

  // GET /api/coupons (ADMIN)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      const rows = await all<any>('SELECT * FROM coupons ORDER BY created_at DESC');
      res.json({ coupons: rows });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to fetch coupons' });
    }
  });

  return router;
}
