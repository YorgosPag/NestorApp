# SPEC-251D: Loading States Centralization → `useAsyncData` + `PageLoadingState`

> **Eliminate manual `setLoading`/`setIsLoading` patterns — use centralized loading management**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #4 — Loading State Management |
| **Priority** | MEDIUM |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~3-4 sessions (overlaps heavily with SPEC-251B) |
| **Dependencies** | **SPEC-251B** — most hook-level loading is solved by `useAsyncData` migration |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση **189 αρχείων** με manual `setLoading`/`setIsLoading` state management, μέσω:
- **Hook-level loading** → `useAsyncData` (λύνεται με SPEC-251B)
- **Page-level loading** → `PageLoadingState` (ADR-229)
- **Action-level loading** → Dedicated patterns per case

---

## 2. Centralized Tools

### Tool A: `useAsyncData` (ADR-223)
**Location**: `src/hooks/useAsyncData.ts`
- Handles data + loading + error σε 1 hook
- Αφορά hook-level loading (fetching data)

### Tool B: `PageLoadingState` (ADR-229)
**Location**: `src/core/states/PageLoadingState.tsx`
- Full-page loading indicator
- Αφορά page-level initial load

---

## 3. Current State (Scattered Pattern)

### Pattern A: Hook-level loading (majority — overlaps with SPEC-251B)
```typescript
// ❌ SCATTERED
const [isLoading, setIsLoading] = useState(false);

const fetchData = async () => {
  setIsLoading(true);
  try {
    const result = await service.getData();
    setData(result);
  } finally {
    setIsLoading(false);
  }
};
```

### Pattern B: Action-level loading (button click, form submit)
```typescript
// ❌ SCATTERED
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  setIsSaving(true);
  try {
    await service.save(formData);
  } finally {
    setIsSaving(false);
  }
};

return <Button disabled={isSaving}>Save</Button>;
```

### Pattern C: Multiple loading states
```typescript
// ❌ SCATTERED
const [loadingProjects, setLoadingProjects] = useState(false);
const [loadingContacts, setLoadingContacts] = useState(false);
const isLoading = loadingProjects || loadingContacts;
```

---

## 4. Target State (Centralized Pattern)

### Pattern A → useAsyncData (SPEC-251B handles this)
```typescript
// ✅ CENTRALIZED
const { data, loading } = useAsyncData(() => service.getData(), [deps]);
```

### Pattern B → useAsyncData for actions ή local useState (acceptable)
```typescript
// ✅ Option 1: useAsyncData for action
const { loading: isSaving, execute: save } = useAsyncData(...);

// ✅ Option 2: Local useState is ACCEPTABLE for simple button states
// Action-level loading (1 useState for 1 button) is not boilerplate
const [isSaving, setIsSaving] = useState(false);
```

### Pattern C → Multiple useAsyncData
```typescript
// ✅ CENTRALIZED
const { loading: loadingProjects } = useAsyncData(...);
const { loading: loadingContacts } = useAsyncData(...);
const isLoading = loadingProjects || loadingContacts;
```

---

## 5. Affected Areas

| Category | Count | Action |
|----------|-------|--------|
| **Hook-level loading** (data fetch) | ~117 files | Solved by **SPEC-251B** (useAsyncData) |
| **Page-level loading** | ~37 files already migrated | Continue using PageLoadingState |
| **Action-level loading** (1 button) | ~35 files | **ACCEPTABLE** — no migration needed |
| **Total with `setLoading` pattern** | 189 files | |

### Key insight
Μετά την υλοποίηση SPEC-251B, η πλειονότητα (~117) λύνεται αυτόματα. Τα υπόλοιπα ~35 αρχεία με action-level loading (`isSaving`, `isDeleting`, `isSubmitting`) **δεν χρειάζονται migration** — single-button loading state δεν είναι boilerplate.

### Πώς βρίσκεις affected files
```bash
# All files with manual loading state
grep -r "setLoading\|setIsLoading" src/ --include="*.ts" --include="*.tsx" -l | \
  xargs grep -L "useAsyncData"
```

---

## 6. Implementation Steps

### Βήμα 1: Υλοποίηση SPEC-251B (prerequisite)
Η μετάβαση σε `useAsyncData` εξαλείφει αυτόματα ~117 manual loading states.

### Βήμα 2: Page-level — MIGRATE-ON-TOUCH
Όταν αγγίζεις ένα page component:
1. Check αν χρησιμοποιεί manual loading state για initial page load
2. Αν ναι → αντικατέστησε με `PageLoadingState`

### Βήμα 3: Action-level — EVALUATE
- Single-button loading state → **ACCEPTABLE, no change needed**
- Multiple related loading states → Consider `useAsyncData` pattern

---

## 7. Before/After Examples

### Example 1: Page Component

**Before:**
```typescript
export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    projectService.getAll()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  return <ProjectList projects={projects} />;
}
```

**After:**
```typescript
import { PageLoadingState } from '@/core/states/PageLoadingState';
import { useAsyncData } from '@/hooks/useAsyncData';

export default function ProjectsPage() {
  const { data: projects, loading } = useAsyncData(
    () => projectService.getAll(),
    []
  );

  if (loading) return <PageLoadingState />;
  return <ProjectList projects={projects ?? []} />;
}
```

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| **Action-level loading** (save/delete button) | ✅ ACCEPTABLE as-is — single useState is fine |
| **Real-time subscription loading** | ❌ Skip — `onSnapshot` manages own state |
| **Complex loading orchestration** (parallel + sequential) | ⚠️ Case-by-case evaluation |
| **Loading with progress %** | ❌ Skip — `useAsyncData` doesn't support progress |
| **Optimistic updates** | ❌ Skip — different pattern entirely |

---

## 9. Verification Criteria

- [ ] Hook-level loading states migrated via SPEC-251B
- [ ] Page-level loading uses `PageLoadingState` where appropriate
- [ ] No unnecessary loading state refactors on simple button actions
- [ ] TypeScript compilation passes
- [ ] Loading spinners appear/disappear correctly in UI

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Manual `setLoading` patterns | 189 files | <70 files (action-level only) |
| `PageLoadingState` adoption | 37 files | All page components |
| `useAsyncData` adoption | 10 files | 60+ files (via SPEC-251B) |

---

## 11. Relationship to Other SPECs

- **SPEC-251B** (Data Fetching): **PREREQUISITE** — solving B auto-solves ~117 of D's 189 files
- **SPEC-251A** (Error Handling): Complementary — centralized error handling in loading states

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation | Claude Code |
