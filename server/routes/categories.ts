import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';

export function categoriesRouter() {
  const router = express.Router();

  router.get('/', async (_req: Request, res: Response) => {
    const rows = await all<any>('SELECT * FROM categories ORDER BY name');
    res.json({ categories: rows });
  });

  router.get('/:slug', async (req: Request, res: Response) => {
    const row = await get<any>('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: row });
  });

  // POST /api/categories (ADMIN)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN');
      const { name, slug, description, imageUrl } = req.body;
      if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
      const id = `cat_${Date.now()}`;
      await run(
        'INSERT INTO categories (id,name,slug,description,image_url,item_count) VALUES (?,?,?,?,?,?)',
        [id, name, slug, description ?? '', imageUrl ?? '', 0]
      );
      const category = await get('SELECT * FROM categories WHERE id = ?', [id]);
      res.status(201).json({ category });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // DELETE /api/categories/:id (ADMIN)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN');
      await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  return router;
}
