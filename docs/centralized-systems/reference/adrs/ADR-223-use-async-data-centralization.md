# ADR-223: useAsyncData — Data Fetching Centralization

| Field | Value |
|-------|-------|
| **Status** | ✅ Implemented (Phase 1) |
| **Date** | 2026-03-13 |
| **Category** | Centralization / React Hooks |
| **Author** | Claude + Giorgos |

---

## Context

112 αρχεία επαναλαμβάνουν το ίδιο loading/error/data fetching pattern:

```typescript
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
useEffect(() => {
  try { setLoading(true); const result = await fetch(); setData(result); }
  catch (err) { setError(getErrorMessage(err)); }
  finally { setLoading(false); }
}, [deps]);
```

## Decision

Create a centralized `useAsyncData<T>` hook at `src/hooks/useAsyncData.ts`.

### Hook API

```typescript
interface UseAsyncDataOptions<T> {
  fetcher: () => Promise<T>;
  deps?: ReadonlyArray<unknown>;
  enabled?: boolean;           // Skip fetch until ready (auth gating)
  initialData?: T;             // Fallback before resolve
  onError?: (message: string) => void;
}

interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### Key Features

- **Stale closure prevention**: `callIdRef` counter ensures only the latest fetch resolves
- **Unmount safety**: `mountedRef` prevents setState after unmount
- **Auto-refetch on dependency change**: `deps` serialized via `JSON.stringify`
- **Auth gating**: `enabled` flag skips fetch until auth is ready
- **Uses centralized `getErrorMessage()`** from `src/lib/error-utils.ts` (ADR-221)
- **Stable `refetch` reference**: Always callable, always uses latest fetcher

## Migration Pattern

### Before (~25 lines):
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
useEffect(() => { ... fetch boilerplate ... }, [deps]);
```

### After (~5 lines):
```typescript
const { data, loading, error, refetch } = useAsyncData({
  fetcher: () => myService.getData(id),
  deps: [id],
  enabled: !!id,
});
```

## Phase 1 Migrations (10 files, 15 hooks)

| # | File | Hooks | Notes |
|---|------|-------|-------|
| 1 | `src/hooks/useObligations.ts` | 4 (useObligations, useObligation, useObligationTemplates, useObligationStats) | CRUD calls refetch |
| 2 | `src/hooks/useBuildingFloorplans.ts` | 1 | Promise.all fetch |
| 3 | `src/hooks/useBuildingMilestones.ts` | 1 | CRUD calls refetch |
| 4 | `src/hooks/useFirestoreUnits.ts` | 2 (+ useBuildingUnits) | Auth gating via enabled |
| 5 | `src/hooks/useFirestoreStorages.ts` | 2 (+ useBuildingStorages) | RealtimeService + refetch |
| 6 | `src/hooks/useFirestoreBuildings.ts` | 1 | RealtimeService → refetch |
| 7 | `src/hooks/useFirestoreParkingSpots.ts` | 2 (+ useBuildingParkingSpots) | RealtimeService + refetch |
| 8 | `src/components/leads/hooks/useLeadsList.ts` | 1 | Delete calls refetch |
| 9 | `src/hooks/useCalendarEvents.ts` | 1 | Auth + computed stats |
| 10 | `src/hooks/useBOQItems.ts` | 1 | CRUD + filters + refetch |

### Skipped (Phase 2 candidates)

| File | Reason |
|------|--------|
| `useEntityAudit.ts` | Cursor pagination incompatible |
| `useFirestoreProjects.ts` | AbortController, complex error handling |
| `useContactDataLoader.ts` | Not an async data fetcher |
| `useGlobalSearch.ts` | Debounced search pattern |
| `useBuildingForm.ts` | Form state hook |

## Metrics

| Metric | Value |
|--------|-------|
| New files | 1 (`useAsyncData.ts`) |
| Files migrated | 10 |
| Hooks migrated | 15 |
| Boilerplate eliminated | ~250 lines |
| Pattern coverage | 9% of 112 files (Phase 1) |

## Changelog

- **2026-03-13**: Phase 1 — Hook created, 10 files migrated
