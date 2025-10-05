# 🧪 TESTING GUIDE - DXF Viewer

**Ημερομηνία Δημιουργίας:** 2025-10-04
**Τελευταία Ενημέρωση:** 2025-10-04 (Added Centralized Helpers Guide)
**Στόχος:** Να σταματήσουμε να χάνουμε ισορροπία - Τέλος στους 4 μήνες debugging!

> 📖 **Αυτό το guide:** Practical workflows & how-to
>
> 🏗️ **Για architecture & centralization:** Δες [TEST_INFRASTRUCTURE.md](../TEST_INFRASTRUCTURE.md)
>
> 📋 **Για κεντρικοποιημένα συστήματα:** Δες [centralized_systems.md](../centralized_systems.md) - Rule #10

---

## 🎯 ΓΙΑ ΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ GUIDE

### Το Πρόβλημα (4 μήνες τώρα)

```
❌ ΤΙ ΓΙΝΟΤΑΝ ΠΡΙΝ:
1. Αλλάζαμε DxfRenderer.ts → Grips σπάνε
2. Φτιάχναμε hover → Selection χάνεται
3. Φτιάχναμε selection → Grips ξαναχάνονται
4. Επαναλαμβάναμε για 4 μήνες...
```

### Η Λύση

```
✅ ΤΙ ΚΑΝΟΥΜΕ ΤΩΡΑ:
1. Γράφουμε integration test ΠΡΟ της αλλαγής
2. Κάνουμε την αλλαγή
3. Τρέχουμε το test
4. Αν περνάει → ✅ Commit
5. Αν σπάει → 🔥 Ξέρουμε ΑΜΕΣΑ τι πήγε λάθος!
```

---

## 📚 ΤΙ TESTS ΕΧΟΥΜΕ

### 1. Integration Tests

**Location:** `__tests__/integration/`

#### `grips-selection.test.ts` ✅ (12 tests)
**Τι ελέγχει:**
- Layer card click → Grips show
- Single entity click → Grips show
- Empty click → Clear grips
- Multiple layer selections
- Event listener registration (HILITE_EVENT)
- Entity ID validation
- Layer visibility check
- Locked layer check
- Entity type support
- Performance (1000 entities)
- **Regression test για Bug #7** (2025-10-04)

**Πώς τρέχει:**
```bash
npm test -- grips-selection
```

**Αποτέλεσμα:**
```
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Time:        2.596 s
```

---

### 2. Property-Based Tests

**Location:** `__tests__/coord.prop.test.ts`

**Τι ελέγχει:**
- Coordinate transforms με 1000s τυχαίων combinations
- Reversibility (screen → world → screen)
- Precision validation

**Πώς τρέχει:**
```bash
npm run test:prop
```

---

### 3. Visual Regression Tests

**Location:** `__tests__/visual-regression*.test.ts`

**Τι ελέγχει:**
- Grid rendering consistency
- Canvas output pixel-perfect comparison

**Πώς τρέχει:**
```bash
npm run test:visual
```

---

## 🔧 ΠΏΣ ΝΑ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ ΤΑ TESTS

### Workflow: Πριν Κάνεις Αλλαγή

```bash
# 1. Τρέξε τα tests να δεις ότι όλα περνάνε (BASELINE)
npm test -- grips-selection

# 2. Κάνε την αλλαγή σου
# (edit DxfRenderer.ts, BaseEntityRenderer.ts, κτλ.)

# 3. Τρέξε ξανά τα tests
npm test -- grips-selection

# 4α. Αν περνάνε → ✅ Commit!
git add .
git commit -m "Fix: Whatever you fixed"

# 4β. Αν σπάνε → 🔥 Δες ποιο test σπάει
# Το test θα σου πει ΑΚΡΙΒΩΣ τι πήγε λάθος!
```

---

### Workflow: Προσθήκη Νέου Feature

```bash
# 1. Γράψε ΠΡΩΤΑ το test (Test-Driven Development)
# Φτιάξε __tests__/integration/new-feature.test.ts

# 2. Τρέξε το test (θα σπάσει - το feature δεν υπάρχει ακόμα)
npm test -- new-feature

# 3. Υλοποίησε το feature

# 4. Τρέξε ξανά το test
npm test -- new-feature

# 5. Όταν περνάει → ✅ Το feature είναι done!
```

