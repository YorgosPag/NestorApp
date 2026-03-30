# SPEC-007: Implementation Phases

**ADR**: 268 — Dynamic Report Builder
**Version**: 2.0 — Ενσωμάτωση Mandatory Testing (SPEC-011)
**Last Updated**: 2026-03-29

---

## 🚨 ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟΣ ΚΑΝΟΝΑΣ: TESTING

> Κάθε Phase παραδίδεται μαζί με τα αντίστοιχα tests στο **ΙΔΙΟ COMMIT**.
> Κώδικας χωρίς tests = ΔΕΝ γίνεται commit.
> Πλήρης testing strategy: βλ. **SPEC-011-testing-strategy.md**

---

## Phase Overview

| Phase | Τίτλος | Domains | Αρχεία | Test Αρχεία | Εκτ. Tests |
|-------|--------|---------|--------|-------------|------------|
| **1** | **Core MVP ✅ DONE** | A1-A4 (Έργα, Κτίρια, Όροφοι, Μονάδες) | 16 | 8 | 254 |
| **2** | **Grouping + KPIs + Charts ✅ DONE** | — (engine) | 6 new + 6 mod | 1 | 29 |
| **3** | **Export (Tier 1) ✅ DONE** | — (PDF + Excel) | 5 new + 6 mod | 1 | ~30 |
| **4** | **Domains A5-A6, B1-B8 ✅ DONE** | Parking, Storage, Contacts... | ~5 configs | ~1 | ~20-30 |
| 5 | Domains C1-C7 (8 domains) + Computed Fields + collectionGroup | Payments, Cheques, Contracts... | ~8 configs + 2 engine | ~3 | ~40-50 |
| 6 | Domains D1-D4, E1-E2, F1-F2 + Tier 3 | Construction, CRM, Accounting | ~8 configs | ~1 | ~20-30 |
| 7 | Saved Reports | — | ~3 | ~2 | ~20-25 |
| **8** | **Cash Flow Forecast ✅ DONE** | — (standalone) | 20 new + 5 mod | 1 | 39 |

**Σύνολο**: ~45 αρχεία κώδικα, ~22 test αρχεία, ~275-345 test cases

---

## Phase 1: Core MVP ✅ IMPLEMENTED (2026-03-29, commit `9edad8cf`)

