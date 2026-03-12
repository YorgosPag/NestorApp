# ADR-216: formatCurrency Centralization — 0% → 100% Adoption

| Field | Value |
|-------|-------|
| **Status** | ✅ Implemented |
| **Date** | 2026-03-12 |
| **Category** | Centralization / Currency Formatting |
| **Scope** | 23 files, 29 inline patterns eliminated |

## Context

Audit (ADR-156) identified **29 inline currency patterns** across **21 files** plus **2 duplicate functions** — while 4 centralized functions exist in `src/lib/intl-utils.ts` with **0% adoption** in violating files.

**Inconsistencies fixed:**
- Mixed locales: some files `'el-GR'`, others browser default
- `€` prefix via string concatenation vs locale-aware `Intl.NumberFormat`
- `formatEuro()` duplicate in `accounting-notification.ts`
- Local `formatCurrency()` duplicate in `ProjectMeasurementsTab.tsx`

## Decision

Replace all 29 inline currency formatting patterns with centralized SSoT functions from `src/lib/intl-utils.ts`:

| Function | Signature | Use Case |
|----------|-----------|----------|
| `formatCurrency()` | `(amount, currency?, options?)` | General currency (0-2 decimals) |
| `formatCurrencyWhole()` | `(amount: number\|null\|undefined)` | 0 decimals, null→"—" |
| `formatCurrencyCompact()` | `(value: number)` | K/M notation (€500K, €1.2M) |
| `formatPriceWithUnit()` | `(price, unit, currency?)` | "€1.200/month" |

## Changes

### GROUP A: `€${value.toLocaleString()}` → `formatCurrency()` (17 patterns, 14 files)
- UnitsTabContent, ParkingTabContent, StorageTab → `formatCurrencyWhole()`
- SoldUnitsPreview → `formatCurrencyWhole()`
- PropertyCard (compositions + property-grid) → `formatCurrency()`
- UnifiedCustomerCard → `formatCurrency()`
- share-utils, sharing-service, ShareButton → `formatCurrency()`
- SustainabilityTab, ExportTab (DXF) → `formatCurrency()`
- email-templates.service (×3) → `formatCurrency()`
- search-index-config → `formatCurrency()`
- ContactCard → `formatCurrency()`

### GROUP B: `€${Math.round(...).toLocaleString('el-GR')}` → `formatCurrencyWhole()` (6 patterns, 3 files)
- available-apartments, available-parking, available-storage pages

### GROUP C: Dialog `toLocaleString('el-GR')` patterns (3 patterns, 2 files)
- SalesActionDialogs (×2) → `formatCurrency()`
- telegram/search/criteria → `formatCurrency()`

### GROUP D: Compact notation (1 pattern)
- spaces/parking/page → `formatCurrencyCompact()`

### GROUP E: Duplicate function elimination (2 files)
- `ProjectMeasurementsTab.tsx`: Renamed local wrapper to `formatCurrencyWithDecimals()`, still delegates to centralized `formatCurrency()` with `{ minimumFractionDigits: 2 }`
- `accounting-notification.ts`: `formatEuro()` body replaced with delegation to centralized `formatCurrency()`

### SKIP
- `telegram/templates/template-resolver.ts` — Legitimate i18n-aware locale mapping, not a duplicate

## Verification

```bash
# Zero inline € concatenation patterns (except template-resolver.ts)
grep -rn '€\${.*toLocaleString' src/ --include="*.ts" --include="*.tsx" | grep -v template-resolver | grep -v intl-utils | grep -v node_modules

# Zero local formatEuro definitions
grep -rn 'function formatEuro\b' src/ --include="*.ts" | grep -v intl-utils | grep -v node_modules
```

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — 29 patterns centralized across 23 files |
