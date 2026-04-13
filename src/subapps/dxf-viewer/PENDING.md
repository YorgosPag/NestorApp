# DXF Viewer Subapp — Pending Tasks

**Last updated:** 2026-04-13
**Referenced from:** `CLAUDE.md`

Εκκρεμείς εργασίες ειδικά για το DXF Viewer subapp. Δεν υπάρχει deadline — όλες είναι low-priority και δουλεύουν incrementally όταν αγγίζεις σχετικά αρχεία.

---

## 1. ⚠️ ServiceRegistry V2 Migration (Low Priority)

**Status**: ✅ V2 Implementation Complete (2025-09-30)

### What's Done
- ✅ `ServiceRegistry.v2.ts` (650 lines — AutoCAD-class certified)
- ✅ All 10 ChatGPT-5 enterprise requirements implemented
- ✅ Migration guide: `MIGRATION_GUIDE_V1_TO_V2.md`
- ✅ Full documentation (1900+ lines)
- ✅ V1 still works (backward compatible)

### What's Pending
- 🟡 Migrate existing files από V1 → V2 (incremental, as we touch files)
- 🟡 Install Vitest/Jest (optional — for automated testing)

### Strategy
- Migrate files **ONLY when we edit them** (no need to touch everything at once)
- V1 continues to work fine — no urgency

### Location
- `src/subapps/dxf-viewer/services/`
- See `MIGRATION_GUIDE_V1_TO_V2.md` for step-by-step instructions

---

## 2. 🧪 Grid Testing Suite (2025-09-30)

**Status**: ✅ Implementation Complete | ⏸️ Execution Paused

### 2.1 Enterprise Grid Tests (CAD Standard)

**What's Done**
- ✅ `grid-enterprise-test.ts` (13 tests, 5 categories)
- ✅ Based on ISO 9000, SASIG PDQ, VDA 4955 standards
- ✅ Debug button integration (Grid TEST button in header)
- ✅ Test Results: **12/13 passed, 1 warning, 100% Topological Integrity**

**How to Run**
1. Open DXF Viewer: `http://localhost:3001/dxf/viewer`
2. Click "📐 Grid TEST" button in header
3. Check console for detailed report + notification summary

**Test Categories**
- **MORPHOLOGIC**: Grid structure integrity
- **SYNTACTIC**: Grid rendering correctness
- **SEMANTIC**: Grid functionality validation
- **PRECISION**: Coordinate accuracy (CAD millimeter-level)
- **TOPOLOGY**: Grid-Canvas-Context integration

**Location**: `src/subapps/dxf-viewer/debug/grid-enterprise-test.ts`

### 2.2 Visual Regression Tests (Playwright)

**What's Done**
- ✅ `e2e/grid-visual-regression.spec.ts` (9 tests)
- ✅ `playwright.config.ts` configured (deterministic rendering)
- ✅ `e2e/README.md` documentation (full workflow guide)
- ✅ npm scripts added (`test:visual`, `test:visual:update`, κλπ)
- ✅ Based on OCCT, FreeCAD, BRL-CAD visual testing practices

**Why Paused**: Γιώργος decided to postpone full test execution.

**How to Run (when ready)**
```bash
npm run test:visual:update  # Generate baseline snapshots (first time)
npm run test:visual         # Run visual regression tests
npm run test:visual:headed  # Run with browser visible
npm run test:visual:report  # View HTML report
```

**Test Coverage**
- 3 resolutions: 1280x800, 1920x1080, 3840x2160 (4K)
- 3 grid styles: Lines, Dots, Crosses
- 3 zoom levels: 0.5x, 1.0x, 2.0x
- Coordinate precision test (millimeter-level)

**Quality Standards**
- `maxDiffPixelRatio: 0.0001` (0.01% tolerance — CAD standard)
- Deterministic rendering (fixed DPR, no animations, seed: 42)
- Cross-browser (Chromium, Firefox, WebKit)

**Location**: `e2e/grid-visual-regression.spec.ts`
**Documentation**: `e2e/README.md`

---

## 3. 🎯 Transform Constants Consolidation — ✅ COMPLETED (2025-10-04)

**Status**: ✅ **COMPLETED** — Phase 1.3 from `MASTER_CONSOLIDATION_ROADMAP.md`

### What Was Done
- ✅ Created `config/transform-config.ts` (400 lines — Single source of truth)
- ✅ Resolved CRITICAL inconsistency: MIN_SCALE (0.01 vs 0.1 — 10x conflict!)
- ✅ Unified all transform/zoom/pan constants
- ✅ Industry-standard zoom factors (AutoCAD/Blender/Figma: 1.1)
- ✅ Complete backward compatibility (re-exports)

### Files Migrated
- ✅ `hooks/state/useCanvasTransformState.ts` → Using `validateTransform`/`transformsEqual` from config
- ✅ `systems/zoom/zoom-constants.ts` → Re-exports from `transform-config`
- ✅ `systems/zoom/ZoomManager.ts` → Auto-updated via re-exports
- ✅ `ui/toolbar/ZoomControls.tsx` → Using `ZOOM_FACTORS.BUTTON_IN` (20%)

### Documentation Updated
- ✅ `docs/centralized-systems/reference/adr-index.md` — Added ADR-043: Zoom Constants
- ✅ `src/md_files/diplotypa/Constants.md` — Section 1 completed
- ✅ `src/md_files/diplotypa/MASTER_CONSOLIDATION_ROADMAP.md` — Phase 1.3 (25% complete)

### Hotfixes Applied (2025-10-04)

**Bug #1**: Zoom-to-cursor was shifting — point under cursor moved up/down during zoom
- **Fix**: Removed hardcoded margins (`left: 80, top: 30`) from `calculations.ts`
- **Solution**: Now uses centralized `COORDINATE_LAYOUT.MARGINS`
- **File**: `systems/zoom/utils/calculations.ts` (line 45)

**Bug #2**: `ZoomManager` used hardcoded viewport `{ width: 800, height: 600 }` instead of actual canvas size
- **Enterprise Pattern**: Viewport Dependency Injection
- **Implementation**:
  - `ZoomManager` constructor now accepts `viewport` parameter (DI)
  - `ZoomManager.setViewport()` method for canvas resize updates
  - `useZoom` hook now accepts `viewport` prop and injects it
  - `CanvasSection` passes viewport to `useZoom`
  - Eliminated all hardcoded viewport fallbacks
- **Files Changed**:
  - `systems/zoom/ZoomManager.ts` — Added viewport DI
  - `systems/zoom/hooks/useZoom.ts` — Added viewport prop
  - `components/dxf-layout/CanvasSection.tsx` — Injects viewport
- **Result**: Zoom-to-cursor now uses **actual canvas dimensions** for accurate coordinate transforms

### Location
`src/subapps/dxf-viewer/config/transform-config.ts`

### Documentation
`docs/centralized-systems/reference/adr-index.md` (ADR-043)