**Αρχεία κώδικα (delivered):**
```
src/app/reports/builder/page.tsx
src/components/reports/builder/ReportBuilder.tsx
src/components/reports/builder/DomainSelector.tsx
src/components/reports/builder/ColumnSelector.tsx
src/components/reports/builder/FilterPanel.tsx
src/components/reports/builder/FilterRow.tsx
src/components/reports/builder/ReportResults.tsx
src/config/report-builder/domain-definitions.ts
src/config/report-builder/report-builder-types.ts
src/hooks/reports/useReportBuilder.ts
src/app/api/reports/builder/route.ts
src/services/report-engine/report-query-executor.ts
```

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/config/report-builder/__tests__/domain-definitions.test.ts        ← Domain config validation
src/config/report-builder/__tests__/report-builder-types.test.ts      ← Type guards, validators
src/services/report-engine/__tests__/report-query-executor.test.ts    ← Query building, WHERE, LIMIT
src/config/report-builder/__tests__/filter-operators.test.ts          ← Operator logic (==, !=, >, <, contains...)
src/app/api/reports/builder/__tests__/route.test.ts                   ← API: auth, validation, response
src/components/reports/builder/__tests__/DomainSelector.test.tsx      ← UI: render, select, groups
src/components/reports/builder/__tests__/ColumnSelector.test.tsx      ← UI: toggle, select all/none
src/components/reports/builder/__tests__/FilterPanel.test.tsx         ← UI: add/remove, operators
```

**Domains**: A1 Projects, A2 Buildings, A3 Floors, A4 Units
**UI**: DomainSelector + ColumnSelector + FilterPanel + Table
**No**: grouping, charts, export, saved reports

**Additional files delivered (not in original spec):**
```
src/config/report-builder/index.ts                                  ← Barrel exports
src/components/reports/builder/index.ts                             ← Barrel exports
src/components/reports/builder/AIQueryInput.tsx                     ← AI natural language query
src/services/report-engine/ai-query-translator.ts                  ← gpt-4o-mini structured output
src/app/api/reports/builder/ai/route.ts                            ← AI translation API endpoint
src/i18n/locales/{en,el}/report-builder.json                       ← UI labels (EL+EN)
src/i18n/locales/{en,el}/report-builder-domains.json               ← Domain/field labels (EL+EN)
```

**Test results**: 7/8 suites passed, 254/254 tests passed (1 suite: firebase-admin ESM compat issue, not code bug)

---

## Phase 2: Grouping + KPIs + Charts — ✅ IMPLEMENTED (2026-03-29, commit `0ed9a37d`)

**Αρχεία κώδικα (delivered):**
```
src/services/report-engine/grouping-engine.ts                         ← NEW: pure functions (groupRows, aggregations, suggestChart, generateKPIs)
src/components/reports/builder/GroupBySelector.tsx                     ← NEW: 2-level grouping dropdown
src/components/reports/builder/ChartSection.tsx                        ← NEW: 5 chart types + cross-filter
src/components/reports/builder/GroupedTreeGrid.tsx                     ← NEW: WAI-ARIA treegrid, expand/collapse
src/hooks/reports/useReportGrouping.ts                                ← NEW: extracted hook (SRP <500 lines)
src/components/reports/builder/ReportBuilder.tsx                       ← MODIFIED: +GroupBySelector, ChartSection, KPIs
src/components/reports/builder/ReportResults.tsx                       ← MODIFIED: +GroupedTreeGrid, CrossFilterChip
src/config/report-builder/report-builder-types.ts                     ← MODIFIED: +GroupByConfig, GroupingResult, GroupedRow
src/hooks/reports/useReportBuilder.ts                                  ← MODIFIED: composes useReportGrouping
src/i18n/locales/{en,el}/report-builder.json                          ← MODIFIED: +grouping, chart, kpi, crossFilter keys
```

**Test αρχεία:**
```
src/services/report-engine/__tests__/grouping-engine.test.ts          ← 29 tests (group, aggregate, suggest, KPIs)
```

**Features (12)**: GroupBy 1-2 levels, COUNT+SUM+AVG+MIN+MAX aggregations, chart auto-suggest + manual override, legend toggle, context-aware KPIs (max 4), grand total sticky footer, % of total toggle, chart↔table cross-filter, WAI-ARIA treegrid, sort by subtotal, animated transitions

---

## Phase 3: Export (Tier 1) — ✅ IMPLEMENTED (2026-03-29)

**Αρχεία κώδικα (delivered):**
```
src/services/report-engine/builder-export-types.ts                    ← NEW: shared types, operator symbols, filename builder
src/services/report-engine/builder-pdf-exporter.ts                    ← NEW: SAP Crystal banded, watermark, TOC, bookmarks
src/services/report-engine/builder-excel-exporter.ts                  ← NEW: 4-sheet, formulas, named ranges, protection
src/services/report-engine/builder-excel-analysis.ts                  ← NEW: extracted analysis sheet logic
src/services/report-engine/builder-pdf-extras.ts                      ← NEW: watermark, TOC, bookmarks, footers
src/components/reports/builder/ExportDialog.tsx                        ← NEW: format + watermark + scope selection
src/components/reports/builder/ReportBuilder.tsx                       ← MODIFIED: +export wiring (dynamic import, toPng)
src/config/report-builder/report-builder-types.ts                     ← MODIFIED: +re-export Phase 3 types
src/i18n/locales/{en,el}/report-builder.json                          ← MODIFIED: +export dialog, watermark, scope keys
```

**Test αρχεία:**
```
src/services/report-engine/__tests__/builder-export.test.ts           ← ~30 tests (PDF + Excel generation, watermark, formulas)
```

**Features (18)**: PDF SAP Crystal banded layout, chart PNG embed (html-to-image 2x DPR), Excel 4-sheet workbook (real COUNTA/SUM/AVERAGE/COUNTIFS/SUMIFS formulas), domain-aware filenames, cross-filter scope dialog, applied filters display, loading spinner + toast, conditional formatting, PDF watermark (3 modes), repeat headers every page, orphan/widow control, TOC + PDF bookmarks, document metadata, named ranges, sheet protection, print setup, outline/group rows, freeze panes + auto-filter

---

## Phase 4: More Domains + Tier 2 Export — ✅ IMPLEMENTED (2026-03-30)

**Domains**: A5-A6, B1-B8 (Parking, Storage, Individuals, Companies, Buyers, Suppliers, Engineers, Workers, Legal, Agents)

**Αρχεία κώδικα (delivered):**
```
src/config/report-builder/domain-defs-spaces.ts                       ← NEW: A5 Parking + A6 Storage
src/config/report-builder/domain-defs-contacts.ts                     ← NEW: B1 Individuals + B2 Companies
src/config/report-builder/domain-defs-buyers.ts                       ← NEW: B3 Buyers
src/config/report-builder/domain-defs-persona.ts                      ← NEW: B4-B8 (Suppliers, Engineers, Workers, Legal, Agents)
src/config/report-builder/domain-definitions.ts                       ← MODIFIED: register new domains
src/config/report-builder/report-builder-types.ts                     ← MODIFIED: +domain IDs
src/i18n/locales/{en,el}/report-builder-domains.json                  ← MODIFIED: +domain labels
```

---

## Phase 5: Financial Domains — ✅ IMPLEMENTED (2026-03-30)

**Domains**: C1-C7b → 8 domains (Payment Plans, Cheques, Legal Contracts, Purchase Orders, Brokerage, Commissions, Ownership Summary, Ownership Detail)
**Σημ**: C7 σπάει σε C7a (Summary, table-level grain) + C7b (Detail, row-level grain) — Kimball grain consistency

**Engine Upgrades Delivered**:
- **collectionGroup query support** στον report-query-executor (για subcollection C1 Payment Plans)
- **Computed fields** (26 virtual columns, at query time) — AR Aging, maturity buckets, completion %, overdue detection
- **Row expansion** — C7b flattens `rows[]` array: 1 doc → N result rows
- **JS sort** for computed fields (Firestore can't orderBy virtual columns)

**Domain Group**: New `'financial'` group added to `DomainGroup` union

**Files Created**:
- `src/config/report-builder/domain-defs-financials.ts` (C1 + C2 + C3)
- `src/config/report-builder/domain-defs-procurement.ts` (C4)
- `src/config/report-builder/domain-defs-brokerage.ts` (C5 + C6)
- `src/config/report-builder/domain-defs-ownership.ts` (C7a + C7b)
- `src/services/report-engine/report-query-transforms.ts` (extracted utilities + transforms)

**Files Modified**:
- `src/config/report-builder/report-builder-types.ts` (8 new IDs, financial group, computed/queryType/rowExpansion props)
- `src/config/report-builder/domain-definitions.ts` (registry: 14→22 domains)
- `src/services/report-engine/report-query-executor.ts` (collectionGroup, computed pipeline, extracted utils)
- `src/i18n/locales/{en,el}/report-builder-domains.json` (8 domain blocks, British English)
- `firestore.indexes.json` (collectionGroup indexes for payment_plans)

**Tests**: Extended `report-query-executor.test.ts` with computed fields, row expansion, and computed-filter-routing tests

---

## Phase 6: Construction + CRM + Accounting + Tier 3

**Domains**: D1-D6, E1-E4, F1-F6
**Tier 3**: Contact Card PDF renderer

### Phase 6a: Construction Core (D1-D3) ✅ IMPLEMENTED (2026-03-30)

**Domains implemented**:
- D1: `constructionPhases` — 18 fields (12 flat + 6 computed)
- D2: `constructionTasks` — 20 fields (12 flat + 8 computed)
- D3: `resourceAssignments` — 13 fields (9 flat + 4 computed)

**Gap Analysis Enhancements (Web Research: Procore, P6, CostX, Buildertrend, PlanGrid)**:
- G1: EVM fields (SPI, Schedule Variance) — computed on Phases & Tasks
- G2: Critical Path flag (isCritical) — computed on Tasks
- G3+G7: actualHours field + utilization% — on Resource Assignments
- G4: Auto Risk Indicator (On Track / At Risk / Late) — computed on Phases & Tasks
- G8: Budget columns — deferred to Phase 6b (requires cross-document BOQ aggregation)

**Files**:
```
src/config/report-builder/domain-defs-construction.ts              ← NEW: 3 domain definitions
src/config/report-builder/report-builder-types.ts                  ← EDIT: +3 domain IDs, +construction group
src/config/report-builder/domain-definitions.ts                    ← EDIT: register 3 domains
src/types/building/construction.ts                                 ← EDIT: +actualHours field
src/i18n/locales/en/report-builder-domains.json                    ← EDIT: +3 domains EN
src/i18n/locales/el/report-builder-domains.json                    ← EDIT: +3 domains EL
```

**Decisions recorded**:
- G5 (Cost/m²): Phase 6b with BOQ domain
- G6 (BOQ Revisions): Post-Phase 6
- D6 (Baselines domain): Phase 6b

### Phase 6b: Construction Extended (D4-D6) ✅ IMPLEMENTED (2026-03-30)

**Domains implemented**:
- D4: `boqItems` — 31 fields (23 flat + 8 computed: grossQuantity, unitCost, estimatedTotalCost, actualTotalCost, materialCost, laborCost, equipmentCost, quantityVariance), 7 enums
- D5: `buildingMilestones` — 12 fields (11 flat + 1 computed: daysUntil), 2 enums
- D6: `constructionBaselines` — 7 fields (4 flat + 2 computed: phaseCount, taskCount + createdAt)

**Files**:
```
src/config/report-builder/domain-defs-construction-ext.ts          ← NEW: 3 domain definitions
src/config/report-builder/report-builder-types.ts                  ← EDIT: +3 domain IDs
src/config/report-builder/domain-definitions.ts                    ← EDIT: register 3 domains
src/i18n/locales/en/report-builder-domains.json                    ← EDIT: +3 domains EN
src/i18n/locales/el/report-builder-domains.json                    ← EDIT: +3 domains EL
```

**Total construction domains**: 6 (D1-D6), 28 domains total in Report Builder

### Phase 6c: CRM Core (E1-E2) ✅ IMPLEMENTED (2026-03-30)

**Web Research**: Salesforce, HubSpot, Pipedrive, Zoho CRM, Microsoft Dynamics 365
**Gap Analysis**: 17 gaps identified (G1-G17), all approved by Γιώργος

**New files:**
- `src/config/report-builder/domain-defs-crm.ts` — E1 Opportunities + E2 CRM Tasks

**E1 Opportunities** (25 fields: 19 flat + 6 computed):
- G1: `weightedValue` = estimatedValue × probability / 100 (all platforms)
- G2: `ageDays` = days since creation (all platforms)
- G3: `daysSinceLastActivity` = deal rotting (Pipedrive, Salesforce Einstein)
- G9: `daysInCurrentStage` = bottleneck detection (all platforms)
- G10: `pushCount` = close date postponements (Salesforce, HubSpot, Dynamics)
- G11: `dealVelocityScore` = (value × prob) / age — per-deal velocity (Salesforce, HubSpot)

**E2 CRM Tasks** (20 fields: 15 flat + 5 computed):
- G4: `isOverdue` = past due date + not completed (all platforms)
- G5: `daysUntilDue` = countdown to deadline (Salesforce, HubSpot)
- G12: `daysOpen` = task aging (all platforms)
- G13: `agingBucket` = Today/1-7d/1-2w/2-4w/30+ (Salesforce pattern)
- G14: `completedOnTime` = completed ≤ due date (Salesforce, Zoho)

### Phase 6d: CRM Extended (E3-E4) ✅ IMPLEMENTED (2026-03-30)

**New files:**
- `src/config/report-builder/domain-defs-crm-ext.ts` — E3 Communications + E4 Appointments

**E3 Communications** (18 fields: 16 flat + 2 computed):
- G6: `daysSinceContact` = days since communication (all platforms)
- G15: `isGoingCold` = contact going cold > 30 days (Pipedrive "rotting", Salesforce Einstein)

**E4 Appointments** (21 fields: 17 flat + 4 computed):
- G7: `isStale` = approved + date passed + not completed (Salesforce, HubSpot)
- G8: `waitingDays` = days waiting for action (Pipedrive, Zoho)
- G16: `rescheduleCount` = appointment postponements — **COMPETITIVE ADVANTAGE** (no CRM native!)
- G17: `daysToApproval` = response time (Dynamics 365 SLA, Salesforce)

**Running totals after Phase 6d**: 32 domains, 84 fields (17 computed CRM)

### Phase 6e: Accounting Core — ✅ DONE (2026-03-30)

**Research**: QuickBooks Enterprise, Xero, FreshBooks, Sage, myDATA ΑΑΔΕ
**Gap Analysis**: 16 gaps identified → 16 questions → ALL approved by Γιώργος

**Domains**:
- F1 Invoices: ~20 flat + 14 computed (AR aging, DSO, payment progress, myDATA)
- F2 Journal Entries: ~16 flat + 6 computed (entry age, fiscal quarter, reversal)

**Computed fields (20)**:
- G1: `daysPastDue` = days past due date (QuickBooks, Xero AR Aging)
- G2: `isOverdue` = unpaid + past due (all platforms)
- G3: `paymentProgress` = % paid (QuickBooks, Xero)
- G4: `agingBucket` = current/30/60/90/90+ (QuickBooks AR Aging Detail)
- G5: `daysToPayment` = DSO per invoice (Xero, Sage)
- G6: `outstandingAmount` = gross - paid (all platforms)
- G7: `entryAge` = days since journal entry (Sage)
- G8: `hasInvoiceLink` = linked to invoice (Sage)
- G9: `isReversed` = entry reversed (Sage, QuickBooks)
- G19: `mydataStatus` = ΑΑΔΕ transmission status (myDATA compliance)
- G20: `daysSinceIssued` = days since invoice issue (all platforms)
- G21: `isCancelled` = invoice cancelled (QuickBooks, Sage)
- G22: `isCreditNote` = credit note type (all platforms)
- G23: `fiscalQuarter` = Q1-Q4 label (Sage, ΑΑΔΕ)
- G24: `computedVatAmount` = VAT amount (all platforms)
- G31: `paymentCount` = number of payments (QuickBooks, Xero)
- G32: `daysSinceLastPayment` = last payment age (QuickBooks, Xero)
- G33: `hasContact` = linked to contact (QuickBooks, Xero)
- G37: `emailSentCount` = emails sent (QuickBooks, FreshBooks)
- G38: `wasEmailed` = at least one email (all platforms)

### Phase 6f: Accounting Extended — ✅ DONE (2026-03-30)

**Domains**:
- F4 Bank Transactions: ~11 flat + 5 computed (reconciliation, matching age)
- F5 Expense Documents: ~11 flat + 7 computed (AI confidence, deductibility)
- F6 EFKA Payments: ~7 flat + 5 computed (KEAO risk, overdue tracking)

**Computed fields (17)**:
- G10: `isReconciled` = matched/unmatched/excluded (Xero, QuickBooks)
- G11: `daysSinceTransaction` = transaction age (all platforms)
- G12: `unmatchedAge` = days waiting for match (Xero)
- G13: `hasDocument` = file attached (FreshBooks, QuickBooks)
- G14: `computedVatAmount` = VAT from confirmed/extracted (all platforms)
- G15: `isDeductible` = tax deductible (ΑΑΔΕ, Sage)
- G16: `isOverdue` = EFKA payment overdue (ΕΦΚΑ/ΚΕΑΟ)
- G17: `daysOverdueOrUntilDue` = days +/- from due (ΕΦΚΑ)
- G18: `keaoRisk` = low/medium/high risk (ΕΦΚΑ/ΚΕΑΟ >60 days)
- G25: `isInflow` = credit direction (all platforms)
- G26: `absoluteAmount` = positive amount for sorting (all platforms)
- G27: `documentAge` = days since upload (FreshBooks)
- G28: `needsReview` = status=review flag (Xero, FreshBooks AI)
- G29: `monthLabel` = human month name (all platforms)
- G30: `contributionTotal` = total EFKA amount (ΕΦΚΑ)
- G35: `aiConfidence` = AI extraction confidence % (Xero, FreshBooks AI)
- G36: `hasJournalEntry` = linked to journal (Sage, QuickBooks)

**Running totals after Phase 6f**: 37 domains, ~160 fields (37 computed accounting)

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/tier3-card-renderer.test.ts      ← Card PDF: sections, conditional blocks
```

