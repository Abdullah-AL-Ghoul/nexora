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

  // GET /api/products/:slug/reviews — public list of approved reviews
  router.get('/:slug/reviews', async (req: Request, res: Response) => {
    try {
      const product = get<any>('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      const rows = all<any>(
        'SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 50',
        [product.id]
      );
      res.json({
        reviews: rows.map((r) => ({
          id: r.id, productId: r.product_id, userId: r.user_id, userName: r.user_name,
          userAvatar: r.user_avatar, rating: r.rating, title: r.title, comment: r.comment,
          isVerifiedPurchase: !!r.is_verified_purchase, isApproved: !!r.is_approved,
          createdAt: r.created_at,
        })),
      });
    } catch (e: any) {
      console.error('reviews list error:', e);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  // POST /api/products/:slug/reviews — submit a review (supports guests with a name)
  router.post('/:slug/reviews', async (req: Request, res: Response) => {
    try {
      const product = get<any>('SELECT * FROM products WHERE slug = ?', [req.params.slug]);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const { rating, title, comment, userName } = req.body ?? {};
      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      }
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'A review title is required.' });
      }
      if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
        return res.status(400).json({ error: 'A review comment is required.' });
      }

      const user = await authMiddleware(req as any, { optional: true });
      const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const displayName = user?.name ?? (typeof userName === 'string' && userName.trim() ? userName.trim() : 'Distinguished Collector');

      run(
        `INSERT INTO reviews (id,product_id,user_id,user_name,user_avatar,rating,title,comment,is_verified_purchase,is_approved,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [id, product.id, user?.uid ?? 'guest', displayName, null, rating, title.trim(), comment.trim(), user ? 1 : 0, 1, new Date().toISOString()]
      );

      // Recompute aggregate rating + count (avg of all approved reviews)
      const agg = get<{ r: number; c: number }>(
        'SELECT ROUND(AVG(rating),1) as r, COUNT(*) as c FROM reviews WHERE product_id = ? AND is_approved = 1',
        [product.id]
      );
      run('UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?',
        [agg?.r ?? product.rating, agg?.c ?? product.reviews_count, product.id]);

      res.status(201).json({
        review: {
          id, productId: product.id, userId: user?.uid ?? 'guest', userName: displayName,
          rating, title: title.trim(), comment: comment.trim(), isVerifiedPurchase: !!user, isApproved: true,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('review create error:', e);
      res.status(500).json({ error: 'Failed to submit review' });
    }
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
      const book = get<{ id: string }>('SELECT id FROM products WHERE slug = ?', [slug]);
      if (book) throw new HttpError(409, 'Another product already uses this profile link (slug).');
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

      const product = rowToFeed(get<any>('SELECT * FROM products WHERE id = ?', [id])!);
      res.status(201).json({ product });
    } catch (e: any) {
      if (e instanceof HttpError) { return res.status(e.status).json({ error: e.message }); }
      else { console.error(e); res.status(500).json({ error: 'Failed to create product' }); }
    }
  });

  // PUT /api/products/:id — update existing product (ADMIN/MANAGER)
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const user = await authMiddleware(req as any);
      requireRole(user, 'ADMIN', 'MANAGER');

      const id = req.params.id;
      const existing = get<any>('SELECT * FROM products WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Product not found' });

      const result = CreateProductSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      const d = result.data;

      // Slug conflict check: another product already owns this slug → 409
      const slug = d.slug ?? existing.slug;
      const slugOwner = get<{ id: string }>('SELECT id FROM products WHERE slug = ? AND id != ?', [slug, id]);
      if (slugOwner) return res.status(409).json({ error: 'Another product already uses this profile link (slug).' });

      const cat = get<{ name: string }>('SELECT name FROM categories WHERE id = ?', [d.categoryId]);
      const categoryName = cat?.name ?? existing.category_name;
      const now = new Date().toISOString();

      run(`
        UPDATE products SET
          name=?, slug=?, tagline=?, description=?, price=?, compare_at_price=?, sku=?,
          stock=?, category_id=?, category_name=?, images=?, variants=?, status=?,
          is_featured=?, is_best_seller=?, is_trending=?, materials=?, updated_at=?
        WHERE id=?
      `, [
        d.name, slug, d.tagline ?? existing.tagline, d.description ?? existing.description,
        d.price, d.compareAtPrice ?? existing.compare_at_price, d.sku ?? existing.sku,
        d.stock ?? existing.stock, d.categoryId, categoryName, JSON.stringify(d.images ?? JSON.parse(existing.images || '[]')),
        JSON.stringify(d.variants ?? JSON.parse(existing.variants || '[]')), d.status ?? existing.status,
        d.isFeatured ? 1 : 0, d.isBestSeller ? 1 : 0, d.isTrending ? 1 : 0,
        JSON.stringify(d.materials ?? JSON.parse(existing.materials || '[]')), now, id,
      ]);

      res.json({ product: rowToFeed(get<any>('SELECT * FROM products WHERE id = ?', [id])!) });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Failed to update product' });
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
