import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;
let adminToken = '';
let customerToken = '';

beforeAll(async () => {
  // Isolated in-memory DB for the whole suite (db.ts reads this at import time)
  process.env.NEXORA_DB = ':memory:';
  process.env.JWT_SECRET = 'test-secret';
  // Reset module registry so db.ts initializes against the in-memory DB
  vi.resetModules();
  const { createApp } = await import('../../server');
  app = await createApp();
});

afterAll(async () => {
  // release the sqlite handle
  const dbMod = await import('../db');
  (dbMod as any)?.db?.close?.();
});

describe('Auth — register / login / logout', () => {
  it('registers a new account and returns a session token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nada Q', email: 'nada@test.com', password: 'Sup3rSecret!' })
      .expect(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Duplicate', email: 'nada@test.com', password: 'Sup3rSecret!' })
      .expect(409);
    expect(res.body.error).toContain('already exists');
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexora.com', password: 'nexora2026' })
      .expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('ADMIN');
    adminToken = res.body.token;
  });

  it('logs in seeded customer with default credential', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@nexora.com', password: 'nexora2026' })
      .expect(200);
    customerToken = res.body.token;
  });

  it('rejects wrong password with generic 401 (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexora.com', password: 'nope' })
      .expect(401);
    expect(res.body.error).toBe('Incorrect email or password.');
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@nowhere.com', password: 'whatever' })
      .expect(401);
    expect(res.body.error).toBe('Incorrect email or password.');
  });

  it('requires password min 8 chars on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Shorty', email: 'short@test.com', password: '1234567' })
      .expect(400);
  });

  it('logout succeeds', async () => {
    const res = await request(app).post('/api/auth/logout').expect(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Session / me', () => {
  it('returns 401 without a token', async () => {
    await request(app).get('/api/users/me').expect(401);
  });

  it('returns the user for a valid admin token', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.user.email).toBe('admin@nexora.com');
    expect(res.body.user.password_hash).toBeUndefined();
  });
});

describe('RBAC enforcement', () => {
  it('guest cannot create a product (401)', async () => {
    await request(app).post('/api/products').send({ name: 'X', price: 1 }).expect(401);
  });

  it('customer cannot create a product (403)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'X', price: 1, categoryId: 'cat_timepieces' })
      .expect(403);
  });

  it('guest cannot access admin analytics (401)', async () => {
    await request(app).get('/api/users/analytics').expect(401);
  });

  it('customer cannot access admin users list (403)', async () => {
    await request(app).get('/api/users').set('Authorization', `Bearer ${customerToken}`).expect(403);
  });
});

describe('Product CRUD (admin)', () => {
  let productId = '';

  it('creates a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Aurum Chronograph',
        slug: 'aurum-chronograph',
        tagline: 'Hand-finished 316L steel chronograph',
        description: 'A test product created by the integration suite.',
        price: 1490,
        sku: 'NX-AURUM001',
        stock: 8,
        categoryId: 'cat_timepieces',
      })
      .expect(201);
    expect(res.body.product.name).toBe('Aurum Chronograph');
    expect(res.body.product.images).toEqual([]);
    productId = res.body.product.id;
  });

  it('fetches a product by slug', async () => {
    const res = await request(app).get('/api/products/aurum-chronograph').expect(200);
    expect(res.body.product.price).toBe(1490);
  });

  it('updates a product (name + price) via PUT', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Aurum Chronograph II',
        slug: 'aurum-chronograph-ii',
        price: 1590,
        categoryId: 'cat_timepieces',
      })
      .expect(200);
    expect(res.body.product.name).toBe('Aurum Chronograph II');
    expect(res.body.product.slug).toBe('aurum-chronograph-ii');
  });

  it('returns 409 when updating a slug that another product owns', async () => {
    // Create a separate product 'Owner' that owns slug 'aurum-chronograph-ii'
    const owner = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Slug Owner', slug: 'slug-owner-one', price: 10, categoryId: 'cat_timepieces' })
      .expect(201);
    // Now try to take over productId's slug... they need to differ. Instead:
    // create productId's neighbor claiming the SAME slug via update → conflict.
    const res = await request(app)
      .put(`/api/products/${owner.body.product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Slug Owner', slug: 'aurum-chronograph-ii', price: 10, categoryId: 'cat_timepieces' })
      .expect(409);
    expect(res.body.error).toContain('already uses');
  });

  it('returns 409 when POST creates a duplicate slug', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dupe', slug: 'aurum-chronograph-ii', price: 5, categoryId: 'cat_timepieces' })
      .expect(409);
    expect(res.body.error).toContain('already uses');
  });

  it('deletes a product', async () => {
    await request(app)
      .delete(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});

describe('Public catalog', () => {
  it('lists products without auth', async () => {
    const res = await request(app).get('/api/products?limit=5').expect(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('404 for unknown product', async () => {
    await request(app).get('/api/products/no-such-product').expect(404);
  });
});

describe('Newsletter', () => {
  it('subscribes an email (201)', async () => {
    const res = await request(app)
      .post('/api/newsletter')
      .send({ email: 'collector@nexora.test', locale: 'en' })
      .expect(201);
    expect(res.body.success).toBe(true);
  });

  it('dedupes an existing email (200, already)', async () => {
    const res = await request(app)
      .post('/api/newsletter')
      .send({ email: 'collector@nexora.test', locale: 'en' })
      .expect(200);
    expect(res.body.already).toBe(true);
  });

  it('rejects an invalid email (400)', async () => {
    await request(app).post('/api/newsletter').send({ email: 'not-an-email' }).expect(400);
  });

  it('admin can list subscribers; guest cannot', async () => {
    await request(app).get('/api/newsletter').expect(401);
    const res = await request(app)
      .get('/api/newsletter')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.subscribers.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Reviews', () => {
  it('creates a guest review and updates product rating', async () => {
    // Need a product to review
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reveal Watch', slug: 'reveal-watch', price: 700, categoryId: 'cat_timepieces' })
      .expect(201);
    const slug = created.body.product.slug;

    const res = await request(app)
      .post(`/api/products/${slug}/reviews`)
      .send({ rating: 5, title: 'Stunning', comment: 'A masterpiece of horology.', userName: 'QA' })
      .expect(201);
    expect(res.body.review.userName).toBe('QA');

    const detail = await request(app).get(`/api/products/${slug}`).expect(200);
    expect(detail.body.product.reviewsCount).toBe(1);
    expect(detail.body.product.rating).toBe(5);

    const list = await request(app).get(`/api/products/${slug}/reviews`).expect(200);
    expect(list.body.reviews.length).toBe(1);
  });

  it('rejects a review with an invalid rating', async () => {
    const res = await request(app)
      .post('/api/products/reveal-watch/reviews')
      .send({ rating: 9, title: 'x', comment: 'y' })
      .expect(400);
  });
});

describe('Analytics (real, not fake)', () => {
  it('guest is blocked', async () => {
    await request(app).get('/api/users/analytics').expect(401);
  });

  it('admin gets real numbers from DB', async () => {
    const res = await request(app)
      .get('/api/users/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(Array.isArray(res.body.revenueByDay)).toBe(true);
    expect(res.body.revenueByDay.length).toBe(7);
    // No more fabricated constants
    expect(res.body.revenueChangePercent).not.toBe(18.4);
  });
});