---

## Phase 7: Saved Reports — ✅ COMPLETE (2026-03-30)

**Research**: Salesforce, HubSpot, QuickBooks, Xero, Power BI, Google Analytics
**Decisions by Γιώργος** (5 ερωτήσεις, 5 αποφάσεις):
1. Visibility: Role-based 3-tier (personal/shared/system) — Salesforce pattern
2. Persistence: Config-only ("recipe"), live data on each run — QuickBooks pattern
3. Date ranges: Relative by default (this_month, last_quarter, etc.) — industry standard
4. Favorites: Per-user via `favoritedBy[]` array — Power BI pattern
5. Categories: Predefined (monthly/tax/expenses/bank/efka/general) — QuickBooks Groups
6. Recent tab: Via `lastRunAt` + `runCount` tracking — GA4 pattern

**Firestore**: `saved_reports` collection, ID prefix: `srpt_`

### Phase 7a: Backend — ✅ DONE (commit `3e73b845`)

**Αρχεία delivered:**
```
src/types/reports/saved-report.ts                    ← Types, interfaces, enums
src/services/saved-reports/saved-reports-service.ts  ← Firestore CRUD (7 methods)
src/app/api/reports/saved/route.ts                   ← GET (list) + POST (create)
src/app/api/reports/saved/[reportId]/route.ts        ← GET + PUT + DELETE + POST (actions)
src/i18n/locales/en/saved-reports.json               ← EN labels
src/i18n/locales/el/saved-reports.json               ← EL labels
src/config/firestore-collections.ts                  ← +SAVED_REPORTS
src/services/enterprise-id.service.ts                ← +srpt_ generator
```

