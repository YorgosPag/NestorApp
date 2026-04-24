# ADR-324: Clearable `<Select>` SSoT for Form Renderers (CHECK 5B — Clearable Select)

**Status:** ✅ IMPLEMENTED — 2026-04-25
**Date:** 2026-04-25
**Category:** UI Components / SSoT Enforcement / Form UX
**Author:** Γιώργος Παγώνης + Claude Code
**Related ADRs:** ADR-001 (Radix Select canonical), ADR-294 (SSoT Ratchet), ADR-323 (Contact Update Sanitize + deleteField), ADR-322 (Contact Mappers)

---

## 1. Context

Οι χρήστες των forms (Individual / Company / Service) μπορούσαν να **επιλέξουν** μια τιμή σε dropdowns όπως `Φύλο`, `Χώρα Γέννησης`, `Τύπος Εγγράφου`, αλλά **όχι να την καθαρίσουν**. Από τη στιγμή που επέλεγαν μια τιμή, ο μόνος τρόπος να την αφαιρέσουν ήταν να επιλέξουν μια άλλη — ποτέ "καμία".

Κατά το QA session της 2026-04-25 ο Γιώργος ζήτησε: *"Βάλε Καθαρισμός επιλογής και αυτό να είναι κεντρικοποιημένος κώδικας, όχι διάσπαρτος. GOL + SSoT."*

### 1.1 Περιορισμός του Radix Select

Το Radix primitive έχει ένα runtime check: `<SelectItem value="" />` πετάει exception. Το `SelectItem` *πρέπει* να έχει non-empty value. Γι' αυτό υπάρχει ήδη το sentinel `SELECT_CLEAR_VALUE = '__clear__'` στο `config/domain-constants.ts` — αλλά η εισαγωγή του item και ο μεταφραστής `__clear__ → ''` ήταν **ευθύνη κάθε call site** (duplication waiting to happen).

### 1.2 Υπάρχοντες renderers

Τρία παράλληλα renderer αρχεία:

| File | Contract |
|------|----------|
| `src/components/generic/IndividualFormRenderer.tsx` | `IndividualFieldConfig` / `IndividualFormData` |
| `src/components/generic/GenericFormRenderer.tsx` | `FieldConfig` / `FormDataRecord` |
| `src/components/generic/ServiceFormRenderer.tsx` | `ServiceFieldConfig` / `ServiceFormData` |

Κάθε ένας είχε το δικό του `renderSelectField` με ~20 γραμμές duplication. Το να βάλουμε το "Καθαρισμός επιλογής" σε τρεις τοπικές υλοποιήσεις θα παραβίαζε κατευθείαν το SSoT pattern.

## 2. Decision

Ένα single-file helper module — **`src/components/generic/form-select-helpers.tsx`** — εκθέτει 3 primitives που κάθε renderer καλεί:

```typescript
// 1) Section renderer — inserts the clear item + separator when allowed
<ClearableSelectSection shouldAllowClear={allowClear} t={t} />

// 2) onValueChange wrapper — translates SELECT_CLEAR_VALUE → ''
onValueChange={wrapClearableSelectHandler((v) => onSelectChange(field.id, v))}

// 3) Predicate — "a field is clearable iff it is not required"
const allowClear = shouldAllowClearForField(field);
```

### 2.1 Why these three primitives

- **`shouldAllowClearForField`** centralises the business rule ("required fields cannot be cleared"). Today it's one line, but it's the place to add exceptions (e.g. "companyId is required at runtime but clearable in super-admin mode") without touching every renderer.
- **`ClearableSelectSection`** renders the sentinel item *plus* a `<SelectSeparator />` so the visual hierarchy is consistent across every dropdown in the app.
- **`wrapClearableSelectHandler`** guards the write path: if the sentinel leaked past the UI it would be persisted as `'__clear__'` — a silent data-corruption bug. The wrapper pins the translation to one place.

### 2.2 End-to-end flow (with ADR-323)

```
user picks "Καθαρισμός επιλογής"
   ↓
Radix onValueChange('__clear__')
   ↓
wrapClearableSelectHandler maps to ''
   ↓
onSelectChange(fieldId, '')
   ↓
editedData[fieldId] = ''          ← dirty-tracked diff (ADR-323 L2)
   ↓
Save → sanitizeContactForUpdate   ← partitions '' → fieldsToDelete (ADR-323 L1)
   ↓
ContactsService.updateContact     ← pairs with deleteField() sentinel
   ↓
Firestore removes the field entirely
```

