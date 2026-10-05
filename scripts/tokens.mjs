// One-time migration: replace hardcoded hex color classes with @theme tokens.
// Run: node scripts/tokens.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src');
const files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|html)$/.test(e) && !/index\.css/.test(p)) files.push(p);
  }
}
walk(root);

const HEX_TOKENS = {
  '0f1113': { bg: 'bg-ink', text: 'text-ink', border: 'border-ink' },
  '0b0d0f': { bg: 'bg-ink', text: 'text-fg' },
  '171a1f': { bg: 'bg-surface', text: 'text-surface', border: 'border-surface' },
  '121418': { bg: 'bg-raised', text: 'text-raised' },
  '1e2229': { bg: 'bg-elevated', border: 'border-elevated' },
  '242831': { bg: 'bg-line', border: 'border-line', text: 'text-fg-faint' },
  '343a47': { bg: 'bg-line-strong', border: 'border-line-strong' },
  'c9a961': { bg: 'bg-gold', text: 'text-gold', border: 'border-gold', ring: 'ring-gold', shadow: 'shadow-gold' },
  'e7d3a0': { bg: 'bg-gold-soft', text: 'text-gold-soft', border: 'border-gold-soft' },
  'f5f5f5': { bg: 'bg-fg', text: 'text-fg', border: 'border-fg' },
  '9ca3af': { bg: 'bg-fg-muted', text: 'text-fg-muted', border: 'border-fg-muted' },
  '6b7280': { bg: 'bg-fg-faint', text: 'text-fg-faint' },
};

// Match: [prefix:]utility-[#HEX][opacity]  e.g. hover:border-[#C9A961]/50
const RE = /([a-z-]*:)?(bg|text|border|ring|shadow|outline)-(?:color-)?\[#([0-9A-Fa-f]{6})\](?:\/(\d+))?/g;

let changedFiles = 0;
let replacements = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  let out = s;
  out = out.replace(RE, (m, prefix, util, hex, opacity) => {
    const entry = HEX_TOKENS[hex.toLowerCase()];
    if (!entry || !entry[util]) return m; // leave unmatched as-is
    replacements++;
    return `${prefix ?? ''}${entry[util]}${opacity ? `/${opacity}` : ''}`;
  });
  if (out !== s) {
    writeFileSync(f, out);
    changedFiles++;
  }
}
console.log(`tokenized ${changedFiles} files, ${replacements} class replacements`);

// Leftover hex utilities for manual review
const leftover = [];
function scan(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) scan(p);
    else if (/\.(tsx|ts|html)$/.test(e) && !/index\.css/.test(p)) {
      const c = readFileSync(p, 'utf8');
      const m = c.match(/(bg|text|border|ring|shadow|outline)-(\[#(?:[0-9A-Fa-f]{6})\]|color-.+)/g);
      if (m) leftover.push([p, [...new Set(m)].slice(0, 8)]);
    }
  }
}
scan(root);
console.log('remaining color utilities:', JSON.stringify(leftover, null, 1));