---

## 🐛 REGRESSION TESTS - Bug History

Κάθε φορά που βρίσκουμε bug, προσθέτουμε **regression test** ώστε να μην επαναληφθεί!

### Bug #7 - Layer Card Click → Grips Not Showing (2025-10-04)

**Τι ήταν:**
- `publishHighlight()` έστελνε `HILITE_EVENT`
- `DxfCanvas.tsx` ΔΕΝ είχε listener
- Grips δεν εμφανίζονταν

**Πώς φτιάχτηκε:**
- Προστέθηκε `useEffect` listener στο `DxfCanvas.tsx` (lines 394-418)

**Regression Test:**
```typescript
test('🐛 Bug #7 - Layer card click not showing grips (2025-10-04)', () => {
  // Test που ελέγχει ότι το HILITE_EVENT listener δουλεύει
});
```

**Location:** `integration/grips-selection.test.ts` (line ~305)

---

### Bug #8 - Entity Click → Grips Not Showing (2025-10-04)

**Τι ήταν:**
- `useCentralizedMouseHandlers.handleMouseUp` καλούσε `hitTestingService.hitTest()`
- `onEntitySelect(entityId)` callback καλείται
- `CanvasSection.handleEntitySelect` ενημέρωνε Context + Props
- **ΑΛΛΑ ΔΕΝ** έστελνε `publishHighlight({ ids: [entityId], mode: 'select' })`
- `DxfCanvas` περίμενε `HILITE_EVENT` για να εμφανίσει grips
- Grips δεν εμφανίζονταν!

**Root Cause:**
- Missing event dispatch στο `handleEntitySelect`
- Το test **ΔΕΝ** ελέγχε αν στέλνεται το `HILITE_EVENT`
- Το test πέρασε, αλλά η λειτουργία δεν δούλευε!

**Πώς φτιάχτηκε:**
- Προστέθηκε `publishHighlight({ ids: selectedIds, mode: 'select' })` στο `CanvasSection.handleEntitySelect` (line 96)
- Import `publishHighlight` από `events/selection-bus` (line 35)

**Regression Tests (3 νέα tests):**
```typescript
test('🐛 Bug #8 - Entity click not triggering HILITE_EVENT', () => {
  // Ελέγχει ότι το event στέλνεται με σωστά data
});

test('🐛 Bug #8 Integration - Full entity click → grips flow', () => {
  // Ελέγχει ΟΛΗ τη ροή: click → hitTest → callback → event → grips
});
```

**Location:** `integration/grips-selection.test.ts` (lines ~332-436)

**Lesson Learned:**
- ❌ Τα tests πρέπει να ελέγχουν **ΟΛΗ** τη ροή, όχι μόνο μέρη της!
- ✅ Προστέθηκε **Full Integration Test** που ελέγχει όλα τα βήματα
- ✅ Αν αυτό το test υπήρχε, θα είχε σπάσει ΑΜΕΣΑ!

---

### Future Bugs

Όταν βρούμε νέα bugs, προσθέτουμε εδώ:

1. **Περιγραφή του bug**
2. **Root cause**
3. **Η λύση**
4. **Regression test location**
5. **Lesson learned** - Τι μάθαμε;

---

## 🏢 TEST INFRASTRUCTURE

### Jest Configuration

**Root config:** `F:\Pagonis_Nestor\jest.config.js`
**DXF Viewer config:** `src/subapps/dxf-viewer/jest.config.ts`

### Custom DOM Environment

**File:** `F:\Pagonis_Nestor\jest-minimal-dom-environment.js`

**Γιατί το φτιάξαμε:**
- Το `jest-environment-jsdom` timeout-άρει κατά την εγκατάσταση
- Χρειαζόμαστε DOM mocks (CustomEvent, window, document)
- Minimal implementation που καλύπτει τις ανάγκες μας

