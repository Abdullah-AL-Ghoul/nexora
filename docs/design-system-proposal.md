# NEXORA — Design System & Visual Identity Proposal
**Phase 06 Deliverable — Complete Visual Architecture & Component Specification**
*Document Version:* 1.0.0  
*Date of Audit:* November 2026  
*Design Team:* Principal UI/UX Designer, Design Systems Engineer, Senior Frontend Engineer

---

## 1. Visual Identity & Brand Philosophy

NEXORA’s aesthetic identity is christened **"The Precision Atelier" (محترف الدقة المعمارية)**. It rejects the transient, playful styling of mass-market consumer tech in favor of the timeless weight, tactile restraint, and geometric rigor of high European horology and architectural sculpture.

### 1.1 Aesthetic Pillars
- **Permanent, Tactile Craft:** Interfaces emulate solid materials—obsidian crystal, brushed titanium, vegetable-tanned leather, and unlacquered brass.
- **Architectural Structuralism:** Thin, precise borders (`1px solid var(--color-line)`) define clear spatial compartments.
- **Restrained Luxury:** Negative space is treated as an active luxury material. We avoid dense walls of text and clutter.
- **Micro-Detail Precision:** Subtle hairline dividers, monospaced numerals for calibers and serial numbers, and inter-word dot separators (`·`).

---

## 2. Color System & Runtime Design Tokens

NEXORA employs a runtime token architecture defined in `src/index.css` under Tailwind CSS v4's `@theme` directive. Colors adapt dynamically between **Dark Obsidian** (default) and **Warm Ivory Alabaster** (light mode).

### 2.1 Core Semantic Token Palette

| Token Name | Dark Mode Value | Light Mode Value | Functional Role |
|---|---|---|---|
| `--color-ink` | `#0F1113` (Obsidian) | `#FAF8F4` (Alabaster) | Page base background and primary canvas |
| `--color-surface` | `#171A1F` (Dark Slate) | `#FFFFFF` (Pure White) | Card containers, modals, table surfaces |
| `--color-elevated` | `#1E2229` (Lifted Slate) | `#F4F0E8` (Warm Ecru) | Hover surfaces, active state layers |
| `--color-raised` | `#121418` (Inset Black) | `#EFE9DF` (Muted Parchment) | Recessed wells, quote blocks, trust marquee |
| `--color-line` | `#242831` (Subtle Rim) | `#E2DDD4` (Warm Gray Border) | Default hairline card and section borders |
| `--color-line-strong` | `#343A47` | `#C8C1B4` | Active borders, focused inputs, table dividers |
| `--color-gold` | `#C9A961` (Swiss Gold) | `#8A6D2F` (Aged Bronze Gold) | Brand accent, primary CTAs, active indicators |
| `--color-gold-soft` | `#E7D3A0` (Champagne) | `#A3833E` | Secondary accent, hover gold, badge highlights |
| `--color-fg` | `#F5F5F5` (Off-White) | `#1A1D20` (Charcoal Black) | Primary editorial and body typography |
| `--color-fg-muted` | `#9CA3AF` (Neutral Muted) | `#5A626E` (Slate Gray) | Secondary metadata, captions, timestamps |
| `--color-fg-faint` | `#6B7280` | `#8C95A3` | Disabled states, placeholders, watermark labels |
| `--color-on-image` | `#F5F5F5` (Non-inverting)| `#F5F5F5` (Non-inverting)| High-contrast white text overlaid on photographic scrims |
| `--color-on-image-muted`| `#D1D5DB` (Non-inverting)| `#D1D5DB` (Non-inverting)| Secondary text on photographic overlays in both themes |

### 2.2 Functional & Status Colors
- **Success (`--color-success`):** `#34D399` (Stock verified, order paid, certificate valid)
- **Warning (`--color-warning`):** `#FBBF24` (Low stock alert, pending review)
- **Danger (`--color-danger`):** `#FB7185` (Critical error, out of stock, destructive deletion)
- **Info (`--color-info`):** `#7DD3FC` (Courier dispatches, market intelligence notes)

---

## 3. Typography Hierarchy & Bidirectional Parity

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TYPOGRAPHY STACK                              │
│                                                                        │
│  [Display (Serif)] ──► Cinzel (Latin) / Cairo (Arabic)                 │
│  [Body (Sans)]     ──► Plus Jakarta Sans (Latin) / Cairo (Arabic)      │
│  [Technical (Mono)]──► JetBrains Mono / System Monospace Stack         │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Type Scales & Roles
1. **Display Hero (H1):** `font-serif-luxury text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1]`
2. **Section Headings (H2):** `font-serif-luxury text-2xl sm:text-3xl font-bold tracking-normal leading-snug`
3. **Card Titles (H3):** `font-serif-luxury text-lg sm:text-xl font-semibold`
4. **Editorial Eyebrow / Kicker:** `font-mono text-xs uppercase tracking-[0.2em] text-gold font-semibold`
5. **Body Text:** `font-sans text-sm sm:text-base leading-relaxed text-fg`
6. **Technical Meta / Serial / SKU:** `font-mono text-xs sm:text-sm text-gold-soft tracking-wider`

