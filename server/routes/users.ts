import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';

/** Never leak credential columns to clients. */
function toSafeUser(u: any) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

export function usersRouter() {
  const router = express.Router();

  // GET /api/users/me — current user info (resolved from session token)
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any, { optional: true });
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      const dbUser = get<any>('SELECT * FROM users WHERE email = ?', [user.email]);
      res.json({ user: toSafeUser(dbUser) ?? { id: user.uid, email: user.email, name: user.name, role: user.role, created_at: new Date().toISOString() } });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // GET /api/users — list all users (ADMIN)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN');
      const rows = await all<any>('SELECT * FROM users ORDER BY created_at DESC');
      res.json({ users: rows.map(toSafeUser) });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // GET /api/users/analytics (ADMIN)
  router.get('/analytics', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');

      const revenueRow = await get<{total:number}>('SELECT COALESCE(SUM(total),0) as total FROM orders WHERE payment_status = ?', ['SUCCEEDED']);
      const ordersCount = await get<{c:number}>('SELECT COUNT(*) as c FROM orders');
      const customersCount = await get<{c:number}>('SELECT COUNT(DISTINCT user_id) as c FROM orders');
      const revenue = revenueRow ?? { total: 0 };
      const orders = ordersCount ?? { c: 0 };
      const lowStockCount = (await get<{c:number}>('SELECT COUNT(*) as c FROM products WHERE stock <= 5')) ?? { c: 0 };
      const recentOrders = await all<any>('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8');

      // Category breakdown
      const catRows = await all<any>(`
        SELECT p.category_name as category, SUM(oi.total_price) as amount
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id WHERE o.payment_status = 'SUCCEEDED'
        GROUP BY p.category_name
      `);
      const totalRevenue = revenue.total;
      const salesByCategory = catRows.map(r => ({ category: r.category, amount: r.amount, percentage: totalRevenue > 0 ? Math.round((r.amount / totalRevenue) * 100) : 0 }));

      // Revenue by day (last 7 days) from real orders — never fake numbers
      const realRevenueByDay = (() => {
        const byDay: { date: string; amount: number }[] = [];
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        for (let i = 6; i >= 0; i -= 1) {
          const d = new Date(start);
          d.setUTCDate(start.getUTCDate() - i);
          const dayStart = d.toISOString();
          const { sum } = get<{ sum: number }>(
            `SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE payment_status = 'SUCCEEDED' AND created_at >= ? AND created_at < ?`,
            [dayStart, new Date(d.getTime() + 86400000).toISOString()]
          ) ?? { sum: 0 };
          byDay.push({
            date: `${d.toISOString().slice(5, 10)} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]})`,
            amount: sum,
          });
        }
        return byDay;
      })();

      // Current vs prior 7-day revenue — real delta (0 when no prior data; never fabricated)
      const isoPrior = new Date(Date.now() - 7 * 86400000).toISOString();
      const curPeriod = get<{ sum: number }>('SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE payment_status = ? AND created_at >= ?', ['SUCCEEDED', isoPrior]) ?? { sum: 0 };
      const priorPeriod = get<{ sum: number }>('SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE payment_status = ? AND created_at < ?', ['SUCCEEDED', isoPrior]) ?? { sum: 0 };
      const revenueChangePercent = priorPeriod.sum > 0
        ? Math.round(((curPeriod.sum - priorPeriod.sum) / priorPeriod.sum) * 1000) / 10
        : 0;

      const totalCustomers = customersCount?.c ?? 0;
      const averageOrderValue = orders.c > 0 ? Math.round((revenue.total / orders.c) * 100) / 100 : 0;

      res.json({
        totalRevenue: revenue.total, revenueChangePercent,
        totalOrders: orders.c, ordersChangePercent: 0,
        totalCustomers, customersChangePercent: 0,
        averageOrderValue, lowStockCount: lowStockCount.c,
        revenueByDay: realRevenueByDay,
        salesByCategory,
        recentOrders: recentOrders.map(r => ({ ...r, shipping_address: JSON.parse(r.shipping_address || '{}') })),
        topSellingProducts: [],
      });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  return router;
}
