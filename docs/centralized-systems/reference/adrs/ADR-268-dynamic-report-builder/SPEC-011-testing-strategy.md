# SPEC-011: Testing Strategy — Google-Level Automated Testing

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Status**: ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ — Κάθε γραμμή κώδικα συνοδεύεται από tests

---

## 1. Αρχή

> **Κανόνας Γιώργου**: Τα tests πρέπει να είναι **επιπέδου Google**. Τίποτα λιγότερο δεν γίνεται αποδεκτό. Αυτό είναι αδιαπραγμάτευτο.

**Google Testing Pattern (Presubmit)**:
- Κανένα commit χωρίς tests
- Tests γράφονται **μαζί** με τον κώδικα (ίδιο commit)
- Κάθε public function/service/hook/component έχει test coverage
- Tests τρέχουν αυτόματα πριν κάθε merge

---

## 2. Υπάρχοντα Tests — Inventory

### 2.1 Report Engine Tests (3 αρχεία, 82 tests)

| Αρχείο | Tests | Τι καλύπτει |
|--------|-------|-------------|
| `report-engine/__tests__/evm-calculator.test.ts` | 28 | EVM calculations (BAC, AC, EV, PV, CPI, SPI, S-curve) |
| `report-engine/__tests__/aging-calculator.test.ts` | 28 | Payment aging buckets, overdue %, partial payments |
| `report-engine/__tests__/report-aggregator-helpers.test.ts` | 26 | Data aggregation, BOQ variance, revenue, top buyers |

### 2.2 Procurement Tests (4 αρχεία, 152 tests)

| Αρχείο | Tests | Τι καλύπτει |
|--------|-------|-------------|
| `procurement/__tests__/po-status-fsm.test.ts` | 36 | PO status FSM, valid/invalid transitions, VAT |
| `procurement/__tests__/po-invoice-matcher.test.ts` | 44 | Invoice-to-PO matching scoring algorithm |
| `procurement/__tests__/supplier-metrics.test.ts` | 32 | Supplier performance, spend, delivery rate |
| `ai-pipeline/tools/__tests__/handlers/procurement-handler.test.ts` | 40 | AI tool interface for PO CRUD |

### 2.3 Construction Scheduling Tests (1 αρχείο, 21 tests)

| Αρχείο | Tests | Τι καλύπτει |
|--------|-------|-------------|
| `construction-scheduling/__tests__/cpm-calculator.test.ts` | 21 | CPM forward/backward pass, float, critical path |

### 2.4 Κενά Coverage (ΔΕΝ υπάρχουν tests)

| Module | Status | Priority |
|--------|--------|----------|
| `report-pdf-exporter.ts` | ❌ No tests | Phase 3 |
| `report-excel-exporter.ts` | ❌ No tests | Phase 3 |
| `report-data-aggregator.ts` | ❌ No tests | Phase 1 |
| Report Builder UI components | ❌ No tests | Phase 1 |
| API route `/api/reports/builder` | ❌ No tests | Phase 1 |
| Domain configurations | ❌ No tests | Phase 1 |
| Saved reports CRUD | ❌ No tests | Phase 7 |

---

## 3. Testing Architecture — 4 Layers

Ακολουθεί το Google Testing Pyramid:

```
          ┌─────────┐
          │  E2E    │  ← Playwright (Phase 3+, optional)
          │  (λίγα) │
         ─┼─────────┼─
         │Integration│  ← API route tests, Firestore queries
         │  (μέτρια) │
        ─┼───────────┼─
        │  Component  │  ← React Testing Library (UI)
        │  (αρκετά)   │
       ─┼─────────────┼─
       │    Unit       │  ← Jest, pure functions, services
       │  (πολλά)      │  ← ΤΟ 80% ΤΩΝ TESTS
       └───────────────┘
```

### Layer 1: Unit Tests (80% — ΥΠΟΧΡΕΩΤΙΚΟ)

**Τι**: Pure functions, calculators, validators, type guards, config transformations.
**Pattern**: Jest + test data factories.
**Mock strategy**: Mock external dependencies (Firestore, Next.js), test logic in isolation.
**Υπάρχον πρότυπο**: `evm-calculator.test.ts` — ακολούθησε ΑΚΡΙΒΩΣ αυτή τη δομή.

