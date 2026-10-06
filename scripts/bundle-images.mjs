// Bundles all externally hot-linked Unsplash URLs into /public/img/* so the site
// never depends on a third-party image CDN. Steps:
//   1. Scan source files + seed data for https://images.unsplash.com/photo-* URLs
//   2. Download each unique photo (large enough for any usage) into public/img/
//   3. Rewrite every reference in source files to the local /img/... path
//   4. Rewrite rows already stored in the SQLite DB (products.images JSON,
//      categories.image_url, users.avatar).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IMG_DIR = join(ROOT, 'public', 'img');
mkdirSync(IMG_DIR, { recursive: true });

const URL_RE = /https:\/\/images\.unsplash\.com\/photo-([a-z0-9-]+)\?[^"'`\s]*/g;

const SOURCE_FILES = [
  'src/data/seedData.ts',
  'server/db.ts',
  'src/components/store/HeroSection.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/AdminDashboardPage.tsx',
  'src/pages/AboutPage.tsx',
];

// 1. Collect unique photo IDs
const photoIds = new Set();
for (const file of SOURCE_FILES) {
  const full = join(ROOT, file);
  if (!existsSync(full)) continue;
  const content = readFileSync(full, 'utf8');
  for (const match of content.matchAll(URL_RE)) photoIds.add(match[1]);
}

console.log(`Found ${photoIds.size} unique photos.`);

// 2. Download each photo. Reuse filename from the Unsplash short ID.
const downloaded = new Map();
for (const id of photoIds) {
  const fname = `nx-${id}.jpg`;
  const dest = join(IMG_DIR, fname);
  if (!existsSync(dest)) {
    const url = `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;
    execSync(`curl -sL --max-time 60 "${url}" -o "${dest}"`);
  }
  downloaded.set(id, `/img/${fname}`);
  console.log(`  ${id} -> /img/${fname}`);
}

// 3. Rewrite source files
for (const file of SOURCE_FILES) {
  const full = join(ROOT, file);
  if (!existsSync(full)) continue;
  const content = readFileSync(full, 'utf8');
  const rewritten = content.replace(
    /https:\/\/images\.unsplash\.com\/photo-([a-z0-9-]+)\?[^"'`\s]*/g,
    (_m, id) => downloaded.get(id) ?? `/img/nx-${id}.jpg`
  );
  if (rewritten !== content) {
    writeFileSync(full, rewritten, 'utf8');
    console.log(`Rewrote ${file}`);
  }
}

// 4. Rewrite SQLite rows
try {
  const DB_PATH = process.env.NEXUS_DB ?? join(ROOT, '.data', 'nexora.sqlite');
  const db = new DatabaseSync(DB_PATH);

  // products.images JSON
  const products = db.prepare('SELECT id, images FROM products').all();
  for (const p of products) {
    let changed = false;
    let images = p.images || '[]';
    images = images.replace(/https:\/\/images\.unsplash\.com\/photo-[a-z0-9-]+[^"\\]*/gi, (m) => {
      const id = /photo-([a-z0-9-]+)/.exec(m)?.[1];
      changed = true;
      return downloaded.get(id) ?? `/img/nx-${id}.jpg`;
    });
    if (changed) db.prepare('UPDATE products SET images = ? WHERE id = ?').run(images, p.id);
  }

  // categories.image_url
  const cats = db.prepare('SELECT id, image_url FROM categories').all();
  for (const c of cats) {
    const id = /photo-([a-z0-9-]+)/.exec(c.image_url || '')?.[1];
    if (id && downloaded.has(id)) {
      db.prepare('UPDATE categories SET image_url = ? WHERE id = ?').run(downloaded.get(id), c.id);
    }
  }

  // users.avatar
  const users = db.prepare('SELECT id, avatar FROM users').all();
  for (const u of users) {
    const id = /photo-([a-z0-9-]+)/.exec(u.avatar || '')?.[1];
    if (id && downloaded.has(id)) {
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(downloaded.get(id), u.id);
    }
  }

  db.close();
  console.log('SQLite rows rewritten.');
} catch (e) {
  console.warn('SQLite rewrite skipped (DB may be locked or absent):', e.message);
}

console.log('Done.');
