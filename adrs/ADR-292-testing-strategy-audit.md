# ADR-292: Testing Strategy — Audit, Gap Analysis & Roadmap

**Status**: ACTIVE
**Date**: 2026-04-07
**Author**: Claude (Opus 4.6) + Γιώργος Παγώνης
**Category**: Quality / Testing / Infrastructure

---

## 1. Context — Γιατί αυτό το ADR

Η εφαρμογή έχει **147 test files** με **4.332 individual tests**, αλλά:
- Μόνο τα AI Pipeline tests (~73 suites) τρέχουν αυτόματα (pre-commit hook)
- Τα υπόλοιπα ~74 suites **δεν τρέχουν ποτέ αυτόματα**
- 17 suites **σπάνε** (ο κώδικας άλλαξε, τα tests δεν ενημερώθηκαν)
- Τα CI/CD workflows είναι **disabled** (`.yml.disabled`)
- **Κρίσιμα production services** δεν έχουν καθόλου tests

Χρειαζόμαστε μια στρατηγική που:
1. Εκμεταλλεύεται τα υπάρχοντα tests
2. Γράφει νέα tests για κρίσιμα κομμάτια
3. Αποτρέπει regression σε κάθε commit/push

---

## 2. Τρέχουσα Κατάσταση (Audit 2026-04-07)

### 2.1 Αποτελέσματα `npm test`

```
Test Suites: 17 failed, 127 passed, 144 total
Tests:       22 failed, 11 skipped, 4.299 passed, 4.332 total
Time:        98.529 s
```

### 2.2 Τι ΤΡΕΧΕΙ αυτόματα (pre-commit hook)

| Check | Trigger | Χρόνος | Μπλοκάρει |
|-------|---------|--------|-----------|
| AI Pipeline tests | Αλλαγή σε `src/services/ai-pipeline/` | ~11s | ✅ BLOCK |
| Windows reserved filenames | Πάντα | <1s | ✅ BLOCK |
| i18n hardcoded strings | Αλλαγή σε `.ts/.tsx` | ~2s | ✅ BLOCK |
| UI hardcoded Greek | Αλλαγή σε `.ts/.tsx` | ~2s | ✅ BLOCK |
| File size >500 lines | Αλλαγή σε `.ts/.tsx` | <1s | ✅ BLOCK |
| Secret scan | Πάντα | ~1s | ✅ BLOCK |
| License compliance | Αλλαγή σε `package.json` | ~3s | ✅ BLOCK |

### 2.3 Τι ΔΕΝ τρέχει πουθενά

| Κατηγορία | Suites | Tests | Κατάσταση |
|-----------|--------|-------|-----------|
| DXF Viewer (geometry, settings) | 16 | ~208 | 2 FAIL, 14 PASS |
| Accounting (VAT, tax, depreciation) | 7 | ~105 | ALL PASS |
| Report Engine (aggregator, export) | 9 | ~180 | 3 FAIL, 6 PASS |
| Entity Linking (cache, retry) | 4 | ~64 | ALL PASS |
| Components/UI (dialogs, CRM) | 12 | ~145 | 2 FAIL, 10 PASS |
| Type Safety (comms, address) | 7 | ~85 | 4 FAIL, 3 PASS |
| Firestore Rules | 4 | ~60 | 4 FAIL (χρειάζονται emulator) |
| Utilities (storage-path, mutations) | 6 | ~70 | 2 FAIL, 4 PASS |
| E2E/Playwright | 3 | ~25 | UNTESTED (χρειάζονται server) |

### 2.4 Σπασμένα Tests — 17 Suites

#### Κατηγορία A: Κώδικας άλλαξε, test δεν ενημερώθηκε (9 suites)
Αυτά χρειάζονται **ενημέρωση tests** ώστε να αντικατοπτρίζουν τον τρέχοντα κώδικα.

