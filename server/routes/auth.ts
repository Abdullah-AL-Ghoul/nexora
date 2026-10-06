import type { Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { run, getUserByEmail, getUserById, DbUser } from '../db.js';
import { hashPassword, verifyPassword } from '../password.js';
import { signLocalToken, HttpError, isAdminEmail } from '../auth.js';

const RegisterSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

const LoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

function toPublicUser(u: DbUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    phone: u.phone,
    avatar: u.avatar,
    createdAt: u.created_at,
  };
}

export function authRouter() {
  const router = express.Router();

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      const { name, email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase();

      if (getUserByEmail(normalizedEmail)) {
        throw new HttpError(409, 'An account with this email already exists.');
      }

      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const role = isAdminEmail(normalizedEmail) ? 'ADMIN' : 'CUSTOMER';

      run(
        'INSERT INTO users (id,email,name,role,password_hash,auth_provider,created_at) VALUES (?,?,?,?,?,?,?)',
        [id, normalizedEmail, name, role, hashPassword(password), 'local', new Date().toISOString()]
      );

      const user = getUserById(id)!;
      const token = await signLocalToken(user);
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('register error:', e);
      res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;
      const user = getUserByEmail(email.toLowerCase());

      // Same message for unknown email vs wrong password (no account enumeration)
      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        throw new HttpError(401, 'Incorrect email or password.');
      }

      const token = await signLocalToken(user);
      res.json({ token, user: toPublicUser(user) });
    } catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error('login error:', e);
      res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  // POST /api/auth/logout — stateless JWT: the client discards the token.
  router.post('/logout', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  return router;
}
