import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { hashPassword } from './password.js';
import { runMigrations } from './migrations/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', '.data');
mkdirSync(DB_DIR, { recursive: true });

// Allow tests to point at an isolated DB (e.g. NEXORA_DB=/tmp/test.sqlite or :memory:)
const DB_PATH =
  process.env.NEXORA_DB === ':memory:'
    ? ':memory:'
    : resolve(process.env.NEXORA_DB ?? join(DB_DIR, 'nexora.sqlite'));

if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// Enable WAL + FK via exec (synchronous). WAL is file-backed; the in-memory
// DB (used by tests) inherently uses memory journaling.
db.exec('PRAGMA foreign_keys=ON;');
if (DB_PATH !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');

// ─── Database Access Wrappers ────────────────────────────────────────────────

/** Execute SQL and return all rows */
export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return (db.prepare(sql) as any).all(...params) as T[];
}

/** Execute SQL and return the first row */
export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return (db.prepare(sql) as any).get(...params) as T | undefined;
}

/** Execute SQL (INSERT/UPDATE/DELETE) and return { changes, lastInsertRowid } */
export function run(
  sql: string,
  params: unknown[] = []
): { changes: number; lastInsertRowid: number | bigint } {
  return (db.prepare(sql) as any).run(...params);
}

// ─── Asynchronous Controlled Bootstrap ───────────────────────────────────────

let initPromise: Promise<void> | null = null;

/**
 * Initializes the database safely:
 * 1. Executes versioned migrations (including baseline validation/creation & domain evolution).
 * 2. Seeds legacy defaults only for fresh databases (users count is 0).
 * 3. Ensures seeded passwords are valid.
 *
 * Guaranteed to be called before Express begins accepting requests.
 */
export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Run versioned migrations safely
    await runMigrations(db);

    // 2. Legacy seed behavior for fresh dev/test databases (Zero fictional projects/certifications)
    seedLegacyDefaults();
    ensureSeedPasswords();
  })();

  return initPromise;
}

/**
 * Closes the database connection (primarily used for test teardown).
 */
export function closeDb(): void {
  try {
    db.close();
  } catch {
    // Ignore close errors
  }
}

// ─── Legacy Seed (Fresh Databases Only) ──────────────────────────────────────

