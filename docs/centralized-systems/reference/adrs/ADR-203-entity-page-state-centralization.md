# ADR-203: Entity Page State Centralization

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-12 |
| **Category** | Data & State / Hooks |
| **Extends** | ADR-051 (Enterprise Filter System) |

## Context

Πέντε entity pages (Projects, Buildings, Parking, Storages + Units/DXF viewer) μοιράζονταν σχεδόν ταυτόσημο boilerplate (~60 γραμμές/hook) για:

- URL parameter handling (`useSearchParams`)
- Selected item state (`useState<T | null>`)
- View mode state (`list | grid | byType | byStatus`)
- Dashboard toggle
- Filter state management
- Auto-select from URL parameter
- Data sync when source array refreshes

### Προβλήματα πριν τη κεντρικοποίηση

1. **Bug σε 1 = bug σε 4** — αν βρεθεί issue στο auto-select, πρέπει fix σε 4 αρχεία
2. **INP optimization** (`useTransition`) υπήρχε ΜΟΝΟ στο buildings hook
3. **Data sync** (`useEffect` for selected item refresh) υπήρχε ΜΟΝΟ στο projects hook
4. **~700+ γραμμές** συνολικό boilerplate

## Decision

Δημιουργία generic `useEntityPageState<T, F>` hook που δέχεται:

- `items: T[]` — η λίστα entities
- `config: EntityPageStateConfig<T, F>` — entity-specific ρυθμίσεις

Κάθε entity hook γίνεται thin wrapper (~30 γραμμές) που παρέχει:
- Entity-specific filter function
- URL param name
- Entity-specific property names (selectedProject vs selectedBuilding)

## Architecture

```
useEntityPageState<T, F>          ← Generic centralized hook
  ├─ useProjectsPageState         ← Thin wrapper + project filter fn
  ├─ useBuildingsPageState        ← Thin wrapper + building filter fn
  ├─ useParkingPageState          ← Thin wrapper + parking filter fn
  └─ useStoragesPageState         ← Thin wrapper + storage filter fn
```

### EntityPageStateConfig interface

```typescript
interface EntityPageStateConfig<T, F> {
  urlParamName: string;           // e.g. 'projectId'
  loggerName: string;             // e.g. 'useProjectsPageState'
  defaultFilters: F;              // entity-specific default filter state
  filterFn: (items: T[], filters: F) => T[];  // pure filter function
  extraUrlParams?: string[];      // e.g. ['tab'] for projects
  syncCompareFields?: (keyof T)[];  // fields to check for data sync
}
```

### Πλεονεκτήματα κεντρικοποίησης

| Feature | Πριν | Μετά |
|---------|------|------|
| useTransition (INP) | Μόνο buildings | Όλα τα entities |
| Data sync | Μόνο projects | Όλα τα entities |
| Bug fix propagation | 4 αρχεία | 1 αρχείο |
| Lines of code | ~700 | ~400 (−43%) |

## Files

| File | Role |
|------|------|
| `src/hooks/useEntityPageState.ts` | **NEW** — Generic centralized hook |
| `src/hooks/useProjectsPageState.ts` | Refactored — thin wrapper |
| `src/hooks/useBuildingsPageState.ts` | Refactored — thin wrapper |
| `src/hooks/useParkingPageState.ts` | Refactored — thin wrapper |
| `src/hooks/useStoragesPageState.ts` | Refactored — thin wrapper |

## Notes

- `useUnitsViewerState` ΔΕΝ κεντρικοποιήθηκε — είναι DXF viewer hook με εντελώς διαφορετική δομή
- Τα filter functions παραμένουν entity-specific (διαφορετικά fields/ranges ανά entity)
- Backward compatibility 100%: τα return types δεν άλλαξαν καθόλου

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — 4 hooks centralized |