Η UX promise ("Καθαρισμός επιλογής" = το πεδίο εξαφανίζεται) τηρείται end-to-end, χωρίς bloat empty-string values στο Firestore.

### 2.3 SSoT enforcement

- Νέο module `clearable-select-helpers` στο `.ssot-registry.json` (tier 3).
- `forbiddenPatterns`: `function\s+(ClearableSelectSection|shouldAllowClearForField|wrapClearableSelectHandler)\(` — κάθε μελλοντική προσπάθεια re-implementation σε άλλο file μπλοκάρεται από το CHECK 3.7 SSoT Ratchet.
- Allowlist: μόνο `src/components/generic/form-select-helpers.tsx`.
- Test files εξαιρούνται globally από το registry `exemptPatterns`.

### 2.4 Test coverage + pre-commit gate (CHECK 5B — Clearable Select)

New test file: `src/components/generic/__tests__/form-select-helpers.test.tsx` (8 tests, ~15 s):

| Group | Tests | What it locks |
|-------|-------|---------------|
| `shouldAllowClearForField` | 3 | predicate — required=true → false, otherwise true |
| `wrapClearableSelectHandler` | 3 | sentinel → ''; plain values pass through; multiple calls respected |
| `ClearableSelectSection` | 2 | `shouldAllowClear=false` renders nothing; `=true` renders the sentinel item with the localised label |

Pre-commit entry added to CHECK 5B:

```bash
run_area_tests "Clearable Select" \
    "^src/components/generic/form-select-helpers\.tsx|^src/components/generic/(Individual|Generic|Service)FormRenderer\.tsx" \
    "src/components/generic/__tests__/form-select-helpers" \
    "npm run test:clearable-select"
```

New npm script: `"test:clearable-select": "jest --testPathPatterns=src/components/generic/__tests__/form-select-helpers --verbose"`.

## 3. Implementation Checklist

- [x] New SSoT module `src/components/generic/form-select-helpers.tsx`
- [x] Uses existing `SELECT_CLEAR_VALUE` / `isSelectClearValue` from `config/domain-constants.ts`
- [x] Uses existing i18n key `common:dropdown.clearSelection` (el + en locales already present)
- [x] `IndividualFormRenderer.renderSelectField` → wire helpers
- [x] `GenericFormRenderer.renderSelectField` → wire helpers
- [x] `ServiceFormRenderer.renderSelectField` → wire helpers
- [x] Unit tests `form-select-helpers.test.tsx` (8 tests, all passing)
- [x] `test:clearable-select` npm script
- [x] Pre-commit CHECK 5B entry
- [x] SSoT registry entry `clearable-select-helpers`
- [x] ADR-324 (this file)

## 4. Consequences

### 4.1 Positive

- **Single place to change** the clear-option UX — label, separator, predicate rules.
- **No silent data corruption** from leaked sentinel values (guarded by `wrapClearableSelectHandler`).
- **End-to-end delete** works: a user clearing `birthCountry` actually sees the field disappear from Firestore (thanks to ADR-323).
- **Required fields stay required** — `firstName` / `lastName` / `companyName` keep their legacy behaviour (no clear option offered).
- **Pattern ready for other forms** — same three helpers work for any `<Select>` in the codebase that uses a `FieldConfig`-style options array.

### 4.2 Trade-offs

- `ClearableSelectSection` loads its own `common` namespace via `useTranslation` rather than accepting a `t` prop. This keeps every caller from having to remember to include `common` in its own namespace list (the first-pass API with `t` as a prop silently fell back to the raw key when the caller's `useTranslation([...])` didn't load `common`). The cost is one extra hook call per render, which is negligible.
- Adds ~15 s to pre-commit when a renderer or the helper is touched — consistent with other CHECK 5B entries.

### 4.3 Future work

- Extend `shouldAllowClearForField` with opt-out attribute `field.clearable: false` if a specific non-required field needs to preserve its value semantically (e.g. a select with a "—" option baked into the dataset).
- Migrate the 7 legacy `EnterpriseComboBox` call sites (per ADR-001) so they inherit the same clear semantics once they switch to Radix Select.

## 5. Changelog

- **2026-04-25** — Initial version. Helper + wiring in 3 renderers + 8 tests + pre-commit gate + SSoT registry entry.
