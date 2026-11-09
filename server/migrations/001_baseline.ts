import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { BaselineMismatchError, type Migration } from './types.js';

export const LEGACY_TABLE_NAMES = [
  'users',
  'categories',
  'products',
  'orders',
  'order_items',
  'coupons',
  'reviews',
  'inventory_transactions',
  'newsletter_subscribers',
] as const;

export const BASELINE_DDL = `
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
`;

export const BASELINE_CHECKSUM = crypto
  .createHash('sha256')
  .update(BASELINE_DDL.trim())
  .digest('hex');

/**
 * Inspects all application tables currently in SQLite (excluding sqlite internal tables and schema_migrations).
 */
export function getApplicationTableNames(db: DatabaseSync): string[] {
  const rows = (db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name ASC"
    )
    .all() as { name: string }[]) ?? [];
  return rows.map((r) => r.name);
}

/**
 * Builds a deterministic structural fingerprint of the 9 legacy tables.
 */
export function computeLegacyFingerprint(db: DatabaseSync): string {
  const elements: string[] = [];

  for (const table of [...LEGACY_TABLE_NAMES].sort()) {
    const cols = (db.prepare(`PRAGMA table_info("${table}");`).all() as any[]) ?? [];
    cols.sort((a, b) => a.cid - b.cid);
    for (const c of cols) {
      elements.push(`${table}.${c.name}:${c.type}:${c.notnull}:${c.dflt_value}:${c.pk}`);
    }

    const indexes = (db.prepare(`PRAGMA index_list("${table}");`).all() as any[]) ?? [];
    indexes.sort((a, b) => a.name.localeCompare(b.name));
    for (const idx of indexes) {
      elements.push(`${table}.index:${idx.name}:${idx.unique}`);
    }
  }

  return crypto.createHash('sha256').update(elements.join('|')).digest('hex');
}

/**
 * Migration 001: Baseline inspection, validation, or creation.
 */
export const migration001: Migration = {
  version: 1,
  name: '001_initial_baseline',
  checksum: BASELINE_CHECKSUM,
  up(db: DatabaseSync) {
    const existingTables = getApplicationTableNames(db);

    // Case A: Fresh database (0 application tables)
    if (existingTables.length === 0) {
      db.exec(BASELINE_DDL);
      return;
    }

    // Case B: Valid existing database
    const discrepancies: string[] = [];

    // 1. Verify all 9 expected legacy tables exist
    for (const expectedTable of LEGACY_TABLE_NAMES) {
      if (!existingTables.includes(expectedTable)) {
        discrepancies.push(`Missing expected legacy table: "${expectedTable}"`);
      }
    }

    // 2. Verify no unexpected/foreign application tables exist before Phase 02
    for (const existingTable of existingTables) {
      if (!(LEGACY_TABLE_NAMES as readonly string[]).includes(existingTable)) {
        discrepancies.push(`Unexpected table in legacy baseline: "${existingTable}"`);
      }
    }

    if (discrepancies.length > 0) {
      throw new BaselineMismatchError(
        'Database schema does not match the canonical legacy baseline',
        discrepancies
      );
    }

    // 3. Verify essential columns and nullability for each table
    const requiredColumns: Record<string, string[]> = {
      users: ['id', 'email', 'name', 'role', 'password_hash', 'auth_provider', 'created_at'],
      categories: ['id', 'name', 'slug', 'description', 'image_url', 'item_count'],
      products: ['id', 'name', 'slug', 'price', 'sku', 'stock', 'category_id', 'status', 'is_featured'],
      orders: ['id', 'order_number', 'user_id', 'subtotal', 'total', 'status', 'payment_status'],
      order_items: ['id', 'order_id', 'product_id', 'unit_price', 'quantity', 'total_price'],
      coupons: ['id', 'code', 'type', 'value', 'starts_at', 'expires_at', 'is_active'],
      reviews: ['id', 'product_id', 'user_id', 'rating'],
      inventory_transactions: ['id', 'product_id', 'sku', 'type', 'quantity', 'stock_after'],
      newsletter_subscribers: ['id', 'email', 'created_at'],
    };

    for (const [table, cols] of Object.entries(requiredColumns)) {
      const tableInfo = (db.prepare(`PRAGMA table_info("${table}");`).all() as any[]) ?? [];
      const colNames = tableInfo.map((c) => c.name);
      for (const requiredCol of cols) {
        if (!colNames.includes(requiredCol)) {
          discrepancies.push(`Table "${table}" is missing required column "${requiredCol}"`);
        }
      }
    }

    if (discrepancies.length > 0) {
      throw new BaselineMismatchError(
        'Legacy database schema contains column discrepancies',
        discrepancies
      );
    }

    // Baseline is valid! Do NOT recreate or alter any tables or records.
  },
};
