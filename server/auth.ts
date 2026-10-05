import * as jose from 'jose';
import { upsertUser } from './db.js';

// Fetch Google public keys for Firebase ID token verification
const JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/robot/v1/metadata/google_id_tokens/jwks')
);

// Cache for verified tokens (5 min TTL)
const tokenCache = new Map<string, { payload: jose.JWTPayload; exp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// ADMIN_EMAILS from env — these emails get ADMIN role server-side
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'ynab2025@gmail.com,admin@nexora.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'MANAGER' | 'ADMIN';
}

/** HTTP error with a status, thrown by auth guards and caught in route handlers */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export async function verifyIdToken(token: string): Promise<AuthUser | null> {
  if (!token || token === 'demo') return null; // demo mode = anonymous access

  try {
    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && cached.exp > Date.now()) {
      return payloadToUser(cached.payload);
    }

    const { payload } = await jose.jwtVerify(token, JWKS, { algorithms: ['RS256'] });

    const exp = (payload.exp ?? 0) * 1000;
    tokenCache.set(token, { payload, exp });

    return payloadToUser(payload);
  } catch {
    return null;
  }
}

function payloadToUser(payload: jose.JWTPayload): AuthUser {
  const email = (payload.email as string | undefined) ?? '';
  const normalizedEmail = email.toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);

  return {
    uid: payload.sub as string,
    email,
    name: (payload.name as string | undefined) ?? 'Distinguished Collector',
    role: isAdmin ? 'ADMIN' : 'CUSTOMER',
  };
}

/**
 * Reads the Firebase ID token from an Express request and returns the
 * verified user (role determined server-side). Throws HttpError on failure.
 */
export async function authMiddleware(
  req: { headers?: Record<string, string | string[] | undefined> },
  opts: { optional?: boolean } = {}
): Promise<AuthUser | null> {
  const authHeader = (req.headers?.authorization as string) ?? (req.headers?.Authorization as string) ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    if (opts.optional) return null;
    throw new HttpError(401, 'Authentication required.');
  }

  // Demo bypass: allow 'demo' token for local testing without Firebase
  if (token === 'demo') {
    return { uid: 'demo', email: 'demo@nexora.local', name: 'Demo User', role: 'ADMIN' };
  }

  const user = await verifyIdToken(token);
  if (!user) {
    if (opts.optional) return null;
    throw new HttpError(401, 'Invalid or expired token.');
  }

  // Upsert user in our DB with server-determined role
  await upsertUser(user.uid, user.email, user.name, user.role);

  return user;
}

export function requireRole(user: AuthUser | null, ...roles: AuthUser['role'][]): void {
  if (!user) throw new HttpError(401, 'Authentication required.');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions.');
}
