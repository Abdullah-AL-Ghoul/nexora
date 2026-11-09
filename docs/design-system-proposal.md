# NEXORA — Design System & Visual Identity Specification

**Design Code:** M13-LUXURY-PRECISION  
**Design Philosophy:** Architectural Precision · Dark Monochromatic Depth · Burnished Gold Accents · Tactile Clarity  
**Primary Reference:** `DESIGN.md` and Tailored Modern Luxury Benchmarks  

---

## 1. Brand Identity & Visual Language

### 1.1 Brand Personality
- **Quiet Authority:** Confident, understated, and unhurried. No aggressive blinking banners or neon promotional popups.
- **Mechanical Precision:** Mathematical alignment, clean hairlines, tabular numerals for technical metadata, and zero visual clutter.
- **High-Craft Materiality:** Interfaces mimic the physical qualities of brushed champagne gold, black PVD titanium, and frosted sapphire glass.
- **Bespoke Exclusivity:** Treating each collection, bespoke project, and certificate as a curated gallery piece.

### 1.2 Iconography & Visual Assets
- **Icon Style:** `lucide-react` icons rendered with uniform 1.5px to 1.75px stroke width (`strokeWidth={1.5}`), enclosed in subtle circular or squircle containers with `bg-primary/10 text-primary`.
- **Imagery Standards:** Studio-lit product photography on dark or neutral backgrounds, framed in `aspect-square` or `aspect-[4/3]`, with soft gradient scrims to ensure absolute text contrast.

---

## 2. Color System & Token Architecture

The design system enforces a **strict dark-only mode** (`:root` and `.dark` are harmonized) to preserve visual prestige and eliminate harsh contrast shocks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXORA COLOR TOKENS                             │
├───────────────────┬──────────────┬─────────────────────────────────────┤
│ Token             │ Hex / Oklch  │ Semantic Role                       │
├───────────────────┼──────────────┼─────────────────────────────────────┤
│ `--background`    │ `#0F1113`    │ Primary viewport and page canvas    │
│ `--card` / Surface│ `#171A1F`    │ Elevated cards, panels, footers     │
│ `--surface-hover` │ `#1E222A`    │ Interactive card & row hover state  │
│ `--primary`       │ `#C9A961`    │ Burnished Champagne Gold (CTAs/Rings│
│ `--primary-hover` │ `#B8964B`    │ Darker gold for active click state  │
│ `--secondary`     │ `#E7D3A0`    │ Warm pale accent for subheadings    │
│ `--foreground`    │ `#F5F5F5`    │ Primary text (contrast ratio >16:1) │
│ `--muted-fg`      │ `#9AA0A6`    │ Metadata, labels, secondary copy    │
│ `--border`        │ `rgba(245..)`│ 10% opacity hairline white border   │
│ `--border-gold`   │ `rgba(201..)`│ 30%–60% opacity gold border hover   │
│ `--destructive`   │ `oklch(0.63)`│ Errors, stock depletion alerts      │
│ `--success`       │ `oklch(0.72)`│ Paid status, verified badges        │
└───────────────────┴──────────────┴─────────────────────────────────────┘
```

---

## 3. Typography Scale & Hierarchy

Nexora pairs geometric clarity with mechanical precision using the **Geist** font family:

```
┌──────────────────────────────────────────────────────────────┐
│                    TYPOGRAPHY SPECIFICATION                  │
├──────────────────────────────────────────────────────────────┤
│ Sans-Serif: Geist Sans (--font-geist-sans)                    │
│ Monospaced: Geist Mono (--font-geist-mono)                    │
├────────────────────┬──────────┬────────┬──────────┬──────────┤
│ Level              │ Size     │ Weight │ Line Ht  │ Tracking │
├────────────────────┼──────────┼────────┼──────────┼──────────┤
│ Hero Display       │ 48–64px  │ 600    │ 1.08     │ -0.03em  │
│ Page H1            │ 32–36px  │ 600    │ 1.15     │ -0.025em │
│ Section H2         │ 24–28px  │ 600    │ 1.25     │ -0.02em  │
│ Subsection H3      │ 18–20px  │ 500    │ 1.35     │ -0.01em  │
│ Body Text          │ 14–16px  │ 400    │ 1.60     │ normal   │
│ Monospaced / Price │ 14–18px  │ 600    │ 1.00     │ tabular  │
│ Meta & Badges      │ 11–12px  │ 500    │ 1.00     │ +0.08em  │
└────────────────────┴──────────┴────────┴──────────┴──────────┘
```

- **Special Style:** `.text-gold-gradient` applied to focal hero words (`bg-gradient-to-r from-[#C9A961] via-[#E7D3A0] to-[#C9A961] bg-clip-text text-transparent`).
- **Data & Pricing Rule:** All monetary figures, order numbers, and SKUs must use `font-mono tabular-nums`.

---

## 4. Spacing Scale, Layout & Grid Discipline

- **Maximum Canvas Width:** `max-w-7xl` (1280px) centered with `mx-auto px-4 sm:px-6 lg:px-8`.
- **Rhythmic Section Spacing:** `py-16 sm:py-24` on landing sections to create generous, comfortable pacing.
- **Card Corner Radii:**
  - Cards & Bento Tiles: `rounded-xl` (12px) or `rounded-2xl` (16px).
  - Buttons & Inputs: `rounded-lg` (8px).
  - Badges & Pills: `rounded-full` (9999px).
- **Elevation & Shadows:**
  - `shadow-card`: Subtle ambient drop shadow for cards against dark canvases.
  - `shadow-glow`: Ambient gold radial halo (`0 0 40px rgba(201, 169, 97, 0.15)`).

---

## 5. Standardized Component Library

### 5.1 Buttons (`components/ui/button.tsx`)
- **Default (Primary):** Solid gold background (`bg-primary text-primary-foreground font-medium hover:bg-primary/90 shadow-lg shadow-primary/20`).
- **Outline (Secondary):** Dark surface with hairline border (`border border-border hover:border-primary/50 text-foreground`).
- **Ghost:** Transparent background for icon actions (`hover:bg-primary/10 hover:text-primary`).
- **Touch Target:** Minimum 44px height (`h-11 px-5` or `h-9 px-4` with expanded tap area on mobile).

### 5.2 Product & Project Cards (`components/product/product-card.tsx`)
- Enclosed in `rounded-xl border border-border bg-card/60 backdrop-blur transition-all duration-300 hover:border-primary/50 hover:shadow-glow`.
- Features image with `aspect-square`, discount badge, stock indicator, quick-add hover trigger, and wishlist bookmark button.

### 5.3 Modals, Sheets & Dialogs
- Overlay with frosted dark glass (`bg-background/80 backdrop-blur-md`).
- Focus trapped automatically; accessible escape key and close button with clear screen-reader labels.

### 5.4 Form Controls & Inputs (`components/ui/input.tsx`)
- Background: `bg-card/80 border-border text-foreground`.
- Focus State: Visible gold ring (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`).
- Error State: Red border with inline explanatory message.

### 5.5 State Feedback: Empty, Error & Skeleton Skeletons
- Every listing surface (`/shop`, `/admin/orders`, `/wishlist`, `/admin/products`) implements a matching pulse skeleton (`components/ui/skeleton.tsx`).
- Empty states (`components/catalog/empty-state.tsx`) offer a clear icon, explanation, and recovery action button.
