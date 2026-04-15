# ADR-300 — Stale Cache Factory SSoT (Navigation Flash Prevention)

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-15 |
| **Category** | Data & State / SSoT Enforcement |
| **Canonical Location** | `src/lib/stale-cache.ts` |

---

## 1. Problem

Navigation between pages caused a visual flash (blank/loading screen for ~200ms) on every re-visit to entity list pages (storages, parking, contacts).

**Root cause**: Each React component unmounts on navigation and remounts on return. Firestore data hooks re-initialize with `isLoading: true`, show a loading state, then re-fetch data that was already loaded.

**Pattern was duplicated in 3 places:**

| Hook | Implementation |
|------|---------------|
| `useFirestoreStorages.ts` | `const _storagesCache: Record<string, Storage[]> = {}` |
| `useFirestoreParkingSpots.ts` | `const _parkingCache: Record<string, ParkingFetchResult> = {}` |
| `useContactsPageState.ts` | `let _contactsCache: Contact[] \| null = null` + `let _initialLoadDone = false` |

Each was an ad-hoc module-level variable with no shared interface.

---

## 2. Solution

Single factory `createStaleCache<T>(namespace)` in `src/lib/stale-cache.ts`.

**Stale-while-revalidate pattern:**
1. First visit: cache miss → `isLoading: true` → fetch → write cache → render
2. Subsequent visits: cache hit → `isLoading: false` → show stale immediately → fetch silently → update

---

## 3. Interface

```typescript
export interface StaleCache<T> {
  get(key?: string): T | null;
  set(value: T, key?: string): void;
  hasLoaded(key?: string): boolean;
  invalidate(key?: string): void;
  clear(): void;
}

export function createStaleCache<T>(namespace: string): StaleCache<T>;
```

**Key design decisions:**
- `hasLoaded()` is separate from `get() !== null` — a successful fetch of an empty array still sets the loaded flag
- Optional `key` parameter supports both single-entity caches (contacts) and multi-key caches (storages keyed by buildingId)
- Internal `Map` + `Set` — O(1) reads, isolated per namespace, no global registry

---

## 4. Usage Patterns

### REST hooks (via `useAsyncData`)

```typescript
const storagesCache = createStaleCache<Storage[]>('storages');

const { data } = useAsyncData({
  fetcher: async () => {
    const storages = await fetchStorages();
    storagesCache.set(storages, cacheKey);
    return storages;
  },
  initialData: storagesCache.get(cacheKey),
  silentInitialFetch: storagesCache.hasLoaded(cacheKey),
});
```

### `onSnapshot` hooks (real-time)

```typescript
const contactsCache = createStaleCache<Contact[]>('contacts');

const [contacts, setContacts] = useState<Contact[]>(contactsCache.get() ?? []);
const [isLoading, setIsLoading] = useState(!contactsCache.hasLoaded());

useEffect(() => {
  if (!contactsCache.hasLoaded()) setIsLoading(true);
  const unsub = subscribeToContacts((fresh) => {
    contactsCache.set(fresh);
    setContacts(fresh);
    setIsLoading(false);
  });
  return unsub;
}, [deps]);
```

---

## 5. Prohibition

⛔ **FORBIDDEN**: Creating ad-hoc module-level cache variables:
```typescript
// ❌ FORBIDDEN — violates ADR-300 SSoT
const _myCache: Record<string, MyData[]> = {};
let _myLoadedFlag = false;
```

✅ **REQUIRED**: Use `createStaleCache<T>()` from `@/lib/stale-cache`:
```typescript
// ✅ CORRECT
const myCache = createStaleCache<MyData[]>('my-entity');
```

---

## 6. Migrated Files

| File | Before | After | Date |
|------|--------|-------|------|
| `src/hooks/useFirestoreStorages.ts` | `_storagesCache: Record<string, Storage[]>` | `storagesCache = createStaleCache<Storage[]>('storages')` | 2026-04-15 |
| `src/hooks/useFirestoreParkingSpots.ts` | `_parkingCache: Record<string, ParkingFetchResult>` | `parkingCache = createStaleCache<ParkingFetchResult>('parking')` | 2026-04-15 |
| `src/components/contacts/page/useContactsPageState.ts` | `_contactsCache + _initialLoadDone` | `contactsCache = createStaleCache<Contact[]>('contacts')` | 2026-04-15 |
| `src/app/page.tsx` | `useState(false)` + `hasInitializedRef` | `dashboardAuthCache = createStaleCache<boolean>('dashboard-auth')` | 2026-04-15 |
| `src/hooks/useFirestoreProjects.ts` | `useState([])` + `loading: true` + `hasLoadedOnceRef(false)` | `projectsCache = createStaleCache<FirestoreProject[]>('projects')` | 2026-04-15 |
| `src/hooks/useFirestoreBuildings.ts` | `useState([])` + `setLoading(true)` unconditional | `buildingsCache = createStaleCache<Building[]>('buildings')` | 2026-04-15 |

---

## 7. Out of Scope

- **Properties** (`SharedPropertiesProvider`): uses React Context — already centralized, no flash issue, different architecture (pre-loads at app shell level). No change needed.
- **Cache invalidation on logout**: `cache.clear()` is available. Wire into auth logout handler in a future ADR if needed.
- **TTL-based expiry**: Not needed — data stays valid until next RealtimeService event or next navigation.

---

## 8. Related

- `src/lib/cache/reference-cache.ts` — infra-level deduplication cache (different purpose)
- `src/lib/cache/enterprise-api-cache.ts` — TTL-based API cache (different purpose)
- `src/hooks/useAsyncData.ts` — `silentInitialFetch` option (ADR-223)
- ADR-223 — `useAsyncData` centralized hook
- ADR-294 — SSoT Ratchet Enforcement
