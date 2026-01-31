# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής

**📊 Stats**: 80 ADRs (ADR-065 expanded) | Last Updated: 2026-01-31

---

## 🎯 **QUICK NAVIGATION**

| Category | ADR Range | Quick Jump |
|----------|-----------|------------|
| **UI Components** | ADR-001 to ADR-003 | [View](#-ui-components) |
| **Design System** | ADR-002, ADR-004, ADR-011 | [View](#-design-system) |
| **Canvas & Rendering** | ADR-004 to ADR-009 | [View](#-canvas--rendering) |
| **Data & State** | ADR-010, ADR-030 to ADR-034 | [View](#-data--state-management) |
| **Drawing System** | ADR-005, ADR-040 to ADR-048 | [View](#-drawing-system) |
| **Security & Auth** | ADR-020, ADR-024, ADR-062, ADR-063 | [View](#-security--authentication) |
| **Backend Systems** | ADR-059, ADR-060 | [View](#-backend-systems) |
| **Infrastructure** | ADR-061 | [View](#-infrastructure) |
| **Performance** | ADR-019, ADR-030, ADR-040 | [View](#-performance) |
| **Filters & Search** | ADR-029, ADR-051 | [View](#-filters--search) |
| **Tools & Keyboard** | ADR-026 to ADR-028, ADR-035, ADR-038, ADR-055 | [View](#-tools--keyboard) |
| **Entity Systems** | ADR-012 to ADR-018, ADR-025, ADR-052 to ADR-057 | [View](#-entity-systems) |

---

## 📊 **COMPLETE ADR TABLE**

| ADR | Decision | Status | Date | Category |
|-----|----------|--------|------|----------|
| **ADR-001** | Select/Dropdown Component → Radix Select | ✅ APPROVED | 2026-01-01 | UI Components |
| **ADR-002** | Enterprise Z-Index Hierarchy | ✅ APPROVED | 2026-01-02 | Design System |
| **ADR-003** | Floating Panel Compound Component | ✅ APPROVED | 2026-01-02 | UI Components |
| **ADR-004** | Canvas Theme System | ✅ APPROVED | 2026-01-03 | Canvas & Rendering |
| **ADR-005** | Line Drawing System | ✅ APPROVED | 2026-01-03 | Drawing System |
| **ADR-006** | Crosshair Overlay Consolidation | ✅ APPROVED | 2026-01-03 | Canvas & Rendering |
| **ADR-008** | CSS→Canvas Coordinate Contract | ✅ APPROVED | 2026-01-04 | Canvas & Rendering |
| **ADR-009** | Ruler Corner Box Interactive | ✅ APPROVED | 2026-01-04 | Canvas & Rendering |
| **ADR-010** | Panel Type Centralization | ✅ APPROVED | 2026-01-04 | Data & State |
| **ADR-011** | FloatingPanel UI Styling System | ✅ APPROVED | 2026-01-04 | Design System |
| **ADR-012** | Entity Linking Service | ✅ APPROVED | 2026-01-07 | Entity Systems |
| **ADR-013** | Enterprise Card System (Atomic Design) | ✅ APPROVED | 2026-01-08 | UI Components |
| **ADR-014** | Navigation Entity Icons Centralization | ✅ APPROVED | 2026-01-09 | UI Components |
| **ADR-015** | Entity List Column Container | ✅ APPROVED | 2026-01-09 | UI Components |
| **ADR-016** | Navigation Breadcrumb Path System | ✅ APPROVED | 2026-01-10 | UI Components |
| **ADR-017** | Enterprise ID Generation | ✅ APPROVED | 2026-01-11 | Entity Systems |
| **ADR-018** | Unified Upload Service | ✅ APPROVED | 2026-01-11 | Entity Systems |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED | 2026-01-11 | Entity Systems |
| **ADR-019** | Centralized Performance Thresholds | ✅ APPROVED | 2026-01-11 | Performance |
| **ADR-020** | Centralized Auth Module | ✅ APPROVED | 2026-01-11 | Security & Auth |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED | 2026-01-11 | Security & Auth |
| **ADR-023** | Centralized Spinner Component | ✅ APPROVED | 2026-01-11 | UI Components |
| **ADR-024** | Environment Security Configuration | ✅ APPROVED | 2026-01-16 | Security & Auth |
| **ADR-025** | Unit Linking System | ✅ APPROVED | 2026-01-24 | Entity Systems |
| **ADR-026** | DXF Toolbar Colors System | ✅ APPROVED | 2026-01-24 | Tools & Keyboard |
| **ADR-027** | DXF Keyboard Shortcuts System | ✅ APPROVED | 2026-01-24 | Tools & Keyboard |
| **ADR-028** | Button Component Consolidation | ✅ APPROVED | 2026-01-24 | Tools & Keyboard |
| **ADR-029** | Canvas V2 Migration | ✅ COMPLETED | 2026-01-25 | Canvas & Rendering |
| **ADR-030** | Unified Frame Scheduler | ✅ IMPLEMENTED | 2026-01-25 | Performance |
| **ADR-031** | Enterprise Command Pattern (Undo/Redo) | ✅ IMPLEMENTED | 2026-01-25 | Data & State |
| **ADR-032** | Drawing State Machine | ✅ IMPLEMENTED | 2026-01-25 | Drawing System |
| **ADR-033** | Hybrid Layer Movement System | 📋 PLANNING | 2026-01-25 | Drawing System |
| **ADR-034** | Geometry Calculations Centralization | ✅ APPROVED | 2026-01-26 | Data & State |
| **ADR-035** | Tool Overlay Mode Metadata | ✅ APPROVED | 2026-01-26 | Tools & Keyboard |
| **ADR-036** | Enterprise Structured Logging | ✅ APPROVED | 2026-01-26 | Performance |
| **ADR-037** | Product Tour System | ✅ APPROVED | 2026-01-26 | UI Components |
| **ADR-038** | Centralized Tool Detection Functions | ✅ APPROVED | 2026-01-26 | Tools & Keyboard |
| **ADR-040** | Preview Canvas Performance | ✅ APPROVED | 2027-01-27 | Drawing System |
| **ADR-041** | Distance Label Centralization | ✅ APPROVED | 2027-01-27 | Drawing System |
| **ADR-042** | UI Fonts Centralization | ✅ APPROVED | 2027-01-27 | Design System |
| **ADR-043** | Zoom Constants Consolidation | ✅ APPROVED | 2027-01-27 | Canvas & Rendering |
| **ADR-044** | Canvas Line Widths Centralization | ✅ APPROVED | 2027-01-27 | Canvas & Rendering |
| **ADR-045** | Viewport Ready Guard | ✅ APPROVED | 2027-01-27 | Canvas & Rendering |
| **ADR-046** | Single Coordinate Transform | ✅ APPROVED | 2027-01-27 | Canvas & Rendering |
| **ADR-047** | Close Polygon on First-Point Click | ✅ APPROVED | 2027-01-27 | Drawing System |
| **ADR-048** | Unified Grip Rendering System | ✅ APPROVED | 2027-01-27 | Drawing System |
| **ADR-049** | Unified Move Tool (DXF + Overlays) | ✅ APPROVED | 2027-01-27 | Drawing System |
| **ADR-050** | Unified Toolbar Integration | ✅ APPROVED | 2027-01-27 | UI Components |
| **ADR-051** | Enterprise Filter System Centralization | ✅ APPROVED | 2026-01-29 | Filters & Search |
| **ADR-052** | DXF Export API Contract | ✅ APPROVED | 2026-01-30 | Entity Systems |
| **ADR-053** | Drawing Context Menu | ✅ APPROVED | 2026-01-30 | Drawing System |
| **ADR-054** | Enterprise Upload System Consolidation | ✅ APPROVED | 2026-01-30 | Entity Systems |
| **ADR-055** | Centralized Tool State Persistence | ✅ APPROVED | 2026-01-30 | Tools & Keyboard |
| **ADR-056** | Centralized Entity Completion Styles | ✅ APPROVED | 2026-01-30 | Drawing System |
| **ADR-057** | Unified Entity Completion Pipeline | ✅ APPROVED | 2026-01-30 | Drawing System |
| **ADR-058** | Canvas Drawing Primitives (Arc via Ellipse) | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-064** | Shape Primitives Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-065** | Distance & Vector Operations Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-066** | Angle Calculation Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-067** | Radians/Degrees Conversion Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-068** | Angle Normalization Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-069** | Number Formatting Centralization (formatDistance/formatAngle) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-070** | Vector Magnitude Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-071** | Clamp Function Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-072** | Dot Product Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-074** | Point On Circle Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-075** | Grip Size Multipliers Centralization | ✅ APPROVED | 2026-01-31 | Drawing System |
| **ADR-076** | RGB ↔ HEX Color Conversion Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-077** | TAU Constant Centralization (2 * Math.PI) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-078** | Vector Angle & Angle Between Vectors Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-079** | Geometric Epsilon/Precision Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-080** | Rectangle Bounds Centralization (rectFromTwoPoints) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-081** | Percentage Formatting Centralization (formatPercent) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-059** | Separate Audit Bootstrap from Projects List | ✅ APPROVED | 2026-01-11 | Backend Systems |
| **ADR-060** | Building Floorplan Enterprise Storage | ✅ APPROVED | 2026-01-11 | Backend Systems |
| **ADR-061** | Path Aliases Strategy | ✅ APPROVED | 2026-01-13 | Infrastructure |
| **ADR-062** | No Debug Endpoints in Production | ✅ APPROVED | 2026-01-17 | Security & Auth |
| **ADR-063** | Company Isolation Custom Claims | ✅ APPROVED | 2026-01-18 | Security & Auth |
| **ADR-UI-001** | Visual Primitive Ownership | ✅ APPROVED | 2026-01-04 | Design System |

---

## 🎨 **UI COMPONENTS**

### ADR-001: Select/Dropdown Component
- **Canonical**: `@/components/ui/select` (Radix Select)
- **Deprecated**: `EnterpriseComboBox`
- **Strategy**: Migrate on touch (7 legacy files)

### ADR-003: Floating Panel Compound Component
- **Canonical**: `FloatingPanel` (`@/components/ui/floating`)
- **Pattern**: Compound Component (Radix UI style)

### ADR-013: Enterprise Card System (Atomic Design)
- **Canonical**: `@/design-system` + `@/domain/cards`
- **Pattern**: Atomic Design (Primitives → Components → Domain Cards)
- **Result**: 64% code reduction (22→7 domain cards)

### ADR-014: Navigation Entity Icons Centralization
- **Canonical**: `NAVIGATION_ENTITIES` from `@/components/navigation/config`
- **Prohibition**: Hardcoded Lucide icons for entities

### ADR-015: Entity List Column Container
- **Canonical**: `EntityListColumn` from `@/core/containers`
- **Pattern**: Semantic HTML + centralized width tokens

### ADR-016: Navigation Breadcrumb Path System
- **Canonical**: `syncBreadcrumb()` from `NavigationContext`
- **Type**: `BreadcrumbEntityRef` (lightweight display-only)

### ADR-023: Centralized Spinner Component
- **Canonical**: `Spinner` from `@/components/ui/spinner`
- **Prohibited**: Direct `Loader2` import from lucide-react

### ADR-037: Product Tour System
- **Canonical**: `ProductTour` from `@/components/ui/ProductTour`
- **Pattern**: Context-based + Floating UI + Spotlight

### ADR-050: Unified Toolbar Integration
- **Canonical**: `EnhancedDXFToolbar` with collapsible sections
- **Pattern**: AutoCAD Ribbon pattern

---

## 🎨 **DESIGN SYSTEM**

### ADR-002: Enterprise Z-Index Hierarchy
- **Source**: `design-tokens.json` → CSS variables
- **Pattern**: `var(--z-index-*)` for all z-index values
- **Prohibited**: Hardcoded z-index (e.g., `z-[9999]`)

### ADR-004: Canvas Theme System
- **Source**: `design-tokens.json` → `CANVAS_THEME`
- **Pattern**: CSS Variables for runtime theme switching
- **Level**: 9.5/10 (Figma/AutoCAD/Blender standards)

### ADR-011: FloatingPanel UI Styling System
- **Hooks**: `useSemanticColors()` + `useBorderTokens()`
- **Coverage**: 47 files, 100% centralized
- **Prohibited**: Hardcoded Tailwind colors

### ADR-042: UI Fonts Centralization
- **Canonical**: `UI_FONTS` from `text-rendering-config.ts`
- **Prohibited**: Hardcoded `ctx.font = '12px Arial'`

### ADR-UI-001: Visual Primitive Ownership
- **Owner**: `useBorderTokens.ts` for all visual primitives
- **API**: `quick.*` semantic tokens (not just helpers)

---

## 🖼️ **CANVAS & RENDERING**

### ADR-006: Crosshair Overlay Consolidation
- **Canonical**: `canvas-v2/overlays/CrosshairOverlay.tsx`
- **Deleted**: Legacy `canvas/CrosshairOverlay.tsx` (495 lines)

### ADR-008: CSS→Canvas Coordinate Contract
- **Formula**: `(e.clientX - rect.left) * (canvas.width / rect.width)`
- **Pattern**: Industry Standard (AutoCAD/Figma/Blender)

### ADR-009: Ruler Corner Box Interactive
- **Canonical**: `RulerCornerBox` component
- **Features**: Single click (Fit), Double click (100%), Ctrl+Click (Previous)

### ADR-029: Canvas V2 Migration
- **Canonical**: `canvas-v2/` (ONLY active system)
- **Deprecated**: `_canvas_LEGACY/` (excluded from TypeScript)
- **API**: `DxfCanvasRef` (4 methods vs V1's 11 methods)

### ADR-043: Zoom Constants Consolidation
- **Canonical**: `transform-config.ts` (SSOT)
- **Deleted**: `zoom-constants.ts` middleman

### ADR-044: Canvas Line Widths Centralization
- **Canonical**: `RENDER_LINE_WIDTHS` from `text-rendering-config.ts`
- **Migration**: 32 hardcoded values → 17 files migrated

### ADR-045: Viewport Ready Guard
- **Pattern**: Fresh viewport + `COORDINATE_LAYOUT.MARGINS`
- **Fix**: First-click offset bug (~80px)

### ADR-046: Single Coordinate Transform
- **Pattern**: Pass WORLD coords to `onCanvasClick`
- **Fix**: Double conversion bug causing ~80px X-axis offset

### ADR-058: Canvas Drawing Primitives (Arc via Ellipse)
- **Canonical**: `rendering/primitives/canvasPaths.ts`
- **Decision**: Use `ctx.ellipse()` instead of `ctx.arc()` for all circle/arc rendering
- **Background**: `ctx.arc()` found unreliable with HiDPI canvas transforms
- **API**: `drawCircle()`, `drawArc()`, `addCirclePath()`, `addArcPath()`, `TAU`
- **Migration**: 23 files updated to use centralized primitives
- **Files Migrated**:
  - CircleRenderer.ts, EllipseRenderer.ts, BaseEntityRenderer.ts
  - SnapRenderer.ts, CursorRenderer.ts, OriginMarkersRenderer.ts, GridRenderer.ts
  - OverlayPass.ts, BackgroundPass.ts, ghost-entity-renderer.ts
  - angle-utils.ts, dot-rendering-utils.ts, GripShapeRenderer.ts
- **Exceptions**:
  - Canvas2DContext.ts (low-level wrapper - must keep raw API)
  - EllipseRenderer.ts (uses ctx.ellipse for actual ellipses with different radii)

### ADR-064: Shape Primitives Centralization
- **Canonical**: `rendering/primitives/canvasPaths.ts` (extends ADR-058)
- **Decision**: Centralize all shape path functions (square, diamond, cross, triangle, X)
- **API**: `addSquarePath()`, `addDiamondPath()`, `addCrossPath()`, `addTrianglePath()`, `addXPath()`
- **Problem**: Duplicate shape rendering code across 3 files (~100 lines)
- **Solution**: Single Source of Truth in canvasPaths.ts
- **Files Migrated**:
  - GripShapeRenderer.ts - uses `addDiamondPath()`
  - CursorRenderer.ts - uses `addSquarePath()`, `addDiamondPath()`, `addCrossPath()`
  - SnapRenderer.ts - uses all 5 shape primitives
- **Result**: 6 shape types centralized, zero duplicate path code

---

## 📊 **DATA & STATE MANAGEMENT**

### ADR-010: Panel Type Centralization
- **Canonical**: `types/panel-types.ts`
- **Type**: `FloatingPanelType = 'levels' | 'hierarchy' | 'overlay' | 'colors'`

### ADR-031: Enterprise Command Pattern (Undo/Redo)
- **Canonical**: `core/commands/`
- **Pattern**: GoF Command Pattern (AutoCAD/Photoshop/Figma)
- **Features**: Serialization, Audit Trail, Persistence, Batch Operations

### ADR-034: Geometry Calculations Centralization
- **Canonical**: `geometry-utils.ts` (SSOT for polygon calculations)
- **Separation**: Math (geometry-utils) ↔ Rendering (geometry-rendering-utils)

### ADR-065: Distance & Vector Operations Centralization
- **Canonical Functions** (from `geometry-rendering-utils.ts`):
  - `calculateDistance(p1, p2)` - Distance between two points
  - `normalizeVector(v)` - Normalize vector to unit length
  - `getUnitVector(from, to)` - Unit vector from point to point
  - `getPerpendicularUnitVector(from, to)` - Perpendicular unit vector (90° CCW)
- **Impact**:
  - Distance: 35+ inline implementations → 1 function
  - Vector normalization: 7 inline patterns → 3 functions
- **Files Migrated**:
  - **Distance**: 32 files across snapping, rendering, hooks, utils
  - **Vector**: line-utils.ts, line-rendering-utils.ts, constraints/utils.ts, ParallelSnapEngine.ts, text-labeling-utils.ts, LineRenderer.ts, BaseEntityRenderer.ts
- **Pattern**: Single Source of Truth (SSOT)
- **Eliminated Patterns**:
  - `unitX = dx / length; unitY = dy / length;` → `getUnitVector()`
  - `perpX = -dy / length; perpY = dx / length;` → `getPerpendicularUnitVector()`
- **Benefits**:
  - Zero duplicate distance/vector calculations
  - Consistent math (no typos in normalization)
  - Easy maintenance and optimization
  - Type-safe Point2D interface

### ADR-066: Angle Calculation Centralization
- **Canonical**: `calculateAngle()` from `geometry-rendering-utils.ts`
- **Impact**: 9+ inline `Math.atan2(dy, dx)` implementations → 1 function
- **Files Migrated**:
  - `ArcDragMeasurement.ts` - Arc grip angle calculation
  - `AngleMeasurementRenderer.ts` - Angle measurement arc/text
  - `distance-label-utils.ts` - Label rotation angles
  - `text-labeling-utils.ts` - Edge text positioning
  - `TangentSnapEngine.ts` - Tangent point calculations (bug fix!)
  - `PreviewRenderer.ts` - Angle preview arc
  - `BaseDragMeasurementRenderer.ts` - Base class angle method
  - `ghost-entity-renderer.ts` - Arrow head angle
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate angle calculations
  - Consistent API: `calculateAngle(from: Point2D, to: Point2D): number`
  - Fixed undefined dx/dy bug in TangentSnapEngine
  - Returns radians (multiply by `180/Math.PI` for degrees)
- **Companion**: ADR-065 (Distance Calculation)

### ADR-067: Radians/Degrees Conversion Centralization
- **Canonical**: `degToRad()`, `radToDeg()` from `geometry-utils.ts`
- **Constants**: `DEGREES_TO_RADIANS`, `RADIANS_TO_DEGREES`
- **Impact**: 15+ inline `Math.PI / 180` calculations → centralized functions
- **Files Migrated**:
  - `ArcRenderer.ts` - Arc angle conversions (4 locations)
  - `EllipseRenderer.ts` - Rotation angle conversion
  - `BaseEntityRenderer.ts` - Angle arc degrees display
  - `TextRenderer.ts` - Text rotation
  - `geometry-rendering-utils.ts` - Rendering transform rotation
  - `useDynamicInputHandler.ts` - Coordinate input angles
  - `useDynamicInputMultiPoint.ts` - Segment angle display
  - `AISnappingEngine.ts` - Prediction angles
  - `BaseDragMeasurementRenderer.ts` - Drag angle calculation
  - `ArcDragMeasurement.ts` - Arc grip angle (replaced local constant)
  - `useUnifiedDrawing.tsx` - Measure-angle tool
  - `PdfBackgroundCanvas.tsx` - PDF rotation transform
  - `dxf-entity-converters.ts` - DXF dimension text rotation
  - `line-utils.ts` - Arc hit test angle
  - `angle-calculation.ts` - Interior angle calculation
  - `constraints/config.ts` - Re-exports from centralized source
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline `Math.PI / 180` or `180 / Math.PI` calculations
  - Consistent, tested conversion functions
  - Constants available for performance-critical code
  - Removed 2 duplicate constant definitions
- **Companion**: ADR-065 (Distance), ADR-066 (Angle)

### ADR-068: Angle Normalization Centralization
- **Canonical**: `normalizeAngleRad()`, `normalizeAngleDeg()` from `geometry-utils.ts`
- **Impact**: 6+ inline angle normalization implementations → 2 functions
- **Files Migrated**:
  - `geometry-utils.ts` - `arcFrom3Points()` + `isAngleBetween()` internal normalizations
  - `line-utils.ts` - `hitTestArcEntity()` angle/startAngle/endAngle normalization
  - `angle-calculation.ts` - `calculateAngleData()` positive angle conversion
  - `useUnifiedDrawing.tsx` - `measure-angle` tool angle conversion
  - `constraints/utils.ts` - `AngleUtils.normalizeAngle` delegates to canonical
- **Pattern**: Single Source of Truth (SSOT)
- **Algorithm**: `modulo + if` (more efficient than while loops for extreme values)
- **Benefits**:
  - Zero duplicate angle normalization code
  - Consistent output ranges: radians [0, 2π), degrees [0, 360)
  - Handles extreme values (multiple wraps) efficiently
  - Type-safe APIs with JSDoc examples
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-067 (Deg↔Rad Conversion)

### ADR-069: Number Formatting Centralization (formatDistance/formatAngle)
- **Canonical**: `formatDistance()`, `formatAngle()` from `distance-label-utils.ts`
- **Impact**: 2 duplicate formatDistance implementations → 1 canonical
- **Files Migrated**:
  - `distance-label-utils.ts` - Canonical source (added formatAngle)
  - `useDynamicInputMultiPoint.ts` - Re-exports from canonical (backward compatibility)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `formatDistance(distance: number, decimals?: number): string` (default: 2 decimals)
  - `formatAngle(angle: number, decimals?: number): string` (default: 1 decimal, includes °)
- **Benefits**:
  - Zero duplicate number formatting code
  - Configurable decimal precision
  - Consistent formatting across DXF Viewer
  - Special case handling for near-zero values
- **Companion**: ADR-065 (Distance Calc), ADR-066 (Angle Calc), ADR-041 (Distance Labels)

### ADR-070: Vector Magnitude Centralization
- **Canonical**: `vectorMagnitude()` from `geometry-rendering-utils.ts`
- **Impact**: 15+ inline `Math.sqrt(v.x * v.x + v.y * v.y)` implementations → 1 function
- **Difference from ADR-065**:
  - `calculateDistance(p1, p2)`: Distance between **2 Point2D** → `Math.sqrt((p2.x-p1.x)² + (p2.y-p1.y)²)`
  - `vectorMagnitude(v)`: Length of **1 vector** → `Math.sqrt(v.x² + v.y²)`
- **Files Migrated**:
  - `PolylineRenderer.ts` - Rectangle detection (4 side lengths)
  - `BaseEntityRenderer.ts` - Angle arc rendering (prevLength, nextLength, bisectorLength, centerLength)
  - `geometry-utils.ts` - `angleBetweenPoints()` vector magnitudes (mag1, mag2)
  - `useDynamicInputMultiPoint.ts` - Angle calculation between segments (4 magnitudes)
  - `constraints/utils.ts` - Polar coordinate distance
- **Bonus Fix**: `useGripMovement.ts` now uses `calculateDistance()` instead of inline calc
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate vector magnitude calculations
  - Consistent API: `vectorMagnitude(vector: Point2D): number`
  - Clear distinction from distance calculation
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance Calculation), ADR-066 (Angle Calculation)

### ADR-071: Clamp Function Centralization
- **Canonical**: `clamp()`, `clamp01()`, `clamp255()` from `geometry-utils.ts`
- **Impact**: 40+ inline `Math.max(min, Math.min(max, value))` implementations → 3 functions
- **Files Migrated (Phase 1 - Core)**:
  - `geometry-utils.ts` - Canonical source (added `clamp01()`, `clamp255()`)
  - `domain.ts` - Removed local clamp const, uses import
  - `calculations.ts` - `clampScale()` now uses centralized clamp
  - `pdf.types.ts` - `clampPageNumber()`, `clampOpacity()`, `clampScale()` use centralized
- **Files Migrated (Phase 2 - High-Impact)**:
  - `FitToViewService.ts` - safePadding and scale calculations (4 patterns)
  - `gripSettings.ts` - validateGripSettings (5 patterns)
  - `GridSpatialIndex.ts` - Grid cell clamping (5 patterns)
  - `useColorMenuState.ts` - Coordinate validation (2 patterns)
  - `DxfViewerComponents.styles.ts` - Progress bar (2 patterns)
  - `transform-config.ts` - validateScale, validateOffset
  - `SpatialUtils.ts` - calculateOptimalGridSize
  - `HitTester.ts` - closestPointOnLine param
  - `input-validation.ts` - normalizeNumericInput
  - `GripSizeCalculator.ts` - clampSize
  - `ui/color/utils.ts` - RGB value clamping (uses clamp255)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `clamp(value, min, max)`: Generic clamping
  - `clamp01(value)`: [0, 1] range (opacity, alpha)
  - `clamp255(value)`: [0, 255] range (RGB)
- **Benefits**:
  - Zero duplicate clamp implementations
  - Semantic wrappers for common use cases
  - Consistent, tested clamping behavior
  - Type-safe number parameters
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-067 (Deg↔Rad), ADR-070 (Magnitude)

### ADR-072: Dot Product Centralization
- **Canonical**: `dotProduct()` from `geometry-rendering-utils.ts`
- **Impact**: 9+ inline `v1.x * v2.x + v1.y * v2.y` implementations → 1 function
- **Difference from ADR-070**:
  - `vectorMagnitude(v)`: Length of **1 vector** → `Math.sqrt(v.x² + v.y²)`
  - `dotProduct(v1, v2)`: Inner product of **2 vectors** → `v1.x * v2.x + v1.y * v2.y`
- **Files Migrated**:
  - `PolylineRenderer.ts` - Rectangle perpendicularity check (2 patterns)
  - `geometry-utils.ts` - `angleBetweenPoints()` vector angle calculation
  - `useDynamicInputMultiPoint.ts` - Angle calculation between segments (2 patterns)
  - `useUnifiedDrawing.tsx` - Measure-angle tool angle calculation
  - `angle-calculation.ts` - `calculateAngleData()` angle between vectors
- **Files NOT Migrated (special cases)**:
  - `geometry-utils.ts:62` - Uses normalized direction (not Point2D vectors)
  - `geometry-utils.ts:97` - Uses raw dx/dy components (not Point2D)
  - `HitTester.ts:624` - Uses abbreviated vars A,B,C,D (not Point2D structure)
  - `BaseEntityRenderer.ts:686` - Uses cos/sin values directly (not Point2D)
- **Pattern**: Single Source of Truth (SSOT)
- **Mathematical Properties**:
  - `v1 · v2 = |v1| * |v2| * cos(θ)`
  - If `dot = 0`, vectors are perpendicular
  - If `dot > 0`, angle < 90°
  - If `dot < 0`, angle > 90°
- **Benefits**:
  - Zero duplicate dot product calculations
  - Consistent API: `dotProduct(v1: Point2D, v2: Point2D): number`
  - Clear distinction from magnitude/distance calculations
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-070 (Magnitude), ADR-066 (Angle)

### ADR-073: Midpoint/Bisector Calculation Centralization
- **Canonical**:
  - `calculateMidpoint()` from `geometry-rendering-utils.ts`
  - `bisectorAngle()` from `geometry-utils.ts`
  - `SpatialUtils.boundsCenter()` from `SpatialUtils.ts`
- **Impact**: 55+ inline `(a + b) / 2` implementations → 3 centralized functions
- **Categories**:
  - **Point Midpoints**: `(p1.x + p2.x) / 2, (p1.y + p2.y) / 2` → `calculateMidpoint(p1, p2)`
  - **Bisector Angles**: `(angle1 + angle2) / 2` → `bisectorAngle(angle1, angle2)`
  - **Bounds Centers**: `(minX + maxX) / 2` → `SpatialUtils.boundsCenter(bounds)`
- **Files Migrated (Point Midpoints)**:
  - `line-utils.ts` - Edge grip midpoints, gap calculations (4 patterns)
  - `phase-text-utils.ts` - Distance text positioning (2 patterns)
  - `BaseEntityRenderer.ts` - Distance text positioning (2 patterns)
  - `text-labeling-utils.ts` - Edge text positioning (1 pattern)
  - `entity-conversion.ts` - Overlay edge midpoints (1 pattern)
  - `LayerRenderer.ts` - Edge grip midpoints (1 pattern)
  - `SplineRenderer.ts` - Bezier midpoints (1 pattern)
  - `UnifiedGripRenderer.ts` - Midpoint grips (1 pattern)
- **Files Migrated (Bisector Angles)**:
  - `AngleMeasurementRenderer.ts` - Angle label positioning (1 pattern)
  - `BaseEntityRenderer.ts` - Corner arc label (1 pattern)
  - `PreviewRenderer.ts` - Angle preview text (1 pattern)
- **Re-export**: `geometry-utils.ts` re-exports `calculateMidpoint` for convenience
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `calculateMidpoint(p1: Point2D, p2: Point2D): Point2D`
  - `bisectorAngle(angle1: number, angle2: number): number`
  - `SpatialUtils.boundsCenter(bounds: SpatialBounds): Point2D`
- **Benefits**:
  - Zero duplicate midpoint/bisector calculations
  - Consistent, type-safe Point2D interface
  - Clear semantic separation (points vs angles vs bounds)
  - Companion to distance/angle calculations
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-070 (Magnitude)

### ADR-074: Point On Circle Centralization
- **Canonical**: `pointOnCircle()` from `geometry-rendering-utils.ts`
- **Impact**: 13 inline `center.x + radius * Math.cos(angle)` implementations → 1 function
- **Difference from other ADRs**:
  - `calculateDistance(p1, p2)`: Distance between **2 Point2D**
  - `vectorMagnitude(v)`: Length of **1 vector**
  - `dotProduct(v1, v2)`: Inner product of **2 vectors**
  - `pointOnCircle(center, radius, angle)`: **Polar → Cartesian** conversion
- **Files Migrated**:
  - `ArcRenderer.ts` - Arc start/end/mid points for rendering and grips (4 patterns)
  - `GeometricCalculations.ts` - Arc endpoints and midpoints for snapping (4 patterns)
  - `NodeSnapEngine.ts` - Arc start/end snap points (2 patterns)
  - `GeometryUtils.ts` - Arc tessellation for export (1 pattern)
- **Mathematical Formula**:
  - `x = center.x + radius * cos(angle)`
  - `y = center.y + radius * sin(angle)`
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate polar-to-cartesian conversions
  - Consistent API: `pointOnCircle(center: Point2D, radius: number, angle: number): Point2D`
  - Angle in radians (0 = right, π/2 = up, π = left, 3π/2 = down)
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-070 (Magnitude), ADR-072 (Dot Product)

### ADR-075: Grip Size Multipliers Centralization
- **Canonical**: `GRIP_SIZE_MULTIPLIERS` from `rendering/grips/constants.ts`
- **Impact**: Fixed **visual inconsistency** - grips had different sizes (1.2/1.4 vs 1.25/1.5)
- **Standard Values** (AutoCAD/BricsCAD):
  - `COLD`: 1.0 (normal state)
  - `WARM`: 1.25 (hover state, +25%)
  - `HOT`: 1.5 (active/drag state, +50%)
- **Files Migrated**:
  - `LayerRenderer.ts` - Overlay grip rendering (was 1.2/1.4, now 1.25/1.5)
  - `GripProvider.tsx` - Grip context helper (was 1.2/1.4, now 1.25/1.5)
  - `BaseEntityRenderer.ts` - Entity grip rendering (was hardcoded 1.25/1.5)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero grip size inconsistency (all grips use same multipliers)
  - AutoCAD-standard visual feedback
  - Single place to change grip size behavior
- **Companion**: ADR-048 (Unified Grip Rendering System)

### ADR-076: RGB ↔ HEX Color Conversion Centralization
- **Canonical**: `parseHex()`, `rgbToHex()` from `ui/color/utils.ts`
- **Impact**: 12+ inline color conversion implementations → 2 functions
- **Files Migrated**:
  - `aci.ts` - Removed duplicate `hexToRgb()`, uses `parseHex()`
  - `useContrast.ts` - Removed duplicate `hexToRgb()` and `rgbToHex()`, uses imports
  - `LegacyGridAdapter.ts` - Uses `parseHex()` and `rgbToHex()` for color darkening/lightening
  - `domain.ts` - Uses `rgbToHex()` for RGB→HEX conversion
  - `RulerBackgroundSettings.tsx` - Uses `rgbToHex()` for rgba→hex extraction
  - `RulerMajorLinesSettings.tsx` - Uses `rgbToHex()` in `getBaseColor()`
  - `RulerMinorLinesSettings.tsx` - Uses `rgbToHex()` in `getBaseColor()`
  - `RulerUnitsSettings.tsx` - Uses `rgbToHex()` in `getPreviewColor()`
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `parseHex(hex: string): RGBColor` - Parses #RGB, #RRGGBB, #RRGGBBAA
  - `rgbToHex(rgb: RGBColor, options?: FormatOptions): string` - Converts RGB to hex
- **Benefits**:
  - Zero duplicate color conversion code
  - Consistent parsing with error handling
  - Support for shorthand (#RGB) and alpha (#RRGGBBAA)
  - Type-safe RGBColor interface
- **Companion**: ADR-004 (Canvas Theme System)

### ADR-077: TAU Constant Centralization (2 * Math.PI)
- **Canonical**: `TAU` from `rendering/primitives/canvasPaths.ts`
- **Re-export**: `TAU` also available from `rendering/entities/shared/geometry-utils.ts`
- **Impact**: 42 inline `Math.PI * 2` / `2 * Math.PI` patterns → 1 constant
- **Files Migrated** (16 files):
  - `canvasPaths.ts` - Canonical source (line 222)
  - `geometry-utils.ts` - Re-exports TAU, removed duplicate private const
  - `OverlayPass.ts` - Grips & snap circles (3 usages)
  - `EntityPass.ts` - Circle entity (1 usage)
  - `BackgroundPass.ts` - Origin marker (1 usage)
  - `BaseEntityRenderer.ts` - Angle arc calculations (4 usages)
  - `AngleMeasurementRenderer.ts` - Angle normalization (2 usages)
  - `CircleRenderer.ts` - Circumference calc (2 usages)
  - `PreviewRenderer.ts` - Circle preview (1 usage)
  - `LayerRenderer.ts` - Grid dots (1 usage)
  - `NearSnapEngine.ts` - Point on circle (2 usages)
  - `angle-calculation.ts` - Angle calculations (5 usages)
  - `OriginMarkersDebugOverlay.ts` - Debug circle (1 usage)
  - `CursorSnapAlignmentDebugOverlay.ts` - Debug snap point (1 usage)
  - `CalibrationGridRenderer.ts` - Calibration grid (1 usage)
  - `CircleDragMeasurement.ts` - Circumference calc (1 usage)
- **Pattern**: Single Source of Truth (SSOT)
- **API**: `export const TAU = Math.PI * 2;`
- **Benefits**:
  - Zero inline full-circle angle patterns
  - Mathematical clarity (τ = 2π is the "true" circle constant)
  - Single point of change if precision adjustments needed
  - Consistent naming across codebase
- **Companion**: ADR-058 (Canvas Drawing Primitives)

### ADR-078: Vector Angle & Angle Between Vectors Centralization
- **Canonical**: `vectorAngle()`, `angleBetweenVectors()` from `geometry-rendering-utils.ts`
- **Impact**: 20 inline `Math.atan2()` implementations → 2 functions + existing `calculateAngle()`
- **Difference from ADR-066**:
  - `calculateAngle(from, to)`: Angle from point A **to point B** → `atan2(to.y - from.y, to.x - from.x)`
  - `vectorAngle(v)`: Angle of a **single vector** from origin → `atan2(v.y, v.x)`
  - `angleBetweenVectors(v1, v2)`: **Signed angle** between 2 vectors → `atan2(cross, dot)`
- **Files Migrated**:
  - `BaseEntityRenderer.ts` - Distance text angle, angle arc unit vectors (4 patterns)
  - `constraints/utils.ts` - `angleBetweenPoints()`, `cartesianToPolar()` (2 patterns)
  - `useUnifiedDrawing.tsx` - Measure-angle tool calculation (1 pattern)
  - `dxf-entity-converters.ts` - Dimension text rotation (1 pattern)
- **Files NOT Migrated (centralized functions)**:
  - `geometry-utils.ts` - Already centralized functions (`angleFromHorizontal`, `arcFrom3Points`, `arcFromCenterStartEnd`)
  - `angle-calculation.ts` - Already centralized functions (`calculateAngleData`, `getArcAngles`)
  - `line-utils.ts` - Uses existing centralized functions
- **Pattern**: Single Source of Truth (SSOT)
- **Mathematical Properties**:
  - `vectorAngle(v)`: Range [-π, π] radians from positive X-axis
  - `angleBetweenVectors(v1, v2)`: Positive = v2 CCW from v1, Negative = v2 CW from v1
- **Benefits**:
  - Zero duplicate atan2 angle calculations
  - Clear semantic separation (point→point vs vector vs vector→vector)
  - Consistent, type-safe Point2D interface
  - Cross/dot product properly encapsulated
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-072 (Dot Product), ADR-073 (Bisector)

### ADR-079: Geometric Epsilon/Precision Centralization
- **Canonical**: `GEOMETRY_PRECISION`, `AXIS_DETECTION`, `MOVEMENT_DETECTION`, `VECTOR_PRECISION`, `ENTITY_LIMITS` from `tolerance-config.ts`
- **Impact**: 25 inline epsilon/precision values (1e-10, 1e-6, 1e-3, 0.001, 0.01) → 5 centralized constant objects
- **Problem**: Inconsistent precision values scattered across 16 files
- **Solution**: Extended tolerance-config.ts with semantic precision categories
- **Constant Categories**:
  - `GEOMETRY_PRECISION`: Ultra-high precision for intersections (1e-10), vertex duplicates (1e-6), point matching (0.001)
  - `AXIS_DETECTION`: Zero/axis proximity (0.001), grid major line detection
  - `MOVEMENT_DETECTION`: Min movement (0.001), zoom change (0.001), zoom preset match (0.01)
  - `VECTOR_PRECISION`: Min magnitude for safe division (0.001)
  - `ENTITY_LIMITS`: Min entity size (0.001), constraint tolerance (0.001)
- **Files Migrated**:
  - `GeometricCalculations.ts` - Line/circle intersection thresholds (3 patterns)
  - `geometry-utils.ts` - Collinear points check (1 pattern)
  - `GeometryUtils.ts` - EPS constant, vertex duplicate (2 patterns)
  - `region-operations.ts` - Region epsilon (1 pattern)
  - `GridSnapEngine.ts` - Major grid detection (2 patterns)
  - `rulers-grid/utils.ts` - Zero threshold (4 patterns)
  - `CenterSnapEngine.ts` - Duplicate center (1 pattern)
  - `AISnappingEngine.ts` - History point match (1 pattern)
  - `useUnifiedDrawing.tsx` - Projection point (2 patterns)
  - `useDynamicInputMultiPoint.ts` - Vector magnitude (2 patterns)
  - `ZoomControls.tsx` - Zoom change detection (1 pattern)
  - `CanvasSection.tsx` - Movement detection (1 pattern)
  - `RulerCornerBox.tsx` - Zoom preset matching (2 patterns)
  - `entity-creation/config.ts` - Min entity size (1 pattern)
  - `constraints/config.ts` - Global tolerance (1 pattern)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline precision values (except tolerance-config.ts)
  - Semantic constant naming (DENOMINATOR_ZERO vs magic number)
  - Single point of change for precision tuning
  - Consistent calculation accuracy across systems
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-034 (Geometry Centralization)

### ADR-080: Rectangle Bounds Centralization (rectFromTwoPoints)
- **Canonical**: `rectFromTwoPoints()`, `RectBounds` from `geometry-rendering-utils.ts`
- **Impact**: 10+ inline bounding box calculations → 1 function
- **Problem**: Duplicate `Math.min(p1.x, p2.x)` / `Math.abs(p2.x - p1.x)` patterns scattered across files
- **Solution**: Centralized `rectFromTwoPoints(p1, p2): RectBounds` function
- **Mathematical Formula**:
  - `x = Math.min(p1.x, p2.x)`
  - `y = Math.min(p1.y, p2.y)`
  - `width = Math.abs(p2.x - p1.x)`
  - `height = Math.abs(p2.y - p1.y)`
- **Interface**:
  ```typescript
  interface RectBounds { x: number; y: number; width: number; height: number; }
  ```
- **Files Migrated**:
  - `PreviewRenderer.ts` - Rectangle preview bounds (1 pattern)
  - `ZoomWindowOverlay.tsx` - Zoom window rectangle (1 pattern)
  - `SelectionMarqueeOverlay.tsx` - Selection marquee rectangle (1 pattern)
  - `SelectionRenderer.ts` - Selection box rendering (1 pattern)
  - `useZoomWindow.ts` - Zoom window state updates (2 patterns)
  - `ghost-entity-renderer.ts` - Ghost rectangle & simplified bounds (2 patterns)
- **Usage Examples**:
  ```typescript
  const { x, y, width, height } = rectFromTwoPoints(corner1, corner2);
  ctx.strokeRect(x, y, width, height);

  const { x: left, y: top, width, height } = rectFromTwoPoints(startPoint, currentPoint);
  ```
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate bounding box calculations
  - Consistent x/y (top-left) + width/height output
  - Type-safe RectBounds interface
  - Destructuring support with rename (`x: left`)
- **Companion**: ADR-065 (Distance), ADR-073 (Midpoint), ADR-074 (Point On Circle)

### ADR-081: Percentage Formatting Centralization (formatPercent)
- **Canonical**: `formatPercent()` from `distance-label-utils.ts`
- **Impact**: 22 inline `Math.round(value * 100)%` implementations → 1 function
- **Problem**: Duplicate percentage formatting patterns scattered across 12 files for:
  - Opacity display (0-1 → 0%-100%)
  - Zoom display (0.5-10 → 50%-1000%)
  - Alpha channel display
- **Solution**: Centralized `formatPercent(value, includeSymbol?)` function
- **API**:
  ```typescript
  formatPercent(value: number, includeSymbol: boolean = true): string
  // formatPercent(0.75)        → "75%"
  // formatPercent(0.75, false) → "75"
  ```
- **Files Migrated**:
  - `distance-label-utils.ts` - Canonical source (ADR-069 companion)
  - `SelectionSettings.tsx` - Window/crossing opacity (4 patterns)
  - `LineSettings.tsx` - Line opacities (3 patterns)
  - `CursorSettings.tsx` - Cursor opacity (1 pattern)
  - `GripSettings.tsx` - Grip opacity (1 pattern)
  - `CurrentSettingsDisplay.tsx` - Summary display (1 pattern)
  - `EnterpriseColorSlider.tsx` - Alpha channel (1 pattern)
  - `ZoomControls.tsx` - Zoom input (2 patterns)
  - `RulerCornerBox.tsx` - Corner zoom (1 pattern)
  - `ToolbarStatusBar.tsx` - Status bar (1 pattern)
  - `PdfControlsPanel.tsx` - Scale & opacity (2 patterns)
  - `usePanelDescription.ts` - Zoom description (1 pattern)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline percentage formatting
  - Consistent rounding (Math.round)
  - Optional % symbol for i18n interpolation
  - Companion to formatDistance/formatAngle
- **Companion**: ADR-069 (Number Formatting), ADR-043 (Zoom Constants)

---

## ✏️ **DRAWING SYSTEM**

### ADR-005: Line Drawing System
- **Canonical**: `useUnifiedDrawing` + `LineRenderer`
- **Lines**: 2,300+ (centralized)
- **Pattern**: 3-phase rendering (preview → completion → normal)

### ADR-032: Drawing State Machine
- **Canonical**: `core/state-machine/`
- **Pattern**: Formal State Machine (XState patterns)
- **States**: IDLE → TOOL_READY → COLLECTING_POINTS → COMPLETING → COMPLETED

### ADR-040: Preview Canvas Performance
- **Canonical**: `canvas-v2/preview-canvas/` + `PreviewRenderer`
- **Performance**: ~250ms → <16ms per frame

### ADR-041: Distance Label Centralization
- **Canonical**: `renderDistanceLabel()` from `distance-label-utils.ts`

### ADR-047: Close Polygon on First-Point Click
- **Pattern**: AutoCAD/BricsCAD pattern for area measurement

### ADR-048: Unified Grip Rendering System
- **Canonical**: `UnifiedGripRenderer` (Facade Pattern)
- **Result**: ~90 lines duplicate code removed
- **📄 Full Details**: [ADR-048-unified-grip-rendering.md](./adrs/ADR-048-unified-grip-rendering.md)

### ADR-049: Unified Move Tool (DXF + Overlays)
- **Canonical**: `MoveOverlayCommand.ts` (380+ lines)
- **Pattern**: Command Pattern with undo/redo

### ADR-053: Drawing Context Menu
- **Canonical**: `DrawingContextMenu.tsx`
- **Pattern**: AutoCAD-style right-click menu

### ADR-056: Centralized Entity Completion Styles
- **Canonical**: `applyCompletionStyles()` from `useLineCompletionStyle.ts`
- **Pattern**: AutoCAD "Current Properties"

### ADR-057: Unified Entity Completion Pipeline
- **Canonical**: `completeEntity()` from `hooks/drawing/completeEntity.ts`
- **Result**: 4 code paths → 1 function

---

## 🔐 **SECURITY & AUTHENTICATION**

### ADR-020: Centralized Auth Module
- **Canonical**: `src/auth/` module
- **Deleted**: `FirebaseAuthContext.tsx`, `UserRoleContext.tsx`
- **Import**: `import { AuthProvider, useAuth } from '@/auth'`

### ADR-020.1: Conditional App Shell Layout
- **Canonical**: `ConditionalAppShell`
- **Pattern**: Auth routes → standalone layout

### ADR-024: Environment Security Configuration
- **Canonical**: `src/config/environment-security-config.ts`
- **Pattern**: Graduated security policies (Microsoft Azure/Google Cloud)

### ADR-062: No Debug Endpoints in Production
- **Policy**: Debug/analysis endpoints **SHALL NOT** exist in production
- **Alternative**: Offline scripts in `scripts/` directory
- **Enforcement**: Code review + CI/CD gates
- **📄 Full Details**: [ADR-062-no-debug-endpoints-in-production.md](./adrs/ADR-062-no-debug-endpoints-in-production.md)

### ADR-063: Company Isolation Custom Claims
- **Canonical**: Firebase Custom Claims (`companyId`, `globalRole`)
- **Storage Rules**: `belongsToCompany(companyId)` function
- **Pattern**: Tenant isolation via ID token claims
- **📄 Full Details**: [ADR-063-company-isolation-custom-claims.md](./adrs/ADR-063-company-isolation-custom-claims.md)

---

## ⚡ **PERFORMANCE**

### ADR-019: Centralized Performance Thresholds
- **Canonical**: `PERFORMANCE_THRESHOLDS` from `performance-utils.ts`
- **Pattern**: Centralized FPS/memory/render time limits

### ADR-030: Unified Frame Scheduler
- **Canonical**: `UnifiedFrameScheduler` singleton
- **Pattern**: Single RAF loop with priority queue

### ADR-036: Enterprise Structured Logging
- **Canonical**: `Logger` from `@/lib/telemetry`
- **Deprecated**: `console.log/warn/info/debug`
- **ESLint**: `custom/no-console-log` (warn mode)

---

## 🔍 **FILTERS & SEARCH**

### ADR-029: Global Search System v1
- **Canonical**: `/api/search` + `src/types/search.ts`
- **Features**: Greek-friendly, prefix matching, tenant isolation

### ADR-051: Enterprise Filter System Centralization
- **Canonical**: `@/components/core/AdvancedFilters/`
- **Hooks**: `useGenericFilters` + `applyFilters`
- **Result**: 7 files deleted, 16 consumers migrated

---

## ⌨️ **TOOLS & KEYBOARD**

### ADR-026: DXF Toolbar Colors System
- **Canonical**: `toolbar-colors.ts`
- **Pattern**: Semantic color mapping (CAD Industry Standard)

### ADR-027: DXF Keyboard Shortcuts System
- **Canonical**: `keyboard-shortcuts.ts`
- **API**: `matchesShortcut()`, `getShortcutDisplayLabel()`
- **Pattern**: AutoCAD F-key standards

### ADR-028: Button Component Consolidation
- **Canonical**: Shadcn Button + `ui/toolbar/ToolButton`
- **Strategy**: Migrate on touch (49 files)

### ADR-035: Tool Overlay Mode Metadata
- **Property**: `preservesOverlayMode: boolean` in `ToolInfo`
- **Helper**: `preservesOverlayMode(tool: ToolType)`

### ADR-038: Centralized Tool Detection Functions
- **Functions**: `isDrawingTool()`, `isMeasurementTool()`, `isInteractiveTool()`
- **Source**: `ToolStateManager.ts` (SSOT)

### ADR-055: Centralized Tool State Persistence
- **Canonical**: `ToolStateStore.ts`
- **Pattern**: `useSyncExternalStore` + `allowsContinuous`

---

## 🏢 **ENTITY SYSTEMS**

### ADR-012: Entity Linking Service
- **Canonical**: `EntityLinkingService` from `@/services/entity-linking`
- **Features**: Retry, Cache, Audit Trail, Optimistic Updates

### ADR-017: Enterprise ID Generation
- **Canonical**: `@/services/enterprise-id.service`
- **Prohibited**: `Math.random()` for ID generation

### ADR-018: Unified Upload Service
- **Canonical**: `UnifiedUploadService` from `@/services/upload`
- **Pattern**: Gateway + Strategy Pattern

### ADR-018.1: Photos Tab Base Template
- **Canonical**: `PhotosTabBase` from photo-system
- **Result**: 79% code reduction

### ADR-025: Unit Linking System
- **Components**: `BuildingSelectorCard`, `LinkedSpacesCard`
- **Pattern**: Dependency Injection + Real-time Firestore

### ADR-052: DXF Export API Contract
- **Canonical**: `types/dxf-export.types.ts`
- **Types**: 18 entity mappings, 7 DXF versions, 17 error codes

### ADR-054: Enterprise Upload System Consolidation
- **Canonical**: 5 canonical components
- **Pipeline**: pending → upload → finalize

---

## 🔧 **BACKEND SYSTEMS**

### ADR-059: Separate Audit Bootstrap from Projects List
- **APIs**: `/api/audit/bootstrap` (navigation) vs `/api/projects/list` (grid)
- **Pattern**: Single Responsibility Principle
- **Benefit**: Independent caching, clear contracts, no scope creep
- **📄 Full Details**: [ADR-059-separate-audit-bootstrap-from-projects-list.md](./adrs/ADR-059-separate-audit-bootstrap-from-projects-list.md)

### ADR-060: Building Floorplan Enterprise Storage
- **Canonical**: `DxfFirestoreService` for DXF scene storage
- **Storage**: Firebase Storage (scenes) + Firestore (metadata)
- **Pattern**: No 1MB Firestore document limit
- **📄 Full Details**: [ADR-060-building-floorplan-enterprise-storage.md](./adrs/ADR-060-building-floorplan-enterprise-storage.md)

---

## 🏗️ **INFRASTRUCTURE**

### ADR-061: Path Aliases Strategy
- **Canonical Source**: `tsconfig.base.json` (root level)
- **Prefixes**: `@/*`, `@/systems/*`, `@geo-alert/core`, `@core/*`
- **Rule**: No ad-hoc aliases without ADR update
- **📄 Full Details**: [ADR-061-path-aliases.md](./adrs/ADR-061-path-aliases.md)

---

## 🚫 **GLOBAL PROHIBITIONS**

> Από όλα τα ADRs, αυτές είναι οι κύριες απαγορεύσεις:

| Prohibition | Alternative | ADR |
|-------------|-------------|-----|
| `as any` / `@ts-ignore` | Proper TypeScript types | CLAUDE.md |
| Hardcoded z-index | `var(--z-index-*)` | ADR-002 |
| Hardcoded canvas backgrounds | `CANVAS_THEME` | ADR-004 |
| New drawing implementations | `useUnifiedDrawing` | ADR-005 |
| Direct `getBoundingClientRect()` | `canvasBoundsService.getBounds()` | ADR-008 |
| Hardcoded Tailwind colors | `useSemanticColors()` | ADR-011 |
| Hardcoded entity icons | `NAVIGATION_ENTITIES` | ADR-014 |
| `Math.random()` for IDs | `enterprise-id.service` | ADR-017 |
| Direct `Loader2` import | `Spinner` component | ADR-023 |
| Hardcoded keyboard shortcuts | `matchesShortcut()` | ADR-027 |
| `useState` for tool state | `useToolState()` | ADR-055 |
| Direct scene manipulation | `completeEntity()` | ADR-057 |
| `console.log` | `Logger` | ADR-036 |

---

## 📚 **RELATED DOCUMENTATION**

- **[API Reference](./api-quick-reference.md)** - Import examples & usage
- **[Design System](../design-system/index.md)** - Design tokens & hooks
- **[Smart Factories](../smart-factories/index.md)** - Dynamic configuration
- **[Data Systems](../data-systems/index.md)** - State & data management
- **[UI Systems](../ui-systems/index.md)** - User interface systems

---

> **💡 Tip**: Use `Ctrl+F` to search for specific ADR numbers or keywords
>
> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
