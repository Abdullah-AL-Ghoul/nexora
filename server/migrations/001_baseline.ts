import { DatabaseSync } from 'node:sqlite';
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

export interface NormalizedColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface NormalizedIndexInfo {
  name: string;
  unique: number;
  origin: string;
  columns: string[];
}

export interface NormalizedTableStructure {
  name: string;
  columns: NormalizedColumnInfo[];
  indexes: NormalizedIndexInfo[];
}

/**
 * Extracts and normalizes the structural metadata of a single table.
 */
export function extractTableStructure(db: DatabaseSync, tableName: string): NormalizedTableStructure {
  const cols = (db.prepare(`PRAGMA table_info("${tableName}");`).all() as any[]) ?? [];
  cols.sort((a, b) => a.cid - b.cid);
  const normalizedCols: NormalizedColumnInfo[] = cols.map((c) => ({
    cid: Number(c.cid),
    name: String(c.name),
    type: String(c.type || '').toUpperCase(),
    notnull: Number(c.notnull),
    dflt_value: c.dflt_value === null || c.dflt_value === undefined ? null : String(c.dflt_value),
    pk: Number(c.pk),
  }));

  const rawIndexes = (db.prepare(`PRAGMA index_list("${tableName}");`).all() as any[]) ?? [];
  const normalizedIndexes: NormalizedIndexInfo[] = rawIndexes.map((idx) => {
    const idxCols = (db.prepare(`PRAGMA index_info("${idx.name}");`).all() as any[]) ?? [];
    idxCols.sort((a, b) => a.seqno - b.seqno);
    return {
      name: idx.name.startsWith('sqlite_autoindex_') ? 'autoindex' : String(idx.name),
      unique: Number(idx.unique),
      origin: String(idx.origin),
      columns: idxCols.map((c) => String(c.name)),
    };
  });

  normalizedIndexes.sort((a, b) => {
    const colA = a.columns.join(',');
    const colB = b.columns.join(',');
    return colA.localeCompare(colB) || a.unique - b.unique;
  });

  return {
    name: tableName,
    columns: normalizedCols,
    indexes: normalizedIndexes,
  };
}

/**
 * Extracts normalized baseline structural metadata for all 9 legacy tables.
 */
export function extractBaselineStructure(db: DatabaseSync): NormalizedTableStructure[] {
  const list = [...LEGACY_TABLE_NAMES].sort();
  return list.map((t) => extractTableStructure(db, t));
}

/**
 * Computes a deterministic SHA-256 fingerprint from normalized structural metadata.
 */