**Τι παρέχει:**
- `CustomEvent` - Για event dispatching
- `window` - Global object
- `document` - Minimal DOM
- `HTMLCanvasElement` - Canvas mocks
- `addEventListener/removeEventListener/dispatchEvent`

---

## 📊 TEST COVERAGE

### Τρέχοντα Coverage

```bash
# Τρέξε όλα τα tests με coverage report
npm test -- --coverage
```

**Target Coverage:**
- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

**Critical Modules (95% coverage):**
- `rendering/core/CoordinateTransforms.ts`

---

## 🎯 ΠΩΣ ΝΑ ΓΡΑΨΕΙΣ ΝΕΟ TEST

### 📚 CENTRALIZED TEST HELPERS (2025-10-04) ✅

**ΠΑΝΤΑ χρησιμοποιούμε centralized helpers - ΟΧΙ embedded utilities!**

```typescript
// ✅ ΣΩΣΤΟ - Import από centralized helpers
import {
  createTestScene,      // Test data
  publishHighlight,     // Event helpers
  TEST_EVENTS,          // Event constants
  querySelector,        // DOM helpers
  measureTest,          // Performance helpers
  sleep                 // Async utilities
} from '../helpers';

// ❌ ΛΑΘΟΣ - ΜΗΝ δημιουργείς embedded utilities!
function createTestScene() { ... }  // DON'T DO THIS!
const HILITE_EVENT = 'dxf.highlightByIds';  // DON'T DO THIS!
```

**Available Helpers:**

| Helper File | Exports | Χρήση |
|-------------|---------|-------|
| `testData.ts` | `createTestScene()`, `createTestEntities()`, `createTestLayer()` | Test data generation |
| `eventHelpers.ts` | `publishHighlight()`, `TEST_EVENTS`, `waitForEvent()` | Event dispatching & constants |
| `domHelpers.ts` | `querySelector()`, `createTestElement()`, `cleanupDOM()` | DOM utilities |
| `performanceHelpers.ts` | `measureTest()`, `sleep()`, `benchmark()` | Performance testing |

**Path Mappings:**
```typescript
// Both work:
import { ... } from '../helpers';           // Relative
import { ... } from '@helpers/testData';    // Path alias
```

---

### Template για Integration Test

```typescript
/**
 * 🧪 INTEGRATION TEST - [Feature Name]
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// ✅ Import centralized helpers
import {
  createTestScene,
  publishHighlight,
  TEST_EVENTS
} from '../helpers';

describe('🧪 [Feature Name] Integration Tests', () => {
  let testScene;

  beforeEach(() => {
    // ✅ Use centralized test data
    testScene = createTestScene();
  });

  test('✅ Should do X when Y happens', () => {
    // Arrange - Setup
    const entityIds = testScene.entities.map(e => e.id);

    // Act - Perform action
    publishHighlight(entityIds, 'select');

    // Assert - Verify
    expect(result).toBe(expectedValue);
  });

  test('🐛 Regression: Bug #X - Description', () => {
    // Test που ελέγχει ότι το bug δεν επαναλαμβάνεται
  });
});
```

---

## ⚡ QUICK COMMANDS

```bash
# Τρέξε μόνο integration tests
npm test -- integration

# Τρέξε μόνο το grips-selection test
npm test -- grips-selection

# Τρέξε όλα τα tests
npm test

# Τρέξε με verbose output
npm test -- --verbose

# Τρέξε χωρίς coverage (πιο γρήγορα)
npm test -- --no-coverage

# Watch mode (τρέχει αυτόματα όταν αλλάζουν αρχεία)
npm run test:watch
```

---

## 🚀 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ

### Προτεραιότητες

1. **✅ DONE** - Integration test για Grips & Selection
2. **TODO** - Integration test για Hover system
3. **TODO** - Integration test για Drag & Drop
4. **TODO** - Integration test για Zoom/Pan persistence
5. **TODO** - Integration test για Layer visibility
6. **TODO** - Integration test για Entity rendering

### Μελλοντικές Βελτιώσεις

