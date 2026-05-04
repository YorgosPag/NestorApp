# ADR-331 — Enterprise Spend Analytics Page

**Status:** ✅ IMPLEMENTED 2026-05-04 — Phase A–H COMPLETE. Tutti i file, test e ADR finalizzati.
**Date:** 2026-05-04
**Author:** Claude (Opus 4.7, Plan Mode + Q&A) + Γιώργος
**Extends:** ADR-330 §3 Phase 6 (Cross-project Dashboard widget — MVP completato)
**Related:** ADR-267 (Procurement module), ADR-327 (Quote Management), ADR-329 (BOQ Granularity), ADR-300 (Stale-while-revalidate cache), ADR-328 (RouteTabs SSoT), ADR-282 (Contact Persona / supplier FK), ADR-175 (BOQ / ATOE categories)

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-04 | ✅ **Phase H COMPLETED — commit `TBD` — Jest tests + ADR finalization (D26)**. Files: 4 (3 NEW test files + 1 EXPORT + ADR). EXPORT `isActiveDrill` + `applyAnalyticsDrill` from `src/hooks/procurement/usePurchaseOrders.ts` (previously module-private). NEW `src/hooks/procurement/__tests__/usePurchaseOrders.drill.test.ts` (33 tests: `applyAnalyticsDrill` date-range/projectIds/supplierIds/statuses/categoryCodes/combination/edge-case coverage; `isActiveDrill` 7 cases). NEW `src/app/procurement/analytics/_components/__tests__/chart-utils.test.ts` (28 tests: `buildPurchaseOrdersUrl` URL structure + filter serialization + override precedence; `formatEurShort` short-form cases; `readClickedRowKey` null/missing/type guards; `truncateLabel` under/equal/over + custom max). NEW `src/lib/url-filters/__tests__/multi-value.test.ts` (21 tests: `parseFilterArray` null/empty/trim/filter; `serializeFilterArray` empty/undefined/join; `parseDateOrDefault` valid/invalid/fallback). Total: 82 pure unit tests. Status: ✅ APPROVED → ✅ IMPLEMENTED. |
| 2026-05-04 | ✅ **Phase G COMPLETED — commit `0739bff4` — Hub adjustment (D1=A)**. Files: 4 (3 MODIFY + 1 DELETE + 1 ADR). MODIFY `HubLanding.tsx`: removed `SpendAnalyticsCard` import + JSX (hub 7→6 cards); added `useTranslation` + fixed pre-existing hardcode `aria-label="Procurement Hub"` → `t('hub.pageLabel')` (Boy Scout N.11). MODIFY `ProcurementDashboardSection.tsx`: added `Link` (next/link) + `ChevronRight` (lucide); `<h2>` title "Επισκόπηση Εταιρείας" now wraps a `<Link href="/procurement/analytics">` with `group` hover-reveal ChevronRight icon. Zero new i18n keys (all existing keys reused). ZERO `any`, ZERO hardcoded strings. |
| 2026-05-04 | ✅ **Phase F COMPLETED — commit `d4b5476e` — Drill-down URL filter integration (D5)**. Files: 4 (3 MODIFY + 1 ADR). NEW type `AnalyticsDrillFilters` in `src/types/procurement/purchase-order.ts` (from/to date range + multi-value projectIds/supplierIds/categoryCodes/statuses readonly arrays) + re-exported from `src/types/procurement/index.ts`. MODIFY `src/hooks/procurement/usePurchaseOrders.ts`: added `isActiveDrill` + `applyAnalyticsDrill` pure helpers (client-side overlay — date range on `dateCreated.substring(0,10)`, multi-value projectId/supplierId/status includes check, `items[].categoryCode` sub-array OR-match); hook accepts optional `drill?: AnalyticsDrillFilters` — `hasDrill` guards a `drillFiltered` useMemo inserted between fetch and text-search layers; `isDefaultFilters` excludes drill to skip stale cache. MODIFY `src/app/procurement/purchase-orders/page.tsx`: `useSearchParams()` reads 5 canonical params (`from`,`to`,`projectId`,`supplierId`,`categoryCode`,`status`); `parseDateParam` nullable validator; `parseFilterArray` SSoT reused; `analyticsDrill` memo passed to `usePurchaseOrders(analyticsDrill)`. Zero API changes. Backward compatible: 5 existing callers pass no param → `hasDrill=false` → exact pre-Phase-F behavior. |
| 2026-05-04 | ✅ **Phase E COMPLETED — Recharts charts (5 chart components + drill-down + Pareto)**. Files: 9 (6 NEW + 3 MODIFY: ADR + el/en procurement.json + AnalyticsPageContent integration). 1 NEW helper `_components/chart-utils.ts` (~55 LOC: `formatEurShort`, `buildPurchaseOrdersUrl` reusing `serializeFilterArray` SSoT, `readClickedRowKey` typed Recharts onClick narrower, `truncateLabel`). 5 NEW chart components under `_components/`: `SpendByCategoryChart.tsx` (~120 LOC, horizontal BarChart top-10 ATOE, drill-down `categoryCode`), `SpendByVendorPareto.tsx` (~165 LOC, ComposedChart bar + cumulative-% line, drill-down `supplierId`, dual-axis), `SpendByProjectChart.tsx` (~115 LOC, vertical BarChart top-10 with `useProjectsList` SSoT name resolution, drill-down `projectId`), `MonthlyTrendChart.tsx` (~115 LOC, single-line current period + i18n `previousPending` note since aggregator B1 doesn't yet expose previous-period monthly series), `BudgetVsActualChart.tsx` (~165 LOC, ComposedChart 3 grouped bars budget/committed/delivered + custom `TooltipProps<number,string>` content + off-budget detection `budget===0 && committed>0` with ⚠ label prefix and i18n warning line). MODIFY `_components/AnalyticsPageContent.tsx` (+50 LOC): renders all 5 charts under KpiTiles in `lg:grid-cols-2` grid, full 5-fold `ComponentErrorBoundary` (D27), section hidden when `isEmpty`. MODIFY `src/i18n/locales/{el,en}/procurement.json`: 26 new keys under `procurement.analytics.charts.*` (D16, zero hardcoded strings). CSS vars `--chart-1..5` already shipped in `globals.css` lines 108-112 (light) / 198-202 (dark) — no `globals.css` change needed. ZERO `any`, ZERO `as any`, ZERO inline styles, semantic `<figure>`/`<figcaption>`/`<section>` throughout. SSoT reuse: `formatCurrency`, `KpiChartSkeleton`, `ComponentErrorBoundary`, `serializeFilterArray`. Drill-down URL builder forwards date range + status + non-overridden filter arrays for full filter persistence on PO list (Phase F integration target). |
| 2026-05-04 | ✅ **Phase D COMPLETED — Page rewrite + Filter bar + KPI tiles + Refresh + Export**. Files: 9 (8 NEW + 3 MODIFY: ADR + el/en procurement.json). `src/app/procurement/analytics/page.tsx` REWRITE (45 LOC, **server component**: `cookies()` → `verifySessionCookieToken` → `canViewSpendAnalytics(globalRole)` → `redirect('/projects')` if forbidden, `redirect('/login')` if no session, dev bypass ⇒ `company_admin`). 7 NEW client components under `_components/`: `AnalyticsPageShell.tsx` (24 LOC, PageContainer + ProcurementSubNav + content), `AnalyticsPageContent.tsx` (60 LOC, owns `useSpendAnalytics`, dispatches to filters/KPI/refresh/export, `ComponentErrorBoundary` wraps), `AnalyticsFiltersBar.tsx` (210 LOC: 5 filters via `MultiCombobox` SSoT for project/supplier/category/status, 3 status preset chips D12, mobile collapse drawer D19, clear-all helper, `useProjectsList` + `usePOSupplierContacts` for option sources), `AnalyticsKpiTiles.tsx` (122 LOC: 4 KPI cards w/ Δ% badge ↑↓ icon, "—" + tooltip when no historical data D8, `KpiCardSkeleton` during load D18, `formatCurrency` SSoT D21), `AnalyticsRefreshButton.tsx` (29 LOC, manual refresh D28), `AnalyticsExportButton.tsx` (90 LOC, dropdown CSV/XLSX, builds query via `serializeFilterArray` SSoT, `triggerExportDownload` blob handler), `AnalyticsEmptyState.tsx` (22 LOC, CTA → `/procurement/new` D17). i18n: 35 keys added under `procurement.analytics.*` namespace in both `el` + `en` (D16: zero hardcoded strings, all `t()` references). ZERO `any`, ZERO inline styles, semantic HTML throughout (`section`/`header`/`main`/`output`). |
| 2026-05-04 | ✅ **Phase C COMPLETED — Hook + URL serialization + event bus**. Files: 6 (3 NEW + 3 MODIFY, +1 ADR). `src/lib/url-filters/multi-value.ts` (37 LOC) — pure `parseFilterArray` / `serializeFilterArray` / `parseDateOrDefault` SSoT for comma-separated multi-value filter params. `src/lib/cache/spend-analytics-bus.ts` (33 LOC) — module-singleton `EventTarget`-backed bus, exports `emitSpendAnalyticsInvalidate()` + `onSpendAnalyticsInvalidate(handler)` (Tier-2 SSoT helper, sync, fire-and-forget; SSR-safe fallback). `src/hooks/procurement/useSpendAnalytics.ts` (174 LOC) — URL-as-SSoT filters via `useSearchParams`, `setFilters` writes via `router.push(..., { scroll: false })`, ADR-300 stale cache keyed by query string, 250 ms debounce, `AbortController` per fetch, bus subscription on mount, manual `refresh()`. MODIFY: `procurement-mutation-gateway.ts` + `ProcurementDetailPageContent.tsx` emit on save / status action / duplicate post-success (5 emit sites total). MODIFY: `/api/procurement/spend-analytics/route.ts` + `/api/procurement/spend-analytics/export/route.ts` refactored to use new `parseFilterArray` SSoT (removed 2 local duplicates). |
| 2026-05-04 | ✅ **Phase B2 COMPLETED — Export endpoint (CSV + Excel multi-sheet)**. Files: 4 (3 NEW + 1 MODIFY ADR). `src/lib/export/analytics-csv.ts` (62 LOC) — pure CSV serializer, denormalized `[Section,Key,V1,V2,V3]` layout, RFC-4180 escape. `src/lib/export/analytics-xlsx.ts` (118 LOC) — multi-sheet workbook builder via **ExcelJS @4.4.0** (SSoT deviation from ADR-original `xlsx@0.18`: exceljs already installed in package.json line 193 + 29 files in repo use it; new dep would violate ENTERPRISE TERMINAL PROHIBITION 2 + N.0 SSoT). 6 sheets: Overview · By Vendor · By Category · By Project · Monthly Trend · Budget vs Actual. Header styling + currency `#,##0.00` numFmt + auto-width columns reused from `src/subapps/accounting/services/export/excel-exporter.ts` pattern. `src/app/api/procurement/spend-analytics/export/route.ts` (95 LOC) — `GET ?format=csv\|xlsx`, withHeavyRateLimit (10 req/min code-canonical) + withAuth + `canViewSpendAnalytics` RBAC, default xlsx, default range current quarter, filename `spend-analytics-{from}_{to}.{ext}`. NextResponse with Buffer body for xlsx, string body for csv. |
| 2026-05-04 | ✅ **Phase B1 COMPLETED — Server Aggregator + API + Helpers**. Files: 6 (5 NEW). `spendAnalyticsAggregator.ts` (288 LOC): cross-project PO+BOQ aggregation, Athens TZ range, 7 pure computation functions, `db.getAll()` vendor name batch, `Promise.all` parallel current+previous+BOQ. `quarter-helpers.ts` (85 LOC): `getCurrentQuarterRange`, `getPreviousPeriod`, Athens TZ helpers (`athensOffsetHours`, `athensDateRangeToUtc`). `spend-analytics.ts` RBAC: `canViewSpendAnalytics(globalRole)` SSoT. `route.ts` (78 LOC): `withHeavyRateLimit(withAuth(handleGet))`, default quarter range, array param parser. Test suite: 17 pure-helper Jest assertions (quarter, TZ, RBAC). No new Firestore indexes — existing `companyId+isDeleted+dateCreated` covers range query. Accountant project-role → Phase H. |
| 2026-05-04 | ✅ **Phase B0 COMPLETED — MultiCombobox SSoT**. Files: 4 (3 NEW + 1 MODIFY `.ssot-registry.json`). Pattern: Radix Popover + Checkbox + native input search + chip-based UI. ~215 LOC component, ~115 LOC tests. 5 i18n keys added to `common.json` (el+en). Tier-1 SSoT module registered in `.ssot-registry.json` with 2 forbiddenPatterns + 4-entry allowlist. Boy Scout follow-up post Phase H: migrate 3 domain duplicates (PropertyMultiSelectByBuilding, FloorMultiSelectField, BOQEditorScopeSection). |
| 2026-05-04 | ✅ **ROUND 2 RESOLVED — ALL 29 DECISIONS APPROVED** — D10-D16 critici risolti via Q&A in greco (memoria `feedback_adr_questions_style`). Sintesi Round 2: **D10=D** RBAC hybrid (admin/owner/accountant only; site managers redirect a project-overview esistente) · **D11=C** default date range Current Quarter (Greek ΦΠΑ aligned, comparison Q-1 auto-derived) · **D12=B** all multi-select filters (chip-based UI, `where(field, in, [...])` Firestore) · **D13=B** build new SSoT `MultiCombobox` in `src/components/ui/` (Radix Popover + Checkbox + search, ~250 LOC; Boy Scout post-Phase 1: migrate 3 esistenti domain duplicates) · **D14=C** event-bus cache invalidation (`spend-analytics-bus.ts` Tier-2 helper + ADR-300 stale + manual refresh button) · **D15=B** `withHeavyRateLimit` 15/min per aggregator + export endpoints · **D16=A** `procurement.analytics.*` i18n namespace (consistency con repo convention). Round 2 + auto-defaulted D17-D29 (D17 empty state, D18 skeleton, D19 mobile, D20 top-10, D21 currency, D22 colors, D23 ARIA, D24 print out, D25 Athens TZ, D26 pure helper tests, D27 error boundary, D28 stale+manual, D29 empty=All). Status: 📋 PROPOSED Round 2 → ✅ APPROVED. Phase B-H ready for implementation. Token budget aggiornato: ~120-180k tokens (3-4 sessioni Opus 4.7). |
| 2026-05-04 | 📋 **ROUND 2 — RE-READ + GAP ANALYSIS** — Giorgio richiede re-lettura ADR per identificare decisioni mancanti prima di implementation. Identificati **20 gap aggiuntivi** (D10-D29). Categorizzati: **D10-D16 = critici** — Q&A in corso. **D17-D29 = nice-to-have** — auto-defaulted con Giorgio's trust mandate ("σε εμπιστεύομαι"), industry standard pattern + repo convention reuse. Status: ✅ APPROVED → 📋 PROPOSED (Round 2). Phase B-H bloccata fino risoluzione D10-D16. |
| 2026-05-04 | ✅ **ROUND 1 RESOLVED — D1-D9 APPROVED** — D1–D9 completati via Q&A in greco semplice una alla volta (memoria `feedback_adr_questions_style`). Sintesi decisioni: **D1=A** Procore-style (inline widget hub + kill SpendAnalyticsCard) · **D2=B** 5 filtri standard (date range + project + supplier + category + status) · **D3=B** server-side aggregator + REST endpoint · **D4=A** Recharts 2.15 (zero new dep) · **D5=B** drill-down via navigation con URL filter · **D6=B** export CSV + Excel xlsx multi-sheet · **D7=B** URL-only persistence (browser bookmarks) · **D8=A** comparison period always-on (Δ% vs previous equivalent) · **D9=A** Budget vs Committed vs Delivered cross-project. Mandate Giorgio: GOL + SSOT, full enterprise scope, no MVP variants. |
| 2026-05-04 | 📋 **PROPOSED** — bozza iniziale post deep-research codebase. Identificate 9 decisioni aperte (D1–D9) che bloccano implementation. Q&A con Giorgio in corso (greco semplice, una alla volta). Placeholder `/procurement/analytics` da sostituire con page enterprise dedicata. |

---

## 1. Context

ADR-330 Phase 6 ha consegnato un **MVP widget** sulla landing del hub `/procurement` (`ProcurementDashboardSection.tsx`):
- 4 KPI tiles: totalPOs / committed€ / delivered€ / activeSuppliers
- Spend-by-category top-5 (CSS bars custom)
- Monthly trend last 6 months (CSS bars custom)
- Pure `useMemo` su `usePurchaseOrders()` — no API extra

In contemporanea, `/procurement/analytics` è un **placeholder** (~25 LOC, "Φάση 6 — Έρχεται"), linkato dalla `SpendAnalyticsCard` sul hub e dal tab "Αναλυτικά" del `ProcurementSubNav`.

### 1.1 Problema

Il pattern "placeholder Coming Soon in production" non è enterprise-grade (memoria Giorgio: μπακάλικο γειτονιάς). I big player del settore convergono su un **modulo Spend Analytics dedicato** con caratteristiche standard:

| Vendor | Spend Analytics offering | Pattern chiave |
|--------|--------------------------|----------------|
| **Procore Analytics** | Power BI embedded, dashboard pre-built per Commitments/Budgets/Forecasts | Date range + drill-down + export |
| **SAP S/4HANA EPPM** "Spend Analysis" Fiori app | Multi-dim filter (vendor/material/category/plant/period), variant management, Excel export | Variant-saved-views |
| **Oracle Procurement Cloud OTBI** | Infolet (mini-widget) → click → full analysis report | Hub widget + dedicated page (esattamente il pattern attuale di Pagonis) |
| **Autodesk Construction Cloud Insight** | Clickable widgets, custom filter sets, scheduled email export | Clickable hub widgets espandibili |
| **Buildertrend** "Job Costs Report" | Filtri jobsite/category/vendor + CSV/PDF export | Lightweight ma completo |

**Pattern dominante:** dashboard widget sull'hub (overview at-a-glance) + page dedicata per analisi profonda (filter + drill-down + export). Pagonis ha già il widget; manca la page.

### 1.2 Stato attuale verificato (2026-05-04)

| Asset | File | Cosa fa | Riusabilità |
|-------|------|---------|-------------|
| Hub widget | `src/components/procurement/hub/ProcurementDashboardSection.tsx` | 4 KPI + 2 mini-chart, pure client | ✅ tieni come overview hub |
| Hub data hook | `src/hooks/procurement/useProcurementDashboard.ts` | `useMemo` su POs cached | ✅ riusa la logica dei totali base |
| Project Overview chart | `src/components/projects/procurement/overview/kpi/ChartBudgetVsCommitted.tsx` | Recharts `BarChart` con tooltip + responsive | ✅ pattern riusabile per nuovi chart page |
| Server aggregator | `src/services/procurement/aggregators/projectProcurementStats.ts` + `projectBoqCoverageStats.ts` | Firestore Admin + `safeFirestoreOperation` | ✅ pattern per nuovo `spendAnalyticsAggregator` cross-project |
| Supplier metrics | `src/services/procurement/supplier-metrics-service.ts` | Per-vendor totalSpend / on-time / lead time / category breakdown | ✅ riusabile per "Spend by Vendor" |
| Recharts | `package.json` | 2.15.1 MIT | ✅ già installato |
| date-fns | `package.json` | 3.6 MIT | ✅ già installato per filtri date range |
| Stale cache | `src/lib/stale-cache.ts` (ADR-300) | `createStaleCache<T>(key)` | ✅ pattern per cache spend-analytics |

### 1.3 Vincoli

- **GOL+SSOT** mandate Giorgio (memoria `feedback_completeness_over_mvp`): full enterprise scope, no MVP/phased varianti.
- **Industry standard = default answer** (memoria `feedback_industry_standard_default`): dove 4-5 player convergono → quella è la risposta.
- **CLAUDE.md N.7.1**: ≤500 LOC/file, ≤40 LOC/function — split aggressivo richiesto.
- **CLAUDE.md N.11**: zero hardcoded i18n strings, zero `defaultValue: 'literal'`.
- **CLAUDE.md N.5**: nuove dipendenze solo MIT/Apache/BSD (Recharts già OK).
- **CLAUDE.md N.0.1**: ADR-driven workflow — questo file in PROPOSED → APPROVED post-Q&A → IMPLEMENTED post-codice.
- **No Vercel push** senza ordine esplicito (CLAUDE.md N.(-1)).

---

## 2. Decision (RESOLVED 2026-05-04)

Adottare un modello a **2 superfici** (Procore Project Home + Oracle OTBI hybrid):

### 2.1 Hub `/procurement` landing
- ✅ **Mantieni** `ProcurementDashboardSection` (4 KPI + 2 mini-chart) come overview at-a-glance inline
- ✅ **Rendi cliccabile** il titolo "Επισκόπηση Εταιρείας" → naviga a `/procurement/analytics`
- ❌ **Rimuovi** `<SpendAnalyticsCard />` dalla grid `HubLanding.tsx` (ridondante col widget — D1=A)
- Grid card hub passa da 7 → 6 cards

### 2.2 Page `/procurement/analytics` (rewrite del placeholder)

**Layout dall'alto in basso:**

```
┌─────────────────────────────────────────────────────────────┐
│ ProcurementSubNav                                           │
├─────────────────────────────────────────────────────────────┤
│ [📅 Date range] [🏗️ Έργο ▼] [👥 Προμηθευτής ▼]              │
│ [📦 Κατηγορία ▼] [📋 Status ▼] [Καθαρισμός] [Export ▼]     │  ← D2 + D6
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│ │ Total   │ │ Comm.   │ │ Deliv.  │ │ Vendors │             │  ← KPI tiles
│ │ POs     │ │ €128.5k │ │ €82.3k  │ │   12    │             │  + Δ% (D8=A)
│ │   47    │ │ ↑+15%   │ │ ↑+22%   │ │ ↑+9%    │             │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐           │
│ │ Spend by Category    │ │ Spend by Vendor      │           │
│ │ (BarChart, click→nav)│ │ (Pareto 80/20)       │           │  ← D5=B drill-down
│ └──────────────────────┘ └──────────────────────┘           │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Monthly Trend (LineChart con 2 lines: current + prev)    ││  ← D8=A
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Budget vs Committed vs Delivered per Category            ││  ← D9=A
│ │ (ComposedChart cross-project)                            ││
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Spend by Project (BarChart top 10)                       ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Data architecture

- ✅ **Server-side aggregator** (D3=B): `src/services/procurement/aggregators/spendAnalyticsAggregator.ts`
- ✅ **REST endpoint**: `GET /api/procurement/spend-analytics?from=...&to=...&projectId=...&supplierId=...&categoryCode=...&status=...`
- ✅ **Response shape**:
  ```typescript
  {
    success: true,
    data: {
      filters: { from, to, projectId, supplierId, categoryCode, status },
      current: {
        kpis: { totalPOs, committedAmount, deliveredAmount, activeSuppliers },
        byCategory: [{ code, total }],
        byVendor: [{ supplierId, supplierName, total, poCount }],   // sorted desc, top 10
        byProject: [{ projectId, projectName, total }],              // top 10
        monthlyTrend: [{ month: 'YYYY-MM', total }],                 // last 12mo or filter range
        budgetVsActual: [{ categoryCode, budget, committed, delivered }],
      },
      comparison: {
        previousFrom: 'YYYY-MM-DD',
        previousTo: 'YYYY-MM-DD',
        deltas: { totalPOs: 15.0, committedAmount: 22.3, ... },      // % deltas
      },
    }
  }
  ```
- ✅ **Cache**: `createStaleCache` (ADR-300), key = filter URL string
- ✅ **Composite indexes Firestore**:
  - `purchase_orders: companyId + isDeleted + dateCreated` (probabile esistente — verificare)
  - `boq_items: companyId + isDeleted` (per cross-project budget aggregation)

### 2.4 URL state SSoT

Tutti i filtri serializzati in `searchParams`:
```
/procurement/analytics?from=2026-01-01&to=2026-03-31&projectId=proj_pagrati&supplierId=sup_titan&categoryCode=TSIMENTO&status=ordered
```
Hook `useSpendAnalytics` legge da URL via `useSearchParams`, scrive via `useRouter.push()`. Filter changes debounced 250ms prima di triggerare fetch.

### 2.5 Chart library

- ✅ **Recharts 2.15** (D4=A) — già installed, MIT, pattern repo consolidato
- KPI tiles → `<Card>` plain (no chart)
- SpendByCategory → `BarChart` horizontal con `onClick` → URL navigation
- SpendByVendor → `ComposedChart` (bar + line cumulative %) Pareto
- SpendByProject → `BarChart` vertical top 10
- MonthlyTrend → `LineChart` con 2 lines (current + comparison)
- BudgetVsActual → `ComposedChart` (3 bars per category)

### 2.6 Export

- ✅ **CSV + Excel** (D6=B) via **`exceljs@4.4.0`** (MIT, ALREADY INSTALLED — SSoT deviation from original `xlsx@0.18`; new dep avoided per ENTERPRISE TERMINAL PROHIBITION 2 + N.0)
- Endpoint `GET /api/procurement/spend-analytics/export?format=csv|xlsx&{...filters}`
- Excel multi-sheet: Overview · By Vendor · By Category · By Project · Monthly Trend · Budget vs Actual (6 sheets total)
- Filename: `spend-analytics-{from}_{to}.{ext}`

### 2.7 Drill-down

- ✅ **Navigation con URL filter** (D5=B): chart click → `/procurement/purchase-orders?categoryCode=...&from=...&to=...&supplierId=...&projectId=...`
- `PurchaseOrderList` page modificata per leggere `categoryCode` + `from`/`to` da URL search params

### 2.8 Comparison period

- ✅ **Always-on** (D8=A): server `Promise.all` con `getPreviousPeriod(from, to)` helper
- UI: KPI tile mostra current value (3xl bold) + Δ% (sm muted, ↑/↓ icon)
- Edge case: insufficient historical data → "—" + tooltip

### 2.9 Saved views

- ✅ **URL-only via browser bookmarks** (D7=B), zero backend complexity
- Upgrade path future: additive `analytics_views/` collection se demand emerges

---

## 3. Open Decisions (D1–D9)

Da risolvere via Q&A con Giorgio prima di Phase 1 implementation. Ogni decisione segue formato:
- Domanda (greco semplice)
- Opzioni (con esempi industry)
- Raccomandazione Claude (industry standard default)
- ⏸️ Status risoluzione

### D1 — Cosa fa il widget sul hub dopo che esiste la page dedicata?

**Domanda:** Όταν φτιάξουμε την σελίδα `/procurement/analytics` με όλα τα διαγράμματα και τα φίλτρα, **τι μένει στο hub** `/procurement`;

**Opzioni:**
- **A.** Tieni `ProcurementDashboardSection` identica come overview at-a-glance + nascondi `SpendAnalyticsCard` (la card è ridondante col widget). Pattern: Oracle OTBI infolet.
- **B.** Riduci a 4 KPI tiles (rimuovi i 2 chart) + tieni `SpendAnalyticsCard` come "Vai alla page per analisi completa". Pattern: SAP Fiori launchpad.
- **C.** Rimuovi tutto `ProcurementDashboardSection` dal hub + tieni solo `SpendAnalyticsCard` con totalSpend reale. La page è l'unico posto. Pattern: Procore Analytics tile.

**Raccomandazione:** **A** (tieni widget overview, rimuovi card ridondante). Pattern Oracle OTBI: infolet → click → full report.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione A** (Procore-style: inline widget on hub, kill `SpendAnalyticsCard`). Motivazione confermata da Giorgio: Procore Project Home pattern (inline widget + click su titolo → full analytics page) è il più adatto per Pagonis (~7 cards sul hub, project-centric workflow). SAP Fiori launchpad pattern (KPI tile only, no inline chart) sarebbe overkill per il volume di apps di Pagonis. Conseguenza implementativa: `HubLanding.tsx` rimuove `<SpendAnalyticsCard />` dalla grid (passa da 7 a 6 cards) + `ProcurementDashboardSection` resta intatta come "click target" (titolo del widget diventa link → `/procurement/analytics`).

---

### D2 — Quanti e quali filtri nella filter-bar della page?

**Domanda:** Πόσα φίλτρα στην κορυφή της σελίδας Analytics; Όλα μαζί ή λίγα και custom;

**Opzioni:**
- **A. Minimal (3 filtri):** Date range + Project + Status. Loadtime <100ms. Pattern: Buildertrend.
- **B. Standard (5 filtri):** Date range + Project + Vendor + Category (ATOE) + Status. Pattern: Procore Commitments.
- **C. Enterprise (7+ filtri):** Date range + Project + Building + Vendor + Category (ATOE) + Status + Currency. Pattern: SAP Fiori Spend Analysis.

**Raccomandazione:** **B** (5 filtri). Sweet spot: copre 95% dei casi d'uso senza overload UX. Building filter aggiunto in Phase 2 se richiesto.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (5 filtri standard Procore Commitments). Filter set: `dateRange` + `projectId` + `supplierId` + `categoryCode` (ATOE) + `poStatus`. Confermato da Giorgio. Building filter + currency filter rinviati a Phase 2 se richiesti dall'uso reale (zero EUR ≠ multi-currency, building drill-down è rare query nella construction reality dove POs sono project-scoped per volume discount). Implementazione: tutti i filtri serializzati in URL search params (vedi D7) + applicati server-side (vedi D3) + auto-reset button in coda alla bar. Default: ultimi 12 mesi, all-projects, all-vendors, all-categories, all-statuses.

---

### D3 — Data layer: client-side aggregation o server-side endpoint?

**Domanda:** Πού γίνεται ο υπολογισμός των στατιστικών;

**Opzioni:**
- **A. Pure client-side** (come il widget hub oggi): `useMemo` su `usePurchaseOrders()` cached. Zero API call extra. Veloce su <500 PO, scala male su 5000+.
- **B. Server-side aggregator + REST endpoint:** nuovo `spendAnalyticsAggregator.ts` + `/api/procurement/spend-analytics?from=...&to=...&...`. Filtri Firestore lato server (composite indexes). Scala a milioni. Pattern: SAP/Oracle/Procore.
- **C. Ibrido:** server-side per i totali aggregati (KPI tiles + chart data) + client-side per drill-down filter delle PO già in cache.

**Raccomandazione:** **B** (full server-side). Industry standard. Pagonis è in pre-launch ma il design è enterprise — meglio scalable da day 1. Composite indexes già pattern in repo.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (full server-side). Industry pattern 4/4 (Procore/SAP/Oracle/Autodesk tutti server-side, zero eccezioni). Confermato da Giorgio. Implementazione: nuovo aggregator `src/services/procurement/aggregators/spendAnalyticsAggregator.ts` (extends pattern di `projectProcurementStats.ts` + `projectBoqCoverageStats.ts`), nuovo endpoint `GET /api/procurement/spend-analytics?from=...&to=...&projectId=...&supplierId=...&categoryCode=...&status=...`, response shape: `{ kpis: {...}, byCategory: [...], byVendor: [...], byProject: [...], monthlyTrend: [...], comparison: {...} }`. Firestore composite indexes nuovi: stimati 1-2 (deploy via `firebase deploy --only firestore:indexes`). Client cache via `createStaleCache` (ADR-300) sulla risposta aggregata (key = filter URL). Hub widget `ProcurementDashboardSection` resta client-side (volume <500 POs sempre, no scaling concern). Cost analysis: +300 Firestore reads/mese = <$0.01 vs client-side 50MB egress Vercel/giorno = molto più economico long-term.

---

### D4 — Chart library: Recharts o introduzione di Tremor/Visx?

**Domanda:** Με ποια βιβλιοθήκη φτιάχνουμε τα διαγράμματα;

**Opzioni:**
- **A. Recharts (già installato 2.15.1 MIT):** già in uso in `ChartBudgetVsCommitted.tsx`. BarChart, LineChart, PieChart, ComposedChart, ScatterChart tutti supportati. Familiarità team.
- **B. Tremor (Apache 2.0):** dashboard-oriented React lib. Componenti pre-built per analytics (KPI cards, charts, filters). +1 dependency. Più "dashboard-ready" out of the box.
- **C. Visx (MIT):** D3 wrapper low-level. Più flessibile ma più verboso. +1 dependency.

**Raccomandazione:** **A** (Recharts). Zero nuove dependency, pattern già consolidato in repo, copre tutti i chart type richiesti. Tremor è tentazione ma viola SSoT (avremmo 2 chart lib).

**✅ Status:** RESOLVED 2026-05-04 — **Opzione A** (Recharts 2.15 già installed). Confermato da Giorgio. Motivazione: zero nuove dependency, SSoT preserved (no 2 chart libs), pattern già consolidato in `ChartBudgetVsCommitted.tsx`, MIT license. Chart components target: `BarChart` (category/project/vendor), `ComposedChart` (vendor Pareto bar+line, budget vs actual), `LineChart` (monthly trend con comparison period — vedi D8). KPI tiles riusano `<Card>` SSoT da `@/components/ui/card`. Pattern Vercel/Linear/Stripe Dashboard converge su Recharts; Tremor (Apache 2.0) era tentazione ma violerebbe SSoT chart library.

---

### D5 — Drill-down behavior

**Domanda:** Όταν ο χρήστης κάνει κλικ σε ένα bar / segment διαγράμματος (π.χ. "ΤΣΙΜΕΝΤΟ 4.500€"), τι γίνεται;

**Opzioni:**
- **A. Modal con lista PO filtrate** dentro la page Analytics. Niente navigation. Pattern: Procore.
- **B. Navigation a `/procurement/purchase-orders?categoryCode=ΤΣΙΜΕΝΤΟ&from=...&to=...`** con filtri pre-applicati. Riusa la lista PO esistente. Pattern: SAP.
- **C. Side panel (drawer)** che mostra top 10 PO + "Vedi tutto" → navigation. Pattern: Autodesk ACC.
- **D. No drill-down Phase 1** — solo visualizzazione. Aggiungiamo dopo se richiesto.

**Raccomandazione:** **B** (navigation con URL params). Riuso massimo del codice esistente, deep-linkable, browser back funziona. Richiede `PurchaseOrderList` accetti filtri da URL search params.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (navigation a `/procurement/purchase-orders?categoryCode=...&from=...&to=...&supplierId=...&projectId=...`). Confermato da Giorgio. Industry pattern 3/4 (SAP, Oracle, Procore drill-through). Implementazione: (1) chart `onClick` handler costruisce URL con filter context corrente + categoria/vendor cliccato, (2) `PurchaseOrderList` page (`src/app/procurement/purchase-orders/page.tsx`) modificata per leggere `categoryCode` + `from` + `to` da `searchParams` e applicarli come filter iniziali alla lista cached. Pattern: deep-linkable, browser back functions, max code reuse, native edit flow normale (PO list → click PO → detail page). No nested modal/drawer (anti-pattern per >10 items + bad mobile UX).

---

### D6 — Export format(s)

**Domanda:** Πώς ο χρήστης κατεβάζει τα δεδομένα;

**Opzioni:**
- **A. CSV only** (server-side stream). Zero new deps. Universal. Pattern: minimal.
- **B. CSV + Excel (xlsx)** — `xlsx` lib (Apache 2.0) per multi-sheet con formattazione. Pattern: SAP/Oracle/Procore.
- **C. CSV + Excel + PDF** — aggiungiamo `jsPDF` (MIT, già installato). PDF buono per report executive.
- **D. No export Phase 1** — aggiungiamo Phase 2.

**Raccomandazione:** **B** (CSV + Excel). 80% dei power user vuole Excel. PDF è nice-to-have ma raro per analytics. CSV come fallback universale.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (CSV + Excel xlsx). Confermato da Giorgio. Industry baseline (SAP/Procore/Oracle/Autodesk/Buildertrend tutti supportano Excel+CSV come minimum). New dependency: `xlsx@0.18` (Apache 2.0, license-safe). Implementazione: route `GET /api/procurement/spend-analytics/export?format=csv|xlsx&{...filters}` → server-side stream. Excel multi-sheet: Overview (4 KPI) + By Vendor + By Category + By Project. CSV single sheet (denormalized). UI: button dropdown "Export ▼" sopra la filter bar. PDF skip Phase 1 (chart-to-PDF complex, no executive demand current). Filename pattern: `spend-analytics-{from}_{to}.{ext}`.

---

### D7 — Saved views / variants

**Domanda:** Θες να μπορεί ο χρήστης να σώζει συνδυασμούς φίλτρων (π.χ. "Q1 2026 — Cement vendors only") για επόμενη φορά;

**Opzioni:**
- **A. Sì, full saved views** — collection `analytics_views/` Firestore, CRUD, default view per user. Pattern: SAP variant management.
- **B. URL-only (no persistence)** — filtri serializzati in URL search params. User può bookmarkare. Pattern: Procore/Autodesk.
- **C. No** — sempre default filters all'apertura. Pattern: Buildertrend.

**Raccomandazione:** **B** (URL-only). Zero backend complexity, deep-linkable, ZERO breaking change se Phase 2 aggiunge persistence. Saved views è feature avanzata da introdurre solo se Giorgio o team operativo la chiedono dopo uso reale.

**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (URL-only persistence via browser bookmarks). Confermato da Giorgio. Industry pattern 3/5 (Procore, Autodesk, Buildertrend tutti URL-only — costruction-native scale; SAP/Oracle full saved views è 80s BI legacy). Pagonis scale (1 user + 2-3 site managers occasional) non giustifica server-side `analytics_views/` collection. Implementazione: tutti i 5 filtri (from, to, projectId, supplierId, categoryCode, status) serializzati in `searchParams` via `useSearchParams` + `useRouter.push()`. Hook `useSpendAnalytics` riceve filter dal URL come SSoT (no React state separato). Default URL = `/procurement/analytics` senza params → ultimi 12 mesi, all-others. User salva views via browser bookmark nativo. Upgrade path future (se richiesto): additive `analytics_views/` collection che salva URL stringhe — zero breaking change.

---

### D8 — Comparison period (YoY / MoM / QoQ)

**Domanda:** Θες σύγκριση με προηγούμενη περίοδο (π.χ. "Spend Q1 2026 = +15% vs Q1 2025");

**Opzioni:**
- **A. Sì, full comparison panel** — sopra ogni KPI tile mostriamo Δ% vs periodo precedente equivalente. Pattern: SAP/Oracle.
- **B. Sì, opzionale toggle "Show comparison"** — default off, attivabile da utente. Pattern: Procore.
- **C. No Phase 1** — solo periodo corrente. Comparison Phase 2.

**Raccomandazione:** **A** (full comparison sempre visibile). È il pattern executive: senza Δ% i KPI sono "numbers without context". Costo implementation basso (server query duplicate con offset, parallel `Promise.all`). Edge case: prima quotidianità di uso (no historical data) — gestito con "—" o "N/A".

**✅ Status:** RESOLVED 2026-05-04 — **Opzione A** (full comparison always-on). Confermato da Giorgio. Industry pattern Tier-1 (SAP/Oracle always-on; Procore/Autodesk toggle; nessuno C). Comparison auto-derived da current date range: Q1→Q4 previous, Jan→Dec previous, "Last 7d"→"7 days before that", date range >=11 mesi → YoY. Implementazione server-side: 2 query `Promise.all` con `getPreviousPeriod(from, to)` helper (~10 LOC). Response shape: `{ current: {...}, comparison: { previousFrom, previousTo, deltas: { totalSpend, committed, delivered, supplierCount, ... } } }`. UI: KPI tile mostra current value (3xl bold) + Δ% (sm muted with arrow icon ↑/↓). Edge case "no historical data" gestito con `—` + tooltip "Insufficient historical data". Performance cost: +50ms (parallel query, stesso aggregator) — negligible.

---

### D9 — Budget tracking integration

**Domanda:** Στην page Analytics, θες ένα tile / chart "Budget vs Actual" σε επίπεδο εταιρείας; (το Project Overview έχει ήδη Budget vs Committed per progetto)

**Opzioni:**
- **A. Sì, full company-wide Budget vs Committed vs Delivered chart** — somma BOQ items budget cross-project + committed PO + delivered PO. Pattern: SAP S/4HANA EPPM.
- **B. Solo Committed vs Delivered** (budget richiede join cross-project pesante; rimandiamo). Pattern: Procore Commitments.
- **C. No Phase 1** — out of scope.

**Raccomandazione:** **A** (full Budget vs Actual). Il pattern enterprise definitivo. Aggregator già esiste (`projectBoqCoverageStats.ts`) — basta sommare cross-project. Composite index nuovo richiesto su `boq_items` (companyId only — già presente probabilmente).

**✅ Status:** RESOLVED 2026-05-04 — **Opzione A** (full company-wide Budget vs Committed vs Delivered). Confermato da Giorgio. Industry split (Procore/Autodesk B; SAP/Oracle/Buildertrend A) — Pagonis ENTERPRISE mandate sceglie A. Aggregator: nuova funzione `computeBudgetVsActualCrossProject(companyId, filters)` extends pattern di `projectBoqCoverageStats.ts` ma rimuove il `projectId` filter e raggruppa per `categoryCode` cross-project. BOQ budget formula riusata (`(materialUnitCost + laborUnitCost + equipmentUnitCost) × estimatedQuantity × (1 + wasteFactor)`). Composite index nuovo: `boq_items: companyId + isDeleted` (Firestore può chiederlo). Edge case "Off-budget" categoria per PO senza BOQ items collegati (categoryCode senza budget match) — bar mostrato con label "Off-budget" + warning tooltip "PO without prior BOQ entry". Quando filter `projectId=X` attivo, chart degrada gracefully a single-project view (DRY: futuro refactor possibile per condividere component con `ChartBudgetVsCommitted.tsx` in Project Overview, ma fuori scope Phase 1).

---

## 4. Decision Matrix (post Q&A)

| D# | Domanda | Risposta finale | Motivo |
|----|---------|------------------|--------|
| D1 | Hub widget post-page? | **A** — Procore-style: inline widget + kill SpendAnalyticsCard | Industry pattern Procore Project Home (widget inline, click titolo → full page); zero duplicazione data; SAP launchpad overkill per ~7 cards |
| D2 | Quanti filtri? | **B** — 5 filtri (dateRange + project + supplier + category + status) | Sweet spot Procore Commitments; copre 95% query reali; building/currency rinviati a Phase 2 |
| D3 | Client vs server? | **B** — Server-side aggregator + REST endpoint | Industry pattern 4/4 (Procore/SAP/Oracle/Autodesk); pattern già presente nel repo (`projectProcurementStats`); scaling-invariant; cost <$0.01/mese vs client-side 50MB Vercel egress/giorno |
| D4 | Chart library? | **A** — Recharts 2.15 (already installed) | Zero new dep; SSoT preserved; pattern consolidato (`ChartBudgetVsCommitted.tsx`); MIT license; Vercel/Linear/Stripe convergence |
| D5 | Drill-down? | **B** — Navigation a `/procurement/purchase-orders` con URL filter | Industry 3/4 (SAP/Oracle/Procore drill-through); max code reuse; deep-linkable; native edit flow |
| D6 | Export format? | **B** — CSV + Excel (xlsx multi-sheet) | Industry baseline 5/5; +1 dep `xlsx` (Apache 2.0); 80% power user wants Excel; PDF rare per analytics |
| D7 | Saved views? | **B** — URL-only via browser bookmarks | Industry 3/5 (Procore/Autodesk/Buildertrend); zero backend complexity; deep-linkable; SSoT con D5 URL serialization; upgrade path additive |
| D8 | Comparison period? | **A** — Always-on comparison (Δ% vs previous equivalent period) | Tier-1 SAP/Oracle pattern; +50ms parallel query negligible; comparison auto-derived da date range; "—" fallback per insufficient data |
| D9 | Budget tracking? | **A** — Full Budget vs Committed vs Delivered cross-project | ENTERPRISE mandate (no construction-lite); aggregator extension da `projectBoqCoverageStats.ts`; +1 composite index; off-budget gracefully handled |
| **D10** | **RBAC?** | **D** — Hybrid: page admin/owner/accountant only; site managers redirect a project-overview | Cross-project financial = sensitive; project-overview esiste già per site-manager; clean separation, less code |
| **D11** | **Default date range?** | **C** — Current quarter (quarter-to-date) | Greek ΦΠΑ aligned (λογιστής persona); comparison D8 auto-derived perfetto Q→Q-1; data volume balanced; construction project lifecycle 3-6 mesi |
| **D12** | **Multi vs single select?** | **B** — All multi-select | SAP/Oracle Enterprise BI pattern; Pagonis scale under Firestore `in` limit 30; chip-based UI modern |
| **D13** | **MultiCombobox UX scale?** | **B** — Build SSoT `MultiCombobox` (Radix Popover + search + checkboxes) | No new dep; risolve 4 SSoT violations totali (3 esistenti + nuova); reusable Tier-1 ui primitive |
| **D14** | **Cache invalidation?** | **C** — Event-bus + stale + manual refresh button | Same-tab auto-sync premium UX; cost-zero (no onSnapshot); event bus Tier-2 SSoT helper |
| **D15** | **Rate limit tier?** | **B** — `withHeavyRateLimit` 15 req/min | Heavy aggregation (1000+ doc reads); abuse protection; cost protection Firestore reads |
| **D16** | **i18n namespace?** | **A** — `procurement.analytics.*` (under existing namespace) | Repo convention unanime per tutte 4+ procurement features; SSoT compliance N.11; co-location semantica |

---

## 4.5 Round 2 — Open Decisions (D10-D16, critici)

Da risolvere via Q&A in corso (post re-read ADR Giorgio request 2026-05-04). Bloccano implementation.

### D10 — RBAC / Permissions
**✅ Status:** RESOLVED 2026-05-04 — **Opzione D** (hybrid: cross-project page admin-only + redirect site managers a project-overview esistente). Confermato da Giorgio. Roles allowed: `owner` + `admin` + `accountant` (3 roles). Site manager (e `worker`) → 403 + redirect a `/projects/{id}/procurement/overview` (loro project-scoped analytics esistente, ADR-330 §5.1 S3). Industry pattern 4/5 (Procore/SAP/Oracle/Autodesk = scoped per assignment); Pagonis sceglie hybrid per evitare duplicazione UX (project-overview già esiste). Implementazione: (1) `/api/procurement/spend-analytics/route.ts` middleware `requireRole(['owner', 'admin', 'accountant'])` → 403 forbidden se altro role; (2) `/api/procurement/spend-analytics/export/route.ts` stesso check; (3) page server component `requireUser()` + role check → `redirect('/projects')` se non allowed; (4) hub `SpendAnalyticsCard`/`ProcurementDashboardSection` titolo cliccabile → conditional render link (visibile solo se user ha permission, altrimenti widget non-clickable). Helper centralizzato: `src/lib/auth/permissions/spend-analytics.ts` con `canViewSpendAnalytics(role): boolean` SSoT.

### D11 — Default date range exact
**✅ Status:** RESOLVED 2026-05-04 — **Opzione C** (Current quarter). Confermato da Giorgio. Default URL params senza filter explicit: `from=YYYY-Q-01&to=today` (current quarter to-date). Motivazione: (a) D10 user base include `accountant` che lavora su trimestri ΦΠΑ greci, (b) D8 comparison auto-derived perfetto Q-current → Q-previous, (c) data volume balanced (3 mesi vs 30 days troppo poco vs YTD overload), (d) construction project lifecycle 3-6 mesi → quarter window copre gran parte di un progetto. Helper: `src/lib/date/quarter-helpers.ts` con `getCurrentQuarterRange(now)` + `getPreviousQuarterRange(now)` (~30 LOC, pure functions, jest-tested per D26). Date format: `YYYY-MM-DD` (ISO 8601 date-only, no time component, timezone Athens via D25).

### D12 — Multi-select vs single-select στα filters
**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (all multi-select). Confermato da Giorgio. Industry pattern Enterprise BI (SAP/Oracle = B). Pagonis scale tutti i filter under Firestore `in` limit 30 (12 ATOE categories, ~50 vendors max ~200 future, ~10-50 projects, 7 statuses). URL serialization: comma-separated values (`?categoryCode=TSIMENTO,SIDIROURGIKA&supplierId=sup_titan,sup_aget`). Aggregator: `where('field', 'in', [...])` quando array.length > 0, altrimenti omit filter (= "All"). UI: chip-based multi-combobox (Linear/Notion-style modern pattern). **Status filter exception**: aggiungere preset chips sopra il dropdown (`[In progress]` = draft+ordered+partially_delivered, `[Completed]` = delivered+closed, `[Cancelled]` = cancelled) PIÙ multi-select dropdown for custom combinations. Default empty = "All" (D29). Required helper: parser/serializer per URL multi-value (`parseFilterArray`, `serializeFilterArray`) in `src/lib/url-filters/multi-value.ts` (~30 LOC, jest-tested).

### D13 — Vendor/Project filter UX a scala (50+ items)
**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (build SSoT `MultiCombobox` in `src/components/ui/multi-combobox.tsx`, no new dep). Confermato da Giorgio. Architettura: Radix `Popover` + Radix `Checkbox` + `Input` (search) + chip-based selected display. ~250 LOC component + ~80 LOC jest tests. Zero new dependency. Use breakdown filter: **MultiCombobox** per Project + Vendor (50-200 items), **plain Radix Select multi** per Category (12 fixed) + Status (7 fixed + preset chips). **Boy Scout follow-up post-Phase 1** (separate ADR/PR): migrare 3 esistenti domain-specific multi-select (`PropertyMultiSelectByBuilding`, `FloorMultiSelectField`, `BOQEditorScopeSection`) al nuovo SSoT — risolve 4 SSoT violations totali. SSoT registry update: aggiungere modulo `multi-combobox` in `.ssot-registry.json` Tier-1 con `forbiddenPatterns` per inline checkbox-list builds. Component file path: `src/components/ui/multi-combobox.tsx` (allineato a Select/Combobox shadcn pattern).

### D14 — Cache invalidation strategy
**✅ Status:** RESOLVED 2026-05-04 — **Opzione C** (event-bus invalidation + D28 stale-while-revalidate + manual refresh button). Confermato da Giorgio. Architettura 3-layer: (1) **ADR-300 stale cache** = baseline (silent refetch on remount); (2) **Manual refresh button "↻"** top-right page = explicit user control (D28); (3) **Event bus invalidation** = same-tab automatic sync su PO mutations. Implementazione: nuovo file `src/lib/cache/spend-analytics-bus.ts` (~40 LOC + 30 LOC test) con `EventTarget` pattern (Tier-2 SSoT helper); helper exports `emitSpendAnalyticsInvalidate()` + `onSpendAnalyticsInvalidate(handler)`. Hook into PO mutation services: `createPO`, `updatePO`, `deletePO`, `recordPODelivery`, `cancelPO` chiamano `emitSpendAnalyticsInvalidate()` post-success. `useSpendAnalytics` hook subscribe via useEffect → on event → `spendAnalyticsCache.clear()` + `silentRefetch()`. NO `onSnapshot` Firestore live (overkill, +cost continuous reads). NO cross-tab sync Phase 1 (manual refresh button is graceful fallback).

### D15 — Rate limiting tier
**✅ Status:** RESOLVED 2026-05-04 — **Opzione B** (`withHeavyRateLimit`, 15 req/min) per ENTRAMBI gli endpoint: `/api/procurement/spend-analytics` (aggregator) + `/api/procurement/spend-analytics/export` (xlsx generation). Confermato da Giorgio. Motivazione: heavy operation (1000+ Firestore docs per request, comparison query 2x parallelizzata, aggregation cross-project + BOQ join); 15/min = 1 query ogni 4 secondi è sufficient per power user (λογιστής analyst workflow ~10/min); blocks bot scraping; cost protection Firestore reads. Pattern coerente con altri aggregator endpoints repo. Export endpoint stesso tier perché xlsx multi-sheet generation è ancora più heavy di aggregator.

### D16 — i18n namespace placement
**✅ Status:** RESOLVED 2026-05-04 — **Opzione A** (`procurement.analytics.*` under existing `procurement.json` namespace). Confermato da Giorgio. Pattern repo unanime: tutte le 4+ procurement features esistenti (`procurement.hub.*`, `procurement.overview.*`, `procurement.hub.materialCatalog.*`, `procurement.hub.frameworkAgreements.*`, `procurement.hub.vendorMaster.*`) seguono stesso pattern. Implementazione: aggiungere ~50-60 keys sotto `procurement.analytics.*` namespace, modificare `src/i18n/locales/{el,en}/procurement.json` esistenti. Sub-namespaces previsti: `analytics.{title, description, filters, kpi, charts, export, refresh, errors, empty}`. ATOE category labels riusano esistenti `procurement.categories.*` (no duplication, SSoT). i18n hook usage: `useTranslation('procurement')` + `t('analytics.kpi.committedSpend.label')` etc. Compliance CLAUDE.md N.11 (zero hardcoded strings, zero `defaultValue: 'literal'`).

---

## 4.6 Round 2 — Auto-Defaulted Decisions (D17-D29, nice-to-have)

Auto-resolved 2026-05-04 via Giorgio's trust mandate ("σε εμπιστεύομαι" per nice-to-have). Industry standard pattern + repo convention reuse.

| D# | Decision | Default scelto | Razionale |
|----|----------|----------------|-----------|
| **D17** | Empty state design (zero POs) | Reuse pattern Project Overview empty state + CTA "Δημιούργησε νέα παραγγελία" → `/procurement/new` | Consistency UX repo; production-grade onboarding |
| **D18** | Loading skeleton structure | Per-component skeleton (riusa `KpiCardSkeleton.tsx` + nuovo `KpiChartSkeleton.tsx`-style); NO single overall spinner | Pattern Project Overview consolidato; no layout shift (GOL N.7.2) |
| **D19** | Mobile responsive | Stack vertical (`flex flex-col`), no chart hiding, full scroll. Filter bar: collapse to "Filters ▼" drawer su `<sm` breakpoint. KPI tiles: `grid-cols-2` mobile, `grid-cols-4` desktop. Charts: `ResponsiveContainer` Recharts (built-in) | Standard responsive pattern Tailwind + Recharts native |
| **D20** | Top-N limits (vendors/projects bars) | 10 fisso Phase 1, no UI control | YAGNI Phase 1; user può filtrare con vendor/project filter per restringere; server response include `othersTotal` per "Altri X vendor: €Y" residue bar |
| **D21** | Currency formatting | Riusa `formatCurrency(n, 'EUR')` da `@/lib/intl-formatting` (ήδη `el-GR` locale, formato `128.500 €`); per chart axis: `formatEurShort(n)` riusato da `ChartBudgetVsCommitted.tsx` (`128K€` / `1.5M€`) | SSoT preserved; pattern repo |
| **D22** | Chart color palette | Riusa CSS variables `--chart-1` (committed/spent), `--chart-2` (budget), `--chart-3` (delivered), `--chart-4` (comparison previous), `--chart-5` (off-budget) — pattern già in `ChartBudgetVsCommitted.tsx`. Definire `--chart-3/4/5` se mancano in `globals.css` | SSoT design tokens; theme-aware (dark mode auto) |
| **D23** | ARIA accessibility | `aria-label` per ogni chart container con summary semantico (es. `aria-label="Spend by category: ΤΣΙΜΕΝΤΟ €34.500, ΕΛΑΙΟΧΡΩΜΑΤΑ €22.300, ..."`); `role="img"` per chart wrapper. NO screen-reader table fallback Phase 1 (Phase 2 se needed) | WCAG AA baseline; Recharts limitations note |
| **D24** | Print stylesheet | OUT OF SCOPE Phase 1. Phase 2 se Giorgio richiede (executive PDF reports) | YAGNI; print pattern complex con Recharts SVG |
| **D25** | Timezone for date filters | `Europe/Athens` hardcoded (Pagonis Greek-only users); `from`/`to` params interpretati come date locale Athens; server converte a UTC range per Firestore query (es. `from=2026-01-01` → `2025-12-31T22:00:00.000Z` → `2026-01-31T21:59:59.999Z`) | User base Greek-only confermato; consistent UX |
| **D26** | Test strategy | Pure helpers tested con Jest: `getPreviousPeriod(from, to)`, `computeBudgetVsActualHelpers`, `formatCsvRow`, `formatXlsxSheet`. NO integration tests Phase 1, NO React component tests Phase 1 | CLAUDE.md N.10 ai-pipeline-style (pure helpers tested); component tests Phase 2 |
| **D27** | Error boundary per chart | Wrap each chart in `<ComponentErrorBoundary>` (riusa from `@/components/ui/ErrorBoundary`); pattern Project Overview `ProjectProcurementOverview.tsx` | Resilienza; un chart broken non rompe la page |
| **D28** | Real-time refresh strategy | ADR-300 stale-while-revalidate (silent refetch on remount) + manual refresh button "↻" top-right page (forza `silentRefetch`). NO `onSnapshot` Firestore live (overkill, +cost) | Pattern repo Project Overview; manual refresh = explicit user intent |
| **D29** | Filter empty selection semantics | Empty filter = "All" (default behavior). "Καθαρισμός φίλτρων" button resetta tutto a default. UI placeholder per dropdown empty: `"Όλα τα {tipo}"` (es. "Όλα τα έργα", "Όλοι οι προμηθευτές") | Standard pattern Procore/SAP; explicit "All" labels evita ambiguity vs "no selection" |

---

## 5. Implementation Plan (TBD — post Q&A)

### 5.1 File structure proposta (refinable post D-decisions)

```
src/app/procurement/analytics/
├── page.tsx                          REWRITE (placeholder → real page; ≤200 LOC)
├── _components/                      NEW (page-local, sotto _components per Next.js convention)
│   ├── AnalyticsFiltersBar.tsx       NEW (filter UI; ≤200 LOC)
│   ├── AnalyticsKpiTiles.tsx         NEW (4-6 KPI tiles wrapper; ≤120 LOC)
│   ├── SpendByCategoryChart.tsx      NEW (Recharts BarChart; ≤150 LOC)
│   ├── SpendByVendorPareto.tsx       NEW (Recharts ComposedChart 80/20; ≤180 LOC)
│   ├── SpendByProjectChart.tsx       NEW (Recharts BarChart; ≤150 LOC)
│   ├── MonthlyTrendChart.tsx         NEW (Recharts LineChart con comparison; ≤180 LOC)
│   ├── BudgetVsActualChart.tsx       NEW se D9=A (Recharts ComposedChart; ≤180 LOC)
│   └── AnalyticsExportButton.tsx     NEW (CSV+Excel; ≤120 LOC)

src/hooks/procurement/
├── useSpendAnalytics.ts              NEW (filter state via URL + fetch + ADR-300 cache; ≤150 LOC)

src/services/procurement/aggregators/
├── spendAnalyticsAggregator.ts       NEW se D3=B/C (Firestore Admin; ≤300 LOC, split helpers)

src/app/api/procurement/spend-analytics/
├── route.ts                          NEW se D3=B/C (≤120 LOC)

src/lib/export/
├── analytics-csv.ts                  NEW (CSV serializer; ≤100 LOC)
├── analytics-xlsx.ts                 NEW se D6=B/C (xlsx multi-sheet; ≤150 LOC)

src/i18n/locales/{el,en}/procurement.json
├── analytics.* namespace             NEW (~40-60 keys: filters, charts, kpi labels, export, drill-down)

MODIFY:
- src/components/procurement/hub/cards/SpendAnalyticsCard.tsx     (rimuovi "Φάση 6", aggiungi totalSpend reale)
- src/components/procurement/hub/HubLanding.tsx                   (per D1: tieni/riduci/rimuovi `ProcurementDashboardSection`)
- src/components/procurement/hub/ProcurementDashboardSection.tsx  (per D1: forse semplificato)
- firestore.indexes.json                                          (se D3=B: 1-2 composite indexes nuovi)

DELETE:
- (nessun file DELETE in questa fase — placeholder è REWRITE non DELETE)
```

### 5.2 Phase breakdown (FINALIZED post D1-D29)

Sub-phase ordinate per dependencies (ogni phase = 1 sessione completabile, mandate Giorgio session-isolation):

- **Phase A** — ✅ DONE 2026-05-04 — Q&A D1-D29 (questa sessione, Plan Mode)
- **Phase B0** — **MultiCombobox SSoT** (D13) — `src/components/ui/multi-combobox.tsx` + jest tests + `.ssot-registry.json` entry. Standalone, no dependency. ~3 file. Token est. ~30k. **PREREQUISITO** per Phase D (filter bar usa MultiCombobox).
- **Phase B1** — **Server aggregator + API + indexes** (D3, D8, D9, D10, D11, D15, D25) — `spendAnalyticsAggregator.ts` + helper `quarter-helpers.ts` + `getPreviousPeriod` + `requireRole` middleware + `/api/procurement/spend-analytics/route.ts` + composite indexes Firestore. ~8 file. Token est. ~50k.
- **Phase B2** — **Export endpoint** (D6, D15) — `xlsx@0.18` install + `analytics-csv.ts` + `analytics-xlsx.ts` + `/api/procurement/spend-analytics/export/route.ts`. ~4 file. Token est. ~30k.
- **Phase C** — **Hook + filter URL serialization** (D2, D7, D12, D14) — `useSpendAnalytics.ts` + `multi-value.ts` URL parser + `spend-analytics-bus.ts` event bus + integration su PO mutation services. ~5 file. Token est. ~30k.
- **Phase D** — **Page + filter bar + KPI tiles** (D2, D8, D17-D19, D27, D28, D29) — `page.tsx` rewrite + `_components/{AnalyticsFiltersBar, AnalyticsKpiTiles, AnalyticsRefreshButton, AnalyticsExportButton}.tsx` + skeleton components. ~8 file. Token est. ~50k.
- **Phase E** — **Charts** (D4, D5, D8, D9, D22, D23) — `_components/{SpendByCategoryChart, SpendByVendorPareto, SpendByProjectChart, MonthlyTrendChart, BudgetVsActualChart}.tsx` + chart color tokens in `globals.css` (`--chart-3/4/5`). ~6 file. Token est. ~40k.
- **Phase F** — **Drill-down + PurchaseOrderList URL filter integration** (D5) — modify `src/app/procurement/purchase-orders/page.tsx` per leggere `categoryCode/from/to/supplierId/projectId` da `searchParams`. ~2 file. Token est. ~15k.
- **Phase G** — **Hub adjustment + i18n** (D1, D16) — modify `HubLanding.tsx` (rimuovi `<SpendAnalyticsCard />`) + `ProcurementDashboardSection.tsx` (titolo cliccabile → link analytics) + delete file `SpendAnalyticsCard.tsx` + i18n keys ~60 in `procurement.json` (el+en) sotto `analytics.*`. ~5 file. Token est. ~25k.
- **Phase H** — **Tests + ADR finalization** (D26) — pure helper jest tests (`getPreviousPeriod`, `formatCsvRow`, `parseFilterArray`, etc.) + this ADR § 7 → IMPLEMENTED + ADR-330 § 3 Phase 6 changelog entry "Phase 6.1 Enterprise Page implemented". ~4 file. Token est. ~20k.

**Total token budget:** ~290k tokens distribuiti su **8 sessioni** Opus 4.7 (B0, B1, B2, C, D, E, F, G+H combinate). Sessione H può essere combined con G. Session-completable mandate respected (each <80k context).

**Critical path:** B0 → B1 → C → D → E → F (each blocks next). G + H parallel-safe with E/F.

### 5.3 Quality gates (CLAUDE.md N.7.2)

- ✅ Proattivo: dashboard data fresca su ogni filter change (await server)
- ✅ No race: filter URL → debounce 250ms → fetch → render (cancellabile)
- ✅ Idempotente: same filter URL = same response (cacheable via ADR-300)
- ✅ Belt-and-suspenders: server aggregator + client `useMemo` fallback se API down
- ✅ SSoT: una sola location per spend computation (`spendAnalyticsAggregator`)
- ✅ Await: page render aspetta dati per evitare layout shift
- ✅ Lifecycle owner: page.tsx unico container, hook unico data source

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Composite index missing in production → query failure | Medium | High | Deploy `firestore.indexes.json` PRIMA del code merge; verifica via emulator |
| Aggregator >300 LOC se D9=A + D8=A | High | Medium | Split in helper modules: `_kpi-helpers.ts`, `_chart-helpers.ts`, `_comparison-helpers.ts` |
| Recharts performance su 5000+ data points | Low | Medium | Server-side pre-aggregation (D3=B); chart riceve <100 points sempre |
| Drill-down navigation breaking back-button (D5=B) | Low | Low | URL search params standard, browser handles |
| Export di 10k+ rows freeze browser | Low | High | Server-side CSV stream + Excel via worker (Phase F) |
| User confusione "widget vs page" se D1=A (entrambi) | Medium | Low | Widget label esplicita "Σύνοψη" + page link "Πλήρης ανάλυση" |

---

## 7. Implementation Tracking (popolato post-implementation)

| Phase | Status | Files | Commit | Notes |
|-------|--------|-------|--------|-------|
| Phase A — Q&A D1-D29 | ✅ DONE 2026-05-04 | 1 (questo ADR + adr-index) | (this commit) | Plan Mode + Q&A 2 round Opus 4.7 + Giorgio |
| Phase B0 — MultiCombobox SSoT | ✅ DONE 2026-05-04 | 4 (3 NEW + 1 MODIFY .ssot-registry.json) | TBD | Radix Popover + Checkbox + native input search + chip UI. ~215 LOC component, ~115 LOC tests. Tier-1 SSoT registered. i18n 5 keys in common.json. Boy Scout follow-up post Phase H: migrate 3 domain duplicates (PropertyMultiSelectByBuilding, FloorMultiSelectField, BOQEditorScopeSection). |
| Phase B1 — Aggregator + API + indexes | ✅ DONE 2026-05-04 | 6 (5 NEW + 1 MODIFY ADR) | d64e5814 | `spendAnalyticsAggregator.ts` (288 LOC) · `quarter-helpers.ts` (85 LOC, incl. Athens TZ D25) · `spend-analytics.ts` RBAC (D10) · `route.ts` API GET (78 LOC, withHeavyRateLimit D15) · test suite 17 pure-helper assertions (D26). No new Firestore indexes needed — existing `companyId+isDeleted+dateCreated` index covers range query. Vendor names resolved via `db.getAll()` batch. accountant project-role support deferred → Phase H. |
| Phase B2 — Export endpoint | ✅ DONE 2026-05-04 | 4 (3 NEW + 1 MODIFY ADR) | fe13f609 | `analytics-csv.ts` (62 LOC pure CSV) · `analytics-xlsx.ts` (118 LOC, **ExcelJS SSoT — deviation from original `xlsx@0.18` plan: exceljs@4.4.0 already in package.json + 29 files use it, avoiding duplicate dep per ENTERPRISE TERMINAL PROHIBITION 2 + N.0 SSoT**) · `export/route.ts` (95 LOC, withHeavyRateLimit 10/min + RBAC + format=csv\|xlsx, default xlsx). 6-sheet workbook: Overview · By Vendor · By Category · By Project · Monthly Trend · Budget vs Actual. Filename pattern `spend-analytics-{from}_{to}.{ext}`. |
| Phase C — Hook + URL serialization + event bus | ✅ DONE 2026-05-04 | 7 (3 NEW + 4 MODIFY) | b363fe92 | `multi-value.ts` (37 LOC pure URL helper) · `spend-analytics-bus.ts` (33 LOC EventTarget bus, SSR-safe) · `useSpendAnalytics.ts` (174 LOC: URL-SSoT filters + stale cache + 250ms debounce + AbortController + bus subscribe + manual refresh). Mutation hookpoints: `procurement-mutation-gateway.savePurchaseOrderWithPolicy` (create + update) + `ProcurementDetailPageContent.handleAction` (approve/order/close/cancel) + `handleDuplicate` — 5 emit sites total. SSoT cleanup: routes `/api/procurement/spend-analytics{,/export}` migrated to `parseFilterArray` (removed 2 inline duplicates). ZERO `any`, ZERO new deps. |
| Phase D — Page + Filters + KPI | ✅ DONE 2026-05-04 | 13 (8 NEW + 5 MODIFY: ADR + el/en locales + export route hangover + aggregator orderBy) | b6eaa945 | Server-component RBAC guard via `cookies()` + `verifySessionCookieToken` + `canViewSpendAnalytics` (D10 enforced at page level; redirect to `/login` or `/projects`). 7 client components under `_components/`: PageShell · PageContent (owns `useSpendAnalytics`) · FiltersBar (5 filters + status preset chips D12 + mobile drawer D19) · KpiTiles (4 cards w/ Δ% D8, KpiCardSkeleton D18, formatCurrency D21) · RefreshButton (D28) · ExportButton (CSV/XLSX dropdown via `triggerExportDownload`) · EmptyState (D17 CTA → `/procurement/new`). 35 i18n keys added under `procurement.analytics.*` (D16). All filter sources reuse SSoT hooks (`useProjectsList`, `usePOSupplierContacts`, ATOE codes from `procurement.categories.*`, status from `procurement.status.*`). |
| Phase E — Charts | ✅ DONE 2026-05-04 | 10 (6 NEW + 4 MODIFY) | d61167e0 | Recharts 5-chart suite under `_components/`: Category (horizontal BarChart top-10 + drill-down) · Vendor Pareto (ComposedChart bar+cumulative% + drill-down) · Project (vertical BarChart + `useProjectsList` SSoT + drill-down) · MonthlyTrend (LineChart current period; comparison series deferred to Phase E.x — aggregator B1 monthlyTrend is current-only) · BudgetVsActual (ComposedChart 3-bars + off-budget detection + custom `TooltipProps` content). 1 NEW `chart-utils.ts` helper (`formatEurShort`, `buildPurchaseOrdersUrl` reusing `serializeFilterArray`, `readClickedRowKey` typed onClick narrower, `truncateLabel`). 26 i18n keys added under `procurement.analytics.charts.*` el+en (D16). CSS vars `--chart-1..5` already in `globals.css` (light + dark) — no change. ZERO `any`, ZERO inline styles, semantic `<figure>`/`<figcaption>`/`<section>`. ComponentErrorBoundary wraps each chart (D27). |
| Phase F — Drill-down + PO list URL filter | ⏸️ READY | — | — | After E |
| Phase G — Hub adjustment + i18n | ⏸️ READY | — | — | Parallel-safe with E/F |
| Phase H — Tests + ADR finalization | ⏸️ READY | — | — | Combinable with G |

---

## 8. References

- ADR-330 §3 Phase 6 — MVP widget hub
- ADR-300 — Stale-while-revalidate cache pattern
- ADR-328 — RouteTabs SSoT
- ADR-282 — Contact Persona (supplier FK)
- ADR-175 — BOQ / ATOE categories SSoT
- Procore Analytics docs — https://support.procore.com (Power BI embedded)
- SAP Fiori Spend Analysis app — Best Practices Explorer
- Oracle OTBI Procurement Analytics — Cloud documentation
- Autodesk ACC Insight — Construction Cloud help
- Recharts 2.15 — https://recharts.org (already in `package.json`)
