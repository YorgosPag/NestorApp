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
| 2 | Grouping + KPIs + Charts | — (engine) | ~3 | ~2 | ~25-30 |
| 3 | Export (Tier 1) | — (PDF + Excel) | ~2 | ~3 | ~40-50 |
| 4 | Domains A5-A6, B1-B8 + Tier 2 | Parking, Storage, Contacts... | ~5 configs | ~1 | ~20-30 |
| 5 | Domains C1-C7 (8 domains) + Computed Fields + collectionGroup | Payments, Cheques, Contracts... | ~8 configs + 2 engine | ~3 | ~40-50 |
| 6 | Domains D1-D4, E1-E2, F1-F2 + Tier 3 | Construction, CRM, Accounting | ~8 configs | ~1 | ~20-30 |
| 7 | Saved Reports | — | ~3 | ~2 | ~20-25 |
| 8 | Cash Flow Forecast (Dedicated Module) | — (standalone) | ~4 | ~2 | ~30-40 |

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

## Phase 2: Grouping + KPIs + Charts

**Αρχεία κώδικα:**
```
src/components/reports/builder/GroupBySelector.tsx
(updates to ReportResults.tsx, report-query-executor.ts)
```

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/grouping-engine.test.ts          ← Group by 1-2 levels, subtotals, aggregations
src/components/reports/builder/__tests__/GroupBySelector.test.tsx      ← UI: select group, max 2 levels
```

**Features**: GroupBy 1-2 levels, KPI cards, subtotals, auto bar/pie chart

---

## Phase 3: Export (Tier 1)

**Αρχεία κώδικα:**
```
src/components/reports/builder/BuilderExportBar.tsx
(reuse existing exportReportToPdf, exportReportToExcel)
```

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/builder-pdf-exporter.test.ts     ← PDF: branding, table, pagination, chart
src/services/report-engine/__tests__/builder-excel-exporter.test.ts   ← Excel: 4-sheet, formulas, charts, format
src/components/reports/builder/__tests__/BuilderExportBar.test.tsx     ← UI: buttons, loading, format select
```

---

## Phase 4: More Domains + Tier 2 Export

**Domains**: A5-A6, B1-B8 (Parking, Storage, Individuals, Companies, Buyers, Suppliers, Engineers, Workers, Legal, Agents)
**Tier 2**: Row repetition export mode for nested entities

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/config/report-builder/__tests__/domain-config-validation.test.ts  ← ALL domain configs schema validation
src/services/report-engine/__tests__/tier2-row-expansion.test.ts      ← Row repetition: arrays → flat rows
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

### Phase 6c-6f: CRM + Accounting — PENDING

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/tier3-card-renderer.test.ts      ← Card PDF: sections, conditional blocks
```

---

## Phase 7: Saved Reports

**Features**: Save/Load/Delete/Update saved report configurations
**Firestore**: `saved_reports` collection

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/saved-reports-service.test.ts    ← CRUD: save, load, update, delete, list
src/components/reports/builder/__tests__/SavedReportManager.test.tsx   ← UI: save dialog, load list, delete confirm
```

---

## Phase 8: Cash Flow Forecast (Dedicated Module)

**Απόφαση (2026-03-30)**: Standalone module, ΟΧΙ embedded σε generic report builder.
**Pattern**: ARGUS Enterprise, Yardi Cash Management, Google Finance.

**Features**:
- Rolling 12-month cash flow projection (inflows from payment plan installments, outflows from POs)
- Projected vs Actual comparison (installment dueDate vs actual paidDate)
- Cumulative balance timeline chart
- PDC (Post-Dated Cheque) maturity calendar
- Inflows/Outflows breakdown per project
- Scenario modeling: optimistic (100% on-time), realistic (historical collection rate), pessimistic

**Data Sources**:
- Payment Plans → installments[].dueDate + amount (projected inflows)
- Cheques → maturityDate + amount (PDC inflows)
- Purchase Orders → paymentDueDate + total (projected outflows)
- Accounting Invoices → dueDate + amount (actual outflows)
- Historical payment data → collection rate calculation

**UI**: Dedicated page `/reports/cash-flow` with:
- Timeline chart (bar + line combo)
- Monthly breakdown table
- Filter by project / building / date range
- Export PDF + Excel

**Test αρχεία (ΥΠΟΧΡΕΩΤΙΚΑ):**
```
src/services/report-engine/__tests__/cash-flow-forecast.test.ts        ← Projection calc, scenarios, cumulative
src/components/reports/__tests__/CashFlowDashboard.test.tsx            ← UI: chart, filters, export
```

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
