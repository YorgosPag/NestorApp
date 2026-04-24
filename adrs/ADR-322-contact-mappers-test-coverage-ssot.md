# ADR-322: Contact Mappers — Safe Field Accessors, Unit Tests & Pre-commit Gate (CHECK 5B — Contact Mappers)

**Status:** ✅ IMPLEMENTED — 2026-04-24
**Date:** 2026-04-24
**Category:** Testing Infrastructure / SSoT Enforcement / Regression Prevention
**Author:** Γιώργος Παγώνης + Claude Code
**Related ADRs:** ADR-294 (SSoT Ratchet), ADR-298 (Firestore Rules Coverage, template), ADR-299 (Ratchet Backlog), ADR-314 (SSoT Discovery)

---

## 1. Context — Γιατί τώρα

Στις **2026-04-24** ο Γιώργος άνοιξε νέα επαφή (`firstName="Georgios"`, `lastName="Pagonis"`) και όταν μετά πάτησε **Modify**, τα inputs `Όνομα` / `Επώνυμο` εμφανίζονταν **άδεια** παρόλο που:

- Το Firestore document είχε τα πεδία σωστά (`firstName: "Georgios"`, `lastName: "Pagonis"`)
- Ο header `ContactDetailsHeader` εμφάνιζε `Georgios Pagonis` σωστά (διαβάζει απευθείας από `contact.firstName + contact.lastName`)
- Μόνο τα form inputs (που διαβάζουν από `resolvedFormData`) ήταν άδεια

### 1.1 Root cause

Στο `src/utils/contactForm/contactMapper.ts:99` υπήρχε **orphan `/**`** (μη-κλεισμένο JSDoc block):

```typescript
/**              ← line 99: opens comment, never closed
function toRecord(...) { ... }   ← inside comment — NOT parsed as code
/**              ← line 108
 * Get safe field value
 */              ← line 115: closes the comment opened on line 99
export function getSafeFieldValue(obj, field, fallback = '') {
  try {
    const record = toRecord(obj);   ← ReferenceError: toRecord is not defined
    ...
  } catch (error) {
    logger.warn(`MAPPER: Failed to extract field ${field}`);
    return fallback;                 ← silent fallback → empty string
  }
}
```

Το try/catch στο `getSafeFieldValue` *καταπίνει* το `ReferenceError` και επιστρέφει `''`. Το ίδιο συμβαίνει στο `getSafeArrayValue` και `getSafeNestedValue`. Αποτέλεσμα: **κάθε πεδίο στο form** ήταν άδειο (firstName, lastName, amka, profession, …).

Η αιτία εισαγωγής: dead-code cleanup Phase 2B (git log batch 16-19) — κάποιος αφαίρεσε το JSDoc content αλλά άφησε το `/**` χωρίς `*/`.

### 1.2 Γιατί δεν πιάστηκε

| Layer | Γιατί δεν το έπιασε |
|-------|---------------------|
| TypeScript compile | Θα έβγαζε `Cannot find name 'toRecord'`, αλλά `tsc` είναι **disabled στο pre-commit** (CLAUDE.md N.1 — slow-check policy) |
| ESLint | Δεν υπάρχει κανόνας για unclosed block comments — syntactically valid JS |
| Pre-commit hook (υπάρχοντα CHECKS) | Υπάρχει CHECK 5B "Contact Mutations" αλλά τρέχει `contact-mutation` tests, όχι mapper tests |
| Unit tests | **Δεν υπήρχαν tests** για `toRecord` / `getSafeFieldValue` / `mapIndividualContactToFormData` |
| Runtime | Το try/catch κατάπιε το σφάλμα σιωπηλά — καμία exception στον browser, μόνο warnings στο console |

Μόνο ο **τελικός χρήστης** είδε το bug (empty form fields). Google-class presubmit culture απαιτεί να πιαστεί **πριν** το commit.

## 2. Decision

Εφαρμόζουμε το **Google Presubmit Pattern** (όπως ADR-298 για Firestore rules και CLAUDE.md N.10 για AI pipeline) σε 3 layers:

### Layer 1 — Unit Tests (SSoT για contact mappers)

**Νέο αρχείο:** `src/utils/contactForm/__tests__/contactMapper.test.ts` (25 tests, 5 groups, ~6s)

Καλύπτει:

| Group | Tests | Τι κλειδώνει |
|-------|-------|-------------|
| `getSafeFieldValue` | 9 | Happy path, missing field, null, undefined, custom fallback, number/boolean preservation |
| `getSafeNestedValue` | 5 | Valid path, undefined intermediate, null leaf, null obj, deep paths |
| `getSafeArrayValue` | 5 | Valid array, missing, non-array, null obj, custom fallback |
| `mapIndividualContactToFormData` | 4 | **Regression test για το 2026-04-24 bug:** valid individual → firstName/lastName populated; fallback fields empty strings; wrong type → minimal form shell |
| `mapContactToFormData` dispatcher | 2 | Routing σε correct mapper; unknown type warning |

