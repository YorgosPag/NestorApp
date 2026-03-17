# ADR-ACC-021: Custom Expense/Income Categories

| Metadata | Value |
|----------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-03-17 |
| **Category** | Accounting / Chart of Accounts / Customization |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-001](./ADR-ACC-001-chart-of-accounts.md) — Chart of Accounts |
| **Depends On** | [ADR-ACC-004](./ADR-ACC-004-vat-engine.md) — VAT Engine, [ADR-ACC-010](./ADR-ACC-010-portability-abstraction-layers.md) — Portability |
| **Related** | [ADR-ACC-005](./ADR-ACC-005-ai-document-processing.md) — AI Document Processing |
| **Module** | M-002: Income/Expense Book (Extension) |

---

## 1. Context

### 1.1 Τρέχουσα Κατάσταση

Η εφαρμογή διαθέτει **25 hardcoded κατηγορίες** (6 εσόδων + 19 εξόδων) στο `config/account-categories.ts`. Κάθε κατηγορία φέρει πλήρη metadata:

- myDATA code (ΑΑΔΕ)
- E3 φορολογικός κωδικός
- ΦΠΑ rate + deductibility %
- ΚΑΔ (κωδικός δραστηριότητας)
- Icon + sortOrder

Αυτές οι 25 κατηγορίες καλύπτουν τις **τυπικές ανάγκες** ενός μηχανικού/κατασκευαστή. Ωστόσο, δεν υπάρχει μηχανισμός για:

- Εξειδικευμένες κατηγορίες ανά πελάτη/project (π.χ. "Υπεργολαβίες Σιδηρού", "Ειδικός Εξοπλισμός Εργοταξίου")
- Πιο λεπτομερή ανάλυση εξόδων (π.χ. διαχωρισμός `other_expense` σε υποκατηγορίες)
- Κατηγορίες που αφορούν ειδικούς τομείς (π.χ. "Αμοιβές Γεωτεχνικών Μελετών")

### 1.2 Πρόβλημα

Ο χρήστης αναγκάζεται να χρησιμοποιεί `other_expense` ή `other_income` για εξειδικευμένες δαπάνες/έσοδα, **χάνοντας ορατότητα** στις αναφορές. Δεν μπορεί να φιλτράρει ή να αναλύσει ανά εξειδικευμένη κατηγορία.

### 1.3 Industry Standard

| ERP | Μηχανισμός |
|-----|-----------|
| **SAP** | Z-tables per client + custom cost elements |
| **SoftOne** | Ξεχωριστός πίνακας user-defined κατηγοριών |
| **Entersoft** | Separate entity "Analysis Codes" |
| **Xero** | Custom tracking categories + chart of accounts |
| **QuickBooks** | User-created account types within standard chart |

**Κοινό pattern**: Οι custom κατηγορίες **συνυπάρχουν** με τις built-in (δεν τις αντικαθιστούν) και αντιστοιχίζονται σε standard φορολογικούς κωδικούς.

---

## 2. Υπάρχουσα Υποδομή — Reuse Analysis

### 2.1 Αρχεία που θα REUSE / EXTEND

| Αρχείο | Τι κάνει | Reuse Level |
|--------|----------|-------------|
| `config/account-categories.ts` | SSoT για 25 built-in categories + 6 lookup functions | EXTEND (add merged lookup) |
| `types/common.ts` | `IncomeCategory`, `ExpenseCategory`, `AccountCategory` types | WIDEN (accept custom codes) |
| `types/journal.ts` | `CategoryDefinition` interface, `JournalEntry` | WIDEN category field |
| `components/shared/ExpenseCategoryPicker.tsx` | Radix Select dropdown | EXTEND (add custom group) |
| `services/engines/vat-engine.ts` | `calculateInputVat(net, vat, category: ExpenseCategory)` | WIDEN parameter type |
| `services/config/vat-config.ts` | `buildDeductibilityRules()` | EXTEND for custom |
| `components/vat/VATDeductibilityTable.tsx` | Table display | EXTEND |
| `components/journal/JournalEntryForm.tsx` | `getCategoryByCode()` usage | ADAPT |
| `types/interfaces.ts` | `IAccountingRepository` | EXTEND (+5 methods) |
| `services/repository/firestore-accounting-repository.ts` | Repository CRUD | EXTEND (+5 methods) |
| `config/firestore-collections.ts` | Collection constants | ADD `ACCOUNTING_CUSTOM_CATEGORIES` |
| `services/enterprise-id.service.ts` | ID generators | ADD `custcat_` prefix |
| `components/setup/SetupPageContent.tsx` | Setup page | ADD section |

