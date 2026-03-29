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
| 1 | Core MVP | A1-A4 (Έργα, Κτίρια, Όροφοι, Μονάδες) | ~13 | ~8 | ~80-100 |
| 2 | Grouping + KPIs + Charts | — (engine) | ~3 | ~2 | ~25-30 |
| 3 | Export (Tier 1) | — (PDF + Excel) | ~2 | ~3 | ~40-50 |
| 4 | Domains A5-A6, B1-B8 + Tier 2 | Parking, Storage, Contacts... | ~5 configs | ~1 | ~20-30 |
| 5 | Domains C1-C7 | Payments, Cheques, Contracts... | ~7 configs | ~1 | ~20-30 |
| 6 | Domains D1-D4, E1-E2, F1-F2 + Tier 3 | Construction, CRM, Accounting | ~8 configs | ~1 | ~20-30 |
| 7 | Saved Reports | — | ~3 | ~2 | ~20-25 |

**Σύνολο**: ~41 αρχεία κώδικα, ~18 test αρχεία, ~225-285 test cases

---

## Phase 1: Core MVP

**Αρχεία κώδικα:**
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

## Phase 5: Financial Domains

**Domains**: C1-C7 (Payment Plans, Cheques, Contracts, Brokerage, Commissions, Purchase Orders, Ownership)

**Tests**: Τα domain configs καλύπτονται από `domain-config-validation.test.ts` (Phase 4). Αν υπάρχει νέα business logic → νέο test file.

---

## Phase 6: Construction + CRM + Accounting + Tier 3

**Domains**: D1-D4, E1-E2, F1-F2
**Tier 3**: Contact Card PDF renderer

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