function seedLegacyDefaults() {
  const existing = get<{ c: number }>('SELECT COUNT(*) as c FROM users');
  if (existing && existing.c > 0) return;

  const users = [
    {
      id: 'user_admin_01',
      email: 'admin@nexora.com',
      name: 'Julian Vance',
      role: 'ADMIN',
      phone: '+1 (555) 890-2341',
      avatar: '/img/nx-1534528741775-53994a69daeb.jpg',
      created_at: '2026-01-15T09:00:00Z',
    },
    {
      id: 'user_manager_01',
      email: 'manager@nexora.com',
      name: 'Elena Rostova',
      role: 'MANAGER',
      phone: '+1 (555) 732-9102',
      avatar: '/img/nx-1580489944761-15a19d654956.jpg',
      created_at: '2026-02-01T11:30:00Z',
    },
    {
      id: 'user_customer_01',
      email: 'customer@nexora.com',
      name: 'Alexander Hayes',
      role: 'CUSTOMER',
      phone: '+1 (555) 419-8803',
      avatar: '/img/nx-1507003211169-0a1dd7228f2d.jpg',
      created_at: '2026-02-14T14:20:00Z',
    },
  ];
  const defaultPassword = hashPassword(process.env.SEED_USER_PASSWORD ?? 'nexora2026');
  for (const u of users) {
    run(
      'INSERT OR IGNORE INTO users (id,email,name,role,phone,avatar,password_hash,auth_provider,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [u.id, u.email, u.name, u.role, u.phone, u.avatar, defaultPassword, 'local', u.created_at]
    );
  }

  const categories = [
    {
      id: 'cat_timepieces',
      name: 'Timepieces',
      slug: 'timepieces',
      description: 'Mechanical precision, sapphire crystals, and horological craftsmanship.',
      image_url: '/img/nx-1522335789203-aabd1fc54bc9.jpg',
      item_count: 6,
    },
    {
      id: 'cat_audio',
      name: 'Audio Engineering',
      slug: 'audio-engineering',
      description: 'Acoustic fidelity, beryllium drivers, and machined aluminum enclosures.',
      image_url: '/img/nx-1546435770-a3e426bf472b.jpg',
      item_count: 6,
    },
    {
      id: 'cat_leather',
      name: 'Minimalist Leather',
      slug: 'minimalist-leather',
      description: 'Full-grain vegetable-tanned hides, hand-burnished edges, and durable brass.',
      image_url: '/img/nx-1548036328-c9fa89d128fa.jpg',
      item_count: 6,
    },
    {
      id: 'cat_workspace',
      name: 'Architectural Workspace',
      slug: 'architectural-workspace',
      description: 'Solid walnut, anodized aluminum, and ergonomic desktop essentials.',
      image_url: '/img/nx-1527443224154-c4a3942d3acf.jpg',
      item_count: 6,
    },
    {
      id: 'cat_optics',
      name: 'Modern Optics',
      slug: 'modern-optics',
      description: 'Japanese titanium frames, Carl Zeiss polarized lenses, and architectural silhouettes.',
      image_url: '/img/nx-1511499767150-a48a237f0083.jpg',
      item_count: 6,
    },
    {
      id: 'cat_apparel',
      name: 'Technical Apparel',
      slug: 'technical-apparel',
      description: 'Merino wool, weather-resistant membranes, and ergonomic tailored cuts.',
      image_url: '/img/nx-1489987707025-afc232f7ea0f.jpg',
      item_count: 6,
    },
    {
      id: 'cat_accessories',
      name: 'Fine Accessories',
      slug: 'fine-accessories',
      description: 'Machined pens, geometric cufflinks, and everyday titanium carry.',
      image_url: '/img/nx-1617038260897-41a1f14a8ca0.jpg',
      item_count: 6,
    },
    {
      id: 'cat_art',
      name: 'Objects of Art',
      slug: 'objects-of-art',
      description: 'Cast bronze, ceramic vessels, and minimalist sculptural accents.',
      image_url: '/img/nx-1579783900882-c0d3dad7b119.jpg',
      item_count: 6,
    },
  ];
  for (const c of categories) {
    run(
      'INSERT OR IGNORE INTO categories (id,name,slug,description,image_url,item_count) VALUES (?,?,?,?,?,?)',
      [c.id, c.name, c.slug, c.description, c.image_url, c.item_count]
    );
  }

  const coupons = [
    {
      id: 'cp_01',
      code: 'NEXORA10',
      type: 'PERCENTAGE',
      value: 10,
      min_order_amount: 100,
      max_discount: null,
      starts_at: '2025-01-01T00:00:00Z',
      expires_at: '2027-12-31T23:59:59Z',
      usage_limit: 999,
      usage_count: 0,
      is_active: 1,
      description: '10% off your order',
    },
    {
      id: 'cp_02',
      code: 'PRECISION50',
      type: 'FIXED',
      value: 50,
      min_order_amount: 250,
      max_discount: null,
      starts_at: '2025-01-01T00:00:00Z',
      expires_at: '2027-12-31T23:59:59Z',
      usage_limit: 5,
      usage_count: 0,
      is_active: 1,
      description: '$50 off orders over $250',
    },
    {
      id: 'cp_03',
      code: 'VIP20',
      type: 'PERCENTAGE',
      value: 20,
      min_order_amount: null,
      max_discount: 200,
      starts_at: '2025-01-01T00:00:00Z',
      expires_at: '2027-12-31T23:59:59Z',
      usage_limit: 999,
      usage_count: 0,
      is_active: 1,
      description: '20% off for VIP members',
    },
  ];
  for (const c of coupons) {
    run(
      'INSERT OR IGNORE INTO coupons (id,code,type,value,min_order_amount,max_discount,starts_at,expires_at,usage_limit,usage_count,is_active,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        c.id,
        c.code,
        c.type,
        c.value,
        c.min_order_amount ?? null,
        c.max_discount ?? null,
        c.starts_at,
        c.expires_at,
        c.usage_limit,
        c.usage_count,
        c.is_active,
        c.description,
      ]
    );
  }
}

function ensureSeedPasswords() {
  const emails = ['admin@nexora.com', 'manager@nexora.com', 'customer@nexora.com'];
  const defaultPassword = process.env.SEED_USER_PASSWORD ?? 'nexora2026';
  for (const email of emails) {
    const existing = getUserByEmail(email);
    if (existing && !existing.password_hash) {
      run('UPDATE users SET password_hash = ?, auth_provider = ? WHERE email = ?', [
        hashPassword(defaultPassword),
        'local',
        email,
      ]);
    }
  }
}

export interface DbUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  password_hash: string | null;
  auth_provider: string;
  created_at: string;
}

export function getUserByEmail(email: string): DbUser | undefined {
  return get<DbUser>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
}

export function getUserById(id: string): DbUser | undefined {
  return get<DbUser>('SELECT * FROM users WHERE id = ?', [id]);
}

export function upsertUser(id: string, email: string, name: string, role: string) {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  run('INSERT INTO users (id,email,name,role,auth_provider,created_at) VALUES (?,?,?,?,?,?)', [
    id,
    email,
    name,
    role,
    'firebase',
    new Date().toISOString(),
  ]);
  return getUserByEmail(email)!;
}
