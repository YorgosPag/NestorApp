# 🧪 TESTING INFRASTRUCTURE - Complete Test Map

**Last Updated:** 2025-10-06
**Status:** 🟡 Partial Integration - 16 tests integrated, 16 tests standalone
**Coverage:** Manual + Automated + Unit + E2E Testing

---

## 📊 OVERVIEW - Test Distribution

| Category | Count | Integration Status |
|----------|-------|-------------------|
| **Automated Tests** (in TestsModal) | 10 | ✅ Fully Integrated |
| **Debug Tools** (in TestsModal) | 6 | ✅ Fully Integrated |
| **Unit Tests** (Vitest/Jest) | 7 | ❌ Not in TestsModal |
| **E2E Tests** (Playwright) | 1 | ❌ Not in TestsModal |
| **Standalone Tests** | 3 | ❌ Not in TestsModal |
| **Settings Tests** | 3 | ❌ Not in TestsModal |
| **Line Drawing Tests** | 2 | 🟡 Partially Integrated |
| **TOTAL** | **32** | **50% Integrated** |

---

## ✅ INTEGRATED TESTS (in TestsModal)

### 📋 Automated Test Suite (10 tests)

These tests run via the **"Run All Tests"** button in TestsModal:

| # | Test Name | File | Description | Pass Criteria |
|---|-----------|------|-------------|---------------|
| 1 | ✏️ Line Drawing Test | `debug/` (via API) | Έλεγχος λειτουργίας σχεδίασης γραμμών | All checks passed |
| 2 | 🎯 Canvas Alignment Test | `debug/canvas-alignment-test.ts` | Canvas alignment & z-index | Aligned + Correct z-index |
| 3 | 🔄 Layering Workflow Test | `debug/layering-workflow-test.ts` | Layer workflow (Ctrl+F2) | All steps success |
| 4 | 🔍 DOM Inspector Test | `debug/dom-inspector.ts` | DOM structure inspection | Elements found |
| 5 | 🏢 Enterprise Cursor Test | `debug/enterprise-cursor-crosshair-test.ts` | Cursor-crosshair alignment (F3) | All scenarios pass |
| 6 | 📐 Grid Enterprise Test | `debug/grid-enterprise-test.ts` | CAD-standard grid testing | 100% topology integrity |
| 7 | 🎯 Origin Markers Test | `debug/OriginMarkersDebugOverlay.ts` | Origin (0,0) markers status | Status retrieved |
| 8 | 📏 Ruler Debug Test | `debug/RulerDebugOverlay.ts` | Ruler diagnostics | Diagnostics retrieved |
| 9 | 👁️ Canvas Visibility Test | `ui/components/TestsModal.tsx` | Canvas display state | Both canvases visible |
| 10 | ℹ️ System Info Test | `ui/components/TestsModal.tsx` | Browser/viewport info | Info retrieved |

**How to Run:**
1. Open DXF Viewer: http://localhost:3001/dxf/viewer
2. Click toolbar **"Run Tests"** button (🧪 icon)
3. Click **"Run All Automated Tests"** button
4. Results appear in toast notification + console

**Expected Output:**
```
Tests Complete: 10✅ / 0❌ (100% pass rate)

✅ Line Drawing Test
✅ Canvas Alignment Test
✅ Layering Workflow Test
... (all tests)

Total Duration: ~2000ms
```

---

### 🛠️ Individual Debug Tools (6 tools)

These tools toggle debug overlays (NOT included in "Run All Tests"):

| # | Tool Name | File | Description | Toggle Shortcut |
|---|-----------|------|-------------|-----------------|
| 1 | 📐 Corner Markers | `debug/layout-debug/CornerMarkers.tsx` | Red corners + border lines + info panel | Click button |
| 2 | 🎯 Origin Markers | `debug/OriginMarkersDebugOverlay.ts` | Origin (0,0) crosshairs on canvases | Click button |
| 3 | 📏 Ruler Debug | `debug/RulerDebugOverlay.ts` | Tick markers + calibration grid | Click button |
| 4 | 🎯 Cursor-Snap Alignment | `debug/CursorSnapAlignmentDebugOverlay.ts` | Blue cursor + Green crosshair + Red snap | Click button |
| 5 | 🎯 Live Coordinates | `debug/layout-debug/CoordinateDebugOverlay.tsx` | Live coords panel + red crosshair | Click button |

**How to Run:**
1. Open TestsModal
2. Scroll to **"Individual Debug Tools"** section
3. Click tool button to toggle ON/OFF

---

## ❌ STANDALONE TESTS (Not in TestsModal)

### 🧪 Unit Tests (Vitest/Jest) - 7 files