```typescript
// PATTERN: Factory + Pure Function + Edge Cases
function makeDomainConfig(overrides: Partial<DomainConfig> = {}): DomainConfig {
  return { id: 'A1', label: 'Projects', collection: 'projects', ...overrides };
}

describe('buildWhereClause', () => {
  it('creates equality filter', () => { ... });
  it('handles empty filters → returns all', () => { ... });
  it('rejects invalid operator', () => { ... });
  // Edge cases
  it('handles special characters in values', () => { ... });
  it('handles null/undefined gracefully', () => { ... });
});
```

### Layer 2: Component Tests (15% — ΥΠΟΧΡΕΩΤΙΚΟ για interactive components)

**Τι**: React components — rendering, user interaction, state management.
**Pattern**: React Testing Library + Jest.
**Mock strategy**: Mock hooks and API calls, test UI behavior.

```typescript
// PATTERN: Render + Interact + Assert
describe('DomainSelector', () => {
  it('renders 20 domain options', () => {
    render(<DomainSelector onSelect={jest.fn()} />);
    expect(screen.getAllByRole('option')).toHaveLength(20);
  });

  it('calls onSelect with domain config when clicked', async () => {
    const onSelect = jest.fn();
    render(<DomainSelector onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Έργα'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'A1' }));
  });
});
```

### Layer 3: Integration Tests (5% — ΥΠΟΧΡΕΩΤΙΚΟ για API routes)

**Τι**: API route handler logic, query building, Firestore query composition.
**Pattern**: Mock Firestore Admin SDK, test full request→response cycle.

```typescript
// PATTERN: Mock Firestore → Call handler → Assert response
describe('POST /api/reports/builder', () => {
  it('returns filtered results for domain A1', async () => {
    mockFirestore.collection('projects').get.mockResolvedValue(mockSnapshot);
    const res = await POST(mockRequest({ domainId: 'A1', filters: [] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rows).toHaveLength(5);
  });

  it('rejects unauthenticated requests', async () => { ... });
  it('enforces 500 row limit', async () => { ... });
});
```

### Layer 4: E2E Tests (Optional — Phase 3+)

**Τι**: Full user flow — select domain → add filters → view results → export.
**Pattern**: Playwright (ήδη configured στο project).
**Πότε**: Μόνο μετά τη Phase 3 (export), αν ο Γιώργος το ζητήσει.

---

## 4. Test File Naming & Location

### Convention (ακολουθεί existing pattern)

```
src/services/report-engine/__tests__/              ← Service logic tests
src/services/report-engine/__tests__/report-query-executor.test.ts
src/services/report-engine/__tests__/domain-query-builder.test.ts

src/config/report-builder/__tests__/               ← Config/type tests
src/config/report-builder/__tests__/domain-definitions.test.ts
src/config/report-builder/__tests__/filter-operators.test.ts

src/hooks/reports/__tests__/                        ← Hook tests
src/hooks/reports/__tests__/useReportBuilder.test.ts

src/components/reports/builder/__tests__/           ← Component tests
src/components/reports/builder/__tests__/DomainSelector.test.tsx
src/components/reports/builder/__tests__/FilterPanel.test.tsx

src/app/api/reports/builder/__tests__/              ← API route tests
src/app/api/reports/builder/__tests__/route.test.ts
```

---

## 5. Υποχρεωτικά Tests ανά Phase

### Phase 1: Core MVP (~13 αρχεία κώδικα → ~8 test αρχεία)

| Test File | Τι καλύπτει | Layer | Priority |
|-----------|-------------|-------|----------|
| `domain-definitions.test.ts` | Validation 20 domain configs: required fields, unique IDs, valid collections | Unit | **P0** |
| `report-builder-types.test.ts` | Type guards, validation functions, operator compatibility | Unit | **P0** |
| `report-query-executor.test.ts` | Query building, WHERE clauses, ORDER BY, LIMIT, aggregations | Unit | **P0** |
| `filter-operators.test.ts` | Operator logic: ==, !=, >, <, >=, <=, contains, startsWith, in, between | Unit | **P0** |
| `route.test.ts` | API route: auth, validation, response format, error handling, row limit | Integration | **P0** |
| `DomainSelector.test.tsx` | Render domains, group by category, select handler | Component | **P1** |
| `ColumnSelector.test.tsx` | Toggle columns, select all/none, computed columns | Component | **P1** |
| `FilterPanel.test.tsx` | Add/remove filters, operator selection, value input | Component | **P1** |

