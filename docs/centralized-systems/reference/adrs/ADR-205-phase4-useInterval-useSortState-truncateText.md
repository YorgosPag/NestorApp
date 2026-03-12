# ADR-205: Scattered Code Centralization — Phase 4

## Status: ✅ IMPLEMENTED

## Date: 2026-03-12

## Context

Phase 4 of scattered code centralization (successor to ADR-204 Phase 3, ADR-200 Phase 2, ADR-161 Phase 1). Analysis by 3 agents identified additional duplicated patterns. Three high-ROI tasks were selected:

1. **Interval patterns**: 7 client-side files with identical `useEffect(() => { const id = setInterval(...); return () => clearInterval(id); }, [...])` pattern
2. **Sort state duplication**: 6 list pages with identical `useState<SortField>` + `useState<'asc'|'desc'>` + inline handler pattern
3. **Inline truncation**: 12 usages across 8 files of `.slice(0,N) + '...'` or `.substring(0,N) + '...'` — existing `truncateText()` in obligations module was not shared

## Decision

### Task 1: `useInterval` Hook

**Location**: `src/hooks/useInterval.ts`

```typescript
function useInterval(callback: () => void, delay: number | null, enabled?: boolean): void;
```

- Ref-based callback (no stale closures — latest callback always called)
- `delay: null` disables the interval (Dan Abramov pattern)
- Optional `enabled` flag for additional conditional guards
- Follows existing pattern of `useEscapeKey` (ADR-204) and `useClickOutside` (ADR-200)

**Migrated files (7 interval patterns)**:

| File | Interval | Purpose |
|------|----------|---------|
| `OperatorInboxClient.tsx` | 15s | Inbox polling with change detection |
| `NotificationProvider.tsx` | 60s | Rate-limit cleanup for stale dedup entries |
| `CacheProvider.tsx` | 60s | Expired cache entry cleanup |
| `EnterpriseRelationshipProvider.tsx` | Dynamic | Periodic integrity validation (conditional) |
| `useInboxApi.ts` (conversations) | INBOX_POLL_MS | Conversation polling (conditional) |
| `useInboxApi.ts` (messages) | THREAD_POLL_MS | Message polling (conditional, skip if realtime) |
| `WebSocketContext.tsx` | 1s | Debug stats refresh (conditional on panel open) |

**Not migrated**:
- `AddCaptureMenu.tsx` — ref-based, not useEffect pattern
- `useRealEstateMatching.ts` — useCallback pattern
- `AnalyticsBridge.ts` — class-based, not a React hook

### Task 2: `useSortState` Hook

**Location**: `src/hooks/useSortState.ts`

```typescript
interface SortState<T extends string = string> {
  sortBy: T;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: T, order: 'asc' | 'desc') => void;
}

function useSortState<T extends string>(defaultField: T, defaultOrder?: 'asc' | 'desc'): SortState<T>;
```

- Generic over sort field type for type safety
- `onSortChange` is `useCallback`-stable (no unnecessary re-renders)
- Unifies `sortOrder` and `sortDirection` naming inconsistency

**Migrated files (6 list pages)**:

| File | Previous Pattern |
|------|-----------------|
| `BuildingsList.tsx` | `useState<SortField>` + `useState<'asc'|'desc'>` + inline handler (2x) |
| `ContactsList.tsx` | `useState<inline union>` + `useState<'asc'|'desc'>` + inline handler with type narrowing |
| `projects-list.tsx` | `useState<SortField>` + `useState<SortDirection>` + `useCallback` handler |
| `ParkingsList.tsx` | `useState<SortField>` + `useState<'asc'|'desc'>` + inline handler (2x) |
| `StoragesList.tsx` | `useState<SortField>` + `useState<'asc'|'desc'>` + inline handler (2x) |
| `UnitsList.tsx` | `useState<SortField>` + `useState<'asc'|'desc'>` + inline handler (2x) |

### Task 3: `truncateText` — Promotion to Shared Utility

**Location**: `src/lib/text-utils.ts` (new shared location)

```typescript
function truncateText(text: string, maxLength?: number): string;
```

- Promoted from `src/lib/obligations/text-utils.ts` (obligations-specific) to `src/lib/text-utils.ts` (shared)
- `obligations/text-utils.ts` now re-exports from shared location (backward compatible)
- Replaces 12 inline `.slice(0,N) + '...'` / `.substring(0,N) + '...'` patterns

**Migrated files (8 files, 12+ usages)**:

| File | Usages | MaxLen |
|------|--------|--------|
| `toc.ts` | 1 | 50 |
| `ContactActivityTimeline.tsx` | 1 | 80 |
| `EmailContentRenderer.tsx` | 2 | 40 |
| `TelegramNotifications.tsx` | 1 | 100 |
| `photo-urls.ts` | 7 | 50 |
| `validation.ts` | 1 | 50 |
| `FloorPlanViewer.tsx` | 1 | 50 |

**Not migrated**:
- `message-utils.ts` — `getMessagePreview` has HTML stripping logic
- `ContactNameResolver.ts` — private method with -3 offset
- API routes — server-side substring for error logs

## Consequences

- **7 fewer** manual `setInterval`/`clearInterval` patterns — no stale closure bugs
- **6 fewer** duplicated sort state declarations — consistent `sortOrder` naming
- **12 fewer** inline truncation patterns — single `truncateText` function
- All changes are **backward compatible** — no breaking changes
- Zero risk — pure refactoring of identical patterns

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — 3 tasks, 21 files modified |