### 2.2 Gap Analysis — Τι λείπει

| Στοιχείο | Κατάσταση |
|---------|----------|
| `CustomCategoryDocument` type | ΛΕΙΠΕΙ |
| Firestore collection `accounting_custom_categories` | ΛΕΙΠΕΙ |
| Enterprise ID prefix `custcat_` | ΛΕΙΠΕΙ |
| API endpoints CRUD | ΛΕΙΠΕΙ |
| `useCustomCategories` hook | ΛΕΙΠΕΙ |
| Custom categories στο `ExpenseCategoryPicker` | ΛΕΙΠΕΙ |
| Unified category resolver (built-in + custom) | ΛΕΙΠΕΙ |
| CRUD UI στο Setup | ΛΕΙΠΕΙ |
| Referential integrity check (deletion safety) | ΛΕΙΠΕΙ |

---

## 3. Αρχιτεκτονικές Αποφάσεις (8 — ΑΠΟΦΑΣΙΣΜΕΝΑ 2026-03-17)

### Απόφαση 1: Storage Strategy → ✅ Επιλογή Α

**Ξεχωριστή Firestore collection `accounting_custom_categories/{id}`**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Ξεχωριστή collection** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — Atomic CRUD, query-ready, ίδιο pattern με invoices/entries |
| **(Β) Embedded στο CompanyProfile** | ❌ — Document size limit, no atomic update ανά item |

**Αιτιολόγηση**: Industry standard (SAP, SoftOne, Xero, Google Firestore best practices) — ξεχωριστή entity για mutable CRUD data.

---

### Απόφαση 2: Type Safety → ✅ Επιλογή Γ

**Template literal type `` `custom_${string}` ``**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Branded string** | ❌ — Overkill για category codes |
| **(Β) Simple widen** | ❌ — Χάνεις compile-time safety |
| **(Γ) Template literal** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — TypeScript native, Google/Microsoft pattern |

```typescript
type CustomCategoryCode = `custom_${string}`;
type AccountCategory = BuiltInIncomeCategory | BuiltInExpenseCategory | CustomCategoryCode;

function isCustomCategory(code: AccountCategory): code is CustomCategoryCode {
  return code.startsWith('custom_');
}
```

**Αιτιολόγηση**: *"Use the simplest type that gives you the safety you need."* — TypeScript Design Goals.

---

### Απόφαση 3: Code Generation → ✅ Επιλογή Γ

**Auto-generated immutable code από `enterprise-id.service.ts`**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Auto από label** | ❌ — Coupling identity με display name |
| **(Β) User-defined** | ❌ — Typos, duplicates, inconsistency |
| **(Γ) Enterprise ID** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — Immutable, zero duplicates, Stripe pattern |

```
Identity (immutable):  code = "custom_a3f8b2c1"   ← ΠΟΤΕ δεν αλλάζει
Display  (mutable):    label = "Υπεργολαβίες Σιδηρού" ← αλλάζει ελεύθερα
```

**Αιτιολόγηση**: *"Never couple your identity to your display name."* — Google API Design Guide.

---

### Απόφαση 4: myDATA Mapping → ✅ Επιλογή Α

**Υποχρεωτικό mapping σε existing myDATA code (νομική υποχρέωση)**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) ΥΠΟΧΡΕΩΤΙΚΟ** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — Validation κατά δημιουργία, dropdown από valid myDATA codes |
| **(Β) Προαιρετικό** | ❌ — ΑΑΔΕ απορρίπτει παραστατικά χωρίς classification |

**Αιτιολόγηση**: Νομική υποχρέωση. *"Fail fast at the boundary, never at submission."* — Google Engineering.

---

### Απόφαση 5: VAT Deductibility → ✅ Επιλογή Γ

**Inherit από myDATA code + δυνατότητα override**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) User ορίζει** | ❌ — Κίνδυνος λανθασμένου % |
| **(Β) Inherit μόνο** | ❌ — Inflexible, αδύνατα edge cases |
| **(Γ) Inherit + override** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — Smart default, respect user expertise |

```
Default: inherit vatDeductiblePercent από myDATA code
Override: λογιστής μπορεί να αλλάξει (με audit trail)
```

**Αιτιολόγηση**: SAP/Oracle/Xero pattern. *"Provide the best default, but respect user expertise."* — Google Material Design.