| # | Test File | Type | Framework | Description | How to Run |
|---|-----------|------|-----------|-------------|------------|
| 1 | `__tests__/coord.prop.test.ts` | Property-Based | Vitest + fast-check | 500 random coordinate transform combinations | `npm run test:vitest coord.prop` |
| 2 | `__tests__/cursor-crosshair-alignment.test.ts` | Unit + Performance | Jest | Cursor-crosshair alignment with mock canvas | `npm run test:jest cursor-crosshair` |
| 3 | `__tests__/visual-metrics.test.ts` | Telemetry | Jest | Visual regression metrics (NDJSON format) | `npm run test:jest visual-metrics` |
| 4 | `__tests__/visual-regression.test.ts` | Visual Regression | Jest | Snapshot comparison testing | `npm run test:jest visual-regression` |
| 5 | `__tests__/visual-regression-basic.test.ts` | Visual Regression | Jest | Basic snapshot testing | `npm run test:jest visual-regression-basic` |
| 6 | `services/__tests__/ServiceRegistry.test.ts` | Unit | Vitest | ServiceRegistry V1 tests | `npm run test:vitest ServiceRegistry.test` |
| 7 | `services/__tests__/ServiceRegistry.v2.enterprise.test.ts` | Unit | Vitest | ServiceRegistry V2 (Fortune 500 tests) | `npm run test:vitest ServiceRegistry.v2` |

**Coverage:**
- **Coordinate Transforms:** Reversibility, precision, edge cases
- **Visual Regression:** Pixel-perfect rendering across changes
- **ServiceRegistry:** Dependency injection, async initialization, deduplication
- **Performance:** Response time thresholds

**Run All Unit Tests:**
```bash
# Vitest (coordinate + ServiceRegistry tests)
npm run test:vitest

# Jest (visual + cursor tests)
npm run test:jest

# All tests with coverage
npm run test:coverage
```

---

### 🌐 E2E Tests (Playwright) - 1 file

| # | Test File | Description | Browsers | Viewports | How to Run |
|---|-----------|-------------|----------|-----------|------------|
| 1 | `e2e/visual-cross-browser.spec.ts` | Cross-browser visual regression | Chromium, Firefox, WebKit | Desktop (1280×800), Mobile (375×667), Tablet (768×1024) | `npm run test:e2e` |

**Features:**
- Cross-browser GPU/OS rendering differences
- Overlay activation testing (origin, grid, crosshair, combined)
- Responsive design validation

**Run Commands:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (debugging)
npm run test:e2e:ui

# Update snapshots
npm run test:e2e:update