- [ ] CI/CD Integration (GitHub Actions)
- [ ] Automated test runs on git commit
- [ ] Test coverage reports in PRs
- [ ] Visual regression baselines
- [ ] E2E tests με Playwright

---

## 📖 ΑΡΧΕΣ TESTING

### 1. Test-Driven Development (TDD)

```
❌ ΛΑΘΟΣ:
1. Γράφω feature
2. Δοκιμάζω manually
3. "Μάλλον δουλεύει"
4. Commit
5. Σπάει αργότερα

✅ ΣΩΣΤΟ:
1. Γράφω test
2. Test σπάει (feature δεν υπάρχει)
3. Γράφω feature
4. Test περνάει
5. Commit με confidence!
```

### 2. One Change at a Time

```
❌ ΛΑΘΟΣ:
- Αλλάζω 5 αρχεία μαζί
- Κάνω commit
- Κάτι σπάει
- Δεν ξέρω ποια αλλαγή φταίει

✅ ΣΩΣΤΟ:
- Αλλάζω 1 αρχείο
- Τρέχω tests
- Αν περνάνε → Commit
- Επόμενο αρχείο
```

### 3. Regression Prevention

```
Κάθε bug που βρίσκουμε = 1 νέο regression test

Έτσι ΔΕΝ επαναλαμβάνονται τα ίδια bugs!
```

---

## 🔥 ΣΗΜΑΝΤΙΚΟ - ΔΙΑΒΑΣΕ ΑΥΤΟ!

### Πότε ΝΑ Τρέχεις Tests

**ΠΑΝΤΑ πριν από:**
- Git commit
- Pull request
- Merge στο main branch
- Deploy σε production

**ΠΑΝΤΑ μετά από:**
- Αλλαγή σε core systems (rendering, selection, grips)
- Προσθήκη νέου feature
- Bug fix
- Refactoring

### Τι να Κάνεις όταν Test Σπάει

```bash
# 1. Δες ποιο test σπάει
npm test -- grips-selection --verbose

# 2. Διάβασε το error message - Λέει ΑΚΡΙΒΩΣ τι πήγε λάθος

# 3. Undo την τελευταία αλλαγή
git diff  # Δες τι άλλαξες
git checkout -- <file>  # Undo το αρχείο

# 4. Τρέξε ξανά το test - Πρέπει να περνάει τώρα
npm test -- grips-selection

# 5. Κάνε την αλλαγή σου πιο προσεκτικά
```

---

## 📞 ΕΠΙΚΟΙΝΩΝΙΑ & UPDATES

**Maintainer:** Γιώργος Παγώνης
**AI Assistant:** Claude (Anthropic)

**Αυτό το guide ενημερώνεται κάθε φορά που:**
- Προσθέτουμε νέο test
- Βρίσκουμε νέο bug
- Αλλάζουμε test infrastructure
- Μαθαίνουμε κάτι καινούριο

---

## 🎓 RESOURCES & LEARNING

### Jest Documentation
- https://jestjs.io/docs/getting-started
- https://jestjs.io/docs/using-matchers

### Testing Best Practices
- https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- https://testing-library.com/docs/

### Integration Testing
- https://martinfowler.com/bliki/IntegrationTest.html

---

## ✅ CHECKLIST - Μετά από Κάθε Session

Πριν τελειώσεις τη δουλειά:

- [ ] Όλα τα tests περνάνε
- [ ] Νέα bugs έχουν regression tests
- [ ] Code coverage δεν έπεσε
- [ ] TESTING_GUIDE.md ενημερωμένο
- [ ] Git commit με σαφές μήνυμα

---

## 📚 RELATED DOCUMENTATION

- 🏗️ **[TEST_INFRASTRUCTURE.md](../TEST_INFRASTRUCTURE.md)** - Architecture, centralization, quality standards
- 📋 **[centralized_systems.md](../centralized_systems.md)** - Rule #10: Testing & Regression Prevention
- 📖 **[docs/](../docs/)** - Full enterprise documentation

---

**🚀 Τέλος στους 4 μήνες debugging - Ξεκινάει η εποχή των tests!**

*Last updated: 2025-10-04 by Claude & Γιώργος*
