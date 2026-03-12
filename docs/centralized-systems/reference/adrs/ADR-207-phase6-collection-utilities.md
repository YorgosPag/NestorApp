# ADR-207: Scattered Code Centralization — Phase 6 (Collection Utilities)

## Status: ✅ IMPLEMENTED

## Date: 2026-03-12

## Context

Phase 6 of scattered code centralization (successor to ADR-206 Phase 5). Comprehensive audit by 3 agents identified 22+ instances of `.reduce()` patterns implementing `groupBy` / `tallyBy` / `sumByKey` across hooks, services, API routes, and components.

Six pure utility functions (`groupBy`, `countBy`, `sumBy`, `rate`, `avg`, `avgRounded`) lived inside `src/hooks/useEntityStats.ts` — a `'use client'` file. This prevented server-side API routes from importing them and forced 14+ files to re-implement the same patterns inline.

## Decision

### Extract to `src/utils/collection-utils.ts`

Created 8 pure functions with zero React dependencies:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `groupByKey<T>` | `(items, keyFn) → Record<string, T[]>` | Group items into arrays (standard groupBy) |
| `tallyBy<T>` | `(items, keyFn) → Record<string, number>` | Count per group (= previous useEntityStats.groupBy) |
| `sumByKey<T>` | `(items, keyFn, valueFn) → Record<string, number>` | Weighted tally (e.g., ErrorTracker: `+= error.count`) |
| `sumBy<T>` | `(items, accessor) → number` | Sum numeric field (moved from useEntityStats) |
| `countBy<T>` | `(items, predicate) → number` | Count matching (moved from useEntityStats) |
| `rate` | `(num, denom) → number` | Percentage 0-100 (moved from useEntityStats) |
| `avg` | `(total, count) → number` | Average (moved from useEntityStats) |
| `avgRounded` | `(total, count) → number` | Rounded average (moved from useEntityStats) |

### Backward Compatibility

`useEntityStats.ts` re-exports all functions via:
```typescript
export { tallyBy as groupBy, countBy, sumBy, rate, avg, avgRounded } from '@/utils/collection-utils';
```

5 existing consumers (`useBuildingStats`, `useStorageStats`, `useParkingStats`, `useUnitsStats`, `useProjectsStats`) require zero changes.

### Migrated Files (14 files, 22 reduce patterns)

**Tier A — tallyBy/sumByKey (8 files, 18 patterns):**

| File | Patterns | Utility |
|------|----------|---------|
| `src/hooks/useUnitsViewerState.ts` | 3 | `tallyBy` |
| `src/hooks/usePropertyFilters.ts` | 3 | `tallyBy` |
| `src/hooks/usePublicPropertyViewer.ts` | 3 | `tallyBy` |
| `src/hooks/useParkingData.ts` | 4 | `tallyBy` |
| `packages/core/alert-engine/dashboard/DashboardService.ts` | 2 | `tallyBy` |
| `packages/core/alert-engine/analytics/EventAnalyticsEngine.ts` | 6 | `tallyBy` |
| `src/services/ErrorTracker.ts` | 2 | `sumByKey` |
| `src/subapps/dxf-viewer/ui/OverlayPanel.tsx` | 1 | `groupByKey` |

**Tier B — groupByKey (6 files, 8 patterns):**

| File | Patterns | Utility |
|------|----------|---------|
| `src/components/building-management/BuildingsPage/BuildingsGroupedView.tsx` | 2 | `groupByKey` |
| `src/components/contacts/tabs/ContactBankingTab.tsx` | 1 | `groupByKey` |
| `src/app/api/floors/route.ts` | 1 | `groupByKey` |
| `src/app/api/floors/admin/route.ts` | 1 | `groupByKey` |
| `src/services/property/EnterprisePropertyTypesService.ts` | 1 | `groupByKey` |
| `src/lib/obligations/sorting.ts` | 2 | `groupByKey` |

## Consequences

### Positive
- **Server-safe**: API routes can now import collection utilities (no `'use client'` barrier)
- **22 reduce patterns eliminated**: Replaced with one-liner utility calls
- **Zero breaking changes**: Re-exports preserve existing consumer signatures
- **Type-safe**: Full generic TypeScript types, no `any`

### Negative
- Minor import addition to 14 files (one-time cost)

### Not Centralized (Justified)
- `useAsync` hook (25+ instances) — idiomatic React, unique error handling per hook
- URL construction (8 files) — context-specific, native URLSearchParams suffices
- Percentage calculations (25 files) — `Math.round(x * 100)` is a one-liner
- Firestore `.toDate()` (52 files) — legitimate converter patterns
- Firestore query builder (327 imports) — would be over-abstraction

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-12 | Initial implementation — 8 functions, 14 files migrated | Claude Code |
