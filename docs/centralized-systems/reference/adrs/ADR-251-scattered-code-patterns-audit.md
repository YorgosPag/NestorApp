# ADR-251: Scattered Code Patterns Audit & Consolidation Roadmap

| Field | Value |
|-------|-------|
| **Status** | DOCUMENTED |
| **Date** | 2026-03-19 |
| **Author** | Claude Code Agent |
| **Triggered By** | ADR-248 (Centralized Auto-Save) post-implementation review |
| **Type** | Audit / Roadmap |
| **Scope** | Full application codebase |

---

## 1. Context

Μετά την υλοποίηση του ADR-248 (Centralized Auto-Save System), εκτελέστηκε **καθολική έρευνα (full codebase audit)** για εντοπισμό scattered/duplicate code patterns σε ΟΛΗ την εφαρμογή. Ο στόχος ήταν να αποτυπωθούν τα patterns που:

1. Έχουν ήδη κεντρικοποιημένη λύση αλλά **δεν χρησιμοποιείται** (adoption gap)
2. Εισάγουν **boilerplate** που θα μπορούσε να εξαλειφθεί
3. Δημιουργούν **κίνδυνο inconsistency** μεταξύ components

**Αυτό το ADR ΔΕΝ υλοποιεί αλλαγές** — τεκμηριώνει τα ευρήματα και ορίζει roadmap για migrate-on-touch.

---

## 2. Methodology

### Εργαλεία & Patterns
- **Grep** searches με regex patterns στον φάκελο `src/`
- **Glob** file matching για εντοπισμό αρχείων
- Cross-referencing με υπάρχοντα centralized systems (`docs/centralized-systems/`)
- Σύγκριση adoption rates (files using centralized vs scattered pattern)

### Grep Patterns Used

| Finding | Search Pattern | Results |
|---------|---------------|---------|
| Error Handling | `instanceof Error` | Ελάχιστα direct instances, αλλά `error.message\|err.message` σε 1+ file |
| Error Handling (centralized) | `import.*getErrorMessage` | 41 αρχεία χρησιμοποιούν |
| Data Fetching | `useState.*null\).*useState.*false\).*useState.*null\)` (multiline) | 117 αρχεία με triple-state pattern |
| Data Fetching (centralized) | `import.*useAsyncData` | 10 αρχεία μόνο |
| Toast/Notifications | `from ['"]sonner['"]` | 15 αρχεία (14 direct + 1 NotificationProvider) |
| Loading States | `setLoading\|setIsLoading` | 189 αρχεία |
| Dialog State | `setIsOpen\|setOpen\|setShowDialog\|setDialogOpen` | 44 αρχεία |
| Dialog (centralized) | `useConfirmDialog\|SmartDialogEngine` | 16 αρχεία |
| Form Validation | `setErrors\|setFieldError` | 151 αρχεία (πολλά legitimate) |

---

## 3. Findings

### Finding #1: Error Handling Patterns

| Metric | Value |
|--------|-------|
| **Severity** | MEDIUM |
| **Centralized Tool** | `getErrorMessage()` σε `src/lib/error-utils.ts` (ADR-221) |
| **Current Adoption** | 41 αρχεία |
| **Scattered Pattern** | `error.message`, `err.message`, inline ternary checks |

#### Πρόβλημα
Πολλά αρχεία κάνουν inline error extraction αντί να χρησιμοποιούν `getErrorMessage()`:

```typescript
// ❌ Scattered pattern
catch (err) {
  console.error('Failed:', err instanceof Error ? err.message : 'Unknown');
}

// ✅ Centralized pattern
catch (err) {
  console.error('Failed:', getErrorMessage(err));
}
```

#### Affected Areas
- API route handlers (`src/app/api/`)
- Service files (`src/services/`)
- Hook error callbacks (`src/hooks/`)

#### Migration Effort: LOW
- Μηχανικό find-replace
- Δεν αλλάζει behavior

---

### Finding #2: Data Fetching — Triple useState Boilerplate

| Metric | Value |
|--------|-------|
| **Severity** | HIGH |
| **Centralized Tool** | `useAsyncData` hook (ADR-223) |
| **Current Adoption** | 10 αρχεία (8.5%) |
| **Scattered Pattern** | 117 αρχεία με manual `data/loading/error` useState trio |