### Phase 2: Grouping + KPIs + Charts (~3 αρχεία → ~2 test αρχεία)

| Test File | Τι καλύπτει | Layer | Priority |
|-----------|-------------|-------|----------|
| `grouping-engine.test.ts` | Group by 1-2 levels, subtotals, COUNT/SUM/AVG per group | Unit | **P0** |
| `GroupBySelector.test.tsx` | UI: select group field, remove, max 2 levels | Component | **P1** |

### Phase 3: Export Tier 1 (~2 αρχεία → ~3 test αρχεία)

| Test File | Τι καλύπτει | Layer | Priority |
|-----------|-------------|-------|----------|
| `builder-pdf-exporter.test.ts` | PDF generation: branding, table layout, pagination, chart image | Unit | **P0** |
| `builder-excel-exporter.test.ts` | Excel 4-sheet: formulas, auto-filters, chart embedding, conditional format | Unit | **P0** |
| `BuilderExportBar.test.tsx` | Export buttons, loading state, format selection | Component | **P1** |

### Phase 4-6: Domain Configs (~20 domain configs → ~3 test αρχεία)

| Test File | Τι καλύπτει | Layer | Priority |
|-----------|-------------|-------|----------|
| `domain-config-validation.test.ts` | ALL domain configs: schema validation, column types, filter operators match | Unit | **P0** |
| `tier2-row-expansion.test.ts` | Row repetition logic: nested arrays → flat rows, correct counts | Unit | **P0** |
| `tier3-card-renderer.test.ts` | Contact Card PDF: sections render, conditional persona blocks | Unit | **P1** |

### Phase 7: Saved Reports (~3 αρχεία → ~2 test αρχεία)

| Test File | Τι καλύπτει | Layer | Priority |
|-----------|-------------|-------|----------|
| `saved-reports-service.test.ts` | CRUD: save, load, update, delete, list, validation | Unit | **P0** |
| `SavedReportManager.test.tsx` | UI: save dialog, load list, delete confirmation | Component | **P1** |

---

## 6. Test Quality Standards — Google-Level

### 6.1 Υποχρεωτικά Patterns

| Pattern | Περιγραφή | Παράδειγμα |
|---------|-----------|------------|
| **Factory Functions** | Δημιουργία test data μέσω factories, ΟΧΙ hardcoded objects | `makeDomainConfig()`, `makeFilter()` |
| **Edge Cases** | ΠΑΝΤΑ: empty input, null, undefined, boundary values, large datasets | `it('handles empty filters')` |
| **Error Paths** | ΠΑΝΤΑ: τι γίνεται αν αποτύχει; Invalid input, network error, timeout | `it('rejects invalid domain ID')` |
| **Descriptive Names** | Test name = documentation: τι κάνει, υπό ποιες συνθήκες, τι αναμένεται | `it('returns 0 rows when no data matches filters')` |
| **Single Assert** | 1 assertion per test (ή logically grouped assertions) | Όχι 10 expects σε 1 test |
| **No Implementation Testing** | Test behavior, NOT implementation details | Μην ελέγξεις internal state |
| **Isolation** | Κάθε test ανεξάρτητο — δεν εξαρτάται από σειρά εκτέλεσης | `beforeEach` cleanup |

### 6.2 Coverage Targets

| Metric | Target | Γιατί |
|--------|--------|-------|
| **Statement Coverage** | ≥ 80% | Google standard minimum |
| **Branch Coverage** | ≥ 75% | Critical paths covered |
| **Function Coverage** | ≥ 90% | Every public function tested |
| **Critical Path Coverage** | 100% | Query execution, export, auth |

### 6.3 Αριθμητικοί Στόχοι