export function computeStructureFingerprint(tables: NormalizedTableStructure[]): string {
  const serialized = JSON.stringify(tables);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

let cachedCanonicalStructure: NormalizedTableStructure[] | null = null;
let cachedCanonicalFingerprint: string | null = null;

/**
 * Generates the authoritative canonical baseline structure and fingerprint from BASELINE_DDL.
 */
export function getCanonicalBaseline(): {
  structure: NormalizedTableStructure[];
  fingerprint: string;
} {
  if (cachedCanonicalStructure && cachedCanonicalFingerprint) {
    return { structure: cachedCanonicalStructure, fingerprint: cachedCanonicalFingerprint };
  }

  const refDb = new DatabaseSync(':memory:');
  try {
    refDb.exec(BASELINE_DDL);
    cachedCanonicalStructure = extractBaselineStructure(refDb);
    cachedCanonicalFingerprint = computeStructureFingerprint(cachedCanonicalStructure);
    return { structure: cachedCanonicalStructure, fingerprint: cachedCanonicalFingerprint };
  } finally {
    try {
      refDb.close();
    } catch {
      // Ignore cleanup
    }
  }
}

export const CANONICAL_BASELINE_FINGERPRINT = getCanonicalBaseline().fingerprint;

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
 * Builds a deterministic structural fingerprint of the 9 legacy tables from an active database connection.
 */
export function computeLegacyFingerprint(db: DatabaseSync): string {
  return computeStructureFingerprint(extractBaselineStructure(db));
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

    // 3. Deep structural comparison against canonical baseline
    const { structure: canonicalTables, fingerprint: canonicalFp } = getCanonicalBaseline();
    const actualTables = extractBaselineStructure(db);
    const actualFp = computeStructureFingerprint(actualTables);

    for (const canonicalTable of canonicalTables) {
      const actualTable = actualTables.find((t) => t.name === canonicalTable.name);
      if (!actualTable) continue;

      // Verify column count
      if (actualTable.columns.length !== canonicalTable.columns.length) {
        discrepancies.push(
          `Table "${canonicalTable.name}" column count mismatch: expected ${canonicalTable.columns.length}, got ${actualTable.columns.length}`
        );
      }

      // Verify each column's specifications
      for (const col of canonicalTable.columns) {
        const actualCol = actualTable.columns.find((c) => c.name === col.name);
        if (!actualCol) {
          discrepancies.push(`Table "${canonicalTable.name}" is missing required column "${col.name}"`);
          continue;
        }
        if (actualCol.cid !== col.cid) {
          discrepancies.push(
            `Table "${canonicalTable.name}" column "${col.name}" position mismatch: expected cid ${col.cid}, got ${actualCol.cid}`
          );
        }
        if (actualCol.type !== col.type) {
          discrepancies.push(
            `Table "${canonicalTable.name}" column "${col.name}" type mismatch: expected "${col.type}", got "${actualCol.type}"`
          );
        }
        if (actualCol.notnull !== col.notnull) {
          discrepancies.push(
            `Table "${canonicalTable.name}" column "${col.name}" NOT NULL mismatch: expected ${col.notnull}, got ${actualCol.notnull}`
          );
        }
        if (actualCol.dflt_value !== col.dflt_value) {
          discrepancies.push(
            `Table "${canonicalTable.name}" column "${col.name}" default value mismatch: expected ${col.dflt_value}, got ${actualCol.dflt_value}`
          );
        }
        if (actualCol.pk !== col.pk) {
          discrepancies.push(
            `Table "${canonicalTable.name}" column "${col.name}" primary key mismatch: expected pk ${col.pk}, got ${actualCol.pk}`
          );
        }
      }

      // Check for unexpected extra columns
      for (const actualCol of actualTable.columns) {
        if (!canonicalTable.columns.some((c) => c.name === actualCol.name)) {
          discrepancies.push(`Table "${canonicalTable.name}" contains unexpected column "${actualCol.name}"`);
        }
      }

      // Verify unique constraints / unique indexes
      for (const canonicalIdx of canonicalTable.indexes) {
        const matching = actualTable.indexes.find(
          (idx) =>
            idx.unique === canonicalIdx.unique &&
            idx.columns.join(',') === canonicalIdx.columns.join(',')
        );
        if (!matching) {
          discrepancies.push(
            `Table "${canonicalTable.name}" is missing required ${canonicalIdx.unique ? 'unique ' : ''}constraint on columns: (${canonicalIdx.columns.join(', ')})`
          );
        }
      }

      for (const actualIdx of actualTable.indexes) {
        const matching = canonicalTable.indexes.find(
          (idx) =>
            idx.unique === actualIdx.unique &&
            idx.columns.join(',') === actualIdx.columns.join(',')
        );
        if (!matching && actualIdx.unique) {
          discrepancies.push(
            `Table "${canonicalTable.name}" has unexpected unique constraint on columns: (${actualIdx.columns.join(', ')})`
          );
        }
      }
    }

    // 4. Assert fingerprint parity
    if (actualFp !== canonicalFp || discrepancies.length > 0) {
      if (discrepancies.length === 0) {
        discrepancies.push(
          `Structural fingerprint mismatch: expected canonical "${canonicalFp}", got "${actualFp}"`
        );
      }
      throw new BaselineMismatchError('Legacy database schema contains structural discrepancies', discrepancies);
    }

    // Baseline is valid! Do NOT recreate or alter any tables or records.
  },
};
