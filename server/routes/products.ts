import type { Request, Response } from 'express';
import express from 'express';
import { get, all, run } from '../db.js';
import { authMiddleware, requireRole, HttpError } from '../auth.js';
import { ProductFilterSchema, CreateProductSchema } from '../schemas.js';

export function productsRouter() {
  const router = express.Router();

  // Build WHERE clause from filters, returns { where, args }
  function buildWhere(params: any): { where: string; args: unknown[] } {
    let where = 'status = ?';
    const args: unknown[] = ['ACTIVE'];
    const { categorySlug, search, minPrice, maxPrice, inStockOnly, featuredOnly } = params;

    if (categorySlug && categorySlug !== 'all') {
      const cat = get<{ id: string }>('SELECT id FROM categories WHERE slug = ?', [categorySlug]);
      if (cat) { where += ' AND category_id = ?'; args.push(cat.id); }
    }
    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      where += ` AND (LOWER(name) LIKE ? OR LOWER(tagline) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category_name) LIKE ?)`;
      args.push(q, q, q, q);
    }
    if (minPrice != null) { where += ' AND price >= ?'; args.push(minPrice); }
    if (maxPrice != null) { where += ' AND price <= ?'; args.push(maxPrice); }
    if (inStockOnly) { where += ' AND stock > 0'; }
    if (featuredOnly) { where += ' AND is_featured = 1'; }
    return { where, args };
  }

  function rowToFeed(r: any) {
    return {
      id: r.id, name: r.name, slug: r.slug, tagline: r.tagline, description: r.description,
      price: r.price, compareAtPrice: r.compare_at_price, sku: r.sku, stock: r.stock,
      categoryId: r.category_id, categoryName: r.category_name,
      images: JSON.parse(r.images || '[]'), variants: JSON.parse(r.variants || '[]'),
      rating: r.rating, reviewsCount: r.reviews_count, status: r.status,
      isFeatured: !!r.is_featured, isBestSeller: !!r.is_best_seller, isTrending: !!r.is_trending,
      materials: JSON.parse(r.materials || '[]'), dimensions: r.dimensions, weight: r.weight, origin: r.origin,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // GET /api/products
  router.get('/', async (req: Request, res: Response) => {
    try {
      const parsed = ProductFilterSchema.safeParse(req.query);
      const params = parsed.success ? parsed.data : { page: 1, limit: 20, sortBy: 'newest' as const };
      const { sortBy } = params as any;
      const page = Number(params.page) || 1;
      const limit = Number(params.limit) || 20;

      const { where, args } = buildWhere(params);
      const countRow = get<{ c: number }>(`SELECT COUNT(*) as c FROM products WHERE ${where}`, args);
      const total = countRow?.c ?? 0;

      const orderByMap: Record<string, string> = {
        'price-asc': 'price ASC', 'price-desc': 'price DESC',
        popular: 'reviews_count DESC', rating: 'rating DESC', newest: 'created_at DESC',
      };
      const orderBy = orderByMap[String(sortBy)] ?? 'created_at DESC';

      const offset = (page - 1) * limit;
      const rows = all<Record<string, any>>(`SELECT * FROM products WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...args, limit, offset]);

      res.json({ products: rows.map(rowToFeed), pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) {
      console.error('products list error:', e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // GET /api/products/featured
  router.get('/featured', async (_req: Request, res: Response) => {
    const rows = all('SELECT * FROM products WHERE status = ? AND is_featured = 1 LIMIT 8', ['ACTIVE']);
    res.json({ products: rows.map(rowToFeed) });
  });

  // GET /api/products/related/:slug
  router.get('/related/:slug', async (req: Request, res: Response) => {
    const product = get<any>('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const rows = all('SELECT * FROM products WHERE category_id = ? AND id != ? AND status = ? LIMIT 4',
      [product.category_id, product.id, 'ACTIVE']);
    res.json({ products: rows.map(rowToFeed) });
  });

  // GET /api/products/:slug
  router.get('/:slug', async (req: Request, res: Response) => {
    const row = get<any>('SELECT * FROM products WHERE slug = ? AND status = ?', [req.params.slug, 'ACTIVE']);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rowToFeed(row) });
  });

  // POST /api/products (ADMIN/MANAGER)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      const result = CreateProductSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      const d = result.data;
      const id = `prod_${Date.now()}`;
      const slug = d.slug ?? d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const sku = d.sku ?? `NX-${Date.now().toString().slice(-4)}`;
      const now = new Date().toISOString();
      const cat = get<{ name: string }>('SELECT name FROM categories WHERE id = ?', [d.categoryId]);
      const categoryName = cat?.name ?? 'Fine Accessories';

      run(`
        INSERT INTO products (id,name,slug,tagline,description,price,compare_at_price,sku,stock,category_id,category_name,images,variants,rating,reviews_count,status,is_featured,is_best_seller,is_trending,materials,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [id, d.name, slug, d.tagline ?? '', d.description ?? '', d.price, d.compareAtPrice ?? null, sku,
        d.stock ?? 10, d.categoryId, categoryName, JSON.stringify(d.images ?? []), JSON.stringify(d.variants ?? []),
        5.0, 0, d.status ?? 'ACTIVE', d.isFeatured ? 1 : 0, d.isBestSeller ? 1 : 0, d.isTrending ? 1 : 0,
        JSON.stringify(d.materials ?? []), now, now]);

      const product = get<any>('SELECT * FROM products WHERE id = ?', [id]);
      res.status(201).json({ product });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else { console.error(e); res.status(500).json({ error: 'Failed to create product' }); }
    }
  });

  // DELETE /api/products/:id (ADMIN/MANAGER)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');
      run('DELETE FROM products WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else { console.error(e); res.status(500).json({ error: 'Failed to delete product' }); }
    }
  });

  return router;
}
