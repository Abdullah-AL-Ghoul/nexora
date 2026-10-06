// Generates public/brand/mark.svg — the standalone Nera SVG favicon,
// mirroring the geometry in src/components/brand/Logo.tsx so they stay in sync.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'public', 'brand', 'mark.svg');
mkdirSync(dirname(out), { recursive: true });

const GOLD = '#C9A961';
const GOLD_SOFT = '#E7D3A0';

const ticks = [];
for (let i = 0; i < 60; i++) {
  const angle = (i * 6 * Math.PI) / 180 - Math.PI / 2;
  const major = i % 5 === 0;
  const outer = 30.5;
  const inner = major ? 27.4 : 28.6;
  const x1 = (32 + outer * Math.cos(angle)).toFixed(2);
  const y1 = (32 + outer * Math.sin(angle)).toFixed(2);
  const x2 = (32 + inner * Math.cos(angle)).toFixed(2);
  const y2 = (32 + inner * Math.sin(angle)).toFixed(2);
  ticks.push(`    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GOLD}" stroke-width="${major ? 1 : 0.5}" opacity="${major ? 0.95 : 0.6}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14" fill="#0F1113"/>
  <circle cx="32" cy="32" r="30" stroke="${GOLD}" stroke-width="1.5"/>
  <circle cx="32" cy="32" r="24.5" stroke="${GOLD}" stroke-width="0.75" opacity="0.85"/>
${ticks.join('\n')}
  <g transform="translate(32 33)" stroke="${GOLD}" stroke-width="2.1" stroke-linecap="square" fill="none">
    <path d="M0.8 -8.4 V5.2"/>
    <path d="M-9.2 -8.4 -19.2 5.2" transform="translate(10 0)"/>
    <path d="M10.8 -8.4 V5.2"/>
    <path d="M14.4 -8.4 4 5.2"/>
    <path d="M4 -8.4 14.4 5.2"/>
  </g>
  <text x="32" y="54.2" text-anchor="middle" font-size="3.4" letter-spacing="0.6" fill="${GOLD_SOFT}" opacity="0.9" font-family="ui-monospace, monospace">EST. MMXXVI</text>
</svg>
`;

writeFileSync(out, svg, 'utf8');
console.log('Wrote', out);