**Service methods**: create, get, list, update, delete, toggleFavorite, trackRun
**API endpoints**: 5 (GET/POST list+create, GET/PUT/DELETE/POST per-report)

### Phase 7b: Frontend — ✅ DONE (2026-03-30)

**Αρχεία delivered:**
```
src/hooks/reports/useSavedReports.ts                       ← NEW: React hook (CRUD + optimistic favorites + tab/search filtering)
src/hooks/reports/useReportBuilder.ts                      ← MODIFIED: +loadSavedReport, getCurrentConfig, unsaved changes detection
src/components/reports/builder/SaveReportDialog.tsx         ← NEW: Save/save-as modal (AlertDialog, category+visibility)
src/components/reports/builder/SavedReportsTableRow.tsx     ← NEW: Row component (star, badges, dropdown actions)
src/components/reports/builder/SavedReportsList.tsx         ← NEW: Tabbed table (All/Favorites/Recent/Shared) + search + confirm delete
src/components/reports/builder/ReportBuilder.tsx            ← MODIFIED: Save/Load buttons, HubSpot yellow unsaved-changes bar, panel
src/components/reports/builder/index.ts                    ← MODIFIED: +3 exports
src/i18n/locales/en/saved-reports.json                     ← MODIFIED: +messages (unsavedChanges, confirmLoad, errors, etc.)
src/i18n/locales/el/saved-reports.json                     ← MODIFIED: +messages (ελληνικά)
```