#### Πρόβλημα
Η πλειονότητα των data-fetching hooks χρησιμοποιεί το ίδιο boilerplate:

```typescript
// ❌ Scattered pattern (117 αρχεία)
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  fetchData()
    .then(setData)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, [deps]);

// ✅ Centralized pattern (10 αρχεία)
const { data, loading, error, refetch } = useAsyncData(
  () => fetchData(),
  [deps]
);
```

#### Top Affected Files (ενδεικτικά)
- `src/hooks/useFirestoreProjects.ts`
- `src/hooks/useChequeRegistry.ts`
- `src/hooks/usePaymentPlan.ts`
- `src/hooks/useLoanTracking.ts`
- `src/hooks/usePaymentReport.ts`
- `src/subapps/accounting/hooks/useInvoices.ts`
- `src/subapps/accounting/hooks/useTaxEstimate.ts`
- `src/subapps/accounting/hooks/useVATSummary.ts`
- `src/subapps/accounting/hooks/useEFKASummary.ts`
- `src/subapps/accounting/hooks/useBankTransactions.ts`

#### Migration Effort: MEDIUM
- Κάθε hook χρειάζεται review για edge cases (πολλαπλά fetches, conditional deps)
- Ορισμένα hooks έχουν complex state logic πέρα από data/loading/error

---

### Finding #3: Toast/Notification Direct Imports

| Metric | Value |
|--------|-------|
| **Severity** | LOW-MEDIUM |
| **Centralized Tool** | `NotificationProvider` σε `src/providers/NotificationProvider.tsx` (ADR-219) |
| **Current Adoption** | ~77 αρχεία μέσω NotificationProvider |
| **Scattered Pattern** | 14 αρχεία με direct `import { toast } from 'sonner'` |

#### Πρόβλημα
14 αρχεία κάνουν bypass τον `NotificationProvider` και importάρουν απευθείας τη `toast` από `sonner`:

```typescript
// ❌ Direct import (14 αρχεία)
import { toast } from 'sonner';
toast.success('Saved!');

// ✅ Via centralized provider
// Χρήση μέσω NotificationProvider hooks/patterns
```

#### Affected Files (πλήρης λίστα)
1. `src/components/sales/payments/RecordPaymentDialog.tsx`
2. `src/components/sales/payments/PaymentTabContent.tsx`
3. `src/components/sales/payments/LoanDetailDialog.tsx`
4. `src/components/sales/payments/InterestCostDialog.tsx`
5. `src/components/sales/payments/EditInstallmentDialog.tsx`
6. `src/components/sales/payments/CreatePaymentPlanWizard.tsx`
7. `src/components/sales/payments/ChequeDetailDialog.tsx`
8. `src/components/sales/payments/AddLoanDialog.tsx`
9. `src/components/sales/payments/AddChequeDialog.tsx`
10. `src/components/sales/legal/ProfessionalsCard.tsx`
11. `src/components/sales/legal/LegalTabContent.tsx`
12. `src/components/sales/legal/ContractCard.tsx`
13. `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx`
14. `src/components/building-management/tabs/FloorsTabContent.tsx`

#### Pattern Observation
- **12 από 14** αρχεία βρίσκονται στο `sales/` module — πιθανώς γράφτηκαν πριν τον NotificationProvider
- Εύκολο migrate-on-touch

#### Migration Effort: LOW
- Αλλαγή import + ενδεχομένως toast API adaptation

---

### Finding #4: Loading State Management

| Metric | Value |
|--------|-------|
| **Severity** | MEDIUM |
| **Centralized Tools** | `useAsyncData` (ADR-223), `PageLoadingState` (ADR-229) |
| **PageLoadingState Adoption** | 37 αρχεία (page-level loading) |
| **Scattered Pattern** | 189 αρχεία με `setLoading`/`setIsLoading` manual state |

#### Πρόβλημα
Διπλό πρόβλημα:
1. **Page-level loading**: Αρκετά well-adopted μέσω `PageLoadingState` (37 αρχεία)
2. **Hook-level loading**: Σχεδόν καθόλου adoption — 189 αρχεία χρησιμοποιούν manual `useState(false)` για loading

