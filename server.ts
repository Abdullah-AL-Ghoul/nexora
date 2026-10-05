import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '100kb' }));

// Rate limiting (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  rateLimitMap.set(key, entry);
  return entry.count > limit;
}

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── Existing endpoints ───────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok', service: 'NEXORA Platform API',
    timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development',
  });
});

app.post('/api/market-intelligence', async (req: Request, res: Response) => {
  if (rateLimit(req.ip ?? 'unknown', 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  try {
    const { query: userQuery, productContext } = req.body;
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    if (userQuery.length > 1000) {
      return res.status(400).json({ error: 'Query too long (max 1000 characters).' });
    }
    const prompt = `User Query: "${userQuery}"\n${productContext ? `Product Context: ${JSON.stringify(productContext)}` : ''}\n\nPlease analyze and provide live, grounded luxury market intelligence, historical auction references, recent price benchmarks, or horological provenance for this artifact.`;
    const ai = new GoogleGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash', contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are the NEXORA Atelier Market Intelligence and Horological Provenance Advisor. You provide collectors and clients with live, verified real-world market intelligence, Swiss watch auction indices, precious material spot valuations (e.g. titanium, 316L, 18k gold), and provenance data. Always ground your answers using Google Search. Keep the tone sophisticated, authoritative, and concise. Highlight real-world verified figures.`,
      },
    });
    res.json({
      success: true,
      text: response.text ?? '',
      groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Market Intelligence error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to retrieve market intelligence data' });
  }
});

app.post('/api/checkout/create-intent', (req: Request, res: Response) => {
  const { amount, currency = 'usd', customerEmail } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid checkout amount' });
  const clientSecret = `pi_test_${Date.now().toString(36)}_secret_${Math.random().toString(36).slice(2, 8)}`;
  res.json({ clientSecret, paymentIntentId: `pi_test_${Date.now().toString(36)}`, amount, currency, mode: 'test', customerEmail });
});

// ─── New API Routes ──────────────────────────────────────────────────────────

async function registerRoutes() {
  const [productsRouter, ordersRouter, categoriesRouter, couponsRouter, inventoryRouter, usersRouter] = await Promise.all([
    import('./server/routes/products.js'),
    import('./server/routes/orders.js'),
    import('./server/routes/categories.js'),
    import('./server/routes/coupons.js'),
    import('./server/routes/inventory.js'),
    import('./server/routes/users.js'),
  ]);

  app.use('/api/products', productsRouter.productsRouter());
  app.use('/api/orders', ordersRouter.ordersRouter());
  app.use('/api/categories', categoriesRouter.categoriesRouter());
  app.use('/api/coupons', couponsRouter.couponsRouter());
  app.use('/api/inventory', inventoryRouter.inventoryRouter());
  app.use('/api/users', usersRouter.usersRouter());

  // Seed endpoint
  const { seedProducts } = await import('./server/routes/seed.js');
  app.post('/api/seed', seedProducts);
}

registerRoutes().catch((err) => {
  console.error('Failed to register routes:', err);
  process.exit(1);
});

// ─── Vite + Server Start ────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXORA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
