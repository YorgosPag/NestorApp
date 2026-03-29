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

## 10. Στατιστικά & Σύνοψη

| Μέτρηση | Τιμή |
|---------|------|
| Υπάρχοντα test αρχεία (report-related) | 8 |
| Υπάρχοντα test cases | 255 |
| Νέα test αρχεία (Report Builder) | ~18 |
| Νέα test cases (εκτίμηση) | ~225-285 |
| Test layers | 4 (Unit 80%, Component 15%, Integration 5%, E2E optional) |
| Coverage target | ≥ 80% statements, ≥ 75% branches |
| Testing framework | Jest + React Testing Library |
| Test data pattern | Factory functions (ακολούθησε `evm-calculator.test.ts`) |
| Commit κανόνας | Κώδικας + Tests = ΙΔΙΟ COMMIT |
