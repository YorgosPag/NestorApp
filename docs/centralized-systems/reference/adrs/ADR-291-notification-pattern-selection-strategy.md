# ADR-291: Notification Pattern Selection Strategy (Google Material Design 3)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-04-05 |
| **Category** | UI Components / Design System |
| **Canonical Location** | `src/providers/NotificationProvider.tsx` + `src/components/ui/form.tsx` + `src/components/ui/alert.tsx` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Supersedes** | — |
| **Complements** | [ADR-219](./ADR-219-notification-toast-consolidation.md) (Toast System Consolidation) |

---

## 1. Context

Το ADR-219 ενοποίησε **ΠΩΣ** εμφανίζουμε notifications (ένα toast system, μέσω `useNotifications()`). Όμως **ΔΕΝ** όρισε **ΠΟΤΕ** χρησιμοποιούμε κάθε pattern (toast vs inline vs banner vs dialog).

Αποτέλεσμα: κάθε developer επιλέγει με το μάτι, με αποτέλεσμα ασυνεπές UX.

### The Problem

- ❌ **Validation errors** εμφανίζονται άλλοτε ως toast, άλλοτε ως inline, άλλοτε ως banner στην κορυφή του form
- ❌ **Success messages** μερικές φορές inline, μερικές φορές toast
- ❌ **Χρήστες δεν ξέρουν πού να κοιτάξουν** — notification fatigue
- ❌ **Developers αναρωτιούνται** "πώς να δείξω αυτό το μήνυμα;" χωρίς κανόνα
- ❌ **Παράδειγμα (2026-04-05):** Στο "Νέο Έργο" form, όταν ο χρήστης δεν έχει επιλέξει εταιρεία και προσπαθεί να αποθηκεύσει, εμφανίζεται **banner top-level** με recovery action (create company inline). Το banner είναι σωστό, αλλά **δεν υπάρχει visual indication** στο ίδιο το πεδίο (EntityLinkCard) που λείπει — ο χρήστης βλέπει το μήνυμα αλλά όχι πού να δράσει

---

## 2. Decision

**Το pattern καθορίζεται από τη ΣΗΜΑΣΙΟΛΟΓΙΑ του μηνύματος, όχι από την προτίμηση του developer.**

### Canonical Rule Matrix

| # | Σενάριο | Pattern | Component | Παράδειγμα |
|---|---------|---------|-----------|------------|
| 1 | **Επιτυχής ενέργεια** (save, delete, send) | **Toast (success)** | `useNotifications().success(msg)` | "Το έργο αποθηκεύτηκε" |
| 2 | **Αποτυχία ενέργειας** (network, server error) | **Toast (error)** | `useNotifications().error(msg)` | "Αποτυχία αποθήκευσης" |
| 3 | **Ενημερωτικό μήνυμα** (system info, background update) | **Toast (info)** | `useNotifications().info(msg)` | "Η λίστα ρυθμίσεων ενημερώθηκε" |
| 4 | **Προειδοποίηση** (warning, non-blocking) | **Toast (warning)** | `useNotifications().warning(msg)` | "Έχετε μη αποθηκευμένες αλλαγές" |
| 5 | **Validation error σε ΕΝΑ πεδίο** | **Inline (FormMessage)** | `<FormMessage />` κάτω από το πεδίο | "Το email δεν είναι έγκυρο" |
| 6 | **Form-level summary** (πολλαπλά validation errors) | **Banner (Alert destructive)** | `<Alert variant="destructive" />` στην κορυφή του form | "3 πεδία χρειάζονται διόρθωση" |
| 6b | **Business rule / Policy error** (server-side, με recovery action) | **Banner + Inline combo** | `<PolicyErrorBanner />` top + κόκκινο border στο σχετικό πεδίο | "Επίλεξε Εταιρεία — κάθε έργο πρέπει να ανήκει σε εταιρεία" + κόκκινο border στο company picker |
| 7 | **Page-level persistent state** (π.χ. read-only mode, offline) | **Banner (Alert default)** | `<Alert />` στην κορυφή της σελίδας | "Είστε σε offline mode" |
| 8 | **Destructive confirmation** (irreversible action) | **Modal Dialog** | `<AlertDialog />` | "Σίγουρα θέλετε να διαγράψετε;" |
| 9 | **Empty state / onboarding** | **Inline section** | Custom empty state component | "Δεν υπάρχουν έργα ακόμα" |

### Decision Tree (για τον developer)

```
Χρειάζομαι να ενημερώσω τον χρήστη για κάτι. Τι να χρησιμοποιήσω;

┌─ Αφορά irreversible ενέργεια που θέλει επιβεβαίωση;
│  └─ ΝΑΙ → AlertDialog (modal)
│
├─ Αφορά ΕΝΑ πεδίο σε form (validation);
│  └─ ΝΑΙ → <FormMessage /> (inline, κάτω από το πεδίο)
│
├─ Αφορά πολλαπλά πεδία σε form (summary πριν submit);
│  └─ ΝΑΙ → <Alert variant="destructive" /> (banner στην κορυφή του form)
│
├─ Αφορά persistent κατάσταση της σελίδας (offline, read-only, license expired);
│  └─ ΝΑΙ → <Alert /> (banner στην κορυφή της σελίδας, δεν auto-dismiss)
│
├─ Αφορά αποτέλεσμα μιας action που μόλις ολοκληρώθηκε;
│  └─ ΝΑΙ → useNotifications().success/error/info/warning (toast, auto-dismiss)
│
└─ Είναι empty state;
   └─ ΝΑΙ → Empty state component (inline section)
```

### Canonical Sources

