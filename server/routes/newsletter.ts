import type { Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { run, get, all } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';

const SubscribeSchema = z.object({
  email: z.string().email().max(200),
  locale: z.enum(['ar', 'en']).optional(),
  source: z.string().max(50).optional(),
});

export function newsletterRouter() {
  const router = express.Router();

  // POST /api/newsletter — public subscribe
  router.post('/', async (req: Request, res: Response) => {
    try {
      const parsed = SubscribeSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ error: 'Invalid email address.' });

      const { email, locale, source } = parsed.data;
      const normalized = email.toLowerCase();
      const existing = get<{ id: string }>('SELECT id FROM newsletter_subscribers WHERE email = ?', [normalized]);
      if (existing) return res.json({ success: true, already: true });

      const id = `nl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      run('INSERT INTO newsletter_subscribers (id,email,locale,source,created_at) VALUES (?,?,?,?,?)',
        [id, normalized, locale ?? 'ar', source ?? 'footer', new Date().toISOString()]);
      res.status(201).json({ success: true, already: false });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('newsletter error:', e);
      res.status(500).json({ error: 'Failed to subscribe.' });
    }
  });

  // GET /api/newsletter — list subscribers (ADMIN) — for the admin export/management
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      const rows = all<any>('SELECT id, email, locale, source, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200');
      res.json({ subscribers: rows });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('newsletter list error:', e);
      res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
  });

  return router;
}
