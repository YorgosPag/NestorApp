# ADR-220: Firestore Field Extractor Centralization

## Status
✅ **Implemented** — 2026-03-13

## Context
Audit εντόπισε **7 αρχεία** που ορίζουν τοπικά τις **ίδιες** type-safe field extractor functions (`getString`, `getNumber`, `getBoolean`, `getArray`, `getObject`). Αυτές εξάγουν typed τιμές από `Record<string, unknown>` (Firestore document data).

**Πρόβλημα**: 18+ τοπικές function definitions, ~120 γραμμές duplicate κώδικα.

## Decision
Δημιουργία centralized module `src/lib/firestore/field-extractors.ts` με overloaded functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `getString` | `(data, field) → string \| undefined` / `(data, field, default) → string` | String extraction |
| `getNumber` | `(data, field) → number \| undefined` / `(data, field, default) → number` | Number extraction |
| `getBoolean` | `(data, field) → boolean \| undefined` | Boolean extraction |
| `getArray<T>` | `(data, field) → T[] \| undefined` / `(data, field, default) → T[]` | Array extraction |
| `getStringArray` | `(data, field) → string[] \| undefined` | Validated string array |
| `getObject<T>` | `(data, field) → T \| undefined` / `(data, field, default) → T` | Object extraction |
| `getStringOrNumber` | `(data, field) → string \| undefined` | ID extraction (string or number→string) |

**DataRecord type**: `Record<string, unknown> | null | undefined` — null-safe, covers all patterns.

## SSoT
- **File**: `src/lib/firestore/field-extractors.ts`
- **Import**: `import { getString, getNumber, ... } from '@/lib/firestore/field-extractors'`

## Migrated Files

| # | File | Functions Removed |
|---|------|-------------------|
| 1 | `src/hooks/inbox/useRealtimeTriageCommunications.ts` | `getString`, `getStringOrUndefined`, `getNumber`, `getBoolean`, `getStringArray` |
| 2 | `src/app/api/projects/list/route.ts` | `getString`, `getNumber`, `getArray` |
| 3 | `src/app/api/conversations/route.ts` | `getString`, `getNumber`, `getArray` |
| 4 | `src/app/api/conversations/[conversationId]/messages/route.ts` | `getString`, `getObject` |
| 5 | `src/hooks/inbox/useRealtimeMessages.ts` | `getString`, `getObject` |
| 6 | `src/subapps/geo-canvas/services/spatial/SpatialQueryService.ts` | `getStringProp` |
| 7 | `src/subapps/geo-canvas/services/administrative-boundaries/AdministrativeBoundaryService.ts` | `getStringProperty`, `getIdProperty` |

## Domain-Specific Functions NOT Migrated
- `getTimestamp` — domain-specific `FirestoreishTimestamp` type
- `getIntentAnalysis` — domain-specific `MessageIntentAnalysis` type
- `getTriageStatus` — validates against `TRIAGE_STATUSES` enum
- `getMetadata` — returns specific shape

## Consequences
- **-95 γραμμές** duplicate, **+105 γραμμές** centralized = single source of truth
- Overloaded signatures: `getString(data, 'x')` → `string | undefined`, `getString(data, 'x', '')` → `string`
- `getStringOrUndefined` → eliminated, replaced by `getString` without default (overload)
- Null-safe `DataRecord` type handles `null | undefined` data automatically

## Changelog

| Date | Change |
|------|--------|
| 2026-03-13 | Initial implementation — centralized 18+ local definitions from 7 files |
