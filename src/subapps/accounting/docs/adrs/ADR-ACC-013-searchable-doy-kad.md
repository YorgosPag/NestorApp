# ADR-ACC-013: Searchable ΔΟΥ + ΚΑΔ Dropdowns

## Status: IMPLEMENTED

## Date: 2026-02-10

## Context

Στο Company Setup, τα πεδία **ΔΟΥ** (Δημόσια Οικονομική Υπηρεσία) και **ΚΑΔ** (Κωδικός Αρχικής Δραστηριότητας) ήταν plain text inputs. Αυτό οδηγούσε σε:
- Τυπογραφικά λάθη
- Μη τυποποιημένα δεδομένα (π.χ. "Α Αθηνών" vs "Α' Αθηνών")
- Δυσκολία εύρεσης του σωστού κωδικού ΚΑΔ (10.500+ κωδικοί)

## Decision

Αντικατάσταση plain text inputs με **searchable dropdowns** χρησιμοποιώντας ένα νέο generic `SearchableCombobox` component.

### Αρχιτεκτονικές αποφάσεις:

1. **Generic component** (`SearchableCombobox`): Reusable σε ολόκληρη την εφαρμογή
2. **Radix Popover**: Συμβατό με ADR-001 (no custom dropdowns)
3. **Static data**: ΔΟΥ (~100 entries, ~5KB) loaded eagerly, ΚΑΔ (~700 entries) lazy-loaded via `import()`
4. **Free text fallback**: ΚΑΔ υποστηρίζει `allowFreeText` — αν ο κωδικός δεν υπάρχει στη λίστα
5. **Accent-insensitive search**: `normalizeGreek()` αφαιρεί τόνους → "Πατ" βρίσκει "Πατρών"
6. **Κανένα νέο npm πακέτο**: Μόνο existing `@radix-ui/react-popover` + `Input`

## New Files

| File | Description | Size |
|------|-------------|------|
| `src/components/ui/searchable-combobox.tsx` | Generic SearchableCombobox | ~280 lines |
| `src/subapps/accounting/data/greek-tax-offices.ts` | ~100 ΔΟΥ (ΑΑΔΕ) | ~5KB |
| `src/subapps/accounting/data/greek-kad-codes.ts` | ~700 ΚΑΔ (NACE Rev.2) | ~40KB |
| `scripts/fetch-kad-codes.ts` | One-time fetch script for full ΚΑΔ list | ~80 lines |

## Modified Files

| File | Change |
|------|--------|
| `BasicInfoSection.tsx` | `<Input>` → `<SearchableCombobox>` for taxOffice |
| `KadSection.tsx` | 2 `<Input>` → 1 `<SearchableCombobox>` per ΚΑΔ entry, lazy loading |
| `el/accounting.json` | +5 i18n keys |
| `en/accounting.json` | +5 i18n keys |

## SearchableCombobox API

```typescript
interface SearchableComboboxProps {
  value: string;
  onValueChange: (value: string, option: ComboboxOption | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  maxDisplayed?: number;    // default: 50
  debounceMs?: number;      // default: 150
  allowFreeText?: boolean;  // default: false
  disabled?: boolean;
  error?: string;
  className?: string;
}
```

## ΔΟΥ Data Source

- **Πηγή**: ΑΑΔΕ (Ανεξάρτητη Αρχή Δημοσίων Εσόδων)
- **Entries**: ~100 ενεργές ΔΟΥ
- **Format**: `{ code, name, region }`
- **Stored value**: `name` (human-readable, εμφανίζεται σε τιμολόγια)
- **Search**: Searches name, code, and region

## ΚΑΔ Data Source

- **Πηγή**: NACE Rev.2 / forin.gr
- **Entries**: ~700 κοινοί κωδικοί (expandable to 10.500+ via fetch script)
- **Format**: `{ code, description }`
- **Lazy loading**: `import()` — loaded on KadSection mount, not on initial page load
- **Auto-fill**: Selecting a ΚΑΔ fills both `code` and `description`

## Fetch Script (for full ΚΑΔ list)

```bash
npx tsx scripts/fetch-kad-codes.ts
```

Fetches paginated data from forin.gr DataTables API and outputs full TypeScript file.

## Consequences

### Positive
- Τυποποιημένα δεδομένα ΔΟΥ + ΚΑΔ
- Γρήγορη αναζήτηση με accent-insensitive filtering
- ΚΑΔ lazy-loaded → δεν επιβαρύνει initial bundle
- Reusable component για μελλοντικά searchable dropdowns

### Negative
- ~40KB extra for ΚΑΔ data (mitigated by lazy loading)
- ΚΑΔ list needs manual update when ΑΑΔΕ changes codes (rare)

## Changelog

| Date | Change |
|------|--------|
| 2026-02-10 | Initial implementation — ADR-ACC-013 |
