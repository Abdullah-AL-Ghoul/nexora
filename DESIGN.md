# NEXORA — Design System

Premium · Dark · Minimal · Precision (M13). Source of truth for all UI work.

## Color tokens (CSS variables in `app/globals.css`)

| Token | Value | Usage |
|---|---|---|
| `--background` | `#0F1113` | Page base (dark) |
| `--surface` (`--card`) | `#171A1F` | Cards, panels, footer |
| `--primary` | `#C9A961` | Brand gold — CTAs, active states, focus ring |
| `--secondary` | `#E7D3A0` | Warm accent text on dark surfaces |
| `--foreground` | `#F5F5F5` | Primary text |
| `--muted-foreground` | `#9AA0A6` | Secondary text (AA on background) |
| `--border` | `rgb(245 245 245 / 10%)` | Hairline borders |
| `--destructive` | red (oklch) | Errors, destructive actions |

Semantic mapping (shadcn): `primary` = brand gold, `accent` = subtle hover surface,
`muted` = input/skeleton fills, `ring` = gold focus outline. `:root` and `.dark`
are identical — the product is dark-only by design.

## Typography

- Sans: **Geist** (`--font-geist-sans`, mapped to `font-sans`).
- Mono: **Geist Mono** — SKUs, prices (`tabular-nums`), codes.
- Scale: hero `text-4xl→6xl` (home), page `h1` `text-2xl→3xl`, section `text-xl→2xl`,
  body `text-sm`, meta `text-xs` + `uppercase tracking-wider` for labels.

## Layout

- Container: `mx-auto max-w-7xl px-4`. Sticky header `h-16` + gold announcement bar.
- Storefront grid: filter sidebar `240px` + results; product grid `2 / 3 / 4` cols.
- Radii: cards `rounded-xl`, buttons `rounded-lg` (shadcn), inputs `h-9/h-8`.

## Components (shadcn base + custom)

- Product card: bordered card, `aspect-square` image, hover `scale-105` + gold border,
  discount badge `-N%` (gold), out-of-stock overlay.
- Buttons: gold `default`, `outline` for secondary, `ghost` for icon actions.
- States: every data surface has loading (`Skeleton`), empty (`EmptyState`), error
  (`error.tsx` with retry), and not-found (`404` with recovery links).
- Money: always `formatPrice(cents)` — integer cents everywhere.

## Rules

1. Server Components by default; Client only for filters, forms, store interactions.
2. Authorization on the server (guards) — hidden links are not security.
3. No light theme. No decorative gradients beyond the hero's subtle gold radial glow.
4. Accessibility: focus-visible gold ring, aria labels on icon buttons, semantic headings.