**Critical regression test** (lock for the actual bug):

```typescript
it('populates firstName and lastName from a valid individual contact', () => {
  const contact = makeIndividual({ firstName: 'Georgios', lastName: 'Pagonis' });
  const result = mapIndividualContactToFormData(contact);
  expect(result.firstName).toBe('Georgios');  // fails if toRecord inside comment
  expect(result.lastName).toBe('Pagonis');
});
```

Αν το `toRecord` ξαναμπεί σε comment ή αν `getSafeFieldValue` σπάσει αλλιώς, αυτό το test αποτυγχάνει σε <1s.

### Layer 2 — Pre-commit Gate (CHECK 5B — Contact Mappers)

**Αρχείο:** `scripts/git-hooks/pre-commit`

Νέο entry στο CHECK 5B (υπάρχον section "Targeted Area Tests"):

```bash
run_area_tests "Contact Mappers" \
    "^src/utils/contactForm/(contactMapper\.ts|fieldMappers/)" \
    "src/utils/contactForm/__tests__/contactMapper" \
    "npm run test:contact-mappers"
```

Trigger condition: staged file matches `src/utils/contactForm/contactMapper.ts` **ή** οποιοδήποτε `src/utils/contactForm/fieldMappers/*`.
Action: τρέχει `npm run test:contact-mappers` (~6s). Fail → commit blocked.

### Layer 3 — SSoT Registry (prevent duplication of helpers)

**Αρχείο:** `.ssot-registry.json`

Νέο module `contact-mappers` (tier 3):

```json
{
  "ssotFile": "src/utils/contactForm/contactMapper.ts",
  "description": "Safe field accessors (toRecord/getSafeFieldValue/getSafeNestedValue/getSafeArrayValue) used by all contact form mappers. ADR-322 — regression guard for 2026-04-24 unclosed-JSDoc incident.",
  "forbiddenPatterns": [
    "function\\s+(toRecord|getSafeFieldValue|getSafeNestedValue|getSafeArrayValue)\\("
  ],
  "allowlist": [
    "src/utils/contactForm/contactMapper.ts"
  ],
  "tier": 3
}
```

Σκοπός: αν μελλοντικά κάποιος ξανα-υλοποιήσει τοπικά `toRecord` ή `getSafeFieldValue` σε άλλο αρχείο, το CHECK 3.7 (SSoT Ratchet) θα μπλοκάρει το commit.

Test files exempted globally via `exemptPatterns` στο registry (`__tests__/|\.test\.|\.spec\.`).

## 3. Implementation Checklist

- [x] Fix: close orphan `/**` σε `contactMapper.ts:99`
- [x] Create `src/utils/contactForm/__tests__/contactMapper.test.ts` (25 tests)
- [x] Add `"test:contact-mappers"` npm script στο `package.json`
- [x] Add "Contact Mappers" area στο CHECK 5B του pre-commit hook
- [x] Register `contact-mappers` module στο `.ssot-registry.json`
- [x] ADR-322 (αυτό το αρχείο)
- [x] Run `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs` για να ενημερωθεί ο ADR index

## 4. Consequences

### 4.1 Positive

- **Zero-regression guarantee** για το specific 2026-04-24 bug — αν ξανα-συμβεί, commit blocked σε 6 seconds
- **SSoT protection** — τα safe accessors μπορούν να εξελιχθούν μόνο σε ένα αρχείο
- **Google-level quality** — unit-tested helpers, presubmit gate, documented ADR
- **Pattern replicability** — ίδιο pattern εφαρμόσιμο σε άλλους silent-fail mappers (company-mapper, service-mapper)

### 4.2 Trade-offs

- **Pre-commit cost:** +~6s όταν αγγίζεις `contactMapper.ts` ή `fieldMappers/**` — αμελητέο
- **Maintenance:** tests πρέπει να ενημερωθούν αν αλλάξει contract του `getSafeFieldValue` — by design (contract lock)

### 4.3 Future work

- Επέκταση coverage σε `companyMapper.ts` + `serviceMapper.ts` (ίδιο pattern, ~20 tests έκαστο)
- Προσθήκη ESLint custom rule `no-unclosed-jsdoc` για catch at lint-time (Layer 0, πιο γρήγορα)
- Migration σε `packemon`/build-time check που να κάνει `tsc --noEmit` incrementally στα changed files (<2s)

## 5. Changelog

- **2026-04-24** — Initial version. Incident + fix + 3-layer guard + ADR.
- **2026-04-25** — Follow-up ADR-323 landed (Contact Update Sanitize SSoT + Dirty-Diff Writes). ADR-322 addressed the READ side (`mapContactToFormData` returning empty); ADR-323 addresses the WRITE side (`updateContact` bloating with empty defaults) discovered during the same QA session.
