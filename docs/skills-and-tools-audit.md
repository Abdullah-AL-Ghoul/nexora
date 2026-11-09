# NEXORA — Skills & Tools Intelligence Audit

**Execution Date:** November 2026  
**Auditing Team:** System Integration Engineer, AI Capabilities Lead, Tooling Specialist  
**Scope:** Evaluation of all global, project, and plugin skills and MCP tools available in the workspace.  

---

## 1. Skills Ecosystem Inventory & Utilization Matrix

The Antigravity agentic environment provides access to specialized domain skills. Each skill has been examined for architectural fit, operational utility, and mapping to the Nexora engineering roadmap:

| Skill / Tool Name | Category | Origin | Status | Primary Purpose in Nexora | Phase Applied |
|---|---|---|---|---|---|
| `project-engineering-orchestrator` | Engineering & Architecture | Global Skill | **Active** | Master 8-stage pipeline governance, architectural discipline, DoD enforcement. | Phases 00–08 |
| `ui-ux-pro-max` | UI/UX & Design Systems | Global Skill | **Active** | Luxury color palettes, typography scales, spacing tokens, responsive layouts. | Phases 03, 04 |
| `react-best-practices` | Frontend Performance | Vercel Plugin | **Active** | 70 rules for eliminating render waterfalls, React 19 compiler compliance, RSC optimization. | Phases 04, 05, 07 |
| `frontend-craft` | Visual Design Quality | Global Skill | **Active** | Anti-AI-tell avoidance, bespoke micro-interactions, editorial aesthetic polish. | Phases 03, 04 |
| `ux-writing` | Product Copy & Tone | Global Skill | **Active** | Microcopy, bilingual luxury terminology (English/Arabic), empty/error states. | Phases 02, 04, 06 |
| `playwright-best-practices` | QA & Automated Testing | Global Skill | **Active** | End-to-end journey tests, modal accessibility tests, role-based admin assertions. | Phase 08 |
| `prisma-client-api` | Database Engineering | Project Skill | **Active** | Complex transactional queries, relational joins, atomic decrements, ledger auditing. | Phases 05, 06 |
| `prisma-orm-setup` | Database Engineering | Project Skill | **Active** | Prisma 7 schema evolution, migration safety, connection pooling with pg driver adapter. | Phase 05 |
| `web-performance` / `core-web-vitals` | Performance Engineering | Global Skill | **Active** | LCP, INP, CLS optimization, font preloading, image sizing, bundle reduction. | Phase 07 |
| `a11y-debugging` / `web-accessibility` | Accessibility (a11y) | DevTools Plugin | **Active** | WCAG 2.2 AA verification, focus rings, screen reader labels, keyboard tab traps. | Phases 04, 07, 08 |
| `api-security-testing` | Application Security | Global Skill | **Active** | OWASP API Top 10 auditing, role-escalation checks, IDOR/BOLA prevention. | Phases 05, 07 |
| `framer-motion-animator` / `web-animation` | Motion Design | Global Skill | **Active** | Smooth card reveals, spring transitions, drawer animations with reduced-motion support. | Phase 04 |
| `modern-web-guidance-plugin` | Modern Web Standards | Plugin | **Active** | Next.js App Router idioms, web standards alignment, modern CSS features. | Phases 04, 05 |

---

## 2. MCP Tools & Runtime Capability Audit

| Tool / Provider | Execution Mode | Capabilities & Permissions | Current Operational State |
|---|---|---|---|
| **PowerShell Terminal (`run_command`)** | Windows 11 Sandboxed & Bypass | Project commands, npm scripts, git operations, local postgres daemon control. | Fully operational (PostgreSQL daemon running, tests passing). |
| **Web Search (`search_web`)** | External Knowledge Retrieval | Multi-engine real-time web querying for design trends, benchmarks, and libraries. | Fully operational (Benchmarked 10 luxury leaders). |
| **Prisma 7 ORM Engine** | Local Native CLI | Schema migration, database introspections, type-safe client generation. | Healthy (PostgreSQL 17 on port 5432). |
| **Chrome DevTools MCP** | Browser Automation & Debugging | Headless DOM inspection, accessibility tree auditing, console log capture. | Available for runtime inspection turns. |
| **Vitest & Playwright** | Native Test Runners | 44 unit/integration tests and 48 E2E tests against live database. | Verified operational. |

---

## 3. Skills & Tools Gap Analysis

1. **Persistent Cloud Storage SDK:**
   - *Current State:* Image upload saves directly to the local filesystem (`public/uploads`) with a Base64 fallback.
   - *Recommendation:* In a future production deployment phase, integrating the `@vercel/blob` or AWS S3 SDK via a secure server action will ensure uploads persist across serverless instances.
2. **Dynamic PDF Generation Tool:**
   - *Current State:* Invoices and receipts use browser print CSS (`components/admin/order-print-button.tsx`).
   - *Recommendation:* When adding digital authenticity certificates, integrating a lightweight server-side PDF generator (`@react-pdf/renderer` or SVG-to-PDF) will allow patrons and admins to download tamper-evident cryptographic Certificates of Authenticity directly.
