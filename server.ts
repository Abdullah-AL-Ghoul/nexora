import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google GenAI client (reads GEMINI_API_KEY from env automatically)
const ai = new GoogleGenAI();

// --- Authoritative Health Check ---
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NEXORA Platform API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// --- Real-Time Market Intelligence & Search Grounding (gemini-3.5-flash with googleSearch) ---
app.post('/api/market-intelligence', async (req: Request, res: Response) => {
  try {
    const { query: userQuery, productContext } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const prompt = `User Query: "${userQuery}"
${productContext ? `Product Context: ${JSON.stringify(productContext)}` : ''}

Please analyze and provide live, grounded luxury market intelligence, historical auction references, recent price benchmarks, or horological provenance for this artifact.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are the NEXORA Atelier Market Intelligence and Horological Provenance Advisor.
You provide collectors and clients with live, verified real-world market intelligence, Swiss watch auction indices, precious material spot valuations (e.g. titanium, 316L, 18k gold), and provenance data.
Always ground your answers using Google Search. Keep the tone sophisticated, authoritative, and concise. Highlight real-world verified figures.`,
      },
    });

    const text = response.text;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    res.json({
      success: true,
      text,
      groundingMetadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Market Intelligence Search Grounding error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to retrieve market intelligence data',
    });
  }
});

// --- Checkout Intent (Stripe Test Mode) ---
app.post('/api/checkout/create-intent', (req: Request, res: Response) => {
  const { amount, currency = 'usd', customerEmail } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid checkout amount' });
  }

  // Simulate or execute verified Stripe test payment intent
  const clientSecret = `pi_test_${Date.now().toString(36)}_secret_${Math.random().toString(36).slice(2, 8)}`;

  res.json({
    clientSecret,
    paymentIntentId: `pi_test_${Date.now().toString(36)}`,
    amount,
    currency,
    mode: 'test',
    customerEmail,
  });
});

// --- Vite Middleware Integration ---
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
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