---

### Απόφαση 6: CRUD UI Location → ✅ Επιλογή Α

**Setup page (`/accounting/setup`) — νέα section δίπλα σε Invoice Series, Service Presets**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Setup page** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — One-time setup action, ακολουθεί υπάρχον pattern |
| **(Β) Ξεχωριστή σελίδα** | ❌ — Προάγει infrequent action σε primary navigation |

**Αιτιολόγηση**: Custom categories είναι one-time setup, όχι daily action. *"Don't promote infrequent actions to primary navigation."* — Google Material Design.

---

### Απόφαση 7: Deletion Policy → ✅ Επιλογή Γ

**Soft delete αν used + Hard delete αν unused**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Block διαγραφή** | ❌ — Bad UX, χωρίς εναλλακτική |
| **(Β) Soft delete μόνο** | ❌ — Accumulates ghost data |
| **(Γ) Soft αν used + Hard αν unused** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — SAP/Xero/QuickBooks pattern |

```
IF entries > 0 → isActive = false (soft delete, εξαφανίζεται από dropdowns)
IF entries = 0 → confirmation dialog → hard delete
```

**Αιτιολόγηση**: *"Never lose data silently. Never block users unnecessarily."* — Google SRE Book.

---

### Απόφαση 8: i18n Strategy → ✅ Επιλογή Γ

**Greek only τώρα, bilingual-ready αρχιτεκτονικά (YAGNI + Forward compatibility)**

| Επιλογή | Απόφαση |
|---------|---------|
| **(Α) Greek only** | ❌ — Παγίδα αν χρειαστεί i18n |
| **(Β) Bilingual τώρα** | ❌ — Premature complexity |
| **(Γ) Greek + bilingual-ready** | ✅ **ΕΠΙΛΕΧΘΗΚΕ** — YAGNI + Forward compatibility |

```typescript
// ΤΩΡΑ — απλό, functional:
label: string;  // "Υπεργολαβίες Σιδηρού"

// ΜΕΛΛΟΝΤΙΚΑ — additive, zero migration:
labels?: { el: string; en: string; };
```

**Αιτιολόγηση**: *"You Aren't Gonna Need It — but design so you could add it without pain."* — Google Engineering Practices.

---

## 4. Προτεινόμενο Data Model

### 4.1 CustomCategoryDocument (Firestore)

```typescript
interface CustomCategoryDocument {
  categoryId: string;              // Enterprise ID: "custcat_xxxxxxxx-xxxx-..."
  code: string;                    // "custom_ypergolabies_sidirou" (prefix: custom_)
  type: 'income' | 'expense';
  label: string;                   // "Υπεργολαβίες Σιδηρού"
  description: string;             // "Υπεργολαβίες σιδηρού για εργοτάξια"
  mydataCode: MyDataIncomeType | MyDataExpenseType;  // Must map to existing AADE code
  e3Code: string;                  // Tax declaration code
  defaultVatRate: number;          // 24, 13, 6, 0
  vatDeductible: boolean;
  vatDeductiblePercent: number;    // 0, 50, 100
  isActive: boolean;               // false = deactivated (soft delete)
  sortOrder: number;               // Starting from 100 (avoid collision with built-in 1-25)
  icon: string;                    // Lucide icon name (default: 'Tag')
  kadCode: string | null;          // Activity code (income only, usually null)
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### 4.2 Unified Flow

```
Built-in Categories (25, hardcoded)     Custom Categories (N, Firestore)
         \                                    /
          +── CategoryResolver ──────────────+
                      |
                      v
              Unified lookup
         (getCategoryByCode, getAll)
                      |
            ┌─────────┼──────────┐
            v         v          v
    ExpensePicker  VATEngine  JournalEntry
    (Radix Select) (deduct)   (submit body)