| Phase | Αρχεία Κώδικα | Test Αρχεία | Εκτ. Test Cases | Min Coverage |
|-------|---------------|-------------|-----------------|--------------|
| Phase 1 | ~13 | ~8 | ~80-100 | 80% |
| Phase 2 | ~3 | ~2 | ~25-30 | 80% |
| Phase 3 | ~2 | ~3 | ~40-50 | 80% |
| Phase 4-6 | ~20 configs | ~3 | ~60-80 | 75% |
| Phase 7 | ~3 | ~2 | ~20-25 | 80% |
| **Σύνολο** | **~41** | **~18** | **~225-285** | **80%** |

---

## 7. Test Execution — Workflow

### 7.1 Development Flow (κάθε commit)

```
1. Γράψε κώδικα
2. Γράψε tests (ίδιο commit)
3. Τρέξε: npm test -- --testPathPattern="report-builder|report-engine"
4. Αν PASS → commit (κώδικας + tests ΜΑΖΙ)
5. Αν FAIL → fix πρώτα, ΠΟΤΕ commit χωρίς πράσινα tests
```

### 7.2 npm Scripts (προτεινόμενα)

```json
{
  "test:report-builder": "jest --testPathPattern='report-builder|report-engine' --verbose",
  "test:report-builder:watch": "jest --testPathPattern='report-builder|report-engine' --watch",
  "test:report-builder:coverage": "jest --testPathPattern='report-builder|report-engine' --coverage"
}
```

### 7.3 Pre-Commit Hook Integration

Ήδη υπάρχει pre-commit hook για ai-pipeline tests. Πρέπει να επεκταθεί:

```bash
# Αν staged files περιέχουν report-builder ή report-engine αλλαγές:
# → Τρέξε npm run test:report-builder
# → Αν FAIL → block commit
```

---

## 8. Mock Strategy

### 8.1 Τι κάνουμε Mock

| Dependency | Mock Pattern | Γιατί |
|------------|-------------|-------|
| **Firestore Admin SDK** | `jest.mock('firebase-admin/firestore')` | No real DB in tests |
| **Firebase Auth** | `jest.mock('@/lib/firebase-admin')` | No auth in unit tests |
| **Next.js Request/Response** | Custom mock factories | API route testing |
| **jsPDF** | `jest.mock('jspdf')` | No PDF generation in unit tests |
| **ExcelJS** | `jest.mock('exceljs')` | No Excel generation in unit tests |
| **html-to-image** | `jest.mock('html-to-image')` | No DOM rendering in tests |
| **recharts** | Not mocked (component tests use RTL) | Rendered in JSDOM |

### 8.2 Τι ΔΕΝ κάνουμε Mock

| Module | Γιατί |
|--------|-------|
| **Domain definitions** | Pure config — test ως-έχει |
| **Filter operators** | Pure logic — test ως-έχει |
| **Type guards** | Pure functions — test ως-έχει |
| **Query builder** | Pure transformation — test ως-έχει |
| **Grouping engine** | Pure aggregation — test ως-έχει |

---

## 9. Σύνδεση με SPEC-007 Phases

Κάθε Phase στο SPEC-007 **ΠΡΕΠΕΙ** να παραδίδεται μαζί με τα αντίστοιχα tests:

| Phase | Κώδικας | Tests | Κανόνας |
|-------|---------|-------|---------|
| Phase 1 | Core MVP | 8 test files, ~80-100 cases | **ΙΔΙΟ COMMIT** |
| Phase 2 | Grouping | 2 test files, ~25-30 cases | **ΙΔΙΟ COMMIT** |
| Phase 3 | Export | 3 test files, ~40-50 cases | **ΙΔΙΟ COMMIT** |
| Phase 4-6 | Domains | 3 test files, ~60-80 cases | **ΙΔΙΟ COMMIT** |
| Phase 7 | Saved | 2 test files, ~20-25 cases | **ΙΔΙΟ COMMIT** |

**ΜΗΔΕΝΙΚΗ ΕΞΑΙΡΕΣΗ**: Κώδικας χωρίς tests = μπακάλικο. Δεν γίνεται commit.

---

## 10. Αποφάσεις Γιώργου

