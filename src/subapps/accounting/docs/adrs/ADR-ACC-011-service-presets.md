# ADR-ACC-011: Service Presets — Προκαθορισμένες Περιγραφές Υπηρεσιών

**Status**: Accepted
**Date**: 2026-02-10
**Author**: Claude Code (Anthropic AI) + Giorgos Pagonis

## Context

Στη φόρμα νέου τιμολογίου, το πεδίο "Περιγραφή" κάθε γραμμής ήταν σκέτο `<Input>` (ελεύθερο κείμενο).
Μηχανικοί εκδίδουν τιμολόγια με **επαναλαμβανόμενες υπηρεσίες** (ΠΕΑ, Αρχιτεκτονική Μελέτη κλπ) —
η χειροκίνητη συμπλήρωση κάθε φορά σπαταλά χρόνο και αυξάνει σφάλματα.

## Decision

Υλοποίηση **Service Presets** — προκαθορισμένες περιγραφές υπηρεσιών με auto-fill.

### Architecture

- **Storage**: Single Firestore document `accounting_settings/service_presets`
  - Ίδιο pattern με `accounting_settings/company_profile`
  - Array 10-30 presets (ρεαλιστικά για ατομική επιχείρηση)
- **Repository**: 2 νέες μέθοδοι στο `IAccountingRepository`
  - `getServicePresets()` → active presets only
  - `saveServicePresets()` → full array overwrite
- **API**: `GET/PUT /api/accounting/setup/presets`
  - `withAuth()` + `withStandardRateLimit()`
  - Server-side validation (max 100, required fields, valid VAT rates)
- **Client**: `useServicePresets` hook (auto-fetch on mount)

### UI Components

1. **ServicePresetCombobox** (`components/shared/`)
   - Radix Popover + Input (ADR-001 compliant)
   - Filtered list on typing
   - Keyboard navigation (↑↓ Enter Escape)
   - `onPresetSelect` → auto-fill: description, unit, unitPrice, vatRate, mydataCode
   - `onDescriptionChange` → free text (only description changes)

2. **ServicePresetsSection** (`components/setup/`)
   - CRUD UI in Settings page
   - Inline edit + delete
   - "Load Defaults" — 10 τυπικές υπηρεσίες μηχανικού

### Integration Points

- `LineItemsEditor` — new `presets` prop, `applyPreset()` handler
- `InvoiceForm` — loads presets via `useServicePresets()`
- `SetupPageContent` — includes `<ServicePresetsSection />` after Invoice Series

## Data Model

```typescript
interface ServicePreset {
  presetId: string;           // 'sp_xxxxx'
  description: string;
  unit: string;               // 'τεμ', 'ώρες', 'τ.μ.'
  unitPrice: number;          // 0 = variable
  vatRate: number;            // 24, 13, 6, 0
  mydataCode: MyDataIncomeType;
  isActive: boolean;
  sortOrder: number;
}
```

## Default Presets (10 services)

| # | Description | Unit | Price | VAT |
|---|-------------|------|-------|-----|
| 1 | ΠΕΑ — Πιστοποιητικό Ενεργειακής Απόδοσης | τεμ | 250 | 24% |
| 2 | Αρχιτεκτονική Μελέτη | τεμ | 0 | 24% |
| 3 | Έκδοση Οικοδομικής Άδειας | τεμ | 0 | 24% |
| 4 | Τοπογραφικό Διάγραμμα | τεμ | 0 | 24% |
| 5 | Επίβλεψη Εργασιών | ώρες | 80 | 24% |
| 6 | Στατική Μελέτη | τεμ | 0 | 24% |
| 7 | Μηχανολογική (Η/Μ) Μελέτη | τεμ | 0 | 24% |
| 8 | Ενεργειακή Μελέτη | τεμ | 0 | 24% |
| 9 | Τεχνική Συμβουλευτική | ώρες | 60 | 24% |
| 10 | Ηλεκτρολογική Μελέτη | τεμ | 0 | 24% |

(Price 0 = variable — user fills in the amount)

## Files

### New (5)
| File | Purpose |
|------|---------|
| `src/app/api/accounting/setup/presets/route.ts` | API endpoint GET/PUT |
| `src/subapps/accounting/hooks/useServicePresets.ts` | Client hook |
| `src/subapps/accounting/components/shared/ServicePresetCombobox.tsx` | Searchable combobox |
| `src/subapps/accounting/components/setup/ServicePresetsSection.tsx` | Settings CRUD |
| `src/subapps/accounting/docs/adrs/ADR-ACC-011-service-presets.md` | This ADR |

### Modified (8)
| File | Change |
|------|--------|
| `types/invoice.ts` | +ServicePreset, +ServicePresetsDocument |
| `types/index.ts` | +barrel exports |
| `types/interfaces.ts` | +getServicePresets(), +saveServicePresets() |
| `services/repository/firestore-accounting-repository.ts` | +implementation |
| `components/invoices/forms/LineItemsEditor.tsx` | Input → ServicePresetCombobox |
| `components/invoices/forms/InvoiceForm.tsx` | +useServicePresets, pass presets |
| `components/setup/SetupPageContent.tsx` | +ServicePresetsSection |
| `hooks/index.ts` | +export |
| `src/i18n/locales/el/accounting.json` | +servicePresets keys |
| `src/i18n/locales/en/accounting.json` | +servicePresets keys |

## Consequences

**Positive**:
- Ταχύτερη έκδοση τιμολογίων (3 κλικ αντί χειροκίνητης πληκτρολόγησης)
- Μειωμένα σφάλματα (σταθεροί κωδικοί myDATA, σωστό ΦΠΑ)
- Πλήρες CRUD χωρίς deploy (ρυθμίσεις στο Firestore)

**Negative**:
- Επιπλέον API call στο mount της InvoiceForm (mitigated: cached by hook)

## Changelog

| Date | Change |
|------|--------|
| 2026-02-10 | Initial implementation — Phase 1 complete |