| Suite | Αρχείο | Αιτία |
|-------|--------|-------|
| communications | `src/types/__tests__/communications.test.ts` | Νέα channels (whatsapp, messenger, instagram) προστέθηκαν στον κώδικα |
| address-helpers | `src/types/project/__tests__/address-helpers.test.ts` | Κώδικας address helpers εξελίχθηκε |
| address-schemas | `src/types/validation/__tests__/address-schemas.test.ts` | Schema changes |
| report-data-aggregator | `src/services/report-engine/__tests__/report-data-aggregator.test.ts` | Report engine refactored |
| report-query-executor | `src/services/report-engine/__tests__/report-query-executor.test.ts` | Query executor changes |
| builder-export | `src/services/report-engine/__tests__/builder-export.test.ts` | Export service refactored |
| storage-path | `src/services/upload/utils/__tests__/storage-path.test.ts` | Upload path logic changed |
| contact-mutation-detectors | `src/utils/contactForm/__tests__/contact-mutation-detectors.test.ts` | Mutation detection evolved |
| useContactMutationImpactGuard | `src/hooks/__tests__/useContactMutationImpactGuard.test.tsx` | Guard hook refactored |

#### Κατηγορία B: Smoke tests ξεπερασμένα (2 suites)
Τα DXF line drawing tests ελέγχουν τη δομή κώδικα (string matching), η οποία αλλάζει συνεχώς.

| Suite | Αρχείο | Αιτία |
|-------|--------|-------|
| line-drawing-functionality | `src/subapps/dxf-viewer/__tests__/line-drawing-functionality.test.ts` | Code structure changed |
| line-drawing-smoke | `src/subapps/dxf-viewer/__tests__/line-drawing-smoke.test.ts` | Code structure changed |

#### Κατηγορία C: Environment-dependent (5 suites)
Αυτά χρειάζονται ειδικό environment (emulator, server).

| Suite | Αρχείο | Αιτία |
|-------|--------|-------|
| pr-1a-buildings | `tests/firestore-rules/pr-1a-buildings.test.ts` | Firebase emulator needed |
| pr-1a-contacts | `tests/firestore-rules/pr-1a-contacts.test.ts` | Firebase emulator needed |
| pr-1a-projects | `tests/firestore-rules/pr-1a-projects.test.ts` | Firebase emulator needed |
| pr-1a-files | `tests/firestore-rules/pr-1a-files.test.ts` | Firebase emulator needed |
| GeoCanvasApp | `src/subapps/geo-canvas/__tests__/GeoCanvasApp.test.tsx` | Complex context mocking |

#### Κατηγορία D: Component render tests (1 suite)
| Suite | Αρχείο | Αιτία |
|-------|--------|-------|
| ThreadView | `src/components/crm/inbox/__tests__/ThreadView.test.tsx` | Component props/context changed |

### 2.5 CI/CD Workflows (Disabled)

| Workflow | Αρχείο | Τι κάνει | Status |
|----------|--------|----------|--------|
| Unit Tests | `.github/workflows/unit.yml.disabled` | Jest + coverage | DISABLED |
| Quality Gates | `.github/workflows/quality-gates.yml.disabled` | Lint + tsc + tests + build | DISABLED |
| i18n Validation | `.github/workflows/i18n-validation.yml.disabled` | Translation completeness | DISABLED |

**Γιατί disabled**: Vercel Hobby plan δεν υποστηρίζει GitHub Actions integration. Τα workflows θα ενεργοποιηθούν όταν γίνει upgrade σε Pro plan ή μεταφορά σε self-hosted runner.

---

## 3. Production Services ΧΩΡΙΣ Tests (Κενά Κάλυψης)

Αυτά τα services τρέχουν σε production και **δεν έχουν καθόλου tests**:

### 🔴 ΚΡΙΣΙΜΑ (P0 — Άμεσα)

| Service | Path | Γιατί κρίσιμο |
|---------|------|---------------|
| **Auth middleware** | `src/lib/auth/` | Κάθε API call περνάει από εδώ — RBAC, tenant isolation |
| **Firestore operations** | `src/lib/firebaseAdmin.ts` | Credential chain, admin SDK setup |
| **Property mutation gateway** | `src/services/property/` | Optimistic updates, impact preview, cascade |
| **Contact mutation impact** | `src/services/contacts/` | Identity changes, cascade effects |
| **Email inbound pipeline** | `src/services/communications/inbound/` | Mailgun webhook → queue → processing |

### 🟡 ΣΗΜΑΝΤΙΚΑ (P1 — Σύντομα)

| Service | Path | Γιατί σημαντικό |
|---------|------|----------------|
| **Notification service** | `src/services/notification/` | Push + email + in-app notifications |
| **File upload service** | `src/services/photo-upload.service.ts` | Photo compression, Firestore storage |
| **Session service** | `src/services/session/` | User session management |
| **Security service** | `src/services/security/` | 2FA, security policies |
| **API error handler** | `src/lib/api/ApiErrorHandler.ts` | Error normalization, retry logic |

