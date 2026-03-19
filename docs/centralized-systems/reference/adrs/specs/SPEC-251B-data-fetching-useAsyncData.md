# SPEC-251B: Data Fetching Centralization → `useAsyncData`

> **Eliminate triple useState boilerplate (data/loading/error) — use centralized `useAsyncData` hook**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #2 — Data Fetching Triple useState Boilerplate |
| **Priority** | HIGH (P1) |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~5-8 sessions (117 affected files, case-by-case) |
| **Dependencies** | None — `useAsyncData` already exists (ADR-223) |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση του **triple useState boilerplate** (`data`, `loading`, `error`) που εμφανίζεται σε 117 αρχεία με το κεντρικοποιημένο `useAsyncData` hook. Αυτό εξαλείφει ~15 γραμμές boilerplate ανά αρχείο, εξασφαλίζει consistent loading/error handling, και δίνει δωρεάν `refetch()`.

**Highest-impact finding** — λύνει ταυτόχρονα και το Finding #4 (Loading States).

---

## 2. Centralized Tool

**Location**: `src/hooks/useAsyncData.ts` (ADR-223)

```typescript
import { useAsyncData } from '@/hooks/useAsyncData';
```

**Signature** (ενδεικτική):
```typescript
const { data, loading, error, refetch } = useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList,
  options?: { enabled?: boolean; initialData?: T }
);
```

---

## 3. Current State (Scattered Pattern)

```typescript
// ❌ SCATTERED — 117 αρχεία (15+ γραμμές boilerplate ΑΝΑ hook)
const [data, setData] = useState<Project[] | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectService.getAll();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [userId]);
```

---

## 4. Target State (Centralized Pattern)

```typescript
// ✅ CENTRALIZED — 3 γραμμές
import { useAsyncData } from '@/hooks/useAsyncData';

const { data, loading, error, refetch } = useAsyncData(
  () => projectService.getAll(),
  [userId]
);
```

---

## 5. Affected Files

### Top-Priority Files (ενδεικτική λίστα — hooks με καθαρό data/loading/error pattern)

| # | File | Pattern | Complexity |
|---|------|---------|------------|
| 1 | `src/hooks/useFirestoreProjects.ts` | Triple useState + useEffect fetch | LOW |
| 2 | `src/hooks/useChequeRegistry.ts` | Triple useState + useEffect fetch | LOW |
| 3 | `src/hooks/usePaymentPlan.ts` | Triple useState + useEffect fetch | LOW |
| 4 | `src/hooks/useLoanTracking.ts` | Triple useState + useEffect fetch | LOW |
| 5 | `src/hooks/usePaymentReport.ts` | Triple useState + useEffect fetch | LOW |
| 6 | `src/subapps/accounting/hooks/useInvoices.ts` | Triple useState + useEffect | LOW |
| 7 | `src/subapps/accounting/hooks/useTaxEstimate.ts` | Triple useState + useEffect | LOW |
| 8 | `src/subapps/accounting/hooks/useVATSummary.ts` | Triple useState + useEffect | LOW |
| 9 | `src/subapps/accounting/hooks/useEFKASummary.ts` | Triple useState + useEffect | LOW |
| 10 | `src/subapps/accounting/hooks/useBankTransactions.ts` | Triple useState + useEffect | LOW |

### Πώς βρίσκεις ΟΛΑ τα affected files

```bash
# Files with triple useState pattern (data + loading + error)
grep -r "useState.*null\)" src/ --include="*.ts" --include="*.tsx" -l | \
  xargs grep -l "useState.*false\)" | \
  xargs grep -l "setLoading\|setIsLoading" | \
  xargs grep -L "useAsyncData"
```

### Current adoption
- **10 αρχεία** ήδη χρησιμοποιούν `useAsyncData`
- **117 αρχεία** με scattered triple-state pattern

---

## 6. Implementation Steps

### Per-file migration (MIGRATE-ON-TOUCH):

1. **Αναγνώριση**: Βρες τα 3 useState (`data`, `loading`, `error`) + useEffect fetch
2. **Αξιολόγηση**: Ελέγξε αν ο hook έχει:
   - Single async fetch → ✅ Migrate
   - Multiple independent fetches → ✅ Migrate (πολλαπλά `useAsyncData`)
   - Real-time subscription (`onSnapshot`) → ❌ DO NOT migrate
   - Complex state beyond data/loading/error → ⚠️ Partial migrate ή skip
