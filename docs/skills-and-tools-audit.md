# NEXORA — Skills, Plugins & Tools Intelligence Report
**Phase 03 Deliverable — Capability Mapping & Environmental Audit**
*Document Version:* 1.0.0  
*Date of Audit:* November 2026  
*Auditors:* Software Architect, Tools & Plugins Specialist

---

## 1. Environment & Capability Overview

The Antigravity development environment provides an extensive ecosystem of specialized skills, Model Context Protocol (MCP) servers, and plugin integrations.

This audit evaluates:
1. Available skills and their domain relevance to NEXORA.
2. Connected plugins and their authentication status.
3. Recommended workflow alignment across project phases.
4. Gaps and missing external prerequisites.

---

## 2. Skills Inventory & Domain Mapping

| Skill Name | Path / Source | Domain | Operational Role in NEXORA | Lifecycle Phase | Status |
|---|---|---|---|---|---|
| **`project-engineering-orchestrator`** | `~/.agents/skills/project-engineering-orchestrator/SKILL.md` | Orchestration | Master 8-stage software engineering pipeline governance | Phases 00–08 | **Active** |
| **`ui-ux-pro-max`** | `~/.agents/skills/ui-ux-pro-max/SKILL.md` | UI/UX Design | 119 UX guidelines, luxury palettes, accessibility standards | Phases 03–06 | **Active** |
| **`react-best-practices`** | `~/.gemini/config/plugins/vercel-plugin/skills/react-best-practices/SKILL.md` | Frontend Perf | Vercel 70-rule React & Next performance guidelines, waterfall elimination | Phases 04–07 | **Active** |
| **`a11y-debugging`** | `~/.gemini/config/plugins/chrome-devtools-plugin/skills/a11y-debugging/SKILL.md` | Accessibility | WCAG 2.2 AA auditing, ARIA labels, focus states, tap targets | Phases 04, 07, 08 | **Active** |
| **`modern-web-guidance`** | `~/.gemini/config/plugins/modern-web-guidance-plugin/skills/modern-web-guidance/SKILL.md` | Web Standards | Modern HTML/CSS, dialogs, popovers, view transitions, scroll reveals | Phases 03–05 | **Active** |
| **`auth-implementation-patterns`** | `~/.agents/skills/auth-implementation-patterns/SKILL.md` | Security & Auth | Jose HS256 JWT, scrypt hashing, RBAC enforcement | Phases 05, 06 | **Active** |
| **`api-security-testing`** | `~/.agents/skills/api-security-testing/SKILL.md` | API Security | OWASP API Security Top 10, IDOR/BOLA audit, rate limiting | Phases 05, 07 | **Active** |
| **`web-performance`** | `~/.agents/skills/web-performance/SKILL.md` | Performance | Bundle size optimization, image payloads, Core Web Vitals | Phases 07, 08 | **Active** |
| **`seo-best-practices`** | `~/.agents/skills/seo-best-practices/SKILL.md` | SEO Strategy | Semantic HTML, JSON-LD, sitemaps, canonical tags | Phases 07 | **Active** |
| **`playwright-best-practices`** | `~/.agents/skills/playwright-best-practices/SKILL.md` | E2E Testing | Automated journey testing, checkout simulation, multi-viewport QA | Phase 08 | **Active** |
| **`ux-writing`** | `~/.agents/skills/ux-writing/SKILL.md` | Microcopy & RTL | Arabic/English microcopy, empty states, luxury product voice | Phases 02, 04 | **Active** |
| **`design-system`** | `~/.agents/skills/design-system/SKILL.md` | Tokens & UI | Three-layer token architecture (Primitive $\to$ Semantic $\to$ Component) | Phase 03 | **Active** |
| **`firebase-security-rules-auditor`** | `~/.gemini/config/plugins/firebase/skills/firebase_security_rules_auditor/SKILL.md` | Firebase Rules | Firestore security rules auditing (`firestore.rules`) | Phase 07 | **Active** |

---

## 3. Plugins & MCP Servers Audit

### 3.1 Connected Plugins
- **`gcalendar` / `gdocs` / `gsheets`**: Connected via OAuth2 (`ynab2025@gmail.com`). Can be utilized for exporting inventory reports, tracking client concierge schedules, or syncing external product spreadsheets if requested.
- **`chrome-devtools` (MCP Server)**: Active. Provides lazy-loaded tools for browser automation, network inspection, console message logging, and DOM snapshots.
- **`gemini-api_gemini-api-docs` (MCP Server)**: Active. Provides documentation lookup for Gemini multimodal, structured outputs, and grounding.

### 3.2 Plugins Requiring Sign-In (Optional / Deferred)
- **`mobbin`**: Needs sign-in (`<plugin-card catalog-id="mobbin"></plugin-card>`). Mobbin is an external UI screenshot library; not required for local execution as local benchmarks and web search provide complete design intelligence.
- **`notion`**: Needs sign-in. Not required for local execution.
- **`vercel-plugin`**: Needs sign-in. Not required as NEXORA is currently hosted on local Express/Vite full-stack server.

---

## 4. Skills & Tools Gap Analysis

| Capability Required | Available Tool / Strategy | Status | Impact & Workaround |
|---|---|---|---|
| **Binary Image File Upload** | Multer (`npm i multer`) + Sharp (already installed in `devDependencies`) | **Ready to Implement** | Express API requires a dedicated `/api/upload` endpoint using Multer to write images to `public/img/uploads/` and persist records in SQLite. |
| **Automated E2E Browser Testing** | Playwright (`@playwright/test`) or Supertest Integration Tests | **Mitigated** | 41 Supertest integration tests currently cover all backend routes; Playwright can be introduced in Phase 08 for automated multi-viewport regression testing. |
| **Cloud Storage (Optional)** | Cloudinary, S3, or Firebase Storage | **Local First** | Following the "boring architecture" principle, storing optimized WebP images locally under `public/img/` requires zero cloud credentials and ensures 100% offline autonomy. |
