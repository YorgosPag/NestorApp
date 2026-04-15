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
| `src/subapps/accounting/components/invoices/InvoicesPageContent.tsx` | `useState([])` + `setLoading(true)` unconditional | `invoicesCache = createStaleCache<Invoice[]>('accounting-invoices')` keyed by fiscalYear+type+payStatus | 2026-04-15 |
| `src/subapps/accounting/hooks/useJournalEntries.ts` | `useState([])` + `setLoading(true)` unconditional | `journalCache = createStaleCache<JournalEntry[]>('accounting-journal')` keyed by type+category+year+quarter | 2026-04-15 |
| `src/subapps/accounting/hooks/useBankTransactions.ts` | `useState([])` + `setLoading(true)` unconditional | `bankTransactionsCache = createStaleCache<BankTransaction[]>('accounting-bank')` keyed by accountId+direction+matchStatus | 2026-04-15 |
| `src/subapps/accounting/hooks/useExpenseDocuments.ts` | `useState([])` + `setLoading(true)` unconditional | `expenseDocsCache = createStaleCache<ReceivedExpenseDocument[]>('accounting-documents')` keyed by fiscalYear+status | 2026-04-15 |
| `src/subapps/accounting/components/invoices/EditInvoicePageContent.tsx` | `useState(null)` + `setLoading(true)` unconditional | `editInvoiceCache = createStaleCache<Invoice>('accounting-invoice-detail')` keyed by invoiceId | 2026-04-15 |
| `src/subapps/accounting/components/apy-certificates/APYCertificateDetails.tsx` | `useState(null)` + `setLoading(true)` unconditional | `apyCertCache = createStaleCache<APYCertificate>('accounting-apy-detail')` keyed by certificateId | 2026-04-15 |
| `src/subapps/accounting/hooks/useMatchingConfig.ts` | `useState(DEFAULT_MATCHING_CONFIG)` + `setLoading(true)` unconditional | `matchingConfigCache = createStaleCache<MatchingConfig>('accounting-matching-config')` single-key | 2026-04-15 |
| `src/components/building-management/tabs/useFloorsTabState.ts` | `useState([])` + `setLoading(true)` unconditional | `floorsCache = createStaleCache<FloorRecord[]>('building-floors')` keyed by buildingId | 2026-04-15 |
| `src/components/building-management/tabs/useParkingTabState.ts` | `useState([])` + `setLoading(true)` unconditional | `buildingParkingCache = createStaleCache<ParkingSpot[]>('building-parking-tab')` keyed by buildingId | 2026-04-15 |
| `src/components/building-management/tabs/BuildingCustomersTab.tsx` | `useState([])` + `setLoading(true)` unconditional | `buildingCustomersCache = createStaleCache<ProjectCustomer[]>('building-customers-tab')` keyed by buildingId | 2026-04-15 |
| `src/components/building-management/tabs/PropertiesTabContent.tsx` | `useState([])` + `setLoading(true)` unconditional | `buildingPropertiesCache` + `buildingFloorsTabCache` keyed by buildingId | 2026-04-15 |
| `src/components/building-management/StorageTab/useStorageTabState.ts` | `useState([])` + `setLoading(true)` unconditional | `buildingStorageCache = createStaleCache<StorageUnit[]>('building-storage-tab')` keyed by buildingId | 2026-04-15 |
| `src/components/projects/ika/hooks/useProjectWorkers.ts` | `useState([])` + `setIsLoading(true)` unconditional | `projectWorkersCache = createStaleCache<ProjectWorker[]>('project-workers')` keyed by projectId | 2026-04-15 |
| `src/components/projects/ika/hooks/useEmploymentRecords.ts` | `useState([])` + `setIsLoading(true)` unconditional | `employmentRecordsCache = createStaleCache<EmploymentRecord[]>('project-employment-records')` keyed by `${projectId}-${year}-${month}` | 2026-04-15 |
| `src/components/projects/ika/hooks/useAttendanceEvents.ts` | `useState([])` + `setIsLoading(true)` unconditional | `attendanceEventsCache = createStaleCache<AttendanceEvent[]>('project-attendance-events')` keyed by `${projectId}-${date}` | 2026-04-15 |
| `src/components/projects/ika/hooks/useEfkaDeclaration.ts` | `useState(null)` + `setIsLoading(true)` unconditional | `efkaDeclarationCache = createStaleCache<EfkaDeclarationData \| null>('project-efka-declaration')` keyed by projectId; stores `null` when no declaration | 2026-04-15 |
| `src/hooks/useFloorFloorplans.ts` | `useState(null)` + `setLoading(true)` unconditional | `floorFloorplansCache = createStaleCache<FloorFloorplanData \| null>('floor-floorplans')` keyed by `floorId ?? '${buildingId}-${floorNumber}'` | 2026-04-15 |
| `src/hooks/useEntityAssociations.ts` | `useState([])` + spinner unconditional (both hooks) | `entityContactLinksCache` keyed by `${entityType}-${entityId}-${parentProjectId}`; `contactEntityLinksCache` keyed by contactId | 2026-04-15 |
| `src/components/admin/role-management/components/UsersTab.tsx` | `useState([])` + `setIsLoading(true)` unconditional | `companyUsersCache = createStaleCache<CompanyUser[]>('admin-users')` single-key | 2026-04-15 |
| `src/components/admin/pages/AdminSetupPageContent.tsx` | `useState(null)` + `setCheckingConfig(true)` unconditional | `adminConfigCache = createStaleCache<AdminConfig \| null>('admin-setup-config')` single-key; stores `null` when NOT_CONFIGURED | 2026-04-15 |
| `src/components/sales/financial-intelligence/PortfolioDashboard.tsx` | `useState(null/[])` + `setLoading(true)` unconditional | `portfolioCache` + `debtMaturityCache` single-key; budget variance not cached (user-selection-dependent) | 2026-04-15 |
| `src/hooks/useContactsState.ts` | `useState([])` + `setIsLoading(true)` unconditional | `contactsStateCache = createStaleCache<Contact[]>('contacts-state')` single-key | 2026-04-16 |
| `src/components/contacts/details/CustomerPropertiesTable.tsx` | `useState([])` + `setLoading(true)` unconditional | `customerPropertiesCache = createStaleCache<Property[]>('contact-properties')` keyed by contactId | 2026-04-16 |
| `src/components/contacts/details/CustomerStats.tsx` | `useState(null)` + `setLoading(true)` unconditional | `customerStatsCache = createStaleCache<Stats \| null>('contact-stats')` keyed by contactId; stores `null` when no properties | 2026-04-16 |
| `src/components/contacts/tabs/ContactBankingTab.tsx` | `useState([])` + `setLoading(true)` unconditional (both loadAccounts + subscription) | `bankAccountsCache = createStaleCache<BankAccount[]>('contact-banking')` keyed by contactId | 2026-04-16 |
| `src/components/crm/leads/lead-detail/hooks/useLead.ts` | `useState(null)` + `setLoading(true)` unconditional | `leadCache = createStaleCache<Opportunity>('crm-lead-detail')` keyed by leadId | 2026-04-16 |
| `src/components/crm/leads/lead-detail/hooks/useLeadTasks.ts` | `useState([])` + `setLoading(true)` unconditional | `leadTasksCache = createStaleCache<CrmTask[]>('crm-lead-tasks')` keyed by leadId | 2026-04-16 |
| `src/hooks/useFloorplanFiles.ts` | `useState([])` + `setLoading(true)` unconditional | `floorplanFilesCache = createStaleCache<FileRecord[]>('floorplan-files')` keyed by `${entityType}-${entityId}-${purposeFilter}` | 2026-04-16 |
| `src/components/building-management/hooks/useConstructionGantt.ts` | `useState(true)` unconditional | `constructionGanttCache = createStaleCache<{phases, tasks}>('construction-gantt')` keyed by buildingId | 2026-04-16 |
| `src/components/communications/hooks/useCommunicationsHistory.ts` | `useState(true)` unconditional | `communicationsHistoryCache = createStaleCache<Communication[]>('communications-history')` keyed by contactId | 2026-04-16 |
| `src/components/projects/ika/hooks/useGeofenceConfig.ts` | `useState(true)` unconditional | `geofenceConfigCache = createStaleCache<GeofenceCachedConfig>('geofence-config')` keyed by projectId; caches defaults on no-config response | 2026-04-16 |
| `src/components/projects/ika/hooks/useLaborComplianceConfig.ts` | `useState(true)` unconditional | `laborComplianceConfigCache = createStaleCache<LaborComplianceConfig>('labor-compliance-config')` single-key; caches defaults when no remote config | 2026-04-16 |
| `src/hooks/useFirestoreProjectsPaginated.ts` | `useState(true)` unconditional | `paginatedProjectsCache = createStaleCache<{projects, hasNext}>('projects-paginated')` keyed by `filters.status ?? 'all'`; caches first page only | 2026-04-16 |
| `src/components/building-management/tabs/BuildingStats.tsx` | `useState(true)` unconditional | `buildingStatsCache = createStaleCache<BuildingStats>('building-stats')` keyed by buildingId | 2026-04-16 |
| `src/components/projects/tabs/ProjectStats.tsx` | `useState(true)` unconditional | `projectStatsCache = createStaleCache<ProjectStats>('project-stats')` keyed by projectId | 2026-04-16 |
| `src/components/contacts/tabs/ContactPurchaseOrdersTab.tsx` | `useState(true)` unconditional | `contactPurchaseOrdersCache = createStaleCache<PurchaseOrder[]>('contact-purchase-orders')` keyed by contactId | 2026-04-16 |
| `src/components/storage/pages/StorageDetailPageContent.tsx` | `useState(true)` unconditional | `storageDetailCache = createStaleCache<StorageUnit>('storage-detail')` keyed by storageId | 2026-04-16 |
| `src/components/crm/tasks/TaskDetailPageContent.tsx` | `useState(true)` unconditional | `taskDetailCache = createStaleCache<CrmTask>('crm-task-detail')` keyed by taskId | 2026-04-16 |
| `src/hooks/useNotifications.ts` | `useState([])` + `useState(true)` unconditional | `notificationsCache = createStaleCache<Notification[]>('notifications')` keyed by userId; seeded in both realtime and one-time-fetch branches | 2026-04-16 |
| `src/hooks/useProjectFloorplans.ts` | `useState(null)` + `setLoading(true)` unconditional | `projectFloorplansCache + parkingFloorplansCache` keyed by projectId; caches `null` when doc does not exist | 2026-04-16 |
| `src/hooks/usePropertyFloorplans.ts` | `useState(null)` + `setLoading(true)` unconditional | `propertyFloorplansCache = createStaleCache<PropertyFloorplanData \| null>('property-floorplans')` keyed by `${propertyId}-${companyId}` | 2026-04-16 |
| `src/components/projects/ProjectTimelineTab.tsx` | `useState([])` + `setLoading(true)` unconditional | `projectTimelineCache = createStaleCache<ProjectBuilding[]>('project-timeline')` keyed by projectId | 2026-04-16 |
| `src/components/projects/tabs/ProjectMeasurementsTab.tsx` | `useState([])` (buildings + items) + `setLoading(true)` unconditional | `projectMeasurementsCache = createStaleCache<{buildings, allItems}>('project-measurements')` keyed by projectId | 2026-04-16 |
| `src/components/building-management/StorageTab/index.tsx` | `useState([])` + `setLoading(true)` unconditional | `buildingStorageTabContentCache = createStaleCache<Storage[]>('building-storage-tab-content')` keyed by buildingId | 2026-04-16 |
| `src/components/sales/cards/PropertyHierarchyCard.tsx` | `useState(null)` + `setLoading(true)` unconditional | `propertyHierarchyCache = createStaleCache<PropertyHierarchyResponse>('property-hierarchy')` keyed by propertyId | 2026-04-16 |
| `src/components/sales/cards/TransactionChainCard.tsx` | `useState([])` + `setLoading(true)` unconditional | `propertyTransactionChainCache = createStaleCache<InvoiceSummary[]>('property-transaction-chain')` keyed by propertyId | 2026-04-16 |
| `src/components/shared/files/ApprovalPanel.tsx` | `useState([])` + `setLoading(true)` unconditional (onSnapshot) | `fileApprovalCache = createStaleCache<FileApproval[]>('file-approval')` keyed by fileId | 2026-04-16 |
| `src/components/shared/files/AuditLogPanel.tsx` | `useState([])` + `setLoading(true)` unconditional | `fileAuditLogCache = createStaleCache<FileAuditRecord[]>('file-audit-log')` keyed by fileId | 2026-04-16 |
| `src/components/shared/files/CommentsPanel.tsx` | `useState([])` + `setLoading(true)` unconditional (onSnapshot) | `fileCommentsCache = createStaleCache<FileComment[]>('file-comments')` keyed by fileId | 2026-04-16 |
| `src/components/shared/files/FolderManager.tsx` | `useState([])` + `setLoading(true)` unconditional | `fileFoldersCache = createStaleCache<FileFolder[]>('file-folders')` keyed by companyId | 2026-04-16 |
| `src/components/crm/notifications/useNotifications.ts` | `useState([])` + `useState(true)` unconditional | `crmNotificationsCache = createStaleCache<CrmNotificationData[]>('crm-notifications')` keyed by userId; seeded on realtime subscription callback | 2026-04-16 |
| `src/components/admin/ai-inbox/useAIInboxState.ts` | `serverLoading: useState(true)` + `serverStatsLoading: useState(true)` unconditional (server/super-admin path) | `aiInboxCommsCache` + `aiInboxStatsCache` keyed by companyId; realtime path unaffected | 2026-04-16 |
| `src/components/admin/operator-inbox/useOperatorInboxState.ts` | `useState([])` + `useState(true)` unconditional | `operatorInboxCache = createStaleCache<OperatorInboxCached>('operator-inbox-state')` single-key; caches `{items, stats}` together | 2026-04-16 |
| `src/hooks/inbox/useInboxApi.ts` | `useConversations: useState([])` + `useState(true)` unconditional | `conversationsCache = createStaleCache<ConversationListItem[]>('inbox-conversations')` keyed by `${userId}-${status}-${channel}`; only page 1 cached | 2026-04-16 |
| `src/components/shared/files/VersionHistory.tsx` | `useState([])` + `setLoading(true)` unconditional | `fileVersionHistoryCache = createStaleCache<FileVersionSnapshot[]>('file-version-history')` keyed by fileId | 2026-04-16 |

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
