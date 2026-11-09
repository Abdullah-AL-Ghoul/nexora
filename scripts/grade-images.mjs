/**
 * NEXORA Studio Grade — unified art direction for every bundled image.
 *
 * One deterministic "photographer" pass over public/img/*.jpg so the whole
 * catalog reads as a single editorial shoot on the obsidian palette:
 *   1. gentle contrast lift + slight darkening (obsidian cohesion)
 *   2. desaturation ~14% (luxury restraint)
 *   3. warm gold soft-light veil (#C9A961 @ ~12%) — the brand temperature
 *   4. corner vignette — focus to the artifact
 *   5. outputs optimized JPEG (mozjpeg q82) + WebP sibling (q80)
 *
 * Idempotent: a manifest (scripts/grade-manifest.json) records each file's
 * source hash; unchanged files are skipped on re-runs. Delete an entry (or
 * the manifest) to re-grade.
 *
 * Usage:  node scripts/grade-images.mjs [--force]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const IMG_DIR = join(ROOT, 'public', 'img');
const MANIFEST = join(import.meta.dirname, 'grade-manifest.json');

const GOLD = { r: 201, g: 169, b: 97 };

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const force = process.argv.includes('--force');

// Radial vignette + gold veil, drawn once in SVG overlay space.
const overlaySvg = (w, h) => Buffer.from(`
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vig" cx="50%" cy="46%" r="75%">
      <stop offset="62%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.20"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#vig)"/>
  <rect width="100%" height="100%" fill="#C9A961" opacity="0.07" style="mix-blend-mode:soft-light"/>
</svg>`);

async function gradeFile(file) {
  const src = join(IMG_DIR, file);
  const buf = readFileSync(src);
  const hash = createHash('sha256').update(buf).digest('hex');
  if (!force && manifest[file] === hash) return 'skip';

  const resized = await sharp(buf)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  const { width, height } = await sharp(resized).metadata();

  const graded = await sharp(resized)
    .modulate({ saturation: 0.9, brightness: 1.0 })
    .linear(1.05, -8)
    .composite([{ input: overlaySvg(width, height), blend: 'over' }])
    .toBuffer();

  await sharp(graded).jpeg({ quality: 82, mozjpeg: true }).toFile(src);
  await sharp(graded).webp({ quality: 80 }).toFile(join(IMG_DIR, file.replace(/\.jpe?g$/, '.webp')));

  manifest[file] = hash;
  return 'graded';
}

async function main() {
  if (!existsSync(IMG_DIR)) {
    console.error(`No ${IMG_DIR} — run scripts/bundle-images.mjs first.`);
    process.exit(1);
  }
  mkdirSync(IMG_DIR, { recursive: true });

  const files = readdirSync(IMG_DIR).filter((f) => /\.jpe?g$/i.test(f));

  const tally = { graded: 0, skip: 0, fail: 0 };
  for (const file of files) {
    try {
      const result = await gradeFile(file);
      tally[result === 'skip' ? 'skip' : 'graded'] += 1;
      if (result !== 'skip') console.log(`  ✓ ${file}`);
    } catch (err) {
      tally.fail += 1;
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`Studio grade complete — graded ${tally.graded}, skipped ${tally.skip}, failed ${tally.fail} of ${files.length}.`);
}

main();
