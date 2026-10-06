import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { hashPassword } from './password.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', '.data');
mkdirSync(DB_DIR, { recursive: true });

// Allow tests to point at an isolated DB (e.g. NEXORA_DB=/tmp/test.sqlite or :memory:)
const DB_PATH = process.env.NEXORA_DB === ':memory:' ? ':memory:' : resolve(process.env.NEXORA_DB ?? join(DB_DIR, 'nexora.sqlite'));
if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// Enable WAL + FK via exec (synchronous). WAL is file-backed; the in-memory
// DB (used by tests) inherently uses memory journaling.
db.exec('PRAGMA foreign_keys=ON;');
if (DB_PATH !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');

// ─── Thin wrappers matching the better-sqlite3 / promise-sqlite API ────────────

/** Execute SQL and return all rows */
export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return (db.prepare(sql) as any).all(...params) as T[];
}

/** Execute SQL and return the first row */
export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return (db.prepare(sql) as any).get(...params) as T | undefined;
}

/** Execute SQL (INSERT/UPDATE/DELETE) and return { changes, lastInsertRowid } */
export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
  return (db.prepare(sql) as any).run(...params);
}

// ─── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'CUSTOMER',
  phone          TEXT,
  avatar         TEXT,
  password_hash  TEXT,
  auth_provider  TEXT NOT NULL DEFAULT 'local',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  item_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  tagline          TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  price            REAL NOT NULL,
  compare_at_price REAL,
  sku              TEXT UNIQUE NOT NULL,
  stock            INTEGER NOT NULL DEFAULT 0,
  category_id      TEXT NOT NULL,
  category_name    TEXT NOT NULL,
  images           TEXT NOT NULL DEFAULT '[]',
  variants         TEXT NOT NULL DEFAULT '[]',
  rating           REAL NOT NULL DEFAULT 5.0,
  reviews_count    INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  is_featured      INTEGER NOT NULL DEFAULT 0,
  is_best_seller   INTEGER NOT NULL DEFAULT 0,
  is_trending      INTEGER NOT NULL DEFAULT 0,
  materials        TEXT NOT NULL DEFAULT '[]',
  dimensions       TEXT,
  weight           TEXT,
  origin           TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                       TEXT PRIMARY KEY,
  order_number             TEXT UNIQUE NOT NULL,
  user_id                  TEXT NOT NULL,
  customer_name            TEXT NOT NULL,
  customer_email           TEXT NOT NULL,
  subtotal                 REAL NOT NULL,
  discount                 REAL NOT NULL DEFAULT 0,
  shipping                 REAL NOT NULL DEFAULT 0,
  tax                      REAL NOT NULL DEFAULT 0,
  total                    REAL NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'PENDING',
  payment_status           TEXT NOT NULL DEFAULT 'PENDING',
  payment_method           TEXT NOT NULL DEFAULT '',
  stripe_payment_intent_id TEXT,
  shipping_address         TEXT NOT NULL DEFAULT '{}',
  tracking_number          TEXT,
  shipping_carrier         TEXT,
  notes                    TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  product_image TEXT NOT NULL DEFAULT '',
  sku           TEXT NOT NULL,
  variant_name  TEXT,
  unit_price    REAL NOT NULL,
  quantity      INTEGER NOT NULL,
  total_price   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  id               TEXT PRIMARY KEY,
  code             TEXT UNIQUE NOT NULL,
  type             TEXT NOT NULL,
  value            REAL NOT NULL,
  min_order_amount REAL,
  max_discount     REAL,
  starts_at        TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  usage_limit      INTEGER NOT NULL DEFAULT 1,
  usage_count      INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1,
  description      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reviews (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT NOT NULL,
  user_id              TEXT NOT NULL,
  user_name            TEXT NOT NULL,
  user_avatar          TEXT,
  rating               INTEGER NOT NULL,
  title                TEXT NOT NULL DEFAULT '',
  comment              TEXT NOT NULL DEFAULT '',
  is_verified_purchase INTEGER NOT NULL DEFAULT 0,
  is_approved          INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku          TEXT NOT NULL,
  variant_id   TEXT,
  type         TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  stock_after  INTEGER NOT NULL,
  reason       TEXT NOT NULL DEFAULT '',
  performed_by TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'ar',
  source     TEXT NOT NULL DEFAULT 'footer',
  created_at TEXT NOT NULL
);
`);

// ─── Migration: add auth columns to users (idempotent) ────────────────────────
function ensureUsersColumn(name: string, ddl: string) {
  const cols = (db.prepare('PRAGMA table_info(users)') as any).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
}
ensureUsersColumn('password_hash', 'password_hash TEXT');
ensureUsersColumn('auth_provider', "auth_provider TEXT NOT NULL DEFAULT 'local'");

// ─── Seed ─────────────────────────────────────────────────────────────────────

function seed() {
  const existing = get<{ c: number }>('SELECT COUNT(*) as c FROM users');
  if (existing && existing.c > 0) return;

  const now = new Date().toISOString();

  const users = [
    { id: 'user_admin_01', email: 'admin@nexora.com', name: 'Julian Vance', role: 'ADMIN', phone: '+1 (555) 890-2341', avatar: '/img/nx-1534528741775-53994a69daeb.jpg', created_at: '2026-01-15T09:00:00Z' },
    { id: 'user_manager_01', email: 'manager@nexora.com', name: 'Elena Rostova', role: 'MANAGER', phone: '+1 (555) 732-9102', avatar: '/img/nx-1580489944761-15a19d654956.jpg', created_at: '2026-02-01T11:30:00Z' },
    { id: 'user_customer_01', email: 'customer@nexora.com', name: 'Alexander Hayes', role: 'CUSTOMER', phone: '+1 (555) 419-8803', avatar: '/img/nx-1507003211169-0a1dd7228f2d.jpg', created_at: '2026-02-14T14:20:00Z' },
  ];
  const defaultPassword = hashPassword(process.env.SEED_USER_PASSWORD ?? 'nexora2026');
  for (const u of users) {
    run('INSERT OR IGNORE INTO users (id,email,name,role,phone,avatar,password_hash,auth_provider,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [u.id, u.email, u.name, u.role, u.phone, u.avatar, defaultPassword, 'local', u.created_at]);
  }

  const categories = [
    { id: 'cat_timepieces', name: 'Timepieces', slug: 'timepieces', description: 'Mechanical precision, sapphire crystals, and horological craftsmanship.', image_url: '/img/nx-1522335789203-aabd1fc54bc9.jpg', item_count: 6 },
    { id: 'cat_audio', name: 'Audio Engineering', slug: 'audio-engineering', description: 'Acoustic fidelity, beryllium drivers, and machined aluminum enclosures.', image_url: '/img/nx-1546435770-a3e426bf472b.jpg', item_count: 6 },
    { id: 'cat_leather', name: 'Minimalist Leather', slug: 'minimalist-leather', description: 'Full-grain vegetable-tanned hides, hand-burnished edges, and durable brass.', image_url: '/img/nx-1548036328-c9fa89d128fa.jpg', item_count: 6 },
    { id: 'cat_workspace', name: 'Architectural Workspace', slug: 'architectural-workspace', description: 'Solid walnut, anodized aluminum, and ergonomic desktop essentials.', image_url: '/img/nx-1527443224154-c4a3942d3acf.jpg', item_count: 6 },
    { id: 'cat_optics', name: 'Modern Optics', slug: 'modern-optics', description: 'Japanese titanium frames, Carl Zeiss polarized lenses, and architectural silhouettes.', image_url: '/img/nx-1511499767150-a48a237f0083.jpg', item_count: 6 },
    { id: 'cat_apparel', name: 'Technical Apparel', slug: 'technical-apparel', description: 'Merino wool, weather-resistant membranes, and ergonomic tailored cuts.', image_url: '/img/nx-1489987707025-afc232f7ea0f.jpg', item_count: 6 },
    { id: 'cat_accessories', name: 'Fine Accessories', slug: 'fine-accessories', description: 'Machined pens, geometric cufflinks, and everyday titanium carry.', image_url: '/img/nx-1617038260897-41a1f14a8ca0.jpg', item_count: 6 },
    { id: 'cat_art', name: 'Objects of Art', slug: 'objects-of-art', description: 'Cast bronze, ceramic vessels, and minimalist sculptural accents.', image_url: '/img/nx-1579783900882-c0d3dad7b119.jpg', item_count: 6 },
  ];
  for (const c of categories) {
    run('INSERT OR IGNORE INTO categories (id,name,slug,description,image_url,item_count) VALUES (?,?,?,?,?,?)',
      [c.id, c.name, c.slug, c.description, c.image_url, c.item_count]);
  }

  const coupons = [
    { id: 'cp_01', code: 'NEXORA10', type: 'PERCENTAGE', value: 10, min_order_amount: 100, max_discount: null, starts_at: '2025-01-01T00:00:00Z', expires_at: '2027-12-31T23:59:59Z', usage_limit: 999, usage_count: 0, is_active: 1, description: '10% off your order' },
    { id: 'cp_02', code: 'PRECISION50', type: 'FIXED', value: 50, min_order_amount: 250, max_discount: null, starts_at: '2025-01-01T00:00:00Z', expires_at: '2027-12-31T23:59:59Z', usage_limit: 5, usage_count: 0, is_active: 1, description: '$50 off orders over $250' },
    { id: 'cp_03', code: 'VIP20', type: 'PERCENTAGE', value: 20, min_order_amount: null, max_discount: 200, starts_at: '2025-01-01T00:00:00Z', expires_at: '2027-12-31T23:59:59Z', usage_limit: 999, usage_count: 0, is_active: 1, description: '20% off for VIP members' },
  ];
  for (const c of coupons) {
    run('INSERT OR IGNORE INTO coupons (id,code,type,value,min_order_amount,max_discount,starts_at,expires_at,usage_limit,usage_count,is_active,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.id, c.code, c.type, c.value, c.min_order_amount ?? null, c.max_discount ?? null, c.starts_at, c.expires_at, c.usage_limit, c.usage_count, c.is_active, c.description]);
  }
}

seed();

// ─── Ensure seeded demo accounts have a passable credential (live DB was seeded
//     before password support; new installs get it from seed()) ───────────────
function ensureSeedPasswords() {
  const emails = ['admin@nexora.com', 'manager@nexora.com', 'customer@nexora.com'];
  const defaultPassword = process.env.SEED_USER_PASSWORD ?? 'nexora2026';
  for (const email of emails) {
    const existing = getUserByEmail(email);
    if (existing && !existing.password_hash) {
      run('UPDATE users SET password_hash = ?, auth_provider = ? WHERE email = ?',
        [hashPassword(defaultPassword), 'local', email]);
    }
  }
}
ensureSeedPasswords();

export interface DbUser {
  id: string; email: string; name: string; role: string; phone: string | null;
  avatar: string | null; password_hash: string | null; auth_provider: string;
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
  run('INSERT INTO users (id,email,name,role,auth_provider,created_at) VALUES (?,?,?,?,?,?)',
    [id, email, name, role, 'firebase', new Date().toISOString()]);
  return getUserByEmail(email)!;
}