# View report
npm run test:e2e:report
```

---

### 📊 Standalone Test Scripts - 3 files

| # | File | Type | Description | How to Run |
|---|------|------|-------------|------------|
| 1 | `test-coordinate-reversibility.ts` | Standalone Script | Tests `screenToWorld(worldToScreen(p)) == p` | `npx tsx test-coordinate-reversibility.ts` |
| 2 | `debug/grid-workflow-test.ts` | CAD QA Test | Grid workflow (5 categories: MORPHOLOGIC, SYNTACTIC, SEMANTIC, PRECISION, TOPOLOGY) | Import & call `runGridWorkflowTest()` |
| 3 | `hooks/test-new-hooks.tsx` | Hook Testing | Custom hooks testing (needs investigation) | Unknown |

---

### ⚙️ Settings Tests - 3 files

| # | File | Framework | Description | How to Run |
|---|------|-----------|-------------|------------|
| 1 | `settings-core/__tests__/override.test.ts` | Vitest | Settings override logic | `npm run test:vitest override.test` |
| 2 | `settings-core/__tests__/validation.test.ts` | Vitest | Settings validation rules | `npm run test:vitest validation.test` |
| 3 | `stores/__tests__/DxfSettingsStore.test.ts` | Vitest | Zustand store testing | `npm run test:vitest DxfSettingsStore.test` |

---

### ✏️ Line Drawing Tests - 2 files

| # | File | Framework | Integration Status | How to Run |
|---|------|-----------|-------------------|------------|
| 1 | `__tests__/line-drawing-functionality.test.ts` | Jest | 🟡 Partially (via API) | `npm run test:jest line-drawing-functionality` |
| 2 | `__tests__/line-drawing-smoke.test.ts` | Jest | 🟡 Partially (via API) | `npm run test:jest line-drawing-smoke` |

**Note:** Line Drawing Test in TestsModal calls `/api/validate-line-drawing`, which may use these tests.

---

## 🎯 TEST EXECUTION MATRIX

| Test Type | Location | Run Method | CI/CD Ready | Browser Required |
|-----------|----------|------------|-------------|------------------|
| **Automated Tests** | TestsModal | UI Button | ❌ No | ✅ Yes |
| **Debug Tools** | TestsModal | UI Button | ❌ No | ✅ Yes |
| **Unit Tests (Vitest)** | CLI | `npm run test:vitest` | ✅ Yes | ❌ No |
| **Unit Tests (Jest)** | CLI | `npm run test:jest` | ✅ Yes | ❌ No |
| **E2E Tests** | CLI | `npm run test:e2e` | ✅ Yes | ✅ Yes (headless) |
| **Standalone Scripts** | CLI | `npx tsx <file>` | ❌ No | Varies |

---

## 📦 NPM SCRIPTS REFERENCE

```json
{
  "scripts": {
    "test:vitest": "vitest --config vitest.config.enterprise.ts",
    "test:jest": "jest --config jest.config.js",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:update": "playwright test --update-snapshots",
    "test:e2e:report": "playwright show-report",
    "test:coverage": "vitest --coverage && jest --coverage",
    "test:all": "npm run test:vitest && npm run test:jest && npm run test:e2e"
  }
}
```

**Note:** These scripts may need to be added to `package.json` if not present.

---

## 🔧 TEST INFRASTRUCTURE IMPROVEMENTS NEEDED

### 🟡 **Phase 2: TestsModal Integration** (In Progress)

**Goal:** Add 3rd tab to TestsModal for Unit Tests & E2E Tests

**Planned Features:**
- **Unit Tests Tab:**
  - ⚡ Run Vitest Tests (via `/api/run-vitest`)
  - ⚡ Run Jest Tests (via `/api/run-jest`)
  - ⚡ Run Property-Based Tests
  - ⚡ Run ServiceRegistry Tests

- **E2E Tests Tab:**
  - 🎭 Run Cross-Browser Tests (via `/api/run-playwright`)
  - 📸 Update Visual Snapshots

- **Standalone Tests Tab:**
  - 🔄 Coordinate Reversibility Test
  - 📐 Grid Workflow Test

**API Endpoints to Create:**
1. `/api/run-vitest` - Executes Vitest suite, returns JSON results
2. `/api/run-jest` - Executes Jest suite, returns JSON results
3. `/api/run-playwright` - Executes Playwright suite, returns JSON results

**Benefits:**
- ✅ Single interface for all tests
- ✅ No need to remember npm scripts
- ✅ Visual feedback in UI
- ✅ CI/CD tests still run independently

---

## 📈 TEST COVERAGE GAPS

### ❌ **Missing Test Areas:**

1. **Zoom System:**
   - ❌ Zoom-to-cursor accuracy
   - ❌ Zoom limits (MIN_SCALE, MAX_SCALE)
   - ❌ Keyboard shortcuts (Ctrl+Wheel, +/-)

2. **Pan System:**
   - ❌ Pan boundaries
   - ❌ Pan performance

3. **DXF File Loading:**
   - ❌ File parsing errors
   - ❌ Large file performance (>10MB)
   - ❌ Corrupt DXF handling

4. **Entity Rendering:**
   - ❌ LINE, ARC, CIRCLE rendering accuracy
   - ❌ TEXT entity positioning
   - ❌ Color/layer filtering

5. **Performance:**
   - ❌ Frame rate (60fps target)
   - ❌ Memory leaks
   - ❌ Canvas resize performance

6. **Accessibility:**
   - ❌ Keyboard navigation
   - ❌ Screen reader support
   - ❌ ARIA labels

---

## 🎯 RECOMMENDED ACTIONS

### **Priority 1: Complete Phase 2 Integration**
- [ ] Create `/api/run-vitest`, `/api/run-jest`, `/api/run-playwright` endpoints
- [ ] Add 3rd tab to TestsModal
- [ ] Test API endpoints work correctly

### **Priority 2: Add Missing NPM Scripts**
- [ ] Verify `package.json` has all test scripts
- [ ] Add shortcuts: `npm test` → runs all tests

### **Priority 3: Fill Coverage Gaps**
- [ ] Write zoom system tests
- [ ] Write DXF loading tests
- [ ] Add performance benchmarks

### **Priority 4: CI/CD Integration**
- [ ] Add GitHub Actions workflow
- [ ] Run Vitest/Jest/Playwright on every commit
- [ ] Block merge if tests fail

---

## 📚 REFERENCES

- **Testing Standards:** ISO 9000, SASIG PDQ, VDA 4955 (CAD industry)
- **Frameworks:** Vitest, Jest, Playwright, fast-check
- **Coverage Target:** 80% code coverage (enterprise standard)
- **Test Types:** Unit, Integration, E2E, Property-Based, Visual Regression

---

## 🔗 QUICK LINKS

- **TestsModal:** `src/subapps/dxf-viewer/ui/components/TestsModal.tsx`
- **Unified Test Runner:** `src/subapps/dxf-viewer/debug/unified-test-runner.ts`
- **Test Directory:** `src/subapps/dxf-viewer/__tests__/`
- **E2E Directory:** `src/subapps/dxf-viewer/e2e/`
- **Debug Directory:** `src/subapps/dxf-viewer/debug/`

---

**Generated:** 2025-10-06
**Maintained by:** Γιώργος Παγώνης + Claude (Anthropic AI)
**Next Review:** After Phase 2 completion
