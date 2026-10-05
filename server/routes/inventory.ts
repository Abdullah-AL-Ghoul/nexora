import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';
import { StockAdjustSchema } from '../schemas.js';

export function inventoryRouter() {
  const router = express.Router();

  // GET /api/inventory/transactions
  router.get('/transactions', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      const rows = await all<any>('SELECT * FROM inventory_transactions ORDER BY created_at DESC LIMIT 200');
      res.json({ transactions: rows });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to fetch inventory transactions' });
    }
  });

  // GET /api/inventory/products (low stock report)
  router.get('/products', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      const rows = await all<any>('SELECT id,name,slug,sku,stock,category_name FROM products WHERE stock <= 5 ORDER BY stock ASC');
      res.json({ lowStock: rows });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  // POST /api/inventory/adjust
  router.post('/adjust', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');

      const parsed = StockAdjustSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      const { productId, variantId, quantityDelta, reason } = parsed.data;

      const product = await get<any>('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const newStock = Math.max(0, product.stock + quantityDelta);

      if (variantId) {
        const variants = JSON.parse(product.variants || '[]');
        const idx = variants.findIndex((v: any) => v.id === variantId);
        if (idx >= 0) {
          variants[idx].stock = Math.max(0, variants[idx].stock + quantityDelta);
          await run('UPDATE products SET variants = ?, updated_at = ? WHERE id = ?', [JSON.stringify(variants), new Date().toISOString(), productId]);
        }
      } else {
        await run('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, new Date().toISOString(), productId]);
      }

      const txId = `inv_tx_${Date.now()}`;
      const now = new Date().toISOString();
      await run(`
        INSERT INTO inventory_transactions (id,product_id,product_name,sku,variant_id,type,quantity,stock_after,reason,performed_by,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `, [txId, productId, product.name, product.sku, variantId ?? null,
          quantityDelta >= 0 ? 'IN' : 'OUT', Math.abs(quantityDelta), newStock, reason, user!.name, now]);

      res.json({ success: true, newStock });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to adjust stock' });
    }
  });

  return router;
}