**Patterns used**: Salesforce saved views, QuickBooks memorized reports, HubSpot unsaved-changes bar, optimistic UI for favorites

**Test αρχεία (DEFERRED — θα γίνουν ξεχωριστά):**
```
src/services/report-engine/__tests__/saved-reports-service.test.ts    ← CRUD: save, load, update, delete, list
src/components/reports/builder/__tests__/SavedReportManager.test.tsx   ← UI: save dialog, load list, delete confirm
```

---

## Phase 8: Cash Flow Forecast (Dedicated Module) — ✅ IMPLEMENTED (2026-03-30)

**Απόφαση (2026-03-30)**: Standalone module, ΟΧΙ embedded σε generic report builder.
**Pattern**: ARGUS Enterprise, Yardi Cash Management, Google Finance.

### Enterprise Research (2026-03-30)

**Πλατφόρμες ερευνηθείσες (12)**: ARGUS Enterprise, Yardi Voyager, Procore, SAP S/4HANA, Oracle NetSuite Cash 360, QuickBooks Enterprise, Xero, Sage Intacct, Microsoft Dynamics 365 Finance, Buildium, AppFolio, HighRadius.

**Πρότυπα κατασκευαστικού κλάδου**: RICS Cash Flow Forecasting 2nd Ed (July 2024), AACE RP 10S-90, PMI PMBOK EVM.