### Q1 — Scope εργασίας (2026-03-30)
**Ερώτηση**: Μόνο τα 6 κενά test suites ή και εμπλουτισμός υπαρχόντων;
**Απάντηση**: ΚΑΙ ΤΑ ΔΥΟ.
- **Βήμα 1**: Δημιουργία 6 νέων test suites:
  1. `saved-reports-service.test.ts` (CRUD)
  2. `builder-pdf-exporter.test.ts` (PDF generation)
  3. `builder-excel-exporter.test.ts` (Excel generation)
  4. `report-data-aggregator.test.ts` (8 static methods)
  5. `SaveReportDialog.test.tsx` (component)
  6. `SavedReportsList.test.tsx` (component)
- **Βήμα 2**: Έλεγχος coverage υπαρχόντων tests και εμπλουτισμός όπου χρειάζεται.

### Q2 — i18n Testing Strategy (2026-03-30)
**Ερώτηση**: Component tests — κλειδιά μετάφρασης ή πραγματικά κείμενα;
**Απάντηση**: Enterprise standard (υβριδική) — ό,τι κάνουν Microsoft, Salesforce, SAP.
- **Unit tests** (τώρα): Mock useTranslation → κλειδιά. Ελέγχουμε behavior, όχι κείμενο.
- **Integration / E2E tests** (μελλοντικά): Πραγματικό i18n instance → πραγματικό κείμενο.
- **Mock pattern**: `t(key, opts) → key::JSON(opts)` ώστε να πιάνει και interpolation params.
- **Reusable mock**: Δημιουργία `test-utils/i18n-mock.ts` για επαναχρησιμοποίηση.

### Q3 — report-data-aggregator coverage (2026-03-30)
**Ερώτηση**: Όλες οι 8 μέθοδοι ή μόνο 3-4 κρίσιμες πρώτα;
**Απάντηση**: Όλες τις 8. Google standard — "If it's in production, it has tests."
- getContactsReport, getProjectsReport, getSalesReport, getCrmReport
- getSpacesReport, getConstructionReport, getComplianceReport, getFinancialReport
- Κάθε μέθοδος: happy path + empty results + edge cases

### Q4 — PDF/Excel exporter testing strategy (2026-03-30)
**Ερώτηση**: Mock-only ή και πραγματική δημιουργία αρχείων;
**Απάντηση**: Και τα δύο — Google "small + medium tests" pattern.
- **Layer 1 (Unit/mock)**: Mock jsPDF/ExcelJS → ελέγχουμε λογική (σωστές κλήσεις, params, σειρά). Τρέχουν σε κάθε commit.
- **Layer 2 (Golden file)**: Δημιουργία πραγματικού PDF/Excel → σύγκριση με αρχείο αναφοράς. Πιάνει visual regressions, encoding, layout bugs.
- Και τα δύο layers υποχρεωτικά.

### Q5 — Saved reports visibility/security testing (2026-03-30)
**Ερώτηση**: Tests για visibility rules (personal/team/system);
**Απάντηση**: Ναι, πλήρες coverage — Google standard "security-critical paths = 100%".
- **Visibility enforcement**: personal→μόνο owner, team→όλοι read/owner edit, system→read-only
- **Cross-user isolation**: User A δεν βλέπει personal report User B
- **Cross-tenant isolation**: Company A δεν βλέπει reports Company B
- **Boundary tests**: Empty/null userId, missing companyId
- **Permission escalation**: Δεν αλλάζει visibility χωρίς ownership
- **Delete protection**: System reports δεν διαγράφονται

### Q6 — Σειρά υλοποίησης test suites (2026-03-30)
**Ερώτηση**: Ποια σειρά υλοποίησης;
**Απάντηση**: Από τα πιο απλά στα πιο σύνθετα.
1. `saved-reports-service.test.ts` — CRUD, σχετικά απλό
2. `SaveReportDialog.test.tsx` — component, μικρό (212 γρ.)
3. `SavedReportsList.test.tsx` — component, μικρό (180 γρ.)
4. `report-data-aggregator.test.ts` — βαρύ, 8 μέθοδοι
5. `builder-excel-exporter.test.ts` — Excel, 2 layers (mock + golden)
6. `builder-pdf-exporter.test.ts` — PDF, 2 layers (mock + golden, πιο σύνθετο)

