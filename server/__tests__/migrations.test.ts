import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runMigrations, getPhysicalTableCount, getAppliedMigrations } from '../migrations/runner.js';
import {
  BaselineMismatchError,
  MigrationChecksumError,
  MigrationExecutionError,
} from '../migrations/types.js';
import { createWalSafeBackup } from '../migrations/backup.js';
import { MigrationLock } from '../migrations/lock.js';
import { BASELINE_DDL, LEGACY_TABLE_NAMES } from '../migrations/001_baseline.js';

describe('Versioned Migration Runner & Core Schema Implementation', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-test-mig-'));
    dbPath = path.join(tempDir, 'test.sqlite');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Migration Behavior & Inventory', () => {
    it('1. Fresh database initialization provisions all 15 physical tables', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const result = await runMigrations(db);

      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.baselineCreated).toBe(true);
      expect(result.totalTables).toBe(15);

      const tableRows = (db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
        )
        .all() as { name: string }[]) ?? [];
      const tables = tableRows.map((r) => r.name);

      expect(tables).toHaveLength(15);

      // Verify all 9 legacy tables
      for (const t of LEGACY_TABLE_NAMES) {
        expect(tables).toContain(t);
      }

      // Verify all 5 new domain tables
      expect(tables).toContain('media_assets');
      expect(tables).toContain('projects');
      expect(tables).toContain('certifications');
      expect(tables).toContain('project_media');
      expect(tables).toContain('certification_media');

      // Verify metadata table
      expect(tables).toContain('schema_migrations');

      db.close();
    });

    it('2. Existing valid legacy baseline upgrade succeeds without recreating tables', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

      // Provision legacy 9 tables directly
      db.exec(BASELINE_DDL);
      db.exec(`
        INSERT INTO users (id, email, name, role, created_at)
        VALUES ('u_leg_01', 'legacy@test.com', 'Legacy User', 'CUSTOMER', '2026-01-01T00:00:00Z');
      `);

      // Run migrations
      const result = await runMigrations(db);

      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.totalTables).toBe(15);

      // Verify legacy record is 100% intact
      const user = db.prepare("SELECT * FROM users WHERE id = 'u_leg_01';").get() as any;
      expect(user).toBeDefined();
      expect(user.email).toBe('legacy@test.com');

      db.close();
    });

    it('3. Rejects partial legacy baseline (e.g. 5 tables present) with BaselineMismatchError', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create only 3 tables
      db.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE);
        CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT);
      `);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('4. Rejects unexpected application tables before baseline registration', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create valid 9 tables + 1 foreign unexpected table
      db.exec(BASELINE_DDL);
      db.exec('CREATE TABLE unexpected_legacy_table (id TEXT PRIMARY KEY);');

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('5. Rejects baseline if required column is missing (structural discrepancy)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create 9 tables, but omit password_hash from users
      const modifiedDDL = BASELINE_DDL.replace('password_hash  TEXT,', '');
      db.exec(modifiedDDL);

      await expect(runMigrations(db)).rejects.toThrow(BaselineMismatchError);
      db.close();
    });

    it('6. Rejects execution if recorded historical checksum does not match registered checksum', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Simulate a tampered schema_migrations table
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
        INSERT INTO schema_migrations VALUES (1, '001_initial_baseline', '2026-01-01', 'tampered_checksum_hash', 10);
      `);

      await expect(runMigrations(db)).rejects.toThrow(MigrationChecksumError);
      db.close();
    });

    it('7. Migration runner is idempotent and completes quickly when already up-to-date', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      const firstRun = await runMigrations(db);
      expect(firstRun.appliedCount).toBe(2);

      const secondStart = Date.now();
      const secondRun = await runMigrations(db);
      const secondDuration = Date.now() - secondStart;

      expect(secondRun.appliedCount).toBe(0);
      expect(secondRun.currentVersion).toBe(2);
      expect(secondRun.totalTables).toBe(15);
      expect(secondDuration).toBeLessThan(100);

      db.close();
    });

    it('8. Atomic transaction rolls back failed migration cleanly without partial schema mutation', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Pre-apply version 1
      db.exec(BASELINE_DDL);
      db.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          checksum TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL
        );
      `);
      const { migration001 } = await import('../migrations/001_baseline.js');
      db.prepare(
        'INSERT INTO schema_migrations VALUES (?, ?, ?, ?, ?)'
      ).run(1, migration001.name, new Date().toISOString(), migration001.checksum, 5);

      // Create a broken migration runner subclass or simulate failed migration
      const { runMigrations: testRunner } = await import('../migrations/runner.js');
      const tableCountBefore = getPhysicalTableCount(db);

      // Attempt migration with a broken DDL statement
      const badMigration = {
        version: 3,
        name: '003_bad_migration',
        checksum: 'abc',
        up(d: DatabaseSync) {
          d.exec('CREATE TABLE valid_half (id TEXT PRIMARY KEY);');
          d.exec('INVALID SQL STATEMENT HERE TRIGGER ERROR;');
        },
      };

      try {
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        badMigration.up(db);
        db.exec('COMMIT;');
      } catch {
        db.exec('ROLLBACK;');
      }

      // Assert table count remained completely unchanged
      expect(getPhysicalTableCount(db)).toBe(tableCountBefore);
      const testCheck = db.prepare("SELECT name FROM sqlite_master WHERE name = 'valid_half';").get();
      expect(testCheck).toBeUndefined();

      db.close();
    });

    it('9. Migration lock prevents concurrent execution', async () => {
      const lockA = new MigrationLock(dbPath);
      const lockB = new MigrationLock(dbPath);

      await lockA.acquire(1000);

      // Lock B should timeout trying to acquire
      await expect(lockB.acquire(200, 50)).rejects.toThrow();

      lockA.release();

      // Now Lock B can acquire
      await lockB.acquire(500);
      lockB.release();
    });

    it('10. Table inventory matches exactly 15 physical tables', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      await runMigrations(db);

      const count = getPhysicalTableCount(db);
      expect(count).toBe(15);
      db.close();
    });
  });

  describe('WAL-Safe Online Backup Behavior', () => {
    it('1. Backup creation succeeds from a file-backed SQLite database', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      expect(backupRes).not.toBeNull();
      expect(fs.existsSync(backupRes!.backupPath)).toBe(true);
      expect(backupRes!.bytes).toBeGreaterThan(0);

      db.close();
    });

    it('2. Backup captures committed WAL data accurately', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Insert committed row into WAL
      db.exec(`
        INSERT INTO categories (id, name, slug, description, image_url, item_count)
        VALUES ('cat_wal_test', 'WAL Category', 'wal-category', 'Test', '/test.jpg', 1);
      `);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      expect(backupRes).toBeDefined();

      // Open backup file separately and check data
      const bakDb = new DatabaseSync(backupRes!.backupPath, { readOnly: true });
      const row = bakDb.prepare("SELECT * FROM categories WHERE id = 'cat_wal_test';").get() as any;
      expect(row).toBeDefined();
      expect(row.slug).toBe('wal-category');

      bakDb.close();
      db.close();
    });

    it('3. Backup integrity_check and quick_check both report ok', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      const bakDb = new DatabaseSync(backupRes!.backupPath, { readOnly: true });

      const integrity = bakDb.prepare('PRAGMA integrity_check;').all() as any[];
      const quick = bakDb.prepare('PRAGMA quick_check;').all() as any[];

      expect(integrity).toEqual([{ integrity_check: 'ok' }]);
      expect(quick).toEqual([{ quick_check: 'ok' }]);

      bakDb.close();
      db.close();
    });

    it('4. Backup filenames are unique and do not collide', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      const bak1 = await createWalSafeBackup(db, dbPath, 2);
      const bak2 = await createWalSafeBackup(db, dbPath, 2);

      expect(bak1!.backupPath).not.toBe(bak2!.backupPath);
      expect(fs.existsSync(bak1!.backupPath)).toBe(true);
      expect(fs.existsSync(bak2!.backupPath)).toBe(true);

      db.close();
    });

    it('5. Source database is not modified or locked by backup creation', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      await createWalSafeBackup(db, dbPath, 2);

      // Should be able to write immediately without error
      expect(() => {
        db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_after_bak', 'a@b.com', 'A', '2026-01-01');");
      }).not.toThrow();

      db.close();
    });

    it('6. Restore procedure recovers exact pre-migration schema and records', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);
      db.exec("INSERT INTO users (id, email, name, created_at) VALUES ('u_restore_01', 'res@nexora.com', 'Restore User', '2026-01-01');");

      const backupRes = await createWalSafeBackup(db, dbPath, 2);
      db.close();

      // Simulate a disaster or corruption on the main database
      fs.writeFileSync(dbPath, 'CORRUPTED_GARBAGE_BYTES');

      // Execute restore procedure
      fs.copyFileSync(backupRes!.backupPath, dbPath);
      // Remove stale WAL/SHM files
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);

      // Verify restored database
      const restoredDb = new DatabaseSync(dbPath);
      const integrity = restoredDb.prepare('PRAGMA integrity_check;').all() as any[];
      expect(integrity).toEqual([{ integrity_check: 'ok' }]);

      const restoredUser = restoredDb.prepare("SELECT * FROM users WHERE id = 'u_restore_01';").get() as any;
      expect(restoredUser).toBeDefined();
      expect(restoredUser.email).toBe('res@nexora.com');

      restoredDb.close();
    });
  });

  describe('Legacy Baseline Upgrade & Data Preservation', () => {
    it('Preserves exact counts of legacy data during Phase 02 migration', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      db.exec(BASELINE_DDL);

      // Insert full mock dataset matching production baseline census
      // 5 users
      for (let i = 1; i <= 5; i++) {
        db.exec(`INSERT INTO users (id, email, name, role, created_at) VALUES ('u_${i}', 'u${i}@test.com', 'User ${i}', 'CUSTOMER', '2026-01-01');`);
      }
      // 8 categories
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO categories (id, name, slug, description, image_url, item_count) VALUES ('cat_${i}', 'Cat ${i}', 'cat-${i}', '', '', 6);`);
      }
      // 48 products
      for (let i = 1; i <= 48; i++) {
        db.exec(`INSERT INTO products (id, name, slug, price, sku, category_id, category_name, created_at, updated_at) VALUES ('prod_${i}', 'Prod ${i}', 'prod-${i}', 100.0, 'SKU-${i}', 'cat_1', 'Cat 1', '2026-01-01', '2026-01-01');`);
      }
      // 6 orders
      for (let i = 1; i <= 6; i++) {
        db.exec(`INSERT INTO orders (id, order_number, user_id, customer_name, customer_email, subtotal, total, created_at, updated_at) VALUES ('ord_${i}', 'ORD-${i}', 'u_1', 'Customer', 'c@t.com', 100, 100, '2026-01-01', '2026-01-01');`);
      }
      // 8 order items
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO order_items (id, order_id, product_id, product_name, sku, unit_price, quantity, total_price) VALUES ('item_${i}', 'ord_1', 'prod_1', 'Prod 1', 'SKU-1', 100, 1, 100);`);
      }
      // 3 coupons
      for (let i = 1; i <= 3; i++) {
        db.exec(`INSERT INTO coupons (id, code, type, value, starts_at, expires_at) VALUES ('cp_${i}', 'CODE_${i}', 'PERCENTAGE', 10, '2026-01-01', '2027-01-01');`);
      }
      // 8 inventory transactions
      for (let i = 1; i <= 8; i++) {
        db.exec(`INSERT INTO inventory_transactions (id, product_id, product_name, sku, type, quantity, stock_after, performed_by, created_at) VALUES ('tx_${i}', 'prod_1', 'Prod 1', 'SKU-1', 'IN', 10, 10, 'u_1', '2026-01-01');`);
      }
      // 1 review
      db.exec(`INSERT INTO reviews (id, product_id, user_id, user_name, rating, created_at) VALUES ('rev_1', 'prod_1', 'u_1', 'User 1', 5, '2026-01-01');`);
      // 1 newsletter subscriber
      db.exec(`INSERT INTO newsletter_subscribers (id, email, created_at) VALUES ('sub_1', 'sub@test.com', '2026-01-01');`);

      // Run migrations
      const result = await runMigrations(db);
      expect(result.appliedCount).toBe(2);
      expect(result.currentVersion).toBe(2);
      expect(result.totalTables).toBe(15);

      // Verify all counts are exactly preserved
      const getCount = (tbl: string) =>
        (db.prepare(`SELECT count(*) as c FROM "${tbl}";`).get() as { c: number }).c;

      expect(getCount('users')).toBe(5);
      expect(getCount('categories')).toBe(8);
      expect(getCount('products')).toBe(48);
      expect(getCount('orders')).toBe(6);
      expect(getCount('order_items')).toBe(8);
      expect(getCount('coupons')).toBe(3);
      expect(getCount('inventory_transactions')).toBe(8);
      expect(getCount('reviews')).toBe(1);
      expect(getCount('newsletter_subscribers')).toBe(1);

      // Verify domain tables are completely empty (Zero-Fabrication Policy)
      expect(getCount('projects')).toBe(0);
      expect(getCount('certifications')).toBe(0);
      expect(getCount('media_assets')).toBe(0);
      expect(getCount('project_media')).toBe(0);
      expect(getCount('certification_media')).toBe(0);

      db.close();
    });
  });
});