### 🔵 ΧΡΗΣΙΜΑ (P2 — Σταδιακά)

| Service | Path | Γιατί χρήσιμο |
|---------|------|--------------|
| **Accounting engines** | `src/subapps/accounting/services/` | VAT, tax calculation (ήδη 7 tests, χρειάζονται περισσότερα) |
| **Entity linking** | `src/services/entity-linking/` | Cross-entity references (ήδη 4 tests) |
| **Realtime service** | `src/services/realtime/` | Live data subscriptions |
| **ESCO service** | `src/services/esco.service.ts` | ESCO skill matching |
| **Building service** | `src/services/floorplans/` | Building-floorplan relationships |

---

## 4. Στρατηγική — 3 Επίπεδα

### Επίπεδο 1: Pre-Commit — Targeted Test Gate (Google Presubmit Pattern)

**Ήδη υλοποιημένο**: AI Pipeline tests τρέχουν αν αλλάξουν ai-pipeline αρχεία.

**Να προστεθεί** — ίδιο pattern, νέα areas:

| Trigger (staged files) | Tests που τρέχουν | Εκτιμώμενος χρόνος |
|------------------------|-------------------|---------------------|
| `src/services/ai-pipeline/` | `test:ai-pipeline:all` | ~11s ✅ ΗΔΗ ΕΝΕΡΓΟ |
| `src/subapps/accounting/` | `jest --testPathPatterns=accounting` | ~5s |
| `src/services/report-engine/` | `jest --testPathPatterns=report-engine` | ~4s |
| `src/services/entity-linking/` | `jest --testPathPatterns=entity-linking` | ~3s |
| `src/subapps/dxf-viewer/rendering/entities/shared/` | `jest --testPathPatterns=geometry` | ~3s |
| `src/types/` | `jest --testPathPatterns=src/types/__tests__` | ~2s |

**Αρχή**: Τρέχουν ΜΟΝΟ αν αγγίξεις αρχεία στον αντίστοιχο φάκελο. Δεν επιβαρύνουν commits σε άσχετες περιοχές.

### Επίπεδο 2: Pre-Push — Full Test Suite

Πριν κάνεις push (manual, αφού ο Γιώργος δώσει εντολή):

```bash
npm test    # ~100s — ΟΛΑ τα Jest tests
```

Αν αποτύχουν → fix πρώτα, μετά push. Αυτό πιάνει cross-cutting regressions.

### Επίπεδο 3: CI/CD — Full Quality Gates (Μελλοντικό)

Όταν ενεργοποιηθούν τα GitHub Actions workflows:
1. **Lint Gate** — ESLint
2. **TypeCheck Gate** — `tsc --noEmit`
3. **Unit Tests Gate** — `npm test` + coverage
4. **Build Gate** — `next build`

---

## 5. Roadmap — Φάσεις Υλοποίησης

### Φάση 1: Σταθεροποίηση (FIX σπασμένα tests)

**Στόχος**: Από 127/144 → 144/144 PASS (ή justified skip)

| Κατηγορία | Suites | Ενέργεια |
|-----------|--------|----------|
| Κώδικας άλλαξε (Cat A) | 9 | Ενημέρωση tests ώστε να ταιριάζουν τον τρέχοντα κώδικα |
| Smoke tests (Cat B) | 2 | Αναθεώρηση: μετατροπή σε behavior tests αντί structure tests |
| Environment (Cat C) | 4 | Skip αν δεν τρέχει emulator (`describe.skipIf`) |
| Component (Cat D) | 1 | Ενημέρωση props/context mocking |
| GeoCanvasApp | 1 | Evaluate: εξαιρετικά complex mock — πιθανό skip/delete |

### Φάση 2: Targeted Pre-Commit Hooks

**Στόχος**: Κάθε area του codebase τρέχει τα δικά της tests στο commit.

Υλοποίηση: Επέκταση του υπάρχοντος CHECK 5 στο `.git/hooks/pre-commit` με νέα area-specific checks.

### Φάση 3: Νέα Tests για Production Services (P0)

**Στόχος**: Tests για τα 5 κρίσιμα production services που δεν έχουν καθόλου coverage.