```

---

## 5. Implementation Plan (5 Φάσεις)

### Φάση 1: Types + Data Model (dependencies: none)

| Βήμα | Αρχείο | Αλλαγή |
|------|--------|--------|
| 1 | `types/common.ts` | Widen `AccountCategory` to include custom codes |
| 2 | `types/custom-category.ts` | NEW — `CustomCategoryDocument`, `CreateCustomCategoryInput`, `UpdateCustomCategoryInput` |
| 3 | `types/index.ts` | Export new types |
| 4 | `config/firestore-collections.ts` | ADD `ACCOUNTING_CUSTOM_CATEGORIES` |
| 5 | `services/enterprise-id.service.ts` | ADD `custcat_` prefix + `generateCustomCategoryId()` |

### Φάση 2: Category Resolution Service (dependencies: Phase 1)

| Βήμα | Αρχείο | Αλλαγή |
|------|--------|--------|
| 6 | `services/category-resolver.ts` | NEW — unified lookup built-in + custom |
| 7 | `config/account-categories.ts` | Widen `getCategoryByCode()` to accept `string` (for custom codes) |

### Φάση 3: Repository + API (dependencies: Phase 1, 2)

| Βήμα | Αρχείο | Αλλαγή |
|------|--------|--------|
| 8 | `types/interfaces.ts` | ADD 5 repository methods |
| 9 | `services/repository/firestore-accounting-repository.ts` | IMPLEMENT 5 methods |
| 10 | `app/api/accounting/categories/route.ts` | NEW — GET (list) + POST (create with code uniqueness) |
| 11 | `app/api/accounting/categories/[id]/route.ts` | NEW — GET + PATCH + DELETE (with referential integrity) |

### Φάση 4: VAT Engine + Journal Integration (dependencies: Phase 2, 3)

| Βήμα | Αρχείο | Αλλαγή |
|------|--------|--------|
| 12 | `services/config/vat-config.ts` | Extend deductibility rules for custom |
| 13 | `services/engines/vat-engine.ts` | Widen `category` parameter type |
| 14 | `components/journal/JournalEntryForm.tsx` | Use resolver for custom category metadata |

### Φάση 5: UI Components (dependencies: Phase 3, 4)

| Βήμα | Αρχείο | Αλλαγή |
|------|--------|--------|
| 15 | `hooks/useCustomCategories.ts` | NEW — fetch/create/update/delete hook |
| 16 | `components/shared/ExpenseCategoryPicker.tsx` | EXTEND — Radix Select Groups (built-in + custom) |
| 17 | `components/setup/CustomCategoriesSection.tsx` | NEW — CRUD UI (table + add/edit dialog) |
| 18 | `components/setup/SetupPageContent.tsx` | ADD CustomCategoriesSection |
| 19 | `components/vat/VATDeductibilityTable.tsx` | EXTEND — show custom categories |
| 20 | `i18n/locales/{el,en}/accounting.json` | ADD translation keys |

---

## 6. Edge Cases & Risks

| Edge Case | Μηχανισμός Αντιμετώπισης |
|-----------|-------------------------|
| Διαγραφή custom category με existing journal entries | Block hard delete — εμφάνιση αριθμού entries που τη χρησιμοποιούν |
| Duplicate code (ίδιο code ήδη υπάρχει) | Uniqueness check στο POST (409 Conflict) |
| Code collision με built-in | Prefix `custom_` εγγυάται zero collision |
| myDATA submission with custom category | Custom category ΠΡΕΠΕΙ να map σε valid myDATA code — enforced at creation |
| Existing journal entries μετά αλλαγή category metadata | Denormalized data σε entries — δεν αλλάζουν retroactively (snapshot pattern) |
| AI Document Processing (`categorizeExpense`) | Widen return type `ExpenseCategory | string | null` — AI μαθαίνει custom codes |
| Performance: πόσα custom categories max? | Soft limit ~50 (Firestore single query, no pagination needed) |

---

## 7. Future Extensions

| Feature | Προτεραιότητα |
|---------|-------------|
| Category groups / hierarchy (parent-child) | MEDIUM |
| Bulk import custom categories (CSV) | LOW |
| AI auto-suggest κατηγορίας βάσει ιστορικού | MEDIUM |
| Per-project categories (φιλτράρισμα ανά project) | LOW |
| Export categories σε λογιστή (PDF/Excel) | LOW |

---

## 8. Changelog

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-17 | ADR-ACC-021 Created — Custom Categories architecture, 8 ερωτήματα ανοιχτά, full implementation plan (5 φάσεις, ~20 αρχεία) | Claude Code |
| 2026-03-17 | ADR-ACC-021 ACCEPTED — Όλες οι αρχιτεκτονικές αποφάσεις κλειδώθηκαν μετά από συζήτηση με Γιώργο Παγώνη: Α1=collection, Α2=template literal, Α3=enterprise-id, Α4=mandatory myDATA, Α5=inherit+override, Α6=setup page, Α7=soft+hard delete, Α8=bilingual-ready | Γιώργος Παγώνης + Claude Code |
