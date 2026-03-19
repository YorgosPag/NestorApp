# SPEC-251A: Error Handling Centralization → `getErrorMessage()`

> **Eliminate inline `error instanceof Error` patterns — use centralized `getErrorMessage()`**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-251 (Scattered Code Patterns Audit) |
| **Finding** | #1 — Error Handling Patterns |
| **Priority** | MEDIUM |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~1 session |
| **Dependencies** | None — `getErrorMessage()` already exists (ADR-221) |
| **Strategy** | MIGRATE-ON-TOUCH |
| **Date** | 2026-03-19 |

---

## 1. Objective

Αντικατάσταση **inline error extraction patterns** με κλήση στο κεντρικοποιημένο `getErrorMessage()` utility. Αυτό εξαλείφει boilerplate, εξασφαλίζει consistent error handling, και μειώνει τον κίνδυνο `err.message` σε non-Error objects.

---

## 2. Centralized Tool

**Location**: `src/lib/error-utils.ts` (ADR-221)

```typescript
import { getErrorMessage } from '@/lib/error-utils';
```

**Τι κάνει**: Ασφαλής extraction error message από οποιοδήποτε τύπο — `Error`, `string`, `unknown`, `AxiosError`, κλπ.

---

## 3. Current State (Scattered Pattern)

### Pattern A: Inline ternary check
```typescript
// ❌ SCATTERED
catch (err) {
  console.error('Failed:', err instanceof Error ? err.message : 'Unknown error');
}
```

### Pattern B: Direct `.message` access (unsafe)
```typescript
// ❌ SCATTERED — crashes if err is not Error
catch (err) {
  setError(err.message);
}
```

### Pattern C: String(err) fallback
```typescript
// ❌ SCATTERED
catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(msg);
}
```

---

## 4. Target State (Centralized Pattern)

```typescript
// ✅ CENTRALIZED
import { getErrorMessage } from '@/lib/error-utils';

catch (err) {
  console.error('Failed:', getErrorMessage(err));
}
```

---

## 5. Affected Areas

| Area | Pattern | Notes |
|------|---------|-------|
| `src/app/api/**` | API route catch blocks | Inline ternary or direct `.message` |
| `src/services/**` | Service methods | Error propagation |
| `src/hooks/**` | Hook error callbacks | State setters with raw error |

### Current Adoption
- **41 αρχεία** ήδη χρησιμοποιούν `getErrorMessage()` — αυτά είναι OK
- **Scattered instances**: Αρχεία με `err instanceof Error ? err.message` ή `error.message` χωρίς import `getErrorMessage`

### Πώς βρίσκεις affected files

```bash
# Files with scattered pattern (exclude already-centralized)
grep -r "instanceof Error ? .*\.message" src/ --include="*.ts" --include="*.tsx" -l | \
  xargs grep -L "getErrorMessage"

# Files with unsafe direct access
grep -r "catch.*err\|catch.*error" src/ --include="*.ts" --include="*.tsx" -l | \
  xargs grep -l "\.message" | xargs grep -L "getErrorMessage"
```

---

## 6. Implementation Steps

### Per-file migration (MIGRATE-ON-TOUCH):

1. **Βρες** catch blocks με inline error patterns
2. **Πρόσθεσε** `import { getErrorMessage } from '@/lib/error-utils';`
3. **Αντικατέστησε**:
   - `err instanceof Error ? err.message : 'Unknown error'` → `getErrorMessage(err)`
   - `error.message` (σε catch) → `getErrorMessage(error)`
   - `String(err)` → `getErrorMessage(err)`
4. **Verify** ότι ο τύπος catch variable δεν είναι explicitly typed (αν είναι `Error`, ίσως `.message` είναι safe — αλλά `getErrorMessage` λειτουργεί εξίσου)

---

## 7. Before/After Examples

### Example 1: API Route Handler

**Before:**
```typescript
export async function PATCH(req: NextRequest) {
  try {
    // ... logic
  } catch (err) {
    console.error('Update failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**After:**
```typescript
import { getErrorMessage } from '@/lib/error-utils';

export async function PATCH(req: NextRequest) {
  try {
    // ... logic
  } catch (err) {
    console.error('Update failed:', err);
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
```

### Example 2: Hook Error Callback

**Before:**
```typescript
const fetchData = async () => {
  try {
    const result = await api.get('/endpoint');
    setData(result);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Failed to fetch');
  }
};
```

**After:**
```typescript
import { getErrorMessage } from '@/lib/error-utils';

const fetchData = async () => {
  try {
    const result = await api.get('/endpoint');
    setData(result);
  } catch (error) {
    setError(getErrorMessage(error));
  }
};
```

---

## 8. Edge Cases & Exceptions

| Case | Action |
|------|--------|
| Explicitly typed `catch (err: Error)` | Still migrate — `getErrorMessage` handles all types |
| Error with custom fields (e.g., `err.code`) | Keep custom field access, only replace `.message` extraction |
| Error messages with i18n | `getErrorMessage` returns raw English — i18n wrapping is separate concern |
| Files already importing `getErrorMessage` | Skip — already centralized |

---

## 9. Verification Criteria

- [ ] Κανένα αρχείο δεν έχει `err instanceof Error ? err.message` pattern (εκτός αν δεν αγγίχτηκε)
- [ ] Κάθε migrated αρχείο κάνει `import { getErrorMessage } from '@/lib/error-utils'`
- [ ] TypeScript compilation passes χωρίς errors
- [ ] Error handling behavior δεν αλλάζει (same messages εμφανίζονται στο UI)

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| `getErrorMessage` imports | 41 files | 60+ files |
| Inline `instanceof Error` patterns | N files | 0 files (in touched files) |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation | Claude Code |
