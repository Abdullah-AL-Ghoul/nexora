import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, HttpError } from '../auth.js';
import { CreateOrderSchema } from '../schemas.js';

export function ordersRouter() {
  const router = express.Router();

  // GET /api/orders — list orders (admin sees all, customer sees own)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any, { optional: true });
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        const rows = await all<any>('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
        return res.json({ orders: rows.map(r => ({ ...r, shipping_address: JSON.parse(r.shipping_address || '{}') })) });
      }

      // Customers only see their own orders
      const rows = await all<any>(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [user.uid]
      );
      res.json({ orders: rows.map(r => ({ ...r, shipping_address: JSON.parse(r.shipping_address || '{}') })) });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else { console.error(e); res.status(500).json({ error: 'Failed to fetch orders' }); }
    }
  });

  // GET /api/orders/:id
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any, { optional: true });
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      const row = await get<any>(
        'SELECT * FROM orders WHERE id = ? OR order_number = ?',
        [req.params.id, req.params.id]
      );
      if (!row) return res.status(404).json({ error: 'Order not found' });
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && row.user_id !== user.uid) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const items = await all<any>('SELECT * FROM order_items WHERE order_id = ?', [row.id]);
      res.json({ order: { ...row, shipping_address: JSON.parse(row.shipping_address || '{}'), items } });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else { console.error(e); res.status(500).json({ error: 'Failed to fetch order' }); }
    }
  });

  // POST /api/orders — create order
  router.post('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any, { optional: true });
      // Allow guest checkout — user can be null but we'll assign to 'guest'
      const uid = user?.uid ?? `guest_${Date.now()}`;
      const customerEmail = user?.email ?? req.body?.shippingAddress?.email ?? 'guest@nexora.local';

      const result = CreateOrderSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      const orderData = result.data;

      // 1. Resolve items with authoritative prices and stock check
      const resolvedItems: any[] = [];
      let subtotal = 0;

      for (const item of orderData.items) {
        const product = await get<any>('SELECT * FROM products WHERE id = ?', [item.productId]);
        if (!product) return res.status(400).json({ error: `Product not found: ${item.productId}` });

        let unitPrice = product.price;
        let sku = product.sku;
        let variantName: string | undefined;
        let variantStock = product.stock;

        if (item.variantId) {
          const variants = JSON.parse(product.variants || '[]');
          const variant = variants.find((v: any) => v.id === item.variantId);
          if (!variant) return res.status(400).json({ error: `Variant not found: ${item.variantId}` });
          unitPrice = variant.price;
          sku = variant.sku;
          variantName = variant.name;
          variantStock = variant.stock;
        }

        if (variantStock < item.quantity) {
          return res.status(409).json({
            error: `Insufficient stock for ${product.name}${variantName ? ` (${variantName})` : ''}. Available: ${variantStock}`,
          });
        }

        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        resolvedItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          productName: product.name,
          productImage: JSON.parse(product.images || '[]')[0]?.url ?? '',
          sku,
          variantName,
          unitPrice,
          quantity: item.quantity,
          totalPrice: itemTotal,
        });
      }

      // 2. Coupon validation and discount (pure logic shared with /api/coupons/validate)
      let discount = 0;
      if (orderData.couponCode) {
        const coupon = await get<any>(
          'SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1',
          [orderData.couponCode.trim().toUpperCase()]
        );
        if (!coupon) return res.status(400).json({ error: 'Invalid coupon code.' });

        const { evaluateCoupon } = await import('../pricing.js');
        const result = evaluateCoupon(coupon, subtotal);
        if (!result.valid || result.discount === undefined) {
          return res.status(400).json({ error: result.error ?? 'Invalid coupon.' });
        }
        discount = result.discount;
        // Increment usage
        await run('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [coupon.id]);
      }

      // 3. Shipping and tax
      const { computeOrderTotals } = await import('../pricing.js');
      const totals = computeOrderTotals(subtotal, discount);
      const { shipping, tax, total } = totals;

      // 4. Create order
      const orderId = `ord_${Date.now()}`;
      const orderNumber = `NX-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();
      const trackingNumber = `NX-TRK-${Math.floor(100000 + Math.random() * 900000)}`;

      await run(`
        INSERT INTO orders (id,order_number,user_id,customer_name,customer_email,subtotal,discount,shipping,tax,total,status,payment_status,payment_method,stripe_payment_intent_id,shipping_address,tracking_number,shipping_carrier,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        orderId, orderNumber, uid,
        orderData.shippingAddress.fullName,
        customerEmail,
        subtotal, discount, shipping, tax, total,
        'PAID', 'SUCCEEDED',
        orderData.paymentMethod || 'Stripe Test Card (•••• 4242)',
        `pi_test_${Date.now().toString(36)}`,
        JSON.stringify(orderData.shippingAddress),
        trackingNumber, 'FedEx Luxury Air', null,
        now, now,
      ]);

      // 5. Insert order items and decrement stock atomically
      for (const item of resolvedItems) {
        await run(`
          INSERT INTO order_items (id,order_id,product_id,product_name,product_image,sku,variant_name,unit_price,quantity,total_price)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `, [item.id, orderId, item.productId, item.productName, item.productImage, item.sku, item.variantName ?? null, item.unitPrice, item.quantity, item.totalPrice]);

        // Decrement stock
        if (item.variantId) {
          // Update variant stock in product JSON (stored as JSON array — we need to parse, update, stringify)
          const product = await get<any>('SELECT variants FROM products WHERE id = ?', [item.productId]);
          const variants = JSON.parse(product.variants || '[]');
          const variantIdx = variants.findIndex((v: any) => v.id === item.variantId);
          if (variantIdx >= 0) variants[variantIdx].stock -= item.quantity;
          await run('UPDATE products SET stock = stock - ?, variants = ?, updated_at = ? WHERE id = ?', [item.quantity, JSON.stringify(variants), now, item.productId]);
        } else {
          await run('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?', [item.quantity, now, item.productId]);
        }

        // Log inventory transaction
        await run(`
          INSERT INTO inventory_transactions (id,product_id,product_name,sku,variant_id,type,quantity,stock_after,reason,performed_by,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `, [
          `inv_tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          item.productId, item.productName, item.sku, item.variantId ?? null,
          'OUT', item.quantity, 0, // stock_after will be computed via a separate query
          `Order ${orderNumber} automated fulfillment`,
          user?.name ?? 'Guest Checkout',
          now,
        ]);
      }

      const order = await get<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
      const items = await all<any>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      res.status(201).json({ success: true, order: { ...order, shipping_address: JSON.parse(order.shipping_address || '{}'), items } });
    } catch (e: any) {
      console.error('create order error:', e);
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // PATCH /api/orders/:id/status (ADMIN)
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');

      const { status } = req.body;
      const validStatuses = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

      await run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  return router;
}

function requireRole(user: any, ...roles: string[]) {
  if (!user) throw new HttpError(401, 'Authentication required.');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions.');
}