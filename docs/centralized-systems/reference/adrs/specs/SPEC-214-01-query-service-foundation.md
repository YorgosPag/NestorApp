# SPEC-214-01: FirestoreQueryService Foundation

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 1 |
| **Status** | PENDING |
| **Risk** | LOW |
| **Αρχεία** | 2 νέα |
| **Εκτιμώμενη Αλλαγή** | ~300 γραμμές |

---

## Στόχος

Δημιουργία του `FirestoreQueryService` — ενιαίο, type-safe query layer που:
- Κεντρικοποιεί CRUD operations
- Ενσωματώνει automatic tenant filtering
- Παρέχει query auditing/logging
- Builds on existing infrastructure (COLLECTIONS, helpers)

---

## Νέα Αρχεία

### 1. `src/services/firestore/firestore-query.service.ts`

```typescript
// === INTERFACE ===

interface QueryOptions<T> {
  collection: keyof typeof COLLECTIONS;
  constraints?: QueryConstraint[];
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
  cursor?: DocumentSnapshot;
  tenantId?: string;          // Auto-injected if not provided
  skipTenantFilter?: boolean; // For system collections only
}

interface QueryResult<T> {
  items: T[];
  count: number;
  cursor?: DocumentSnapshot;
  metadata: {
    collection: string;
    duration: number;
    fromCache: boolean;
  };
}

// === PUBLIC API ===

class FirestoreQueryService {
  // READ
  read<T>(options: QueryOptions<T>): Promise<QueryResult<T>>
  readOne<T>(collection, docId): Promise<T | null>
  exists(collection, docId): Promise<boolean>
  count(options): Promise<number>

  // WRITE
  create<T>(collection, data: T, id?: string): Promise<string>
  update<T>(collection, docId, data: Partial<T>): Promise<void>
  remove(collection, docId): Promise<void>

  // SUBSCRIBE
  subscribe<T>(options, onUpdate, onError?): () => void
  subscribeOne<T>(collection, docId, onUpdate): () => void

  // BATCH
  batchRead<T>(options: QueryOptions<T> & { batchSize: number }): AsyncGenerator<T[]>
}
```

### 2. `src/services/firestore/index.ts`

Barrel exports.

---

## Existing Infrastructure Integration

| Component | Πώς Χρησιμοποιείται |
|-----------|-------------------|
| `COLLECTIONS` | Collection name resolution |
| `firestore-helpers.ts` | `sanitizeDocumentId()` πριν κάθε write |
| `sanitizeForFirestore()` | `undefined → null` πριν κάθε write |
| `enterprise-id.service.ts` | ID generation αν δεν δοθεί explicit ID |
| `query-middleware.ts` | Auth context extraction (getCurrentUser) |

---

## Automatic Tenant Filtering

```typescript
// ΚΑΝΟΝΑΣ: Κάθε query ΑΥΤΟΜΑΤΑ προσθέτει tenant filter
// ΕΚΤΟΣ αν skipTenantFilter === true

// Αυτόματο:
queryService.read({ collection: 'PROJECTS' })
// → query(..., where('companyId', '==', currentCompanyId))

// Explicit skip (για system collections):
queryService.read({ collection: 'SETTINGS', skipTenantFilter: true })
// → query(...) χωρίς companyId filter
```

### System Collections (skipTenantFilter = true)

Αυτά τα collections δεν χρειάζονται tenant filter:
- `NAVIGATION_COMPANIES`
- `SECURITY_ROLES`
- `POSITIONS`
- `SYSTEM_SETTINGS`
- `CONFIG`
- `EMAIL_DOMAIN_POLICIES`
- `COUNTRY_SECURITY_POLICIES`
- `COUNTERS`
- `AUDIT_LOGS`
- `SETTINGS`

---

## Tenant Field Detection

Κάθε collection μπορεί να χρησιμοποιεί διαφορετικό field name:

| Field | Collections |
|-------|------------|
| `companyId` | PROJECTS, CONTACTS, FILES, TASKS, APPOINTMENTS, COMMUNICATIONS |
| `tenantId` | COMPANY_SETTINGS, LAYER_STYLES, POLYGON_STYLES, USER_PREFERENCES, SECURITY_CONFIGS, TEAMS |
| `userId` | NOTIFICATIONS, USER_PREFERENCES |
| `projectId` | BUILDINGS, FLOORS, UNITS (indirect) |

Η service πρέπει να έχει mapping: `collection → tenantField`.

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero errors στα νέα αρχεία
- [ ] Import paths σωστά (`@/services/firestore/...`)
- [ ] ΚΑΝΕΝΑ existing αρχείο δεν αλλάζει σε αυτή τη φάση
- [ ] Export added σε `src/services/index.ts` (αν υπάρχει)

---

## Δεν Περιλαμβάνεται (Επόμενες Φάσεις)

- Migration existing services → Phases 2-10
- AuthorizedQueryService integration → Phase 11
- Performance monitoring dashboard → Future
