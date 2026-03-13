# ADR-225: Type Guards Centralization — `isNonEmptyString`, `isNonEmptyArray`

## Status
**IMPLEMENTED** (Phase 1) — 2026-03-13

## Context

Audit identified **67+ occurrences** of `typeof x === 'string' && x.length > 0` across 29 files
and **626+ occurrences** of `Array.isArray(x) && x.length > 0` across 130+ files. Zero centralized
utility — every file wrote the same inline verbose check.

**SSoT existed**: `src/lib/type-guards.ts` (ADR-213) — exported only `isRecord()`.
Ideal extension point.

## Decision

Extend `src/lib/type-guards.ts` with three new type guard functions:

| Function | Replaces | Type Narrowing |
|----------|----------|----------------|
| `isNonEmptyString(value)` | `typeof x === 'string' && x.length > 0` | `unknown -> string` |
| `isNonEmptyTrimmedString(value)` | `typeof x === 'string' && x.trim().length > 0` | `unknown -> string` |
| `isNonEmptyArray<T>(value)` | `Array.isArray(x) && x.length > 0` | `T[] \| null \| undefined -> T[] & { 0: T }` |

## Implementation — Phase 1

### SSoT: `src/lib/type-guards.ts`

```typescript
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isNonEmptyArray<T>(value: T[] | readonly T[] | null | undefined): value is T[] & { length: number; 0: T } {
  return Array.isArray(value) && value.length > 0;
}
```

### Files Migrated (Phase 1 — 17 files, ~30 patterns)

#### isNonEmptyString (3 files)
| File | Patterns |
|------|----------|
| `src/config/admin-tool-definitions.ts` | 1x |
| `src/components/contacts/details/ContactDetailsHeader.tsx` | 3x |
| `src/subapps/dxf-viewer/hooks/useEnhancedSelection.ts` | 1x |
| `src/services/ai-pipeline/agentic-loop.ts` | 1x |

#### isNonEmptyTrimmedString (4 files)
| File | Patterns |
|------|----------|
| `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` | 2x |
| `src/services/ai-pipeline/shared/ai-reply-generator.ts` | 2x |
| `src/subapps/dxf-viewer/ui/hooks/useSettingsUpdater.ts` | 1x |
| `src/app/api/communications/webhooks/mailgun/inbound/route.ts` | 1x |
| `src/services/contact-relationships/core/RelationshipValidationService.ts` | 1x |

#### isNonEmptyArray (8 files)
| File | Patterns |
|------|----------|
| `src/utils/contacts/EnterpriseContactSaver.ts` | 2x |
| `src/utils/contactForm/fieldMappers/companyMapper.ts` | 5x |
| `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | 1x |
| `src/subapps/geo-canvas/services/administrative-boundaries/OverpassApiService.ts` | 1x |
| `src/components/contacts/relationships/OrganizationTree.tsx` | 1x |
| `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx` | 1x |
| `src/subapps/geo-canvas/systems/polygon-system/utils/legacy-migration.ts` | 3x |
| `src/components/core/AdvancedFilters/FilterField.tsx` | 1x |

### Exclusions
- Domain-specific type guards (contacts/relationships, accounting entity guards)
- `typeof x === 'string'` without `.length` check (type discrimination, not emptiness)
- Bare `Array.isArray(x)` without `.length` (type narrowing only)
- Patterns with additional conditions beyond emptiness (e.g., regex after string check)

## Consequences

### Positive
- **Consistency**: Single pattern across codebase
- **TypeScript narrowing**: `isNonEmptyString(x)` narrows `unknown -> string`
- **Readability**: Intent is immediately clear from function name
- **Grep-friendly**: Easy to find all non-empty checks via `isNonEmptyString\|isNonEmptyArray`

### Future Phases
- Phase 2: Migrate remaining ~80 `Array.isArray && length` patterns across 120+ files
- Phase 2: Migrate remaining ~40 `typeof string && length` patterns across 20+ files

## Changelog

| Date | Change |
|------|--------|
| 2026-03-13 | Phase 1: SSoT extension + 17 files migrated (~30 patterns) |