```typescript
// Toast notifications (Scenarios 1-4)
import { useNotifications } from '@/providers/NotificationProvider';
const { success, error, info, warning } = useNotifications();
success(t('project.saved'));

// Inline form errors (Scenario 5)
import { FormMessage } from '@/components/ui/form';
// Used inside <FormField /> — auto-renders validation errors from react-hook-form + Zod

// Form-level & page-level banners (Scenarios 6-7)
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Destructive confirmations (Scenario 8)
import { AlertDialog, AlertDialogContent, ... } from '@/components/ui/alert-dialog';
```

### Complete Examples

#### ✅ Scenario 1: Success Toast
```typescript
const { success } = useNotifications();

async function handleSave() {
  try {
    await saveProject(data);
    success(t('project.savedSuccessfully'));
  } catch (e) {
    error(t('project.saveFailed'));
  }
}
```

#### ✅ Scenario 5: Inline Field Validation
```typescript
<FormField
  control={form.control}
  name="projectNumber"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('project.number')} *</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* ← Inline error εμφανίζεται αυτόματα εδώ */}
    </FormItem>
  )}
/>
```

#### ✅ Scenario 6: Form-Level Summary Banner
```typescript
const errorCount = Object.keys(form.formState.errors).length;

{errorCount > 0 && (
  <Alert variant="destructive" className="mb-4">
    <AlertTitle>{t('form.errorsTitle')}</AlertTitle>
    <AlertDescription>
      {t('form.errorsSummary', { count: errorCount })}
    </AlertDescription>
  </Alert>
)}
```

#### ✅ Scenario 7: Page-Level Persistent Banner
```typescript
{isOfflineMode && (
  <Alert className="mb-6">
    <AlertTitle>{t('system.offlineMode')}</AlertTitle>
    <AlertDescription>
      {t('system.offlineDescription')}
    </AlertDescription>
  </Alert>
)}
```

---

## 3. Consequences

### Positive

- ✅ **Μηδενική αμφιβολία** για developers — decision tree = σαφής κανόνας
- ✅ **Συνεπές UX** — χρήστες ξέρουν πού να κοιτάξουν
- ✅ **Accessibility** — κάθε pattern έχει σωστά ARIA roles (alert, alertdialog, aria-describedby)
- ✅ **Σύμφωνο με Google Material Design 3** (Snackbar + Helper Text + Banner + Dialog)
- ✅ **Ενισχύεται μέσω ESLint** (future) + code review

### Negative

- ⚠️ **Migration effort** — υπάρχουν αρχεία που παραβιάζουν τον κανόνα (π.χ. ProjectNew form με banner για single field)
- ⚠️ **Pattern #6 (form-level summary)** είναι **προαιρετικό** — χρησιμοποιείται μόνο όταν υπάρχουν 3+ errors ή σε long forms

---

## 4. Prohibitions (after this ADR)

- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `toast.error()` για validation error σε single field → χρησιμοποίησε `<FormMessage />`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `<Alert variant="destructive">` στην κορυφή του form για error σε ΕΝΑ πεδίο → χρησιμοποίησε `<FormMessage />` κάτω από το πεδίο
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** inline success message μέσα σε form (π.χ. "Saved!" σε banner) → χρησιμοποίησε `useNotifications().success()`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** toast για persistent state (π.χ. "You are offline" toast που εξαφανίζεται) → χρησιμοποίησε `<Alert />` banner
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `window.confirm()` / `window.alert()` → χρησιμοποίησε `<AlertDialog />`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** custom ad-hoc notification components — χρησιμοποίησε τα κανονικά (βλ. ADR-219)

---

## 5. Canonical Policy Error Pattern (Scenario 6b)

**Server-side business rule errors (policy errors)** χρειάζονται **banner + inline combo**:

- **Banner** (`<PolicyErrorBanner />`) → top of form, translated message, recovery action
- **Inline visual** → κόκκινο border στο σχετικό πεδίο, auto-scroll-into-view

**Γιατί combo**: Ο χρήστης πρέπει (α) να καταλάβει ΤΙ έκανε λάθος (banner message + recovery), (β) να δει ΠΟΥ πρέπει να δράσει (inline field highlight).

**Canonical implementation**: `src/components/projects/general-tab/GeneralProjectTab.tsx` + `src/components/shared/EntityLinkCard.tsx` (POLICY_COMPANY_REQUIRED → red border on company picker).

### Known Migrations

| File | Status | Notes |
|------|--------|-------|
| SPEC-251C legacy files (20 files) | 🔄 Pending | Direct `sonner` imports → `useNotifications()` (ADR-219, gradual) |

**Boy Scout Rule**: Όταν ένας developer αγγίζει ένα αρχείο με παραβίαση, διορθώνει το pattern πριν commit.

---

## 6. References

- **Complements**: [ADR-219: Notification/Toast System Consolidation](./ADR-219-notification-toast-consolidation.md)
- **Canonical Provider**: `src/providers/NotificationProvider.tsx`
- **Form Components**: `src/components/ui/form.tsx` (FormMessage)
- **Alert Component**: `src/components/ui/alert.tsx`
- **AlertDialog Component**: `src/components/ui/alert-dialog.tsx`

### Industry Standards

- **Google Material Design 3**: [Snackbars](https://m3.material.io/components/snackbar), [Banners](https://m3.material.io/components/banners), [Dialogs](https://m3.material.io/components/dialogs)
- **Nielsen Norman Group**: [Error Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- **WCAG 2.1**: Success Criterion 3.3.1 (Error Identification), 3.3.3 (Error Suggestion)

---

## 7. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-04-05 | ADR Created — Pattern selection rules defined | Claude Code |
| 2026-04-05 | Status: APPROVED | Γιώργος Παγώνης |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Notification pattern guidance from: Google Material Design 3, Nielsen Norman Group, WCAG 2.1*
