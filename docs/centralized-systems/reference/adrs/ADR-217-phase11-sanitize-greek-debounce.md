# ADR-217: Phase 11 — Object Sanitization, Greek Text Normalization, Debounce Callback Deduplication

**Status**: ✅ Implemented
**Date**: 2026-03-12
**Category**: Centralization / Deduplication

---

## Context

Post Phase 9-10 audit identified **3 categories** of duplicate patterns across **~15 files**:
1. Object sanitization (stripUndefined / stripNull) — 4 duplicates
2. Greek text normalization (NFD accent stripping) — 4 duplicates
3. Debounce callback pattern — 3 duplicates

## Decision

### Category 1: Object Sanitization → `src/utils/firestore-sanitize.ts`

Extended the existing centralized module with 2 new functions:

| Function | Purpose | Replaces |
|----------|---------|----------|
| `stripUndefinedDeep<T>(value)` | Recursively removes keys with `undefined` values | `InMemoryObligationsRepository.stripUndefinedDeep`, `boq-repository.stripUndefined`, `FirestoreRelationshipAdapter` inline |
| `stripNullValues(obj)` | Recursively removes keys with `null` values | `OpenAIAnalysisProvider.stripNullValues` |

**Existing** `sanitizeForFirestore()` unchanged — it converts undefined→null (different semantics).

### Category 2: Greek Text Normalization → `src/utils/greek-text.ts` (NEW)

Created top-level utility module:

| Function | Purpose |
|----------|---------|
| `stripAccents(text)` | NFD diacritics removal |
| `normalizeGreekText(text)` | stripAccents + lowercase |
| `normalizeForSearch(text)` | normalizeGreekText + punctuation removal |

`src/services/ai-pipeline/shared/greek-text-utils.ts` now re-exports `stripAccents` and `normalizeGreekText` from `@/utils/greek-text`, keeping AI-specific functions locally (`transliterateGreekToLatin`, `greekStemMatch`, `fuzzyGreekMatch`).

### Category 3: Debounce Callback → `src/hooks/useDebouncedCallback.ts` (NEW)

Created centralized hook for debouncing callback invocations (distinct from `useDebounce` which debounces values):

```typescript
interface DebouncedCallback<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void; // σταθερή αναφορά — 2026-09-11, προσθετικό
}

function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number
): DebouncedCallback<Args>
```

**`cancel()` (2026-09-11):** ακυρώνει την εκκρεμή κλήση. Χρειάστηκε για το `SearchInput`: μια εξωτερική
αλλαγή τιμής πρέπει να **ακυρώνει** την εκκρεμή (μπαγιάτικη) εκπομπή, αλλιώς αυτή την ξαναγράφει πάνω στη
νέα. Προσθετικό — οι υπάρχοντες καταναλωτές (`useDxfSettings`, 5 κλήσεις) το καλούν ως συνάρτηση, όπως πριν.
Άγκυρα: `src/hooks/__tests__/useDebouncedCallback.test.ts` (Δ1–Δ4).

## Files Changed

### New (3)
- `src/utils/greek-text.ts`
- `src/hooks/useDebouncedCallback.ts`
- `docs/centralized-systems/reference/adrs/ADR-217-phase11-sanitize-greek-debounce.md`

### Extended (1)
- `src/utils/firestore-sanitize.ts` (+`stripUndefinedDeep`, +`stripNullValues`)

### Migrated (9)
- `src/services/obligations/InMemoryObligationsRepository.ts` — removed local `stripUndefinedDeep`
- `src/services/measurements/boq-repository.ts` — removed local `stripUndefined`, using `stripUndefinedDeep`
- `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` — removed local `stripNullValues`
- `src/services/contact-relationships/adapters/FirestoreRelationshipAdapter.ts` — replaced inline `Object.fromEntries` filter
- `src/services/ai-pipeline/shared/greek-text-utils.ts` — re-exports from centralized
- `src/components/ui/searchable-combobox.tsx` — removed local `normalizeGreek`
- `src/components/file-manager/FileManagerPageContent.tsx` — replaced inline NFD strip
- `src/components/shared/files/EntityFilesManager.tsx` — replaced inline NFD strip
- `src/subapps/dxf-viewer/stores/useDxfSettings.ts` — removed local `useDebounce`

### Updated (1)
- `src/components/shared/EscoSkillPicker.tsx` — replaced manual setTimeout with `useDebouncedCallback`

### Skipped (migrate-on-touch)
- `scripts/import-esco-skills.ts` + `scripts/import-esco-occupations.ts` — outside `src/`, no `@/` alias
- `src/components/ui/searchable-combobox.tsx` debounce — embedded in useEffect state sync pattern

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — 3 new files, 1 extended, 10 migrated |
| 2026-09-11 | `useDebouncedCallback` + **`cancel()`** (προσθετικό, σταθερή αναφορά) και `useRef(undefined)` ρητά. Πρώτος νέος καταναλωτής: `useSearchInputValue` (μία κατεύθυνση ροής του `SearchInput` — εύρημα ζωντανής επαλήθευσης ADR-332 D27 Β-ΙΙ: ατέρμονη ανταλλαγή «ALF» ↔ «ALFA»). Νέα άγκυρα Δ1–Δ4· η μετάλλαξη `cancel() = no-op` ⇒ **6 κόκκινα**. |
