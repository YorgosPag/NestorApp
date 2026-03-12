# ADR-218: Firestore Timestamp Conversion Centralization

| Field       | Value                              |
|-------------|-------------------------------------|
| **ID**      | ADR-218                             |
| **Status**  | Implemented                         |
| **Created** | 2026-03-12                          |
| **Author**  | Claude (pair programming session)   |
| **Scope**   | Cross-cutting (all Firestore reads) |

## Context

Audit identified **80+ scattered occurrences** of Firestore Timestamp→Date/String conversions across 19+ files. Multiple local helper functions (`getTimestampString`, `toISOString`, `toDateString`, `extractDateString`, `toISOStringOrPassthrough`, `formatTimestamp`) duplicated the same logic that already existed in `normalizeToDate()` at `src/lib/date-local.ts`.

Additionally, `chunkArray()` in `firestore-query.service.ts` was a duplicate of the centralized version in `src/lib/array-utils.ts`.

## Decision

Extend `date-local.ts` with three new functions and eliminate all scattered duplicates:

### New Functions (Single Source of Truth)

```typescript
// src/lib/date-local.ts

/** Timestamp/Date/string/number → ISO string, or null */
export function normalizeToISO(val: unknown): string | null;

/** Extract Firestore field as ISO — for converters/services */
export function fieldToISO(data: Record<string, unknown>, field: string, fallback?: string): string;

/** Extract timestamp from nested object path (e.g., "audit.createdAt") */
export function getNestedTimestampISO(data: Record<string, unknown>, path: string): string;
```

### Migration Summary

| Category | Files | Change |
|----------|-------|--------|
| Extended | `src/lib/date-local.ts` | +3 functions (`normalizeToISO`, `fieldToISO`, `getNestedTimestampISO`) |
| Refactored | `src/lib/firestore/utils.ts` | `asDate()` → thin wrapper over `normalizeToDate` |
| Deleted local `getTimestampString` | 4 files | Replaced with `fieldToISO` import |
| Deleted local `firestoreTimestampToISO` | 2 files | milestones + construction-phases routes |
| Deleted local `getNestedTimestamp` | 1 file | conversations/route.ts → `getNestedTimestampISO` |
| Deleted local timestamp helpers | 5 files | `toISOString`, `toDateString`, `extractDateString`, etc. |
| Replaced `.toDate().toISOString()` | 10 files | Inline patterns → `normalizeToISO` / `fieldToISO` |
| Fixed `chunkArray` duplicate | 1 file | Local definition → import from `@/lib/array-utils` |
| **Total** | **~22 files** | |

### Files Changed

**Core (extended)**:
- `src/lib/date-local.ts` — Added `normalizeToISO()`, `fieldToISO()`, `getNestedTimestampISO()`
- `src/lib/firestore/utils.ts` — `asDate()` now delegates to `normalizeToDate()`

**Migrated (getTimestampString deleted)**:
- `src/hooks/inbox/useRealtimeMessages.ts`
- `src/app/api/projects/list/route.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`

**Migrated (firestoreTimestampToISO deleted)**:
- `src/app/api/buildings/[buildingId]/milestones/route.ts`
- `src/app/api/buildings/[buildingId]/construction-phases/route.ts`

**Migrated (getNestedTimestamp deleted)**:
- `src/app/api/conversations/route.ts` — replaced with centralized `getNestedTimestampISO`

**Migrated (InboxView toISOString simplified)**:
- `src/components/shared/files/InboxView.tsx`

**Migrated (.toDate().toISOString() replaced)**:
- `src/services/file-record.service.ts` (10 occurrences)
- `src/services/communications.service.ts` (4 occurrences)
- `src/services/notificationService.ts` (2 occurrences)
- `src/services/units.service.ts` (1 loop pattern)
- `src/services/opportunities.service.ts` (1 loop pattern)
- `src/services/measurements/boq-repository.ts` (1 — full function replaced)
- `src/services/contacts/ContactNameResolver.ts` (1 — method simplified)
- `src/services/ai-pipeline/shared/sender-history.ts` (1 — function simplified)
- `src/lib/firestore/converters/workspace.converter.ts` (4 occurrences)
- `src/lib/firestore/converters/association.converter.ts` (4 occurrences)
- `src/app/api/audit/bootstrap/route.ts` (full function replaced)
- `src/components/file-manager/hooks/useAllCompanyFiles.ts` (function simplified)

**Fixed duplicate**:
- `src/services/firestore/firestore-query.service.ts` — local `chunkArray` → import from `@/lib/array-utils`

**Excluded (intentionally not touched)**:
- `scripts/check-recent-messages.js` — not production code
- `recovery/lost-found/...` — archived recovery file
- `src/utils/__tests__/unit-normalizer.test.ts` — test file (mock usage, valid)

## Consequences

### Positive
- Single source of truth for timestamp conversions
- ~200 lines of duplicate code eliminated
- Consistent behavior across all Firestore reads
- Easier to add format variants in the future (e.g., `normalizeToUnix()`)

### Negative
- None significant — all changes are backward compatible

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — Phases 1-6 complete |
| 2026-03-12 | Phase 7: Added `getNestedTimestampISO`, eliminated remaining 7 duplicate functions (milestones, construction-phases, InboxView, conversations nested) |