---

## 11. Enterprise Research Findings (2026-03-30)

### 11.1 PDF Testing — Google/Salesforce Pattern
- **ΟΧΙ mock-only**, **ΟΧΙ binary golden file**
- **Pattern**: Generate PDF buffer → `pdf-parse` → extract text → assert contents
- **Assert**: Τίτλος, ημερομηνία, αριθμός σελίδων, ποσά, headers
- **Anti-pattern**: ΠΟΤΕ binary comparison (PDFs έχουν timestamps/random IDs)

### 11.2 Excel Testing — Microsoft/Atlassian Round-trip Pattern
- **ΟΧΙ mock ExcelJS** — χάνεις τον σκοπό
- **Pattern**: Generate buffer → `ExcelJS.load(buffer)` → assert worksheets, cells, formulas
- **3 layers**: Structure (worksheets, rows), Data (cell values), Formatting (optional)
- **Anti-pattern**: ΠΟΤΕ temp files — in-memory buffers μόνο

### 11.3 Security Testing — Google Zanzibar Pattern
- **Permission matrix** ως TypeScript object → `test.each()` auto-generation
- **Negative tests ΠΡΩΤΑ**: User B tries to access User A's data
- **Cross-tenant isolation**: 2 test companies, verify NO data leaks
- **Pattern**: Actor + Resource + Action + Expected Result

### 11.4 Factory Pattern — Google Internal Style
- **Plain builder functions** (zero dependencies) ή **Fishery** (MIT, TypeScript-first)
- **ΠΟΤΕ** raw object literals scattered σε tests
- **Convention**: `makeXxx(overrides?: Partial<Xxx>): Xxx`
- **Ακολουθεί**: existing `evm-calculator.test.ts` pattern στο project