---

## 4. Spacing, Elevation & Layout Grid

### 4.1 Spacing Scale (Base-4/8 System)
- `4px` (0.25rem), `8px` (0.5rem), `12px` (0.75rem), `16px` (1rem), `24px` (1.5rem), `32px` (2rem), `48px` (3rem), `64px` (4rem), `96px` (6rem), `128px` (8rem).
- Section vertical rhythm: Standard `space-y-24` (~96px) on mobile; `space-y-32` (~128px) on desktop.

### 4.2 Modular Container Widths
- Content standard max width: `max-w-7xl` (1280px) with fluid responsive gutters: `px-4 sm:px-6 lg:px-8`.
- Reading / Manifesto column max width: `max-w-4xl` (896px) or `max-w-3xl` (768px).

### 4.3 Corner Radii & Elevation
- **Border Radius:**
  - Micro-controls (Badges, Buttons): `rounded-md` (6px)
  - Cards & Containers: `rounded-xl` (12px)
  - Modals & Hero Banners: `rounded-2xl` (16px)
- **Shadows:**
  - Card Subtle: `0 4px 20px -2px rgba(0, 0, 0, 0.4)`
  - Overlay / Modal: `0 20px 40px -4px rgba(0, 0, 0, 0.7)`
  - Gold Glow Accent: `0 0 25px -5px rgba(201, 169, 97, 0.25)`

---

## 5. Component Library Specification

### 5.1 Buttons (`Button.tsx`)
- **Primary:** `bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-wider uppercase transition-colors px-6 py-3 rounded-md`
- **Secondary / Outlined:** `bg-surface border border-line hover:border-gold text-fg font-semibold text-xs tracking-wider uppercase transition-colors px-6 py-3 rounded-md`
- **Ghost / Link:** `text-xs text-fg-muted hover:text-gold flex items-center gap-1.5 transition-colors`
- **Destructive:** `bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-xs font-semibold px-4 py-2 rounded-md`

### 5.2 Artifact & Project Cards (`ProductCard.tsx`, `ProjectCard.tsx`)
- **Container:** Rounded 12px, border hairline, overflow hidden, relative positioning.
- **Image Treatment:** Aspect ratio lock (`aspect-square` or `aspect-[16/10]`), 700ms scale transition on group hover (`group-hover:scale-105`).
- **Overlay:** Bottom dark gradient (`from-ink via-ink/40 to-transparent`) ensuring all metadata remains readable over high-key photos.
- **Action Strip:** Quick view eye button + Wishlist heart button positioned gracefully in corners with backdrop-blur.

### 5.3 Input Fields & Form Controls (`Input.tsx`)
- **Field:** `bg-raised border border-line focus:border-gold focus:ring-1 focus:ring-gold text-xs text-fg px-4 py-2.5 rounded-md outline-none transition-colors`
- **Label:** `text-xs font-mono uppercase tracking-wider text-fg-muted mb-1.5 block`
- **Error State:** Border becomes `--color-danger`, and a descriptive error message renders immediately beneath the field with ARIA association.

---

## 6. Specifications for New Core Modules

### 6.1 Bespoke Projects Showcase Component (`ProjectCard.tsx` & `ProjectDossier.tsx`)
To fulfill the user's requirement for **Projects (`المشاريع`)**:
- **Metadata Badges:** Client Commission Type, Guild Discipline (Horology, Audio, Interior), Completion Date, Location.
- **Hero Comparison Slider:** Side-by-side or before/after view showing architectural sketches versus the finished physical installation.
- **Technical Materials Tagging:** Clickable pill tags (e.g. `Anodized Titanium Grade 5`, `Solid Black Walnut`, `Smoked Beryllium`).
- **Concierge CTA:** "Request Similar Private Commission" button directly linking to the concierge inquiry modal.

### 6.2 Certifications & Hallmark Registry Component (`CertificationBadge.tsx` & `CertificateModal.tsx`)
To fulfill the user's requirement for **Certifications (`الشهادات`)**:
- **Visual Hallmark Mark:** Digital replica of traditional Swiss assay stamps (e.g., Geneva Seal, COSC Chronometer Certified, RJC Chain of Custody).
- **Interactive Verification Modal:**
  - Official Issuing Organization (e.g., *Contrôle Officiel Suisse des Chronomètres*).
  - Certificate Registration Number & Serial ID.
  - Date of Issue and Expiration.
  - Test Results & Tolerances (e.g., `-4/+6 seconds per day mean daily rate`).
  - High-resolution encrypted certificate scan viewer with download option.
