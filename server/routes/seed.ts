import type { Request, Response } from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';

// POST /api/seed — bulk seed from the existing frontend seed data
export async function seedProducts(req: Request, res: Response) {
  try {
    const user = await authMiddleware(req as any);
    requireRole(user, 'ADMIN', 'MANAGER');

    const {
      INITIAL_PRODUCTS,
      INITIAL_ORDERS,
      INITIAL_REVIEWS,
      INITIAL_INVENTORY_TRANSACTIONS,
    } = await import('../../src/data/seedData.ts');

    let seededProducts = 0;
    for (const p of INITIAL_PRODUCTS) {
      run(`
        INSERT OR REPLACE INTO products (id,name,slug,tagline,description,price,compare_at_price,sku,stock,category_id,category_name,images,variants,rating,reviews_count,status,is_featured,is_best_seller,is_trending,materials,dimensions,weight,origin,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [p.id, p.name, p.slug, p.tagline, p.description, p.price, p.compareAtPrice ?? null, p.sku, p.stock, p.categoryId, p.categoryName,
        JSON.stringify(p.images), JSON.stringify(p.variants), p.rating, p.reviewsCount, p.status,
        p.isFeatured ? 1 : 0, p.isBestSeller ? 1 : 0, p.isTrending ? 1 : 0,
        JSON.stringify(p.materials ?? []), p.dimensions ?? null, p.weight ?? null, p.origin ?? null,
        p.createdAt, p.updatedAt]);
      seededProducts++;
    }

    let seededOrders = 0;
    for (const o of INITIAL_ORDERS) {
      run(`
        INSERT OR REPLACE INTO orders (id,order_number,user_id,customer_name,customer_email,subtotal,discount,shipping,tax,total,status,payment_status,payment_method,stripe_payment_intent_id,shipping_address,tracking_number,shipping_carrier,notes,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [o.id, o.orderNumber, o.userId, o.customerName, o.customerEmail, o.subtotal, o.discount, o.shipping, o.tax, o.total,
        o.status, o.paymentStatus, o.paymentMethod, o.stripePaymentIntentId ?? null, JSON.stringify(o.shippingAddress),
        o.trackingNumber ?? null, o.shippingCarrier ?? null, o.notes ?? null, o.createdAt, o.updatedAt]);

      for (const item of o.items) {
        run(`INSERT OR REPLACE INTO order_items (id,order_id,product_id,product_name,product_image,sku,variant_name,unit_price,quantity,total_price) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [item.id, o.id, item.productId, item.productName, item.productImage, item.sku, item.variantName ?? null, item.unitPrice, item.quantity, item.totalPrice]);
      }
      seededOrders++;
    }

    let seededReviews = 0;
    for (const r of INITIAL_REVIEWS) {
      run(`INSERT OR REPLACE INTO reviews (id,product_id,user_id,user_name,user_avatar,rating,title,comment,is_verified_purchase,is_approved,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [r.id, r.productId, r.userId, r.userName, r.userAvatar ?? null, r.rating, r.title, r.comment, r.isVerifiedPurchase ? 1 : 0, r.isApproved ? 1 : 0, r.createdAt]);
      seededReviews++;
    }

    let seededTx = 0;
    for (const t of INITIAL_INVENTORY_TRANSACTIONS) {
      run(`INSERT OR REPLACE INTO inventory_transactions (id,product_id,product_name,sku,variant_id,type,quantity,stock_after,reason,performed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [t.id, t.productId, t.productName, t.sku, t.variantId ?? null, t.type, t.quantity, t.stockAfter, t.reason, t.performedBy, t.createdAt]);
      seededTx++;
    }

    res.json({ success: true, seeded: { products: seededProducts, orders: seededOrders, reviews: seededReviews, inventoryTx: seededTx } });
  } catch (e: any) {
    console.error('Seed failed:', e);
    if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
    else res.status(500).json({ error: 'Seed failed' });
  }
}