#### Κοινά Enterprise Patterns (consensus 10/12):

| Pattern | Consensus | Best Implementation |
|---------|-----------|-------------------|
| 4 KPI cards στην κορυφή | 10/12 | NetSuite Cash 360 |
| Combo chart (stacked bar + cumulative line) | 8/12 | SAP Fiori, D365 |
| 3 σενάρια (Optimistic/Realistic/Pessimistic) | 5/12 | D365 snapshots (best-in-class) |
| Actual vs Forecast variance | 7/12 | D365, Yardi |
| 12-month rolling forecast | 8/12 | SAP, D365, NetSuite, ARGUS |
| Monthly breakdown table | 12/12 | Universal |
| Per-project filtering | 8/12 | Procore, ARGUS, Yardi |
| Export PDF + Excel | 10/12 | Universal |

#### KPI Cards (industry consensus):
1. **Current Cash Position** — τρέχον υπόλοιπο (10/12)
2. **Cash Runway** — μήνες αντοχής (6/12, emerging)
3. **Collection Rate** — % εισπράξεων εγκαίρως (8/12)
4. **Net Cash Flow** — καθαρή ροή μήνα (7/12)

#### Construction/RE-specific (ARGUS, Procore, RICS):
- S-Curve cumulative cost vs plan
- Retention tracking (5-10% holdback)
- PDC bounce rate tracking (2-5% historical)
- Pre-sales % (units sold before completion)
- Peak Negative Cash Flow (max funding gap)
- 13-week rolling short-term forecast (Wall Street standard)

### Αποφάσεις Γιώργου

