# SPEC-251E: Dialog State Centralization → `useConfirmDialog`

> **Eliminate manual open/close/data dialog state — use centralized `useConfirmDialog` hook**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #5 — Dialog State Management |
| **Priority** | LOW-MEDIUM |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~2-3 sessions |
| **Dependencies** | None — `useConfirmDialog` already exists |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση **manual dialog state management** (open/close/selectedItem) σε 44 αρχεία, με χρήση:
- `useConfirmDialog<T>()` — για confirmation/action dialogs
- `SmartDialogEngine` — για complex multi-step wizards

Εξαλείφει ~5-8 γραμμές boilerplate ανά dialog, εξασφαλίζει consistent state cleanup, και αποτρέπει stale data bugs.

---

## 2. Centralized Tools

### Tool A: `useConfirmDialog<T>`
**Location**: `src/hooks/useConfirmDialog.ts`

```typescript
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const { isOpen, open, close, data } = useConfirmDialog<Project>();
```

### Tool B: `SmartDialogEngine`
**Location**: `src/core/modals/SmartDialogEngine.ts`
- Για multi-step wizards, complex dialog flows
- Δεν αφορά simple confirmation dialogs

---

## 3. Current State (Scattered Pattern)

```typescript
// ❌ SCATTERED — 44 αρχεία (5-8 γραμμές boilerplate ΑΝΑ dialog)
const [isOpen, setIsOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Project | null>(null);

const openDialog = (item: Project) => {
  setSelectedItem(item);
  setIsOpen(true);
};

const closeDialog = () => {
  setIsOpen(false);
  setSelectedItem(null);  // Manual cleanup — easy to forget
};
```

---

## 4. Target State (Centralized Pattern)

```typescript
// ✅ CENTRALIZED — 1 γραμμή
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const { isOpen, open, close, data: selectedItem } = useConfirmDialog<Project>();

// open(project) → sets data + isOpen
// close() → clears data + isOpen (automatic cleanup)
```

---

## 5. Affected Files

### Candidate files: 44 αρχεία με manual dialog state

#### Suitable for `useConfirmDialog` (simple open/close + optional data):
- Confirmation dialogs (delete, archive, status change)
- Detail view dialogs (view item details)
- Simple action dialogs (record payment, add note)

#### NOT suitable (keep manual state):
- Complex form dialogs με multiple useState πέρα από open/data
- Multi-step wizards → use SmartDialogEngine
- Dialogs με uncontrolled→controlled transitions

### Πώς βρίσκεις affected files
```bash
# Files with manual dialog state
grep -r "setIsOpen\|setOpen\|setShowDialog\|setDialogOpen" src/ \
  --include="*.ts" --include="*.tsx" -l | \
  xargs grep -L "useConfirmDialog"
```

### Current adoption
- **16 αρχεία** ήδη χρησιμοποιούν `useConfirmDialog` ή `SmartDialogEngine`
- **44 αρχεία** με manual dialog state

---

## 6. Implementation Steps

### Per-file migration (MIGRATE-ON-TOUCH):

1. **Αναγνώριση**: Βρες `useState(false)` + `useState<T | null>(null)` pair για dialog
2. **Αξιολόγηση**:
   - Simple dialog (open/close + 0-1 data items) → ✅ Migrate to `useConfirmDialog`
   - Complex dialog (multiple states, form data, validation) → ❌ Keep manual
   - Multi-step wizard → ⚠️ Consider SmartDialogEngine
3. **Αντικατάσταση**:
   - Remove `const [isOpen, setIsOpen] = useState(false)`
   - Remove `const [selectedItem, setSelectedItem] = useState<T | null>(null)`
   - Remove manual `openDialog`/`closeDialog` functions
   - Replace με `const { isOpen, open, close, data } = useConfirmDialog<T>()`
4. **Update references**:
   - `openDialog(item)` → `open(item)`
   - `closeDialog()` → `close()`
   - `selectedItem` → `data`

---

## 7. Before/After Examples

### Example 1: Delete Confirmation Dialog

**Before:**
```typescript
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

const handleDeleteClick = (project: Project) => {
  setProjectToDelete(project);
  setShowDeleteDialog(true);
};

const handleDeleteConfirm = async () => {
  if (!projectToDelete) return;
  await projectService.delete(projectToDelete.id);
  setShowDeleteDialog(false);
  setProjectToDelete(null);
};

const handleDeleteCancel = () => {
  setShowDeleteDialog(false);
  setProjectToDelete(null);
};

return (
  <>
    <Button onClick={() => handleDeleteClick(project)}>Delete</Button>
    <ConfirmDialog
      open={showDeleteDialog}
      onConfirm={handleDeleteConfirm}
      onCancel={handleDeleteCancel}
      title={`Delete ${projectToDelete?.name}?`}
    />
  </>
);
```

**After:**
```typescript
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const deleteDialog = useConfirmDialog<Project>();

const handleDeleteConfirm = async () => {
  if (!deleteDialog.data) return;
  await projectService.delete(deleteDialog.data.id);
  deleteDialog.close();
};

return (
  <>
    <Button onClick={() => deleteDialog.open(project)}>Delete</Button>
    <ConfirmDialog
      open={deleteDialog.isOpen}
      onConfirm={handleDeleteConfirm}
      onCancel={deleteDialog.close}
      title={`Delete ${deleteDialog.data?.name}?`}
    />
  </>
);
```

### Example 2: Multiple Dialogs in Same Component

**Before:**
```typescript
const [showEdit, setShowEdit] = useState(false);
const [showDelete, setShowDelete] = useState(false);
const [selected, setSelected] = useState<Item | null>(null);

// Shared selected state → bug-prone!
```

**After:**
```typescript
const editDialog = useConfirmDialog<Item>();
const deleteDialog = useConfirmDialog<Item>();

// Each dialog has its own data → no cross-contamination
```

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| **Complex form dialogs** (5+ internal states) | ❌ Keep manual — useConfirmDialog is for simple cases |
| **Dialog with form validation** | ⚠️ If only open/data + validation → migrate dialog state, keep validation |
| **Controlled Dialog from parent** | ❌ Skip — parent controls open state via props |
| **Dialog with animation state** | ⚠️ Check if `useConfirmDialog` supports exit animation delay |
| **Multiple data items per dialog** | Use `useConfirmDialog<{ item: Item; context: Context }>()` |
| **Dialog that stays open after action** | Adjust — `close()` may need to be called explicitly |

---

## 9. Verification Criteria

- [ ] Migrated dialogs open/close correctly
- [ ] Data passed to dialog renders correctly (names, IDs, etc.)
- [ ] Close automatically cleans up data (no stale state)
- [ ] Multiple dialogs in same component work independently
- [ ] TypeScript compilation passes
- [ ] No UI regression — same dialog behavior

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| `useConfirmDialog` adoption | ~16 files | 35+ files |
| Manual dialog state | 44 files | <20 files (complex cases only) |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation | Claude Code |
