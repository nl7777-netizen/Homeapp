# NSW Property Purchase & Exit Strategy Planner

A **production-grade, 100% client-side** React + TypeScript SPA that models the full journey for Australian couples: **sell / keep / rentvest** an existing NSW property (Phase 1), then **purchase a target NSW property** with full borrowing viability, APRA stress testing and a month-by-month 30-year payoff (Phase 2).

**Privacy first:** every calculation runs locally in your browser. Your data is stored only in `localStorage`. The optional AI features talk **only** to your own [LM Studio](https://lmstudio.ai) server — zero cloud lock-in, zero telemetry.

---

## Features

### Phase 1 — Exit Strategy (4 scenarios, apples-to-apples)
| Scenario | Strategy |
|---|---|
| **A** | Sell now, live with parents, compound after-tax proceeds |
| **B** | Keep as PPOR (P&I / interest-only / P&I + surplus-to-offset modes) |
| **C** | Rent it out, then sell at the target date |
| **D** | Rentvest — extract equity at 80% LVR and deploy it |

- Exact **ATO CGT** rules: PPOR exemption, the **6-year absence rule**, the **s.118-192 value reset** (value at first rental), investment CGT with the 50% discount, and the **post-1-Jul-2027 reform mode** (no discount + CPI indexation + 30% floor).
- **Negative gearing** with the 2027 loss-quarantine for non-grandfathered properties.
- NSW land tax, holding costs (strata/council/insurance/water/utilities), agent fees, vacancy, PM fees.
- **Breakeven solvers**: the property growth rate at which keeping/rentvesting ties selling, and the loan rate at which the winner flips.
- Full line-item ledger per scenario + wealth-comparison chart.

### Phase 2 — Target Purchase
- **Three purchase cases** with strict zero-double-counting of equity:
  - Case 1: buy now — existing property proceeds fund the deposit
  - Case 2: deferred purchase, no existing property — after-tax savings horizon (HISA or ETF mode, wage growth, CPI)
  - Case 3: deferred purchase **with** existing property — Phase 1 deployable equity *replaces* the starting pool
- Exact **NSW stamp duty** ("per $100 or part thereof" tiers), **FHBAS** first-home concession, banded **LMI** (with 9% NSW duty on the premium; capitalise or pay upfront).
- **APRA +3% stress test**, DTI, repayment-stress ratio, surplus cushion, and a ±1% interest-rate sensitivity table.
- Month-by-month **30-year mortgage simulation**: exact amortisation, offset account (with buffer), family co-loan snowball, life events (income shocks, one-off offset deposits/withdrawals), and a 30-year equity-projection chart.

### Local AI (LM Studio)
- **AI Suburb Lookup** — live suburb prices/growth/yield via web search + structured (JSON-schema) extraction; offline fallback to the built-in 43-suburb database with an "Offline Estimate" badge.
- **AI Scenario Review** — streaming, private, in-browser review of your exact plan (quick prompts included).
- **Safe AI Tax & Duty Update Checker** — fetches current ATO figures, diffs them against the embedded tables, and applies **only** after explicit confirmation (saved as a selectable custom FY table).

### Data & Sharing
- 43-suburb NSW baseline database (editable — add custom suburbs).
- Full **JSON export/import** and compact **lz-string sync codes** (`NSWPP1.<checksum>.<payload>`) with version header + djb2 checksum verification.
- Named **saved scenarios** in localStorage.
- Dark/light theme, sticky summary bar, `tabular-nums` money formatting.

---

## Tech Stack

- **React 19 + TypeScript** (`strict: true`, zero `any`) + **Vite 7**
- **Tailwind CSS v4** (`@tailwindcss/vite`), dark mode via custom variant
- **Recharts 3** (equity projection + exit wealth comparison), **Lucide** icons
- **Zustand 5** store with debounced `localStorage` persistence + forward-migration
- **Vitest** — **105 tests** covering every financial engine (ATO tax values, duty tiers, CGT rules, mortgage convergence, orchestrator zero-double-counting, sync-code round-trips)
- Pure deterministic engines (`src/engine/*`) — the UI is a thin view over `runMasterPlanner(state)`

## Getting Started

```bash
npm install
npm test          # 105/105
npm run dev       # local dev server
npm run build     # tsc --noEmit && vite build  (dist/ uses ./ relative assets)
npx preview       # preview the production build
```

## Deploying to GitHub Pages

The repo is pre-wired for Pages: `base: './'` in `vite.config.ts`, state-based tab navigation (no history routes), and a CI workflow.

1. Push the repository to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
3. Done — `.github/workflows/deploy.yml` runs `npm ci → npm test → npm run build` on every push to `main` and deploys `dist/` to Pages.

## Local AI Setup (LM Studio)

1. Install [LM Studio](https://lmstudio.ai) and download a chat model (14B+ recommended for structured output).
2. **Developer tab → Start Server** (default port `1234`).
3. **Server Settings → enable CORS** (the browser calls `http://localhost:1234/v1` directly).
4. In the app: click **Local AI** (top-right) → the base URL is pre-filled (`http://localhost:1234/v1`) → **Test** → pick a model.

Everything (model list, chat, structured suburb extraction, tax checks) runs on your machine.

## Optional Web Search Proxy

The AI suburb lookup and tax-update checker can pull live data. Two options:

**A. Local proxy (recommended — keys never touch the browser):**

```bash
# Node 20+ required (native fetch, zero dependencies)
SERPER_API_KEY=your-key node scripts/local-search-proxy.mjs
# — or —
BRAVE_API_KEY=your-key node scripts/local-search-proxy.mjs
# — or —
SERPAPI_KEY=your-key node scripts/local-search-proxy.mjs
```

Then in **Local AI Settings**: provider = *Local proxy*, URL = `http://localhost:8787/search`.

**B. Direct Serper:** provider = *Serper.dev*, paste your API key (stored only in `localStorage`).

**No provider?** Everything still works offline from the built-in suburb database — AI results are marked "Offline Estimate".

## Repository Layout

```
src/
  data/          taxTables (4 FYs, ATO exact) · nswDutyAndLandTax · nswSuburbs (43)
  types/         planner.ts — every interface in the app
  engine/        taxEngine · stampDutyEngine · exitPlannerEngine · futureSavingsEngine
                 mortgageEngine · viabilityEngine · masterOrchestrator
  services/      lmStudioClient · searchClient · aiWorkflows · persistence
  store/         usePlannerStore (Zustand + localStorage)
  components/    ui primitives · layout/StickySummaryBar · tabs/ (4) ·
                 charts/ (2) · modals/ (4)
  __tests__/     5 suites, 105 tests — all financial math
scripts/         local-search-proxy.mjs
.github/         workflows/deploy.yml
```

## Disclaimer

Estimates only — not financial, tax or legal advice. ATO tables, NSW duty/land-tax schedules and LMI bands are embedded data that may lag legislative change. Verify with the ATO, Revenue NSW and your lender before acting.
