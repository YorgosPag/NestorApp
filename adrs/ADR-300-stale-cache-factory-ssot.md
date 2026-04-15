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
| `src/hooks/useObligations.ts` | `useAsyncData` no cache | `obligationsCache = createStaleCache<ObligationDocument[]>('obligations')` | 2026-04-15 |
| `src/hooks/procurement/usePurchaseOrders.ts` | `useAsyncData` no cache | `purchaseOrdersCache = createStaleCache<PurchaseOrder[]>('procurement')` (default filters only) | 2026-04-15 |
| `src/components/file-manager/hooks/useAllCompanyFiles.ts` | `useState([])` + `setLoading(true)` unconditional | `allCompanyFilesCache = createStaleCache<FileRecord[]>('files')` keyed by companyId | 2026-04-15 |
| `src/subapps/accounting/components/dashboard/AccountingDashboard.tsx` | `useState(true)` + `setLoading(true)` unconditional | `accountingStatsCache = createStaleCache<DashboardStats>('accounting-dashboard')` keyed by year | 2026-04-15 |
| `src/hooks/useFirestoreProperties.ts` | `useAsyncData` no cache | `propertiesCache = createStaleCache<Property[]>('properties')` keyed by buildingId+floorId | 2026-04-15 |
| `src/services/realtime/hooks/useRealtimeOpportunities.ts` | `useState([])` + `setLoading(true)` unconditional | `opportunitiesCache = createStaleCache<Opportunity[]>('opportunities')` | 2026-04-15 |
| `src/services/realtime/hooks/useRealtimeTasks.ts` | `useState([])` + `setLoading(true)` unconditional | `tasksCache = createStaleCache<CrmTask[]>('tasks')` | 2026-04-15 |
| `src/components/crm/hooks/useOpportunities.ts` | `useState([])` + `setLoading(true)` unconditional | `oppsCache = createStaleCache<Opportunity[]>('crm-pipeline')` | 2026-04-15 |
| `src/hooks/useCalendarEvents.ts` | `useAsyncData` no cache | `calendarEventsCache = createStaleCache<CalendarEvent[]>('calendar-events')` keyed by dateRange+userId+eventTypes | 2026-04-15 |
| `src/components/crm/pages/CrmTeamsPageContent.tsx` | `useState([])` + `setLoading(true)` unconditional | `teamsCache = createStaleCache<DisplayTeam[]>('crm-teams')` | 2026-04-15 |
| `src/hooks/reports/useCrmReport.ts` | `useRef` TTL cache (resets on unmount) | `crmReportCache = createStaleCache<CrmReportPayload>('report-crm')` | 2026-04-15 |
| `src/hooks/reports/useCashFlowReport.ts` | `useRef` TTL cache (resets on unmount) | `cashFlowCache = createStaleCache<CashFlowAPIResponse>('report-cash-flow')` keyed by filterKey | 2026-04-15 |
| `src/hooks/reports/useFinancialReport.ts` | `useRef` TTL cache (resets on unmount) | `financialReportCache = createStaleCache<FinancialReportPayload>('report-financial')` | 2026-04-15 |
| `src/hooks/reports/useProjectsReport.ts` | `useRef` TTL cache (resets on unmount) | `projectsReportCache = createStaleCache<ProjectsReportPayload>('report-projects')` | 2026-04-15 |
| `src/hooks/reports/useContactsReport.ts` | `useRef` TTL cache (resets on unmount) | `contactsReportCache = createStaleCache<ContactsReportPayload>('report-contacts')` | 2026-04-15 |
| `src/hooks/reports/useComplianceReport.ts` | `useRef` TTL cache (resets on unmount) | `complianceReportCache = createStaleCache<ComplianceReportPayload>('report-compliance')` | 2026-04-15 |
| `src/hooks/reports/useConstructionReport.ts` | `useRef` TTL cache (resets on unmount) | `constructionReportCache = createStaleCache<ConstructionReportPayload>('report-construction')` | 2026-04-15 |
| `src/hooks/reports/useSalesReport.ts` | `useRef` TTL cache (resets on unmount) | `salesReportCache = createStaleCache<SalesReportPayload>('report-sales')` | 2026-04-15 |
| `src/hooks/reports/useSpacesReport.ts` | `useRef` TTL cache (resets on unmount) | `spacesReportCache = createStaleCache<SpacesReportPayload>('report-spaces')` | 2026-04-15 |
| `src/components/leads/hooks/useLeadsList.ts` | `useAsyncData` no cache | `leadsListCache = createStaleCache<Opportunity[]>('crm-leads')` | 2026-04-15 |
| `src/hooks/procurement/useSupplierMetrics.ts` | `useAsyncData` no cache | `supplierMetricsCache` + `supplierComparisonCache` keyed by supplierId | 2026-04-15 |
| `src/hooks/useBuildingFloorplans.ts` | `useAsyncData` no cache | `buildingFloorplansCache = createStaleCache<FloorplanResult>('building-floorplans')` keyed by buildingId | 2026-04-15 |
| `src/hooks/useBuildingMilestones.ts` | `useAsyncData` no cache | `buildingMilestonesCache = createStaleCache<BuildingMilestone[]>('building-milestones')` keyed by buildingId | 2026-04-15 |
| `src/hooks/useBOQItems.ts` | `useAsyncData` no cache | `boqItemsCache = createStaleCache<BOQItem[]>('boq-items')` keyed by buildingId | 2026-04-15 |

---

## 7. Out of Scope

- **Properties** (`SharedPropertiesProvider`): uses React Context with lazy activation — pre-loads data on first use, not on nav. The Sales pages that consume it (`useSalesPropertiesViewerState`) don't re-trigger loading on re-navigation. No change needed.
- **Communications** (`useConversations` in `useInboxApi.ts`): polling-based REST API, not Firestore. Flash pattern doesn't apply. No change needed.
- **Cache invalidation on logout**: `cache.clear()` is available. Wire into auth logout handler in a future ADR if needed.
- **TTL-based expiry**: Not needed — data stays valid until next RealtimeService event or next navigation.

---

## 8. Related

- `src/lib/cache/reference-cache.ts` — infra-level deduplication cache (different purpose)
- `src/lib/cache/enterprise-api-cache.ts` — TTL-based API cache (different purpose)
- `src/hooks/useAsyncData.ts` — `silentInitialFetch` option (ADR-223)
- ADR-223 — `useAsyncData` centralized hook
- ADR-294 — SSoT Ratchet Enforcement