3. **Αντικατάσταση**:
   - Remove 3x `useState` declarations
   - Remove `useEffect` fetch block
   - Replace με single `useAsyncData` call
4. **Expose refetch**: Αν ο hook εξάγει `refresh`/`reload` function → map to `refetch`
5. **Return type**: Ensure return type compatibility (destructure may change)

---

## 7. Before/After Examples

### Example 1: Simple Hook Migration

**Before:**
```typescript
export function useFirestoreProjects(userId: string) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    projectService.getByUser(userId)
      .then(setProjects)
      .catch(err => setError(err instanceof Error ? err.message : 'Unknown'))
      .finally(() => setLoading(false));
  }, [userId]);

  return { projects, loading, error };
}
```

**After:**
```typescript
import { useAsyncData } from '@/hooks/useAsyncData';

export function useFirestoreProjects(userId: string) {
  const { data: projects, loading, error, refetch } = useAsyncData(
    () => projectService.getByUser(userId),
    [userId],
    { enabled: !!userId }
  );

  return { projects, loading, error, refetch };
}
```

### Example 2: Hook with Multiple Fetches

**Before:**
```typescript
export function useDashboardData(userId: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    setLoadingProjects(true);
    projectService.getAll().then(setProjects).finally(() => setLoadingProjects(false));
  }, [userId]);

  useEffect(() => {
    setLoadingContacts(true);
    contactService.getAll().then(setContacts).finally(() => setLoadingContacts(false));
  }, [userId]);

  return { projects, contacts, loading: loadingProjects || loadingContacts };
}
```

**After:**
```typescript
import { useAsyncData } from '@/hooks/useAsyncData';

export function useDashboardData(userId: string) {
  const { data: projects, loading: loadingProjects } = useAsyncData(
    () => projectService.getAll(),
    [userId]
  );
  const { data: contacts, loading: loadingContacts } = useAsyncData(
    () => contactService.getAll(),
    [userId]
  );

  return {
    projects: projects ?? [],
    contacts: contacts ?? [],
    loading: loadingProjects || loadingContacts,
  };
}
```

### Example 3: Hook with Conditional Fetch

**Before:**
```typescript
useEffect(() => {
  if (!buildingId) return;
  setLoading(true);
  floorService.getByBuilding(buildingId)
    .then(setFloors)
    .catch(err => setError(getErrorMessage(err)))
    .finally(() => setLoading(false));
}, [buildingId]);
```

**After:**
```typescript
const { data: floors, loading, error } = useAsyncData(
  () => floorService.getByBuilding(buildingId!),
  [buildingId],
  { enabled: !!buildingId }
);
```

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| **`onSnapshot` real-time listeners** | ❌ DO NOT migrate — `useAsyncData` is for one-time fetches |
| **Complex state (pagination, filters, caching)** | ⚠️ Evaluate case-by-case — may need custom hook |
| **Multiple sequential fetches** (fetch A → use result to fetch B) | Use multiple `useAsyncData` with `enabled` flag |
| **Hooks that mutate + refetch** | Use `useAsyncData` for read + separate mutation logic |
| **Initial data from props/context** | Use `initialData` option |
| **Hooks with `AbortController`** | Check if `useAsyncData` supports cancellation — may need enhancement |
| **Return type changes** | `data` may be `T | null` instead of `T | undefined` — align callers |

---

## 9. Verification Criteria

- [ ] Κάθε migrated hook εξακολουθεί να: (a) φέρνει data, (b) δείχνει loading, (c) δείχνει error
- [ ] `refetch()` λειτουργεί όπου υπάρχει refresh button
- [ ] Conditional fetches (enabled flag) δεν κάνουν unnecessary requests
- [ ] TypeScript compilation passes
- [ ] Κανένα UI regression — ίδια loading/error/data behavior

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| `useAsyncData` imports | 10 files | 60+ files |
| Triple useState boilerplate | 117 files | <60 files |
| Average boilerplate lines per hook | ~15 | ~3 |

---

## 11. Relationship to Other SPECs

- **SPEC-251D** (Loading States): Λύνεται αυτόματα — `useAsyncData` εξαλείφει manual `setLoading`
- **SPEC-251A** (Error Handling): Complementary — `useAsyncData` uses `getErrorMessage` internally

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation | Claude Code |