| # | Ερώτηση | Απόφαση | Ημερομηνία |
|---|---------|---------|------------|
| Q1 | Τι layout θέλεις στη σελίδα; | "Ό,τι κάνουν οι μεγάλοι" → Dashboard-first: 4 KPI cards + combo chart + monthly table | 2026-03-30 |
| Q2 | Πώς ορίζεται το αρχικό υπόλοιπο; | **Δρόμος Α (Xero pattern)** — χειροκίνητο αρχικό υπόλοιπο + δυνατότητα επεξεργασίας ανά πάσα στιγμή. Αποθήκευση σε Firestore (settings ή dedicated doc). Ο χρήστης μπορεί να το ενημερώνει όποτε θέλει. | 2026-03-30 |
| Q3 | Ποιο ποσοστό δόσεων εισπράττεται εγκαίρως; | "Οι περισσότεροι πληρώνουν, κάποιοι καθυστερούν 1-2 μήνες" → Default σενάρια: **Αισιόδοξο 100%**, **Ρεαλιστικό 85%** (με μέσο delay 30 ημέρες), **Απαισιόδοξο 70%** (με μέσο delay 60 ημέρες). Ιδανικά: υπολογισμός collection rate αυτόματα από ιστορικά δεδομένα (paidDate vs dueDate). | 2026-03-30 |
| Q4 | Τι εκροές μετράμε; | "Ό,τι κάνουν οι μεγάλοι" → **Hybrid approach** (QuickBooks/Xero pattern): (A) Αυτόματα από υπάρχοντα δεδομένα: POs (paymentDueDate+total), Τιμολόγια (dueDate+amount), ΕΦΚΑ (ήδη στο accounting). (B) Χειροκίνητα "Πάγιες Πληρωμές" (recurring expenses): δάνειο, μισθοδοσία, ενοίκια, λοιπά — editable λίστα, εφαρμόζονται κάθε μήνα στο forecast. | 2026-03-30 |
| Q5 | Συγκεντρωτικά ή ανά έργο; | **Επιλογή Γ — Και τα δύο**: Default = όλα τα έργα μαζί (consolidated view). Φίλτρο ανά έργο/κτίριο. SAP/ARGUS/Procore pattern: consolidated default + drill-down per entity. | 2026-03-30 |
| Q6 | Ημερολόγιο λήξης PDC; | **Ναι** — Calendar view με ημερομηνίες λήξης επιταγών. Κάθε ημέρα δείχνει ποσό + όνομα. ARGUS/Yardi pattern: PDC maturity calendar. Θα είναι secondary section κάτω από τον πίνακα. | 2026-03-30 |
| Q7 | Export μορφές; | **PDF + Excel** — Reuse Phase 3 export infrastructure (builder-pdf-exporter, builder-excel-exporter patterns). PDF: branded A4 με KPIs + chart + πίνακα (για τράπεζα/επενδυτές). Excel: monthly breakdown + formulas (για ιδίους υπολογισμούς). | 2026-03-30 |
| Q8 | Πού η φόρμα πάγιων πληρωμών + αρχικού υπολοίπου; | **Μέσα στη σελίδα ως collapsible panel** (QuickBooks/Xero pattern). Ο χρήστης ανοίγει το πάνελ, αλλάζει ποσά, βλέπει αμέσως πώς αλλάζει η πρόβλεψη. Περιλαμβάνει: αρχικό υπόλοιπο (editable) + λίστα recurring expenses (add/edit/delete). | 2026-03-30 |
| Q9 | Forecast vs Actual σύγκριση; | **Ναι, από την αρχή** (D365/HighRadius pattern). Για μήνες που έχουν περάσει, δείχνουμε στήλη "Πραγματικά" δίπλα στα "Προβλεπόμενα" + στήλη "Απόκλιση" (ποσό + %). Υλοποίηση: aggregation πραγματικών εισπράξεων/πληρωμών από bank_transactions + payment events για παρελθοντικούς μήνες. | 2026-03-30 |
| Q10 | Alerts/ειδοποιήσεις; | **Ναι** (SAP/HighRadius pattern). 3 τύποι alerts: (1) Low cash warning — υπόλοιπο πέφτει κάτω από threshold, (2) PDC alerts — επιταγές που λήγουν εντός εβδομάδας, (3) Collection rate drop — είσπραξη κάτω από 80%. Εμφάνιση ως banner/cards στην κορυφή της σελίδας, πάνω από τα KPIs. | 2026-03-30 |

### Features (updated after research):
- Rolling 12-month cash flow projection (inflows from payment plan installments, outflows from POs)
- Projected vs Actual comparison (installment dueDate vs actual paidDate)
- Cumulative balance timeline chart (combo: stacked bar + line)
- PDC (Post-Dated Cheque) maturity calendar
- Inflows/Outflows breakdown per project
- Scenario modeling: optimistic (100% on-time), realistic (historical collection rate), pessimistic
- 4 KPI hero cards: Cash Position, Cash Runway, Collection Rate, Net Cash Flow
- Per-project/building filtering
- Variance column (forecast vs actual)