```typescript
// ❌ Scattered (189 αρχεία)
const [isLoading, setIsLoading] = useState(false);
const handleAction = async () => {
  setIsLoading(true);
  try { await doThing(); }
  finally { setIsLoading(false); }
};

// ✅ Centralized
const { loading, execute } = useAsyncData(...);
// ή PageLoadingState για page-level
```

#### Migration Strategy
- **Page-level**: Ήδη καλό adoption — continue migrate-on-touch
- **Hook-level**: Overlaps με Finding #2 — λύνεται μαζί με `useAsyncData` migration

#### Migration Effort: MEDIUM (ταυτίζεται με Finding #2)

---

### Finding #5: Dialog State Management

| Metric | Value |
|--------|-------|
| **Severity** | LOW-MEDIUM |
| **Centralized Tools** | `useConfirmDialog` (src/hooks/), `SmartDialogEngine` (src/core/modals/) |
| **Centralized Adoption** | 16 αρχεία |
| **Scattered Pattern** | 44 αρχεία με manual `setIsOpen`/`setOpen` useState |

#### Πρόβλημα
Πολλά components διαχειρίζονται dialog state χειροκίνητα:

```typescript
// ❌ Scattered (44 αρχεία)
const [isOpen, setIsOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<T | null>(null);
const openDialog = (item: T) => { setSelectedItem(item); setIsOpen(true); };
const closeDialog = () => { setIsOpen(false); setSelectedItem(null); };

// ✅ Centralized
const { isOpen, open, close, data } = useConfirmDialog<T>();
// ή SmartDialogEngine για complex flows
```

#### Nuance
- Δεν πρέπει ΟΛΟΙ οι dialogs να μεταφερθούν — μόνο confirmation/action dialogs
- Form dialogs με complex state ίσως χρειάζονται τη δική τους λύση
- `SmartDialogEngine` κατάλληλο για multi-step wizards

#### Migration Effort: LOW-MEDIUM
- Simple confirm dialogs → easy migrate
- Complex form dialogs → case-by-case evaluation

---

### Finding #6: Form Validation — Manual Error Setting

| Metric | Value |
|--------|-------|
| **Severity** | LOW |
| **Centralized Tool** | Zod schemas στο `src/utils/validation.ts`, `useFormValidation` hook |
| **Scattered Pattern** | Πολλά αρχεία με manual `setError`/`setErrors` |

#### Πρόβλημα
Ορισμένα components κάνουν manual form validation αντί για Zod schemas:

```typescript
// ❌ Manual validation
const [errors, setErrors] = useState<Record<string, string>>({});
if (!name) setErrors(prev => ({ ...prev, name: 'Required' }));
if (!email.includes('@')) setErrors(prev => ({ ...prev, email: 'Invalid' }));

// ✅ Zod schema validation
const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid'),
});
const result = schema.safeParse(formData);
```

#### Context
- Τα περισσότερα `setError` calls είναι **legitimate** (React Hook Form, custom hooks)
- Μόνο ~6 αρχεία κάνουν πραγματικό manual validation χωρίς schema
- Low priority αφού δεν δημιουργεί σημαντικό maintenance burden

#### Migration Effort: LOW
- Μικρός αριθμός affected files
- Zod schemas ήδη υπάρχουν ως pattern

---

## 4. Existing Centralized Systems

| System | Location | ADR | Status |
|--------|----------|-----|--------|
| `getErrorMessage()` | `src/lib/error-utils.ts` | ADR-221 | Active, partial adoption |
| `useAsyncData` | `src/hooks/useAsyncData.ts` | ADR-223 | Active, low adoption (10 files) |
| `NotificationProvider` | `src/providers/NotificationProvider.tsx` | ADR-219 | Active, good adoption (~77 files) |
| `PageLoadingState` | `src/core/states/PageLoadingState.tsx` | ADR-229 | Active, good adoption (37 files) |
| `useConfirmDialog` | `src/hooks/useConfirmDialog.ts` | — | Active, low adoption |
| `SmartDialogEngine` | `src/core/modals/SmartDialogEngine.ts` | — | Active, low adoption |
| Zod validation schemas | `src/utils/validation.ts` | ADR-165 | Active |
| `useFormValidation` | `src/hooks/useFormValidation.ts` | — | Active |

---

## 5. Prioritization Matrix

