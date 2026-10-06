import React from 'react';

/**
 * NEXORA Heritage Seal — the brand mark. A dual-ring emblem with precision
 * bezel tick marks (indexing the back of a Swiss chronometer) framing an
 * interlocked N/X monogram, finished in gold on obsidian.
 *
 * Variants:
 *  - <Logo />            compact seal (navbar, footer, favicons)
 *  - <Logo.Lockup />     seal + cinzel "NEXORA" wordmark (headers)
 *  - <Logo.Watermark />  large faint seal for section backgrounds
 */

const GOLD = '#C9A961';
const GOLD_SOFT = '#E7D3A0';

export function SealSvg({
  size = 40,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const mono = 'font-mono';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title ?? 'NEXORA heritage seal'}
    >
      {/* Outer static ring */}
      <circle cx="32" cy="32" r="30" stroke={GOLD} strokeWidth="1.5" />
      {/* Inner static ring */}
      <circle cx="32" cy="32" r="24.5" stroke={GOLD} strokeWidth="0.75" opacity="0.85" />

      {/* Bezel tick marks (60 hashes like a minute ring) */}
      {Array.from({ length: 60 }).map((_, i) => {
        const angle = (i * 6 * Math.PI) / 180 - Math.PI / 2;
        const major = i % 5 === 0;
        const outer = 30.5;
        const inner = major ? 27.4 : 28.6;
        const x1 = 32 + outer * Math.cos(angle);
        const y1 = 32 + outer * Math.sin(angle);
        const x2 = 32 + inner * Math.cos(angle);
        const y2 = 32 + inner * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={GOLD}
            strokeWidth={major ? 1 : 0.5}
            opacity={major ? 0.95 : 0.6}
          />
        );
      })}

      {/* Cardinal dots at 12/3/6/9 */}
      {[90, 0, -90, 180].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return (
          <circle
            key={deg}
            cx={32 + 25.5 * Math.cos(rad)}
            cy={32 + 25.5 * Math.sin(rad)}
            r="0.9"
            fill={GOLD}
            opacity="0.9"
          />
        );
      })}

      {/* Interlocked N / X monogram */}
      <g
        transform="translate(32 33)"
        stroke={GOLD}
        strokeWidth="2.1"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      >
        {/* N: two vertical strokes + diagonal */}
        <path d="M-7.6 -8.4 V5.2 H-7.2" />
        <path d="M-7.6 -8.4 -17.6 5.2" transform="translate(10 0)" />
        <path d="M2.4 -8.4 V5.2" />
        {/* X: crossing diagonals */}
        <path d="M5.2 -8.4 -5.2 5.2" />
        <path d="M-5.2 -8.4 5.2 5.2" />
      </g>

      {/* Small est. caption inside lower arc */}
      <text
        x="32"
        y="54"
        textAnchor="middle"
        fontSize="3.4"
        letterSpacing="0.6"
        fill={GOLD_SOFT}
        opacity="0.9"
        className={mono}
      >
        EST. MMXXVI
      </text>
    </svg>
  );
}

export function Logo({ size = 40, className, withMark = true }: { size?: number; className?: string; withMark?: boolean }) {
  if (!withMark) {
    return (
      <span className={`font-serif-luxury font-bold tracking-[0.2em] text-fg ${className ?? ''}`}>
        NEXORA
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <SealSvg size={size} />
      <span
        className="font-serif-luxury font-bold tracking-[0.2em] text-fg leading-none"
        style={{ fontSize: size * 0.62 }}
      >
        NEXORA
      </span>
    </span>
  );
}

export default Logo;