**Data Sources**:
- Payment Plans → installments[].dueDate + amount (projected inflows)
- Cheques → maturityDate + amount (PDC inflows)
- Purchase Orders → paymentDueDate + total (projected outflows)
- Accounting Invoices → dueDate + amount (actual outflows)
- Historical payment data → collection rate calculation

**UI**: Dedicated page `/reports/cash-flow` with:
- 4 KPI cards (hero section)
- Timeline chart (stacked bar inflows/outflows + cumulative balance line)
- Monthly breakdown table (Opening | Inflows | Outflows | Net | Closing)
- Scenario selector (Optimistic / Realistic / Pessimistic)
- Filter by project / building / date range
- Export PDF + Excel

### Implementation (2026-03-30)

**Αρχεία κώδικα (delivered):**
```
src/services/cash-flow/cash-flow.types.ts                              ← NEW: All types & interfaces
src/services/cash-flow/cash-flow-projection-engine.ts                  ← NEW: Pure functions (bucket, expand, project, alerts, PDC)
src/services/cash-flow/cash-flow-data-fetcher.ts                       ← NEW: Server-only Firestore queries (6 collections + config)
src/services/cash-flow/cash-flow-pdf-exporter.ts                       ← NEW: jsPDF A4 branded export
src/services/cash-flow/cash-flow-excel-exporter.ts                     ← NEW: ExcelJS 4-sheet workbook
src/services/cash-flow/index.ts                                        ← NEW: Barrel exports
src/app/api/reports/cash-flow/route.ts                                 ← NEW: GET (forecast) + PUT (config)
src/hooks/reports/useCashFlowReport.ts                                 ← NEW: Main hook (5-min cache, KPIs, chart, table)
src/hooks/reports/useCashFlowSettings.ts                               ← NEW: Settings CRUD hook
src/app/reports/cash-flow/page.tsx                                     ← NEW: Dashboard page
src/components/reports/sections/cash-flow/CashFlowAlerts.tsx            ← NEW: 3 alert types (Q10)
src/components/reports/sections/cash-flow/CashFlowControls.tsx          ← NEW: Scenario + filter + export (Q3, Q5)
src/components/reports/sections/cash-flow/CashFlowChart.tsx             ← NEW: ComposedChart bars + line (Q1)
src/components/reports/sections/cash-flow/CashFlowTable.tsx             ← NEW: Monthly breakdown table (Q1)
src/components/reports/sections/cash-flow/CashFlowSettings.tsx          ← NEW: Collapsible CRUD panel (Q2, Q4, Q8)
src/components/reports/sections/cash-flow/PDCCalendarView.tsx           ← NEW: PDC maturity calendar (Q6)
src/components/reports/sections/cash-flow/ForecastVsActualTable.tsx     ← NEW: Forecast vs Actual (Q9)
src/components/reports/sections/cash-flow/index.ts                     ← NEW: Barrel exports
src/i18n/locales/en/cash-flow.json                                     ← NEW: EN translations
src/i18n/locales/el/cash-flow.json                                     ← NEW: EL translations
src/config/smart-navigation-factory.ts                                 ← MODIFIED: +Banknote nav entry
src/services/enterprise-id.service.ts                                  ← MODIFIED: +rpay_ prefix + generator
src/i18n/lazy-config.ts                                                ← MODIFIED: +cash-flow namespace
src/i18n/locales/en/navigation.json                                    ← MODIFIED: +cashFlow key
src/i18n/locales/el/navigation.json                                    ← MODIFIED: +cashFlow key
```

**Test αρχεία:**
```
src/services/cash-flow/__tests__/cash-flow-projection-engine.test.ts   ← 39 tests (bucket, expand, project, scenarios, PDC, alerts)
```

**Test results**: 1/1 suite passed, 39/39 tests passed

---

## Navigation Integration

Add to sidebar: `/reports/builder` → "Report Builder" (under Reports section)
Add to reports page: link/card to builder

---

## Checklist ανά Phase Delivery

Πριν κάνεις commit σε ΟΠΟΙΑΔΗΠΟΤΕ Phase:

- [ ] Κώδικας γραμμένος
- [ ] Tests γραμμένα (βλ. SPEC-011 §5)
- [ ] `npm test -- --testPathPattern="report-builder|report-engine"` → **ALL PASS**
- [ ] Coverage ≥ 80% statements
- [ ] ADR-268.md changelog ενημερωμένο
- [ ] Commit: κώδικας + tests ΜΑΖΙ
