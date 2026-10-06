import * as jose from 'jose';
import { getUserById, upsertUser } from './db.js';

// Firebase ID token verification (Google public keys) — secondary path
const JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/robot/v1/metadata/google_id_tokens/jwks')
);

// Cache for verified Firebase tokens (5 min TTL)
const tokenCache = new Map<string, { payload: jose.JWTPayload; exp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// ADMIN_EMAILS from env — these emails get ADMIN role server-side
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'ynab2025@gmail.com,admin@nexora.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Local session JWT — signed HS256 with a server-side secret
const JWT_SECRET = process.env.JWT_SECRET ?? 'nexora-dev-only-secret-change-me';
const LOCAL_ISSUER = 'nexora-auth';
const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days

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

// ─── Local (email/password) sessions ──────────────────────────────────────────

export async function signLocalToken(user: {
  id: string; email: string; name: string; role: string;
}): Promise<string> {
  return new jose.SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(LOCAL_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(new TextEncoder().encode(JWT_SECRET));
}

/** Verify a local HS256 session token; returns the DB-backed user or null. */
async function verifyLocalToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {
      issuer: LOCAL_ISSUER,
      algorithms: ['HS256'],
    });
    const uid = payload.sub as string;
    const dbUser = uid ? getUserById(uid) : undefined;
    if (!dbUser) return null;
    return {
      uid: dbUser.id,
      email: dbUser.email,
      name: dbUser.name || 'Distinguished Collector',
      role: dbUser.role as AuthUser['role'],
    };
  } catch {
    return null;
  }
}

// ─── Firebase ID token verification (secondary path) ─────────────────────────

export async function verifyIdToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
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
 * Reads the bearer token from an Express request and returns the verified user
 * (role determined server-side). Tries the local session JWT first, then the
 * Firebase ID token. A missing/invalid token means *guest*. Throws on failure.
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

  // Local session JWT first (fast, no network)
  const local = await verifyLocalToken(token);
  if (local) return local;

  // Firebase (Google) ID token second
  const firebaseUser = await verifyIdToken(token);
  if (firebaseUser) {
    // Keep our DB in sync with the server-determined role (no password set)
    upsertUser(firebaseUser.uid, firebaseUser.email, firebaseUser.name, firebaseUser.role);
    return firebaseUser;
  }

  if (opts.optional) return null;
  throw new HttpError(401, 'Invalid or expired token.');
}

export function requireRole(user: AuthUser | null, ...roles: AuthUser['role'][]): void {
  if (!user) throw new HttpError(401, 'Authentication required.');
  if (!roles.includes(user.role)) throw new HttpError(403, 'Insufficient permissions.');
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