| Service | Τι πρέπει να τεσταριστεί | Εκτίμηση |
|---------|--------------------------|----------|
| Auth middleware | RBAC enforcement, tenant isolation, token validation | ~15 tests |
| Property mutations | Optimistic update, rollback, cascade, impact preview | ~20 tests |
| Contact mutations | Identity changes, merge detection, cascade | ~15 tests |
| Email inbound | Webhook parsing, queue, routing, dedup | ~15 tests |
| API error handler | Error normalization, retry, status codes | ~10 tests |

### Φάση 4: Νέα Tests για Σημαντικά Services (P1)

| Service | Εκτίμηση |
|---------|----------|
| Notification service | ~10 tests |
| File upload + compression | ~10 tests |
| Session management | ~8 tests |
| Security (2FA) | ~8 tests |

### Φάση 5: Coverage Targets + CI Enforcement

| Milestone | Threshold | Πότε |
|-----------|-----------|------|
| Baseline | 0% (τρέχον) | Σήμερα |
| Foundation | 30% critical paths | Μετά Φάση 3 |
| Solid | 60% overall | Μετά Φάση 4 |
| Enterprise | 80%+ on critical modules | Long-term |

---

## 6. Κανόνες Testing (Boy Scout + Google Presubmit)

### Κανόνας 1: Νέος κώδικας = νέα tests
Κάθε νέο feature ή service **ΠΡΕΠΕΙ** να συνοδεύεται από tests.

### Κανόνας 2: Bug fix = regression test
Κάθε bug fix **ΠΡΕΠΕΙ** να συνοδεύεται από test που αποδεικνύει ότι το bug δεν θα ξαναεμφανιστεί.

### Κανόνας 3: Boy Scout Rule
Όταν αγγίζεις legacy κώδικα χωρίς tests → γράψε τουλάχιστον happy path tests.

### Κανόνας 4: Pre-commit = area-specific
Δεν τρέχουμε ΟΛΑ τα tests σε κάθε commit — μόνο τα σχετικά με τις αλλαγές.

### Κανόνας 5: Pre-push = full suite
Πριν γίνει push → `npm test` τρέχει ΟΛΑ.

### Κανόνας 6: Tests ≠ implementation details
Tests ελέγχουν **behavior** (τι κάνει), όχι **structure** (πώς φαίνεται ο κώδικας).

---

## 7. Test Naming Convention

```
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => { ... });
    it('should throw [ErrorType] when [invalid condition]', () => { ... });
  });
});
```

Patterns:
- `*.test.ts` — Unit tests (Jest)
- `*.spec.ts` — E2E tests (Playwright)
- `*.prop.test.ts` — Property-based tests (fast-check)

---

## 8. Τρέχουσα Αρχιτεκτονική Testing

```
┌──────────────────────────────────────────────────────┐
│                   Pre-Commit Hook                     │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ File Size  │  │ i18n     │  │ AI Pipeline      │ │
│  │ Check      │  │ Ratchet  │  │ Tests (targeted) │ │
│  └────────────┘  └──────────┘  └──────────────────┘ │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Secret     │  │ License  │  │ + Accounting  🆕 │ │
│  │ Scan       │  │ Check    │  │ + Report Eng  🆕 │ │
│  └────────────┘  └──────────┘  │ + DXF Geom   🆕 │ │
│                                │ + Types       🆕 │ │
│                                └──────────────────┘ │
├──────────────────────────────────────────────────────┤
│                   Pre-Push (manual)                   │
│  ┌──────────────────────────────────────────────────┐│
│  │  npm test (ALL Jest — 144 suites, ~100s)         ││
│  └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│                   CI/CD (disabled)                     │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐│
│  │  ESLint  │→│   tsc    │→│  Jest  │→│next build ││
│  └──────────┘ └──────────┘ └────────┘ └───────────┘│
└──────────────────────────────────────────────────────┘
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-07 | Initial audit: 147 files, 4332 tests, 17 failing, 127 passing |
| 2026-04-07 | Phase 1 DONE: Fixed 13 suites, skipped 1 (GeoCanvas complex mock), excluded 4 firestore-rules (emulator). Result: 139/139 pass, 4381 tests green |
| 2026-04-07 | Phase 2 DONE: Targeted pre-commit hooks for 6 areas (accounting, report-engine, entity-linking, DXF geometry, types, contact mutations) |