| Priority | Finding | Impact | Effort | ROI | Rationale |
|----------|---------|--------|--------|-----|-----------|
| **P1** | #2 Data Fetching | HIGH | MEDIUM | HIGH | 117 αρχεία, eliminates most boilerplate, fixes #4 simultaneously |
| **P2** | #3 Toast Imports | LOW-MEDIUM | LOW | HIGH | 14 αρχεία only, trivial fix, high consistency gain |
| **P3** | #1 Error Handling | MEDIUM | LOW | MEDIUM | Mechanical replacement, improves reliability |
| **P4** | #5 Dialog State | LOW-MEDIUM | LOW-MEDIUM | MEDIUM | 44 αρχεία but many are legitimate complex cases |
| **P5** | #4 Loading States | MEDIUM | MEDIUM | LOW | Solved by P1 (useAsyncData migration) |
| **P6** | #6 Form Validation | LOW | LOW | LOW | Only ~6 truly affected files |

---

## 6. Migration Strategy

### Κανόνας: **MIGRATE-ON-TOUCH**

**ΔΕΝ κάνουμε mass migration.** Αντ' αυτού:

1. **Όταν αγγίζουμε ένα αρχείο** για bug fix ή feature → ελέγχουμε αν χρησιμοποιεί scattered patterns
2. **Αν ναι** → αντικαθιστούμε με centralized pattern στο ΙΔΙΟ commit
3. **Αν δεν αγγίζεται** → δεν πειράζεται

### Migration Checklist per File

Όταν ανοίγεις ένα αρχείο, τσέκαρε:

- [ ] `import { toast } from 'sonner'` → Migrate to NotificationProvider
- [ ] Triple `useState(null/false/null)` → Migrate to `useAsyncData`
- [ ] `err instanceof Error ? err.message` → Migrate to `getErrorMessage()`
- [ ] Manual `setIsOpen/setOpen` for confirm dialogs → Evaluate `useConfirmDialog`
- [ ] Manual `setLoading/setIsLoading` → Evaluate `useAsyncData`

### Exceptions (ΜΗΝ κάνεις migrate)

- Hooks που χρησιμοποιούν real-time subscriptions (`onSnapshot`) — δεν ταιριάζει ο `useAsyncData`
- Complex form dialogs με πολλαπλά states πέρα από open/close
- Loading states που ελέγχουν multiple concurrent operations

---

## 7. Success Metrics

### Πώς μετράμε πρόοδο

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| `useAsyncData` adoption | 10 files | 60+ files | `grep -r "import.*useAsyncData" src/ \| wc -l` |
| Direct sonner imports | 14 files | 0 files | `grep -r "from 'sonner'" src/ \| grep -v NotificationProvider \| wc -l` |
| `getErrorMessage` adoption | 41 files → **327 files** | ~~60+ files~~ ✅ DONE | `grep -r "import.*getErrorMessage" src/ \| wc -l` |
| `useConfirmDialog` adoption | ~10 files | 25+ files | `grep -r "useConfirmDialog" src/ \| wc -l` |
| Page loading consistency | 37 files | all page files | `grep -r "PageLoadingState" src/ \| wc -l` |

### Reporting Cadence
- Δεν υπάρχει formal schedule
- Κάθε μεγάλο consolidation phase μπορεί να εκτελέσει ξανά τα grep patterns παραπάνω
- Comparison against this baseline

---

## 8. Related ADRs

| ADR | Relationship |
|-----|-------------|
| ADR-221 | Error Message Extraction — defines `getErrorMessage` |
| ADR-223 | useAsyncData — defines centralized data fetching hook |
| ADR-219 | Notification/Toast System — defines NotificationProvider |
| ADR-229 | Page Loading States — defines PageLoadingState |
| ADR-248 | Auto-Save Centralization — trigger for this audit |
| ADR-165 | Entity Validation — defines Zod schemas pattern |
| ADR-204-217 | Previous centralization phases (1-11) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial audit completed. 6 findings documented with real Grep data. |
| 2026-03-19 | 6 SPEC files created (SPEC-251A through SPEC-251F) — one per finding with full implementation details. |
| 2026-03-20 | **SPEC-251A COMPLETE**: Batch 2 migrated 175 API route files (349 replacements). Total: 286 files across Batch 1+2. Finding #1 fully resolved. |
