# SPEC-251F: Form Validation Centralization → Zod Schemas

> **Eliminate manual form validation patterns — use Zod schema-based validation**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #6 — Form Validation Manual Error Setting |
| **Priority** | LOW |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~1 session |
| **Dependencies** | None — Zod schemas pattern already exists (ADR-165) |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση **manual form validation** (~6 αρχεία) με Zod schema-based validation. Αφορά αρχεία που κάνουν χειροκίνητα `if (!field) setErrors(...)` αντί να χρησιμοποιούν schema validation.

**Lowest-impact finding** — μικρός αριθμός affected files, αλλά σημαντικό για consistency.

---

## 2. Centralized Tools

### Tool A: Zod Schemas
**Location**: `src/utils/validation.ts` (ADR-165)

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
});
```

### Tool B: `useFormValidation` hook
**Location**: `src/hooks/useFormValidation.ts`

```typescript
import { useFormValidation } from '@/hooks/useFormValidation';

const { validate, errors, clearErrors } = useFormValidation(schema);
```

---

## 3. Current State (Scattered Pattern)

```typescript
// ❌ SCATTERED — manual validation (~6 αρχεία)
const [errors, setErrors] = useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};

  if (!formData.name) {
    newErrors.name = 'Το όνομα είναι υποχρεωτικό';
  }
  if (!formData.email || !formData.email.includes('@')) {
    newErrors.email = 'Μη έγκυρο email';
  }
  if (formData.amount <= 0) {
    newErrors.amount = 'Το ποσό πρέπει να είναι θετικό';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

---

## 4. Target State (Centralized Pattern)

```typescript
// ✅ CENTRALIZED — Zod schema
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρο email'),
  amount: z.number().positive('Το ποσό πρέπει να είναι θετικό'),
});

// Usage
const result = formSchema.safeParse(formData);
if (!result.success) {
  const fieldErrors = result.error.flatten().fieldErrors;
  // Map to form error state
}
```

---

## 5. Affected Files

### Πραγματικά affected (~6 αρχεία)
Αρχεία με `setErrors`/`setFieldError` που κάνουν **χειροκίνητο validation** χωρίς schema.

> **Σημαντικό**: Πολλά αρχεία (151 total) χρησιμοποιούν `setError`/`setErrors`, αλλά η πλειονότητα αφορά React Hook Form ή legitimate custom error handling — **ΔΕΝ χρειάζονται migration**.

### Πώς βρίσκεις affected files
```bash
# Files with manual validation (not React Hook Form)
grep -r "setErrors\|setFieldError" src/ --include="*.ts" --include="*.tsx" -l | \
  xargs grep -L "useForm\|react-hook-form\|useFormValidation" | \
  xargs grep -l "if.*!.*\." # Manual if-checks for validation
```

### Τι ΔΕΝ μεταφέρεται
- React Hook Form `setError()` calls — αυτά είναι ήδη framework-managed
- Error displays (`{errors.fieldName && <span>...}`) — αυτά μένουν
- API error handling (`setError(response.error)`) — αυτό δεν είναι form validation

---

## 6. Implementation Steps

### Per-file migration (MIGRATE-ON-TOUCH):

1. **Αναγνώριση**: Βρες manual `if (!field)` validation blocks
2. **Δημιούργησε** Zod schema που αντικατοπτρίζει τα validation rules
3. **Αντικατέστησε** manual validation με `schema.safeParse()`
4. **Map** Zod errors σε form error state
5. **Τοποθέτησε** schema δίπλα στο form ή σε `src/utils/validation.ts` αν reusable

---

## 7. Before/After Examples

### Example: Contact Form Validation

**Before:**
```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = () => {
  const newErrors: Record<string, string> = {};

  if (!formData.firstName?.trim()) {
    newErrors.firstName = 'Το όνομα είναι υποχρεωτικό';
  }
  if (!formData.lastName?.trim()) {
    newErrors.lastName = 'Το επώνυμο είναι υποχρεωτικό';
  }
  if (formData.email && !formData.email.includes('@')) {
    newErrors.email = 'Μη έγκυρο email';
  }
  if (formData.phone && formData.phone.length < 10) {
    newErrors.phone = 'Ο αριθμός πρέπει να έχει τουλάχιστον 10 ψηφία';
  }

  setErrors(newErrors);
  if (Object.keys(newErrors).length > 0) return;

  saveContact(formData);
};
```

**After:**
```typescript
import { z } from 'zod';

const contactSchema = z.object({
  firstName: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  lastName: z.string().min(1, 'Το επώνυμο είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρο email').or(z.literal('')).optional(),
  phone: z.string().min(10, 'Ο αριθμός πρέπει να έχει τουλάχιστον 10 ψηφία').optional(),
});

const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = () => {
  const result = contactSchema.safeParse(formData);

  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return;
  }

  setErrors({});
  saveContact(result.data); // Type-safe validated data
};
```

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| **React Hook Form** `setError()` | ❌ Skip — already framework-managed |
| **Cross-field validation** (password confirm) | Use Zod `.refine()` or `.superRefine()` |
| **Async validation** (check email uniqueness) | Keep async check separate, combine with Zod for sync rules |
| **Dynamic validation rules** (based on other field values) | Use Zod `.refine()` with context |
| **i18n error messages** | Pass translated strings to Zod schema |

---

## 9. Verification Criteria

- [ ] Migrated forms show same validation errors
- [ ] Required fields still block submission
- [ ] Optional fields still accept empty values
- [ ] Error messages are identical (or improved) in Greek
- [ ] TypeScript compilation passes
- [ ] `safeParse` returns type-safe data

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Manual validation files | ~6 files | 0 files |
| Zod schema adoption | Existing | +6 schemas |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation | Claude Code |
