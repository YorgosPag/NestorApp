# SPEC-251C: Toast/Notification Consolidation → NotificationProvider

> **Eliminate direct `import { toast } from 'sonner'` — use centralized NotificationProvider**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #3 — Toast/Notification Direct Imports |
| **Priority** | LOW-MEDIUM |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~1 session |
| **Dependencies** | None — NotificationProvider already exists (ADR-219) |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση **14 αρχείων** που κάνουν `import { toast } from 'sonner'` απευθείας, με χρήση του κεντρικοποιημένου `NotificationProvider`. Εξασφαλίζει consistent notification styling, centralized configuration (position, duration, stacking), και single point of change.

---

## 2. Centralized Tool

**Location**: `src/providers/NotificationProvider.tsx` (ADR-219)

Η χρήση γίνεται μέσω hooks/patterns που παρέχει ο NotificationProvider. Ο provider wraps τη `toast` λειτουργικότητα με enterprise defaults.

---

## 3. Current State (Scattered Pattern)

```typescript
// ❌ SCATTERED — 14 αρχεία
import { toast } from 'sonner';

// Direct call — bypasses centralized configuration
toast.success('Αποθηκεύτηκε!');
toast.error('Σφάλμα αποθήκευσης');
```

---

## 4. Target State (Centralized Pattern)

```typescript
// ✅ CENTRALIZED — μέσω NotificationProvider hooks/patterns
// Ακολούθησε το pattern που χρησιμοποιούν τα ~77 αρχεία ήδη
```

---

## 5. Affected Files (πλήρης λίστα — 14 αρχεία)

| # | File | Module |
|---|------|--------|
| 1 | `src/components/sales/payments/RecordPaymentDialog.tsx` | Sales/Payments |
| 2 | `src/components/sales/payments/PaymentTabContent.tsx` | Sales/Payments |
| 3 | `src/components/sales/payments/LoanDetailDialog.tsx` | Sales/Payments |
| 4 | `src/components/sales/payments/InterestCostDialog.tsx` | Sales/Payments |
| 5 | `src/components/sales/payments/EditInstallmentDialog.tsx` | Sales/Payments |
| 6 | `src/components/sales/payments/CreatePaymentPlanWizard.tsx` | Sales/Payments |
| 7 | `src/components/sales/payments/ChequeDetailDialog.tsx` | Sales/Payments |
| 8 | `src/components/sales/payments/AddLoanDialog.tsx` | Sales/Payments |
| 9 | `src/components/sales/payments/AddChequeDialog.tsx` | Sales/Payments |
| 10 | `src/components/sales/legal/ProfessionalsCard.tsx` | Sales/Legal |
| 11 | `src/components/sales/legal/LegalTabContent.tsx` | Sales/Legal |
| 12 | `src/components/sales/legal/ContractCard.tsx` | Sales/Legal |
| 13 | `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` | Contacts |
| 14 | `src/components/building-management/tabs/FloorsTabContent.tsx` | Building Mgmt |

### Pattern Observation
- **12/14** αρχεία στο `sales/` module — γράφτηκαν πριν τον NotificationProvider
- **2 αρχεία** εκτός sales — individual cases

### Πώς βρίσκεις affected files
```bash
grep -r "from ['\"]sonner['\"]" src/ --include="*.ts" --include="*.tsx" -l | \
  grep -v "NotificationProvider"
```

---

## 6. Implementation Steps

### Per-file migration (MIGRATE-ON-TOUCH):

1. **Αφαίρεσε** `import { toast } from 'sonner';`
2. **Πρόσθεσε** import από NotificationProvider hook/pattern
3. **Αντικατέστησε** κάθε `toast.success()`, `toast.error()`, `toast.loading()` κλπ
4. **Verify** ότι toast messages εμφανίζονται σωστά

### Migration map

| Sonner Direct | NotificationProvider Equivalent |
|---------------|-------------------------------|
| `toast.success('msg')` | Centralized success notification |
| `toast.error('msg')` | Centralized error notification |
| `toast.loading('msg')` | Centralized loading notification |
| `toast.promise(promise, {...})` | Centralized promise notification |
| `toast.dismiss()` | Centralized dismiss |

---

## 7. Before/After Examples

### Example: Payment Dialog

**Before:**
```typescript
import { toast } from 'sonner';

const handleSubmit = async () => {
  try {
    await paymentService.record(data);
    toast.success('Η πληρωμή καταχωρήθηκε');
    onClose();
  } catch (err) {
    toast.error('Σφάλμα καταχώρησης πληρωμής');
  }
};
```

**After:**
```typescript
// Import from centralized notification system (ADR-219)
import { useNotification } from '@/providers/NotificationProvider';

const { success, error } = useNotification();

const handleSubmit = async () => {
  try {
    await paymentService.record(data);
    success('Η πληρωμή καταχωρήθηκε');
    onClose();
  } catch (err) {
    error('Σφάλμα καταχώρησης πληρωμής');
  }
};
```

> **Σημείωση**: Η ακριβής API εξαρτάται από τον NotificationProvider. Πριν migrate, διάβασε το `src/providers/NotificationProvider.tsx` για τα exported hooks/methods.

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| `toast.promise()` pattern | Check αν ο NotificationProvider υποστηρίζει promise wrapper |
| Custom toast options (duration, position) | Map σε centralized defaults ή options |
| `toast.dismiss(id)` | Check centralized dismiss API |
| `NotificationProvider.tsx` ίδιο | ❌ ΔΕΝ αλλάζει — αυτό ΕΙΝΑΙ η centralized λύση |
| Files χωρίς React context (utility files) | Σπάνιο — αλλά αν υπάρχει, δεν μπορεί να χρησιμοποιήσει hook |

---

## 9. Verification Criteria

- [ ] 0 αρχεία με `import { toast } from 'sonner'` (εκτός NotificationProvider)
- [ ] Κάθε migrated file χρησιμοποιεί NotificationProvider API
- [ ] Toast messages εμφανίζονται σε ίδια position/style
- [ ] TypeScript compilation passes
- [ ] Success/error/loading toasts λειτουργούν σε όλα τα migrated components

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Direct sonner imports | 14 files | 0 files |
| NotificationProvider adoption | ~77 files | ~91 files |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation — full 14-file list | Claude Code |