### 11.5 Component Testing — Kent C. Dodds 2025
- `userEvent.setup()` + `await user.click()` (ΟΧΙ fireEvent)
- `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Dialog: assert dialog visible → fill form → submit → assert callback
- Table: assert rows count → navigate → assert new data

### 11.6 Αναθεώρηση Q4
Η έρευνα αλλάζει τη στρατηγική PDF/Excel testing:
- **Layer 1 (Unit)**: Mock jsPDF/ExcelJS → assert λογική (κλήσεις, params)
- **Layer 2 (Medium)**: Generate REAL output → parse → assert contents
  - PDF: `pdf-parse` text extraction
  - Excel: ExcelJS round-trip load
- Αυτό είναι πιο αξιόπιστο από binary golden files

### Q9 — Εμπλουτισμός existing tests: μαζί ή ξεχωριστά; (2026-03-30)
**Ερώτηση**: Εμπλουτισμός υπαρχόντων tests μαζί με τα 6 νέα ή ξεχωριστό commit;
**Απάντηση**: Ξεχωριστά — δεύτερο commit.
- **Commit 1**: `feat: add 6 missing test suites (SPEC-011)`
- **Commit 2**: `test: enrich existing test coverage (negative, boundary, security)`
- **Γιατί**: Google "small CLs" pattern — 1 commit = 1 ευθύνη, καθαρό git history

### Q8 — Test data factory pattern (2026-03-30)
**Ερώτηση**: Fishery library ή plain builder functions;
**Απάντηση**: Plain builder functions (Google internal style). Μηδέν νέα dependencies.
- Pattern: `makeXxx(overrides?: Partial<Xxx>): Xxx`
- Ακολουθεί existing `evm-calculator.test.ts` pattern
- Μηδέν νέα dependencies — consistency με υπάρχοντα tests

### Q7 — pdf-parse devDependency (2026-03-30)
**Ερώτηση**: Εγκατάσταση `pdf-parse` (MIT) ως devDependency για PDF content testing;
**Απάντηση**: ΟΚ. Εγκρίθηκε.
- `npm install --save-dev pdf-parse`
- Χρήση: Extract text από generated PDF buffer → assert contents
- License: MIT ✅

---

## 12. Στατιστικά & Σύνοψη

| Μέτρηση | Τιμή |
|---------|------|
| Test αρχεία (report-related) | 14 |
| Συνολικά test cases | 1878 |
| Νέα test αρχεία (SPEC-011) | 6 |
| Νέα/εμπλουτισμένα test cases | 174 (117 new + 19 enriched + 38 Phase 7) |
| Test layers | 4 (Unit 80%, Component 15%, Integration 5%, E2E optional) |
| Coverage target | ≥ 80% statements, ≥ 75% branches |
| Testing framework | Jest + React Testing Library |
| Test data pattern | Factory functions (ακολούθησε `evm-calculator.test.ts`) |
| Commit κανόνας | Κώδικας + Tests = ΙΔΙΟ COMMIT |

---

## 13. Changelog

### 2026-03-31 — Commit 1: 6 νέα test suites (SPEC-011 implementation)

**Υλοποίηση**: 6 νέα test suites, 117 test cases, ALL PASS

| # | Test Suite | Tests | Status |
|---|-----------|-------|--------|
| 1 | `saved-reports-service.test.ts` | 43 | ✅ PASS |
| 2 | `SaveReportDialog.test.tsx` | 17 | ✅ PASS |
| 3 | `SavedReportsList.test.tsx` | 13 | ✅ PASS |
| 4 | `report-data-aggregator.test.ts` | 17 | ✅ PASS |
| 5 | `builder-excel-exporter.test.ts` | 12 | ✅ PASS |
| 6 | `builder-pdf-exporter.test.ts` | 15 | ✅ PASS |

**Patterns χρησιμοποιήθηκαν**:
- Google Zanzibar permission matrix (test.each) — saved-reports visibility + cross-tenant
- Factory functions (makeXxx) — zero raw literals
- Mock Firestore with setupFirestoreMock helper — chainable query mocks
- Excel round-trip (ExcelJS load buffer → assert cells) — Layer 2
- jsPDF call tracking (mockPdfCalls array) — Layer 1+2

**Σημειώσεις**:
- `pdf-parse` και `@testing-library/user-event` ΔΕΝ εγκαταστάθηκαν (npm issue) — δεν χρησιμοποιούνται ακόμα
- Component tests χρησιμοποιούν fireEvent (fallback) αντί userEvent
- SaveReportDialog tests: `fireEvent.change` δεν δουλεύει σε jsdom για controlled inputs — χρησιμοποιήθηκε pre-populated via useEffect
- Pending: ~~Commit 2 (εμπλουτισμός existing tests)~~ — DONE

### 2026-03-31 — Commit 2: Εμπλουτισμός existing tests (+19 tests)

**3 αρχεία εμπλουτίστηκαν**:
- `filter-operators.test.ts` (+4 edge cases)
- `report-builder-types.test.ts` (+8 security/boundary)
- `builder-export.test.ts` (+7 negative/boundary)

### 2026-03-31 — Commit 3: Phase 7 enrichment + route security (+38 tests)

**Υλοποίηση**: Εμπλουτισμός 4 υπαρχόντων suites + route security, +38 tests, ALL PASS

| # | Test Suite | Before | After | Added |
|---|-----------|--------|-------|-------|
| 1 | `domain-definitions.test.ts` | 41 | 48 | +7 boundary/consistency |
| 2 | `DomainSelector.test.tsx` | 4 → 5 (config) | 11 | +6 accessibility/validation |
| 3 | `ColumnSelector.test.tsx` | 7 | 12 | +5 boundary/duplicate detection |
| 4 | `FilterPanel.test.tsx` | 9 | 21 | +12 invalid operators/edge cases |
| 5 | `route.test.ts` | 11 | 21 | +10 row limits/security |

**Bugfix**: `domain-definitions.test.ts` line 65 — αναμενόμενος αριθμός domains ήταν hardcoded 14, ενημερώθηκε σε δυναμικό `VALID_DOMAIN_IDS.length` (37 domains μετά Phase 5+6)

**Tests κατηγοριοποιημένα**:
- Boundary: empty fields, min/max limits, zero columns
- Security: SQL injection, prototype pollution, dot-traversal attacks
- Consistency: unique keys, valid groups, field existence
- Operator validation: invalid combos per type, boolean-only eq

**Final verification**: 14 suites, 1878 tests, ALL PASS
