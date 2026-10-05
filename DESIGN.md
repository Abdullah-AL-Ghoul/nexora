# DESIGN — NEXORA

## Brief
- **Design read (marketing/storefront surface):** luxury e-commerce for sophisticated collectors, premium editorial vibe, dark obsidian + Swiss gold language, trust-first (provenance, certification, insured shipping).
- **Design read (app/dashboard surface):** precision operations console — same brand DNA, denser, calmer motion.
- **Quiet constraints:** accessibility-first, RTL (Arabic) fully supported, bilingual i18n, performance before decoration.
- **Pinned aesthetic:** the established NEXORA dark-luxury identity (obsidian `#0F1113`, surfaces, gold `#C9A961`, Cinzel + Plus Jakarta Sans + Cairo/Tajawal) — systemized, not reinvented.

## Dials
| Surface                | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
| ---------------------- | --------------- | ---------------- | -------------- |
| Marketing / storefront | 7               | 4                | 3              |
| Shop / product / admin | 5               | 3                | 5              |

## Primitives
Shared brand DNA → theme source: `src/index.css` (`@theme` block). One dark theme (the product is dark-only by design).

### Color tokens
| Token               | Value   | Use                                        |
| ------------------- | ------- | ------------------------------------------ |
| `--color-ink`       | #0F1113 | page background / primary text             |
| `--color-surface`   | #171A1F | cards, sections                            |
| `--color-elevated`  | #1E2229 | hover/elevated surfaces                    |
| `--color-raised`    | #121418 | inset / darker zones                       |
| `--color-line`      | #242831 | borders (subtle)                           |
| `--color-line-strong` | #343a47 | borders (active/hover)                   |
| `--color-gold`      | #C9A961 | brand accent, focus, primary CTA           |
| `--color-gold-soft` | #E7D3A0 | accent text on dark, hover gold            |
| `--color-fg`        | #F5F5F5 | primary text                               |
| `--color-fg-muted`  | #9CA3AF | secondary text                             |
| `--color-fg-faint`  | #6B7280 | tertiary text                              |
| `--color-success`   | #34d399 | stock/verified states                      |
| `--color-warning`   | #fbbf24 | low stock / warnings                       |
| `--color-danger`    | #fb7185 | errors, destructive actions                |
| `--color-info`      | #7dd3fc | informational                              |

### Typography
- Display: **Cinzel** (serif luxury) → `--font-display`; RTL display falls back to Cairo.
- Body: **Plus Jakarta Sans** → `--font-sans`; RTL body: Cairo/Tajawal.
- Mono: `--font-mono` (default mono stack) for SKUs, order numbers, editorial numerals.

### Motion
- Durations: 100 / 200 / 350 / 550 ms (`--ease-out` = `cubic-bezier(0.16,1,0.3,1)`; exit ~60%).
- Respect `prefers-reduced-motion` (global guard in CSS).

## Surface: storefront (marketing + shop + product + auth)
Foundation: from scratch (brand-derived). Theme: dark. Semantic re-mapping above.
Voice notes: restrained, editorial, provenance-forward; short CTA verbs; Arabic mirrors English meaning (not literal).

## Surface: console (admin dashboard)
Foundation: from scratch. Theme: dark. Same primitives; denser spacing, calmer motion.
Voice notes: operational clarity — status/count verbs over marketing language.

## Rotation log
Palette family: obsidian + Swiss gold. Display face: Cinzel (serif). RTL companion: Cairo/Tajawal.
