# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής

**📊 Stats**: 128 ADRs (ADR-130 Default Layer Name Centralization) | Last Updated: 2026-02-01

---

## 🎯 **QUICK NAVIGATION**

| Category | ADR Range | Quick Jump |
|----------|-----------|------------|
| **UI Components** | ADR-001 to ADR-003 | [View](#-ui-components) |
| **Design System** | ADR-002, ADR-004, ADR-011 | [View](#-design-system) |
| **Canvas & Rendering** | ADR-004 to ADR-009, ADR-115 | [View](#-canvas--rendering) |
| **Data & State** | ADR-010, ADR-030 to ADR-034 | [View](#-data--state-management) |
| **Drawing System** | ADR-005, ADR-040 to ADR-048 | [View](#-drawing-system) |
| **Security & Auth** | ADR-020, ADR-024, ADR-062, ADR-063 | [View](#-security--authentication) |
| **Backend Systems** | ADR-059, ADR-060 | [View](#-backend-systems) |
| **Infrastructure** | ADR-061 | [View](#-infrastructure) |
| **Performance** | ADR-019, ADR-030, ADR-040 | [View](#-performance) |
| **Filters & Search** | ADR-029, ADR-051 | [View](#-filters--search) |
| **Tools & Keyboard** | ADR-026 to ADR-028, ADR-035, ADR-038, ADR-055 | [View](#-tools--keyboard) |
| **Entity Systems** | ADR-012 to ADR-018, ADR-025, ADR-052 to ADR-057, ADR-104 | [View](#-entity-systems) |

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
| **ADR-082** | Enterprise Number Formatting System (AutoCAD-Grade) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-083** | Line Dash Patterns Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-084** | Scattered Code Centralization (Draggable + Canvas State) | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-085** | Split Line Rendering Centralization | ✅ APPROVED | 2026-01-31 | Drawing System |
| **ADR-086** | Hover Utilities Scattered Code Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-087** | Snap Engine Configuration Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-088** | Pixel-Perfect Rendering Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-089** | Point-In-Bounds Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-090** | Point Vector Operations Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-091** | Scattered Code Centralization (Fonts + Formatting) | ✅ APPROVED | 2026-01-31 | Design System |
| **ADR-092** | Centralized localStorage Service | ✅ APPROVED | 2026-01-31 | Infrastructure |
| **ADR-093** | Text Label Offsets Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-094** | Device Pixel Ratio Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-095** | Snap Tolerance Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-096** | Interaction Timing Constants Centralization | ✅ APPROVED | 2026-01-31 | Tools & Keyboard |
| **ADR-098** | Timing Delays Centralization (setTimeout/setInterval) | ✅ APPROVED | 2026-01-31 | Tools & Keyboard |
| **ADR-099** | Polygon & Measurement Tolerances Centralization | ✅ APPROVED | 2026-01-31 | Drawing System |
| **ADR-100** | Inline Degrees-to-Radians Conversion Centralization | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-101** | Deep Clone Centralization (deepClone utility) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-102** | Origin Markers Centralization (DXF/Layer/Debug) | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-103** | Angular Constants Centralization (RIGHT_ANGLE, ARROW_ANGLE) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-104** | Entity Type Guards Centralization (isLineEntity, isCircleEntity, etc.) | ✅ APPROVED | 2026-01-31 | Entity Systems |
| **ADR-105** | Hit Test Fallback Tolerance Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering |
| **ADR-106** | Edge Grip Size Multipliers Centralization | ✅ APPROVED | 2026-01-31 | Drawing System |
| **ADR-107** | UI Size Defaults Centralization (|| 10 / ?? 10) | ✅ APPROVED | 2026-01-31 | Design System |
| **ADR-108** | Text Metrics Ratios Centralization (0.6 / 0.75 / 0.8) | ✅ APPROVED | 2026-01-31 | Data & State |
| **ADR-109** | Squared Distance Centralization (calculateDistance) | ✅ APPROVED | 2026-02-01 | Data & State |
| **ADR-110** | Grid Subdivisions Centralization (|| 5 fallback) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-111** | Device Pixel Ratio Migration (inline → getDevicePixelRatio) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-112** | Text Rotation Pattern Centralization (normalizeTextAngle) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-113** | Cache TTL Centralization (300000ms / 600000ms / 60000ms) | ✅ APPROVED | 2026-02-01 | Performance |
| **ADR-114** | Bounding Box Calculation Centralization (calculateBoundingBox) | ✅ APPROVED | 2026-02-01 | Data & State |
| **ADR-115** | Canvas Context Setup Standardization (CanvasUtils.setupCanvasContext) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-116** | Primary Blue Color Centralization (#3b82f6 → UI_COLORS) | ✅ APPROVED | 2026-02-01 | Design System |
| **ADR-117** | DPI-Aware Pixel Calculations Centralization (toDevicePixels) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-118** | Canvas Viewport Hook Centralization (useCanvasResize) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-119** | RAF Consolidation to UnifiedFrameScheduler | ✅ IMPLEMENTED | 2026-02-01 | Performance |
| **ADR-120** | Canvas globalAlpha Opacity Centralization (OPACITY constant) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-121** | Zero Point Pattern Centralization (WORLD_ORIGIN, ZERO_VECTOR, EMPTY_BOUNDS) | ✅ APPROVED | 2026-02-01 | Data & State |
| **ADR-122** | CollaborationOverlay Line Width Centralization (ctx.lineWidth → RENDER_LINE_WIDTHS) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-123** | PreviewRenderer Color Centralization (hex → UI_COLORS) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-124** | Renderer Constants Centralization (DOT_RADIUS, TEXT_GAP, CIRCLE_LABEL) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-125** | Context Creation Pattern (Provider Colocation) | ✅ APPROVED | 2026-02-01 | Data & State |
| **ADR-126** | Bank Accounts System for Contacts | ✅ APPROVED | 2026-02-01 | Entity Systems |
| **ADR-127** | Ruler Dimensions Centralization (DEFAULT_RULER_HEIGHT/WIDTH) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering |
| **ADR-128** | Switch Status Variant (Green ON / Red OFF) | ✅ APPROVED | 2026-02-01 | UI Components |
| **ADR-129** | Layer Entity Filtering Centralization | ✅ IMPLEMENTED | 2026-02-01 | Entity Systems |
| **ADR-130** | Default Layer Name Centralization | ✅ IMPLEMENTED | 2026-02-01 | Entity Systems |
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

### ADR-128: Switch Status Variant (Green ON / Red OFF)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Switch components had no visual distinction for ON/OFF state
- **Decision**: Add `variant` prop to Switch component with centralized tokens
- **Canonical Location**: `@/components/ui/switch` + `@/design-system/color-bridge`
- **Variants Available**:
  - `default`: Primary when ON, input color when OFF
  - `status`: Green when ON, Red when OFF (visibility toggles)
  - `success`: Green when ON, muted when OFF
  - `destructive`: Red when ON, muted when OFF
- **Files Updated**: 6 Switch components in Ruler Settings
- **Pattern**: Centralized tokens in COLOR_BRIDGE.switch

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

### ADR-091: Scattered Code Centralization (Fonts + Formatting)
- **Decision**: Migrate hardcoded `ctx.font` strings and inline `.toFixed()` calls to centralized systems
- **Problem**: Two categories of scattered code identified:
  - **42 hardcoded `ctx.font`** strings across 22 files (e.g., `'12px Inter'`, `'14px Arial'`)
  - **245 inline `.toFixed()`** patterns across 94 files (e.g., `radius.toFixed(2)`)
- **Solution**: Use existing centralized systems from ADR-042 and ADR-069
- **Phase 1 Migrations** (15 high-impact files):
  - **Font Migrations** (8 files):
    - `CollaborationOverlay.tsx` → `UI_FONTS.INTER.NORMAL`, `UI_FONTS.INTER.BOLD_SMALL`
    - `PreviewRenderer.ts` → `UI_FONTS.ARIAL.LARGE`
    - `overlay-drawing.ts` → `UI_FONTS.SYSTEM.NORMAL`
    - `CursorSnapAlignmentDebugOverlay.ts` → `UI_FONTS.ARIAL.BOLD`
    - `hover/config.ts` → `UI_FONTS.ARIAL.SMALL`, `UI_FONTS.ARIAL.LARGE`
    - `ghost-entity-renderer.ts` → `UI_FONTS.MONOSPACE.SMALL`
    - `BaseDragMeasurementRenderer.ts` → `UI_FONTS.ARIAL.NORMAL`
    - `text-spline-renderers.ts` → `UI_FONTS.ARIAL.LARGE`
  - **Formatting Migrations** (7 files):
    - `CircleRenderer.ts` → `formatDistance()` for diameter/radius
    - `ArcRenderer.ts` → `formatDistance()`, `formatAngle()`
    - `BaseEntityRenderer.ts` → `formatDistance()`, `formatAngle()`
    - `BaseDragMeasurementRenderer.ts` → `formatDistance()`, `formatAngle()`
- **New UI_FONTS Addition**:
  - `UI_FONTS.INTER` - For collaboration overlays and modern UI elements
    - `SMALL`: `'10px Inter, sans-serif'`
    - `NORMAL`: `'12px Inter, sans-serif'`
    - `BOLD_SMALL`: `'bold 10px Inter, sans-serif'`
- **Pattern**: On-touch migration (Phase 2 covers remaining files as they're edited)
- **Canonical Sources**:
  - Fonts: `UI_FONTS` from `config/text-rendering-config.ts` (ADR-042)
  - Formatting: `formatDistance()`, `formatAngle()` from `distance-label-utils.ts` (ADR-069)
- **Benefits**:
  - Zero hardcoded font strings in migrated files
  - Consistent number formatting across all entity renderers
  - Single point of change for typography and precision
  - Future locale-aware formatting support via `formatDistanceLocale()`
- **Companion**: ADR-042 (UI Fonts), ADR-069 (formatDistance/formatAngle), ADR-082 (FormatterRegistry)

### ADR-107: UI Size Defaults Centralization (|| 10 / ?? 10 / || 8 / || 3)
- **Canonical**: `UI_SIZE_DEFAULTS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded `|| 10` / `?? 10` / `|| 8` / `|| 3` fallback patterns to named constants
- **Problem**: ~30 hardcoded fallback patterns across 7 files:
  - `systems/rulers-grid/utils.ts`: 9 occurrences (fontSize, unitsFontSize)
  - `canvas-v2/layer-canvas/LayerRenderer.ts`: 7 occurrences (fontSize, unitsFontSize, majorTickLength)
  - `hooks/useGripPreviewStyle.ts`: 3 occurrences (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts`: 2 occurrences (text height fallback)
  - `rendering/grips/UnifiedGripRenderer.ts`: 2 occurrences (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx`: 6 occurrences (gripSize, pickBoxSize)
- **Semantic Categories**:
  - `RULER_FONT_SIZE`: 10 - Default ruler number font size (px)
  - `RULER_UNITS_FONT_SIZE`: 10 - Default ruler units label font size (px)
  - `MAJOR_TICK_LENGTH`: 10 - Default major tick mark length (px)
  - `APERTURE_SIZE`: 10 - Grip selection aperture size (px, AutoCAD APERTURE)
  - `GRIP_SIZE`: 8 - Default grip point size (px, AutoCAD GRIPSIZE)
  - `PICK_BOX_SIZE`: 3 - Default pick box size (px, AutoCAD PICKBOX)
  - `TEXT_HEIGHT_FALLBACK`: 10 - Default text height for bounds calculation (drawing units)
- **API**:
  ```typescript
  export const UI_SIZE_DEFAULTS = {
    RULER_FONT_SIZE: 10,
    RULER_UNITS_FONT_SIZE: 10,
    MAJOR_TICK_LENGTH: 10,
    APERTURE_SIZE: 10,
    GRIP_SIZE: 8,
    PICK_BOX_SIZE: 3,
    TEXT_HEIGHT_FALLBACK: 10,
  } as const;
  ```
- **Industry Standard**: AutoCAD DIMSCALE / APERTURE / GRIPSIZE / PICKBOX system variables
- **Files Migrated** (7 files, 29 replacements):
  - `systems/rulers-grid/utils.ts` - 9 replacements
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - 7 replacements
  - `hooks/useGripPreviewStyle.ts` - 3 replacements (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts` - 2 replacements
  - `rendering/grips/UnifiedGripRenderer.ts` - 2 replacements (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx` - 6 replacements (gripSize, pickBoxSize)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers `10` and `8` for UI defaults
  - Semantic constant names (`GRIP_SIZE` vs `8`, `RULER_FONT_SIZE` vs `10`)
  - Single point of change for default sizes
  - Consistent fallback behavior across all UI systems
- **Companion**: ADR-042 (UI Fonts), ADR-044 (Canvas Line Widths), ADR-093 (Text Label Offsets)

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

### ADR-127: Ruler Dimensions Centralization (DEFAULT_RULER_HEIGHT/WIDTH)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Hardcoded ruler dimensions (20 vs 30) scattered across 5+ files
- **Root Cause**: No centralized default constants for ruler dimensions
- **Decision**: Add DEFAULT_RULER_HEIGHT/WIDTH to RULERS_GRID_CONFIG
- **Canonical Location**: `systems/rulers-grid/config.ts`
- **Files Updated**:
  - `BackgroundPass.ts` - 20 → centralized (fixed inconsistency)
  - `DxfCanvas.tsx` - 30 → centralized
  - `CanvasSection.tsx` - fallback → centralized
  - `LayerRenderer.ts` - fallback → centralized
- **Pattern**: Single Source of Truth (SSOT)
- **Companion**: ADR-043 (Zoom Constants), ADR-044 (Canvas Line Widths)

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

### ADR-083: Line Dash Patterns Centralization
- **Canonical**: `LINE_DASH_PATTERNS` from `config/text-rendering-config.ts`
- **Decision**: Centralize all `ctx.setLineDash()` patterns (45+ hardcoded across 16 files)
- **API**:
  - `LINE_DASH_PATTERNS.SOLID` - `[]` (reset)
  - `LINE_DASH_PATTERNS.DASHED` - `[5, 5]`
  - `LINE_DASH_PATTERNS.DOTTED` - `[2, 4]`
  - `LINE_DASH_PATTERNS.DASH_DOT` - `[8, 4, 2, 4]`
  - `LINE_DASH_PATTERNS.SELECTION` - `[5, 5]`
  - `LINE_DASH_PATTERNS.GHOST` - `[4, 4]`
  - `LINE_DASH_PATTERNS.HOVER` - `[12, 6]`
  - `LINE_DASH_PATTERNS.LOCKED` - `[4, 4]`
  - `LINE_DASH_PATTERNS.CONSTRUCTION` - `[8, 4]`
  - `LINE_DASH_PATTERNS.ARC` - `[3, 3]`
  - `LINE_DASH_PATTERNS.TEXT_BOUNDING` - `[2, 2]`
  - `LINE_DASH_PATTERNS.CURSOR_DASHED` - `[6, 6]`
  - `LINE_DASH_PATTERNS.CURSOR_DOTTED` - `[2, 4]`
  - `LINE_DASH_PATTERNS.CURSOR_DASH_DOT` - `[8, 4, 2, 4]`
- **Helper Functions**:
  - `applyLineDash(ctx, pattern)` - Apply pattern to canvas context
  - `resetLineDash(ctx)` - Reset to solid line
- **Type**: `LineDashPattern` - Union type of all patterns
- **Industry Standard**: AutoCAD LTSCALE / ISO 128 Line Types
- **Files Migrated**:
  - `CursorRenderer.ts` - Uses `CURSOR_DASHED`, `CURSOR_DOTTED`, `CURSOR_DASH_DOT`
  - `SelectionRenderer.ts` - Uses `CURSOR_DASHED`, `CURSOR_DOTTED`, `CURSOR_DASH_DOT`
  - `ghost-entity-renderer.ts` - Uses `GHOST` pattern
  - `hover/config.ts` - Uses `SELECTION` pattern
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - Uses `DASHED` for arc preview (2026-01-31)
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Uses `SELECTION` for polygon highlight (2026-01-31)
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - Uses `SELECTION` for selection highlights (2026-01-31)
  - `systems/phase-manager/PhaseManager.ts` - Uses `DASHED` for overlay preview (2026-01-31)
  - `debug/CursorSnapAlignmentDebugOverlay.ts` - Uses `DASHED` for debug lines (2026-01-31)
  - `test/visual/overlayRenderer.ts` - Uses `DASHED` for test crosshair (2026-01-31)
  - `collaboration/CollaborationOverlay.tsx` - Uses `SELECTION` for user selections (2026-01-31)
- **Migration Status**: ✅ **COMPLETE** - Zero hardcoded `[5, 5]` patterns remaining
- **Benefits**:
  - Zero hardcoded dash patterns
  - Consistent visual style across all renderers
  - Single point of change for pattern tuning
  - Type-safe pattern references
- **Companion**: ADR-044 (Canvas Line Widths), ADR-058 (Canvas Primitives)

### ADR-088: Pixel-Perfect Rendering Centralization
- **Canonical**: `pixelPerfect()`, `pixelPerfectPoint()` from `geometry-rendering-utils.ts`
- **Decision**: Centralize pixel-perfect alignment pattern (`Math.round(v) + 0.5`)
- **Problem**: Duplicate inline functions across 4 files:
  - `CrosshairOverlay.tsx`: `Math.round(pos.x) + 0.5` (inline)
  - `LayerRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
  - `DxfRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
  - `OriginMarkersRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
- **Solution**: Single Source of Truth in `geometry-rendering-utils.ts`
- **API**:
  - `pixelPerfect(value: number): number` - Single coordinate (returns `Math.round(value) + 0.5`)
  - `pixelPerfectPoint(point: Point2D): Point2D` - Full point alignment
- **Why +0.5**:
  - Canvas coordinates are at pixel CENTER (not edge)
  - A 1px line at integer coordinate spans 2 pixels (anti-aliased = blurry)
  - Adding 0.5 places the line exactly on pixel boundary = crisp 1px line
- **Industry Standard**: AutoCAD, Figma, Blender all use this pattern
- **Files Migrated**:
  - `canvas-v2/overlays/CrosshairOverlay.tsx` - Crosshair lines
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Origin marker lines
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - Origin marker lines
  - `rendering/ui/origin/OriginMarkersRenderer.ts` - Axis lines
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate pixel-perfect helper functions
  - Consistent crisp line rendering across all canvases
  - Documented reason for the +0.5 pattern
  - CAD-grade visual quality
- **Companion**: ADR-044 (Canvas Line Widths), ADR-058 (Canvas Primitives), ADR-083 (Line Dash Patterns)

### ADR-093: Text Label Offsets Centralization
- **Canonical**: `TEXT_LABEL_OFFSETS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded vertical offsets (10, 30) for multi-line text labels in entity renderers
- **Problem**: Magic numbers `-30`, `-10`, `+10`, `+30` scattered across 5 files:
  - `EllipseRenderer.ts`: 4 lines (Ma, Mi, E, Περ)
  - `ArcRenderer.ts`: 3 lines (R, Angle, L)
  - `RectangleRenderer.ts`: 2 lines (E, Περ)
  - `PolylineRenderer.ts`: 2 lines (E, Περ)
  - `ghost-entity-renderer.ts`: 2 lines (tooltip x/y offset)
- **Solution**: Centralized constants in `text-rendering-config.ts`
- **API**:
  - `TEXT_LABEL_OFFSETS.TWO_LINE`: 10 (2-line label spacing)
  - `TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER`: 30 (3-4 line label outer spacing)
  - `TEXT_LABEL_OFFSETS.TOOLTIP_HORIZONTAL`: 10 (tooltip x offset)
  - `TEXT_LABEL_OFFSETS.TOOLTIP_VERTICAL`: 10 (tooltip y offset)
- **Layout Pattern**:
  ```
  4-line (Ellipse):          3-line (Arc):          2-line (Rect/Poly):
  y - 30  ← "Ma: X.XX"       y - 30  ← "R: X.XX"
  y - 10  ← "Mi: X.XX"       y - 10  ← "Angle"      y - 10  ← "Ε: X.XX"
  y + 10  ← "Ε: X.XX"        y + 10  ← "L: X.XX"    y + 10  ← "Περ: X.XX"
  y + 30  ← "Περ: X.XX"
  ```
- **Industry Standard**: AutoCAD DIMTAD / ISO 129 Dimension Text Positioning
- **Files Migrated**:
  - `rendering/entities/EllipseRenderer.ts` - 4 replacements
  - `rendering/entities/ArcRenderer.ts` - 3 replacements
  - `rendering/entities/RectangleRenderer.ts` - 2 replacements
  - `rendering/entities/PolylineRenderer.ts` - 2 replacements
  - `rendering/utils/ghost-entity-renderer.ts` - 2 replacements
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers for text label positioning
  - Single point of change for spacing adjustments
  - Consistent label layout across all entity types
  - Semantic constant names (`TWO_LINE` vs `10`)
- **Companion**: ADR-042 (UI Fonts), ADR-044 (Canvas Line Widths), ADR-048 (RENDER_GEOMETRY)

### ADR-094: Device Pixel Ratio Centralization
- **Canonical**: `getDevicePixelRatio()` from `systems/cursor/utils.ts`
- **Decision**: Centralize inline `window.devicePixelRatio || 1` patterns to SSR-safe centralized function
- **Problem**: 10+ inline occurrences of `window.devicePixelRatio || 1` across 6 files:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts`: 3 occurrences (lines 151, 160, 220)
  - `debug/CursorSnapAlignmentDebugOverlay.ts`: 2 occurrences (lines 102, 252)
  - `rendering/canvas/utils/CanvasUtils.ts`: 2 occurrences (lines 43, 124)
  - `rendering/canvas/core/CanvasSettings.ts`: 1 occurrence (line 184)
  - `systems/zoom/ZoomManager.ts`: 1 occurrence (line 162)
- **SSR Risk**: Inline `window.devicePixelRatio` without checks fails in SSR environments
- **Solution**: Use existing centralized function (already present in cursor/utils.ts):
  ```typescript
  export function getDevicePixelRatio(): number {
    return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }
  ```
- **API**:
  - `getDevicePixelRatio()` - Returns current device pixel ratio (SSR-safe, defaults to 1)
- **Pattern**: Single Source of Truth (SSOT) for DPR access
- **Benefits**:
  - SSR-safe by default (no `window is not defined` errors)
  - Consistent fallback value (always 1)
  - Single point of change if DPR handling logic changes
  - Testable (can mock in unit tests)
- **Files Migrated**:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 3 replacements
  - `debug/CursorSnapAlignmentDebugOverlay.ts` - 2 replacements
  - `rendering/canvas/utils/CanvasUtils.ts` - 2 replacements
  - `rendering/canvas/core/CanvasSettings.ts` - 1 replacement
  - `systems/zoom/ZoomManager.ts` - 1 replacement
- **Skipped**: `automatedTests.ts` - Test file, inline DPR is acceptable
- **Companion**: ADR-043 (Zoom Constants), ADR-044 (Canvas Line Widths), ADR-088 (Pixel-Perfect Rendering)

### ADR-095: Snap Tolerance Centralization
- **Canonical**: `SNAP_TOLERANCE` from `config/tolerance-config.ts`
- **Decision**: Centralize hardcoded `tolerance = 10` patterns to existing centralized constant
- **Problem**: 7 hardcoded `tolerance = 10` or `tolerance: 10` patterns across 6 files:
  - `rendering/hitTesting/HitTester.ts`: line 70 - `private snapTolerance = 10;`
  - `rendering/ui/snap/SnapTypes.ts`: line 92 - `tolerance: 10,`
  - `systems/toolbars/utils.ts`: line 357 - `tolerance: 10`
  - `systems/rulers-grid/useRulersGrid.ts`: lines 179-180 - 2x `tolerance: 10`
  - `rendering/canvas/core/CanvasSettings.ts`: line 104 - `tolerance: 10,`
  - `systems/cursor/utils.ts`: line 42 - `tolerance: number = 10`
- **Existing Infrastructure**: `SNAP_TOLERANCE` constant already existed but was not being used!
  ```typescript
  // Already in tolerance-config.ts:
  export const SNAP_TOLERANCE = TOLERANCE_CONFIG.SNAP_DEFAULT; // = 10
  ```
- **Solution**: Simple import migration - replace hardcoded values with centralized constant
- **API**:
  - `SNAP_TOLERANCE` - Default snap tolerance in pixels (10px)
  - `TOLERANCE_CONFIG.SNAP_DEFAULT` - Source constant (10)
- **Pattern**: Single Source of Truth (SSOT) for snap tolerance
- **Benefits**:
  - Single point of change for snap sensitivity
  - Consistent snap behavior across all systems (HitTester, Snap, Grid, Rulers, Cursor)
  - CAD-standard tolerance value (10px matches AutoCAD default)
  - Eliminates risk of inconsistent snap behavior
- **Files Migrated** (6 files, 7 replacements):
  - `rendering/hitTesting/HitTester.ts` - 1 replacement
  - `rendering/ui/snap/SnapTypes.ts` - 1 replacement
  - `systems/toolbars/utils.ts` - 1 replacement
  - `systems/rulers-grid/useRulersGrid.ts` - 2 replacements
  - `rendering/canvas/core/CanvasSettings.ts` - 1 replacement
  - `systems/cursor/utils.ts` - 1 replacement
- **Companion**: ADR-043 (Zoom Constants), ADR-079 (Geometric Precision), ADR-087 (Snap Engine Config)

### ADR-102: Origin Markers Centralization (DXF/Layer/Debug)
- **Canonical**: `OriginMarkerUtils.ts` from `rendering/ui/origin/`
- **Decision**: Centralize origin marker rendering from 3 scattered implementations to single utility
- **Problem**: Duplicate origin marker code across 3 files (~50 lines each):
  - `DxfRenderer.ts` (lines 80-103): Orange L-shape (TOP + LEFT)
  - `LayerRenderer.ts` (lines 219-243): Blue inverted L-shape (BOTTOM + RIGHT)
  - `OriginMarkersRenderer.ts`: Magenta crosshair (DEBUG overlay)
- **Duplicate Code Issues**:
  - Same `worldToScreen(worldOrigin, transform, viewport)` calculation in 3 places
  - Hardcoded values: `20px` arm length, `'-45', '-10'` label offset
  - Inconsistent rendering patterns (manual ctx.save/restore, path creation)
- **Solution**: Single Source of Truth utility with variant system
- **API**:
  ```typescript
  // Core functions
  getOriginScreenPosition(transform, viewport): Point2D
  drawOriginMarker(ctx, screenOrigin, { variant: 'dxf' | 'layer' | 'debug' })
  renderOriginMarker(ctx, transform, viewport, options) // Convenience combo

  // Configuration (ORIGIN_MARKER_CONFIG)
  ARM_LENGTH: 20  // Arm length in pixels
  LINE_WIDTH: RENDER_LINE_WIDTHS.THICK
  FONT: UI_FONTS.MONOSPACE.BOLD
  COLORS.DXF: UI_COLORS.DRAWING_HIGHLIGHT  // Orange
  COLORS.LAYER: UI_COLORS.BUTTON_PRIMARY   // Blue
  COLORS.DEBUG: UI_COLORS.DEBUG_ORIGIN     // Magenta
  ```
- **Variant System**:
  - `'dxf'`: Orange L-shape (TOP + LEFT arms) - DXF canvas world origin
  - `'layer'`: Blue inverted L-shape (BOTTOM + RIGHT arms) - Layer canvas
  - `'debug'`: Magenta crosshair (all 4 directions) - Debug overlay
- **Files Migrated**:
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - 24 lines → 1 line
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - 25 lines → 1 line
- **Pattern**: Single Source of Truth (SSOT) + Variant pattern
- **Benefits**:
  - Zero duplicate coordinate transformation code
  - Consistent marker styling (colors, fonts, sizes)
  - Single point of change for origin marker appearance
  - Type-safe variant selection
  - Uses centralized systems: ADR-088 (pixelPerfect), ADR-042 (UI_FONTS), ADR-044 (LINE_WIDTHS)
- **Companion**: ADR-088 (Pixel-Perfect Rendering), ADR-058 (Canvas Primitives)

### ADR-084: Scattered Code Centralization (Draggable + Canvas State)
- **Decision**: Centralize scattered draggable logic and canvas state operations
- **Two Components**:
  1. **CursorSettingsPanel Refactor** - 70+ lines manual drag → FloatingPanel
  2. **withCanvasState() Helper** - 89 hardcoded ctx.fillStyle/strokeStyle → centralized

#### Part 1: CursorSettingsPanel Migration
- **Before**: Manual drag state, mouse handlers, event listeners (70 lines)
- **After**: FloatingPanel compound component (10 lines)
- **Canonical**: `FloatingPanel` from `@/components/ui/floating`
- **File Changed**: `ui/CursorSettingsPanel.tsx`
- **Result**: -60 lines, consistent with other floating panels

#### Part 2: Canvas State Helper
- **Canonical**: `withCanvasState()` from `rendering/canvas/withCanvasState.ts`
- **API**:
  - `withCanvasState(ctx, style, callback)` - Save/restore pattern
  - `withCanvasStateAsync(ctx, style, callback)` - Async version
  - `applyCanvasStyle(ctx, style)` - Apply style options
  - `setFillStyle(ctx, color, opacity?)` - Set fill with optional opacity
  - `setStrokeStyle(ctx, color, width?, dash?)` - Set stroke with optional width/dash
  - `resetCanvasState(ctx)` - Reset to defaults
- **Type**: `CanvasStyleOptions` - All canvas style properties
- **Supports Config Keys**: `lineWidth: 'NORMAL'`, `lineDash: 'DASHED'`

#### Migration Example
```typescript
// Before (scattered code):
ctx.save();
ctx.fillStyle = UI_COLORS.WHITE;
ctx.globalAlpha = 0.5;
ctx.fillRect(0, 0, width, height);
ctx.restore();

// After (centralized):
import { withCanvasState } from '../canvas/withCanvasState';

withCanvasState(ctx, { fill: UI_COLORS.WHITE, opacity: 0.5 }, () => {
  ctx.fillRect(0, 0, width, height);
});
```

- **Migration Strategy**: On-touch migration for 56 files with canvas state operations
- **Files Created**:
  - `rendering/canvas/withCanvasState.ts` (~100 lines)
- **Files Changed**:
  - `ui/CursorSettingsPanel.tsx` (-60 lines, +20 lines)
  - `rendering/canvas/index.ts` (new exports)
- **Companion**: ADR-003 (FloatingPanel), ADR-044 (Line Widths), ADR-083 (Line Dash)

### ADR-115: Canvas Context Setup Standardization
- **Canonical**: `CanvasUtils.setupCanvasContext()` from `rendering/canvas/utils/CanvasUtils.ts`
- **Decision**: Document existing centralized canvas setup function as the Single Source of Truth
- **Status**: ✅ **ALREADY CENTRALIZED** - No code changes needed
- **Current State Analysis**:
  - **Files using centralized function (3/5 = 60%)**:
    - `canvas-v2/layer-canvas/LayerCanvas.tsx` - ✅ Uses `CanvasUtils.setupCanvasContext()`
    - `canvas-v2/dxf-canvas/DxfCanvas.tsx` - ✅ Uses `CanvasUtils.setupCanvasContext()`
    - `rendering/canvas/core/CanvasManager.ts` - ✅ Uses `CanvasUtils.setupCanvasContext()`
  - **Files with acceptable inline pattern (2/5 = 40%)**:
    - `canvas-v2/overlays/CrosshairOverlay.tsx` - Uses ResizeObserver callback (special case)
    - `canvas-v2/preview-canvas/PreviewRenderer.ts` - Standalone class (special case)
  - **Total duplicate lines**: ~20 (negligible)
  - **Pattern consistency**: 100% (all use same DPI pattern)
- **Centralized Function API**:
  ```typescript
  static setupCanvasContext(
    canvas: HTMLCanvasElement,
    config: CanvasConfig
  ): CanvasRenderingContext2D {
    const dpr = config.enableHiDPI ? (config.devicePixelRatio || getDevicePixelRatio()) : 1;
    const rect = canvasBoundsService.getBounds(canvas);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = config.imageSmoothingEnabled !== false;
    return ctx;
  }
  ```
- **Why Inline is Acceptable for 2 Files**:
  - `CrosshairOverlay.tsx`: Uses `ResizeObserver` callback with dimension comparison logic
  - `PreviewRenderer.ts`: Standalone renderer class with different lifecycle
  - Both use `getDevicePixelRatio()` from ADR-094 (centralized DPR)
  - Both follow identical DPI scaling pattern
- **Enterprise Features of CanvasUtils**:
  - Uses `canvasBoundsService` for cached `getBoundingClientRect()` (performance optimization)
  - Uses `getDevicePixelRatio()` from ADR-094 (SSR-safe)
  - Safety checks for invalid canvas elements
  - Full utility suite: `clearCanvas()`, `getCanvasDimensions()`, `screenToCanvas()`, etc.
- **Recommendation**: No refactoring needed - current state is acceptable
- **Benefits**:
  - 60% centralization with 100% pattern consistency
  - ~20 lines of duplicate code (negligible vs 500 estimated)
  - Risk of change outweighs benefit for remaining 2 files
  - Clear documentation of the canonical approach
- **Companion**: ADR-094 (Device Pixel Ratio), ADR-088 (Pixel-Perfect Rendering), ADR-043 (Zoom Constants)

### ADR-117: DPI-Aware Pixel Calculations Centralization
- **Canonical**: `toDevicePixels()` from `systems/cursor/utils.ts`
- **Decision**: Centralize the `Math.round(cssPixels * dpr)` pattern for canvas buffer sizing
- **Status**: ✅ **IMPLEMENTED** (2026-02-01)
- **Problem**: The pattern `Math.round(value * dpr)` for physical pixel calculations was scattered across 3 files:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` (lines 170-171)
  - `canvas-v2/overlays/CrosshairOverlay.tsx` (lines 115-116)
  - `rendering/canvas/utils/CanvasUtils.ts` (lines 53-54)
- **Solution**: Create `toDevicePixels()` utility function
- **API**:
  ```typescript
  /**
   * Convert CSS pixels to device/physical pixels
   * @param cssPixels - Value in CSS pixels
   * @param dpr - Device pixel ratio (defaults to current device)
   * @returns Rounded physical pixel value
   */
  export function toDevicePixels(cssPixels: number, dpr?: number): number {
    const ratio = dpr ?? getDevicePixelRatio();
    return Math.round(cssPixels * ratio);
  }
  ```
- **Migration**:
  ```typescript
  // Before (scattered pattern):
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  // After (centralized):
  import { toDevicePixels } from '../../systems/cursor/utils';
  canvas.width = toDevicePixels(width, dpr);
  canvas.height = toDevicePixels(height, dpr);
  ```
- **Files Changed**:
  - `systems/cursor/utils.ts` (+20 lines: `toDevicePixels()` function)
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` (2 replacements)
  - `canvas-v2/overlays/CrosshairOverlay.tsx` (2 replacements)
  - `rendering/canvas/utils/CanvasUtils.ts` (2 replacements)
- **Benefits**:
  - Single Source of Truth for DPI-aware pixel calculations
  - Self-documenting code: `toDevicePixels(width)` vs `Math.round(width * dpr)`
  - Consistent rounding behavior across all canvas operations
  - Easier to test and maintain
- **Companion**: ADR-094 (Device Pixel Ratio), ADR-115 (Canvas Context Setup)

### ADR-120: Canvas globalAlpha Opacity Centralization
- **Canonical**: `OPACITY` from `config/color-config.ts`
- **Decision**: Migrate hardcoded `ctx.globalAlpha` values to centralized OPACITY constants
- **Status**: ✅ APPROVED
- **Problem**: 12 hardcoded opacity values across 7 files despite existing OPACITY constant
- **Solution**:
  - Add `OPACITY.SUBTLE = 0.6` for origin markers
  - Replace all hardcoded values with OPACITY.* references
- **API**:
  - `OPACITY.OPAQUE` - 1.0 (full opacity, reset value)
  - `OPACITY.HIGH` - 0.9 (region bubbles, near-opaque overlays)
  - `OPACITY.MEDIUM` - 0.7 (construction lines, semi-transparent)
  - `OPACITY.SUBTLE` - 0.6 (NEW: origin markers, subtle overlays)
  - `OPACITY.LOW` - 0.5
  - `OPACITY.VERY_LOW` - 0.3
  - `OPACITY.FAINT` - 0.1
- **Files Migrated**:
  - `rendering/ui/ruler/RulerRenderer.ts` - 2 occurrences (0.6 → SUBTLE, 1 → OPAQUE)
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 2 occurrences (0.7 → MEDIUM, 1 → OPAQUE)
  - `utils/overlay-drawing.ts` - 3 occurrences (0.9 → HIGH, 1 → OPAQUE x2)
  - `systems/phase-manager/PhaseManager.ts` - 1 occurrence (1.0 → OPAQUE)
  - `rendering/entities/BaseEntityRenderer.ts` - 2 occurrences (1.0 → OPAQUE x2)
  - `rendering/canvas/withCanvasState.ts` - 1 occurrence (1.0 → OPAQUE)
  - `debug/OriginMarkersDebugOverlay.ts` - 1 occurrence (1.0 → OPAQUE)
- **Benefits**:
  - Single source of truth for opacity values
  - Consistent visual appearance across canvas operations
  - Easy global adjustments (change one constant, affects all)
  - Type-safe references (TypeScript autocomplete)
- **Companion**: ADR-044 (Line Widths), ADR-083 (Line Dash Patterns)

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
  - Distance: 42+ inline implementations → 1 function
  - Vector normalization: 7 inline patterns → 3 functions
- **Files Migrated**:
  - **Distance**: 38 files across snapping, rendering, hooks, utils
  - **Vector**: line-utils.ts, line-rendering-utils.ts, constraints/utils.ts, ParallelSnapEngine.ts, text-labeling-utils.ts, LineRenderer.ts, BaseEntityRenderer.ts
- **2026-02-01 Migration** (6 additional files):
  - `utils/geometry/GeometryUtils.ts` - nearPoint() function
  - `rendering/entities/PointRenderer.ts` - hitTest() method
  - `rendering/entities/EllipseRenderer.ts` - hitTest() method
  - `snapping/engines/shared/snap-engine-utils.ts` - sortCandidatesByDistance()
  - `systems/constraints/useConstraintApplication.ts` - validatePoint()
  - `rendering/entities/shared/geometry-utils.ts` - circleBestFit() fallback
- **Pattern**: Single Source of Truth (SSOT)
- **Eliminated Patterns**:
  - `unitX = dx / length; unitY = dy / length;` → `getUnitVector()`
  - `perpX = -dy / length; perpY = dx / length;` → `getPerpendicularUnitVector()`
  - `Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2)` → `calculateDistance(p, q)`
  - `Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))` → `calculateDistance()`
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

### ADR-100: Inline Degrees-to-Radians Conversion Centralization
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `degToRad()` from `geometry-utils.ts` (extends ADR-067)
- **Decision**: Migrate remaining 5 inline `Math.PI / 180` patterns to centralized `degToRad()` function
- **Problem**: After ADR-067, 5 inline patterns remained in 2 files:
  - `PreviewRenderer.ts`: 4 patterns (`(entity.startAngle * Math.PI) / 180`)
    - Lines 541-542: Arc preview start/end radians
    - Lines 564-565: Radial construction line angle calculation
  - `FormatterRegistry.ts`: 1 pattern (`degrees * (Math.PI / 180)`)
    - Line 537: `formatRadians()` method
- **Solution**: Simple import of existing `degToRad()` function
- **Files Changed** (2 files, 5 replacements):
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 4 replacements (added `degToRad` to imports)
  - `formatting/FormatterRegistry.ts` - 1 replacement (added import + replaced inline calc)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero remaining inline `Math.PI / 180` patterns in DXF Viewer
  - Consistent with ADR-067 architecture
  - Single point of change for conversion precision
  - Cleaner, more readable code
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "Math\.PI.*180|180.*Math\.PI" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only geometry-utils.ts)
- **Companion**: ADR-067 (Radians/Degrees), ADR-058 (Canvas Primitives), ADR-082 (FormatterRegistry)

### ADR-101: Deep Clone Centralization
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `deepClone<T>()` from `utils/clone-utils.ts`
- **Decision**: Centralize all `JSON.parse(JSON.stringify(...))` patterns to single utility function
- **Problem**: 11 inline `JSON.parse(JSON.stringify(...))` patterns across 6 files:
  - **Command Pattern - State Snapshots** (7 uses):
    - `MoveOverlayCommand.ts` line 98: Overlay polygon vertices for undo
    - `DeleteOverlayCommand.ts` line 59: Full overlay snapshot for soft delete
    - `DeleteOverlayCommand.ts` line 193: Batch delete snapshots
    - `MoveEntityCommand.ts` line 230: Entity movement snapshot
    - `MoveEntityCommand.ts` line 400: Batch move snapshots
    - `DeleteEntityCommand.ts` line 39: Single entity deletion
    - `DeleteEntityCommand.ts` line 143: Batch deletion snapshots
  - **UI State Management** (1 use):
    - `CanvasSection.tsx` line 1530: Drag start polygon copy
  - **Factory Settings** (2 uses):
    - `FACTORY_DEFAULTS.ts` line 336: Get all factory defaults
    - `FACTORY_DEFAULTS.ts` line 348: Get entity-specific defaults
  - **Data Migration** (1 use):
    - `migrationRegistry.ts` line 413: Data backup before migration
- **Solution**: Single generic `deepClone<T>()` function
- **API**:
  ```typescript
  import { deepClone } from '../utils/clone-utils';

  // Clone any serializable value
  const copy = deepClone(entity);
  const polygonCopy = deepClone(overlay.polygon);
  ```
- **Files Changed** (7 files, 11 replacements):
  - `utils/clone-utils.ts` - NEW centralized utility
  - `core/commands/overlay-commands/MoveOverlayCommand.ts` - 1 replacement
  - `core/commands/overlay-commands/DeleteOverlayCommand.ts` - 2 replacements
  - `core/commands/entity-commands/MoveEntityCommand.ts` - 2 replacements
  - `core/commands/entity-commands/DeleteEntityCommand.ts` - 2 replacements
  - `components/dxf-layout/CanvasSection.tsx` - 1 replacement
  - `settings/FACTORY_DEFAULTS.ts` - 2 replacements
  - `settings/io/migrationRegistry.ts` - 1 replacement
- **Limitations** (by design - matches existing behavior):
  - Does not clone: undefined, functions, Symbols, circular references
  - Date objects become strings
  - Map/Set become empty objects
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate `JSON.parse(JSON.stringify())` patterns
  - Type-safe generic function `deepClone<T>(value: T): T`
  - Cleaner, more readable code
  - Single point of documentation for cloning behavior
  - Future-proof: Easy to swap implementation (e.g., structuredClone)
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "JSON\.parse\(JSON\.stringify" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only clone-utils.ts)
- **Companion**: ADR-031 (Command Pattern), ADR-065 (Geometry Utils)

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

### ADR-108: Text Metrics Ratios Centralization
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `TEXT_METRICS_RATIOS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded font/text metrics multipliers (0.6, 0.75, 0.8, etc.) to named constants
- **Problem**: 27+ hardcoded font/text metrics multipliers across 16 files:
  - `TextMetricsCache.ts`: 5 occurrences (0.6, 0.8, 0.2)
  - `useTextPreviewStyle.ts`: 6 occurrences (0.75, 0.3, 0.2, 0.05, 0.15)
  - `LinePreview.tsx`: 4 occurrences (0.6, 0.55, 1.15, 1.2)
  - `Bounds.ts`: 1 occurrence (0.6)
  - `TextRenderer.ts`: 1 occurrence (0.6)
  - `entities.ts`: 1 occurrence (0.6)
  - `TextSettings.tsx`: 1 occurrence (0.75)
  - `systems/zoom/utils/bounds.ts`: 2 occurrences (0.6, 0.7)
- **Semantic Categories**:
  - **Character Width Estimation**:
    - `CHAR_WIDTH_MONOSPACE`: 0.6 - Average monospace character width (60% of fontSize)
    - `CHAR_WIDTH_PROPORTIONAL`: 0.55 - Average proportional character width (55% of fontSize)
    - `CHAR_WIDTH_WIDE`: 0.7 - Wider estimate for text bounds (70% of fontSize)
  - **Vertical Metrics**:
    - `ASCENT_RATIO`: 0.8 - Ascender height (80% of fontSize)
    - `DESCENT_RATIO`: 0.2 - Descender height (20% of fontSize)
  - **Superscript/Subscript**:
    - `SCRIPT_SIZE_RATIO`: 0.75 - Font size reduction (75% of normal)
    - `SUPERSCRIPT_OFFSET`: 0.3 - Vertical raise (30% of fontSize)
    - `SUBSCRIPT_OFFSET`: 0.2 - Vertical drop (20% of fontSize)
  - **Text Decorations**:
    - `UNDERLINE_OFFSET`: 0.15 - Position below text (15% of fontSize)
    - `STRIKETHROUGH_OFFSET`: 0.05 - Position above baseline (5% of fontSize)
    - `DECORATION_LINE_WIDTH`: 0.05 - Line thickness (5% of fontSize)
  - **Bold/Script Adjustments**:
    - `BOLD_WIDTH_MULTIPLIER`: 1.15 - Bold text width increase (115% of normal)
    - `SCRIPT_SPACING_MULTIPLIER`: 1.2 - Script spacing increase (120% of normal)
- **API**:
  ```typescript
  import { TEXT_METRICS_RATIOS } from '../config/text-rendering-config';

  // Character width estimation
  const width = text.length * fontSize * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

  // Superscript font size
  const scriptSize = fontSize * TEXT_METRICS_RATIOS.SCRIPT_SIZE_RATIO;

  // Ascent/descent for bounding box
  const ascent = fontSize * TEXT_METRICS_RATIOS.ASCENT_RATIO;
  const descent = fontSize * TEXT_METRICS_RATIOS.DESCENT_RATIO;
  ```
- **Industry Standard**: CSS font-size-adjust, OpenType OS/2 metrics
- **Files Migrated** (9 files, 21 replacements):
  - `rendering/cache/TextMetricsCache.ts` - 5 replacements (ascent, descent, char width)
  - `hooks/useTextPreviewStyle.ts` - 6 replacements (script size, offsets, decorations)
  - `ui/.../LinePreview.tsx` - 4 replacements (char width, bold/script multipliers)
  - `rendering/hitTesting/Bounds.ts` - 1 replacement (char width)
  - `rendering/entities/TextRenderer.ts` - 1 replacement (char width)
  - `types/entities.ts` - 1 replacement (char width)
  - `ui/.../TextSettings.tsx` - 1 replacement (script size)
  - `systems/zoom/utils/bounds.ts` - 2 replacements (char width)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers for text metrics calculations
  - Semantic constant names (`CHAR_WIDTH_MONOSPACE` vs `0.6`)
  - Single point of change for typography adjustments
  - Typography-correct documentation (CSS/OpenType reference)
  - Consistent text measurement across all systems
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "fontSize \* 0\.[0-9]" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return minimal results)
- **Companion**: ADR-042 (UI Fonts), ADR-091 (Fonts + Formatting), ADR-107 (UI Size Defaults)

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
  - `adapters/ZustandToConsolidatedAdapter.ts` - Line hover width (uses HOT for 1.5x effect)
  - `rendering/ui/snap/SnapRenderer.ts` - Snap indicator highlight mode (uses HOT)
  - `rendering/ui/cursor/CursorRenderer.ts` - Cursor highlight mode (uses HOT)
- **Extended Usage**: `GRIP_SIZE_MULTIPLIERS.HOT` (1.5) χρησιμοποιείται για όλα τα highlight/emphasis effects σε UI elements (όχι μόνο grips)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero grip size inconsistency (all grips use same multipliers)
  - AutoCAD-standard visual feedback
  - Single place to change grip size behavior
  - Unified highlight multiplier για grips, snap indicators, cursors, και line hover
- **Companion**: ADR-048 (Unified Grip Rendering System)

### ADR-106: Edge Grip Size Multipliers Centralization
- **Canonical**: `EDGE_GRIP_SIZE_MULTIPLIERS` from `rendering/grips/constants.ts`
- **Impact**: Fixed **hardcoded edge grip multipliers** in LayerRenderer (1.4/1.6)
- **Standard Values** (Edge-specific, larger than vertex grips):
  - `COLD`: 1.0 (normal state)
  - `WARM`: 1.4 (hover state, +40% - more dramatic than vertex +25%)
  - `HOT`: 1.6 (active/drag state, +60% - more dramatic than vertex +50%)
- **Rationale**: Edge grips are rendered on thin edge lines, so they need larger multipliers for visible hover/active feedback
- **Files Changed**:
  - `rendering/grips/constants.ts` - Added `EDGE_GRIP_SIZE_MULTIPLIERS` (+16 lines)
  - `rendering/grips/index.ts` - Export added
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Replaced hardcoded 1.4/1.6 with centralized constants
- **Consistency Table**:
  | Grip Type | COLD | WARM | HOT | Source |
  |-----------|------|------|-----|--------|
  | **Vertex** | 1.0 | 1.25 | 1.5 | `GRIP_SIZE_MULTIPLIERS` |
  | **Edge** | 1.0 | 1.4 | 1.6 | `EDGE_GRIP_SIZE_MULTIPLIERS` |
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero hardcoded edge grip multipliers
  - Consistent with vertex grip centralization (ADR-075)
  - Single place to adjust edge grip visual feedback
- **Companion**: ADR-075 (Grip Size Multipliers), ADR-048 (Unified Grip Rendering System)

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
- **Companion**: ADR-058 (Canvas Drawing Primitives), ADR-103 (Angular Constants)

### ADR-103: Angular Constants Centralization (RIGHT_ANGLE, ARROW_ANGLE)
- **Canonical**: `RIGHT_ANGLE`, `ARROW_ANGLE` from `rendering/entities/shared/geometry-utils.ts`
- **Impact**: 18 inline `Math.PI / 2` and `Math.PI / 6` patterns → 2 constants
- **Constants Added**:
  - `RIGHT_ANGLE = Math.PI / 2` (≈ 1.5708 rad = 90°)
  - `ARROW_ANGLE = Math.PI / 6` (≈ 0.5236 rad = 30°)
- **Files Migrated** (10 files, 18 replacements):
  - `utils/hover/text-labeling-utils.ts` - Text flip check (1× RIGHT_ANGLE)
  - `utils/hover/edge-utils.ts` - Text flip check (1× RIGHT_ANGLE)
  - `systems/rulers-grid/utils.ts` - Vertical ruler text rotation (2× RIGHT_ANGLE)
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `snapping/engines/TangentSnapEngine.ts` - Tangent point calculation (4× RIGHT_ANGLE)
  - `rendering/ui/ruler/RulerRenderer.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `rendering/entities/shared/distance-label-utils.ts` - Text flip check (2× RIGHT_ANGLE)
  - `rendering/entities/BaseEntityRenderer.ts` - Text flip check (1× RIGHT_ANGLE)
  - `rendering/passes/BackgroundPass.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `rendering/utils/ghost-entity-renderer.ts` - Arrow head rendering (4× ARROW_ANGLE)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  ```typescript
  import { RIGHT_ANGLE, ARROW_ANGLE } from './geometry-utils';

  // Text flip check (if angle > 90°, flip text)
  if (Math.abs(textAngle) > RIGHT_ANGLE) {
    textAngle += Math.PI;
  }

  // Arrow head rendering (30° angle)
  ctx.lineTo(x - size * Math.cos(angle - ARROW_ANGLE), ...);
  ctx.lineTo(x - size * Math.cos(angle + ARROW_ANGLE), ...);
  ```
- **Benefits**:
  - Zero inline angular magic numbers
  - Semantic constant names (`RIGHT_ANGLE` vs `Math.PI / 2`)
  - Single point of documentation
  - Consistent angular calculations across codebase
- **Companion**: ADR-077 (TAU Constant), ADR-067 (Radians/Degrees Conversion), ADR-068 (Angle Normalization)

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

### ADR-087: Snap Engine Configuration Centralization
- **Canonical**: `SNAP_SEARCH_RADIUS`, `SNAP_RADIUS_MULTIPLIERS`, `SNAP_GRID_DISTANCES`, `SNAP_GEOMETRY` from `tolerance-config.ts`
- **Impact**: 8 magic numbers across 4 snap engines → 4 centralized constant objects
- **Problem**: Inconsistent snap engine constants:
  - `OrthoSnapEngine`: `200` (search radius), `radius * 2`, `Math.sqrt(2)`
  - `ParallelSnapEngine`: `radius * 3` (why 3x?), `[0, 50, 100, 150]`
  - `PerpendicularSnapEngine`: `radius * 2`
  - `ExtensionSnapEngine`: `radius * 2`, `[25, 50, 100, 200, 300]`
- **Solution**: Extended tolerance-config.ts with snap engine configuration
- **Constant Categories**:
  - `SNAP_SEARCH_RADIUS.REFERENCE_POINT`: 200 (Ortho reference point search)
  - `SNAP_RADIUS_MULTIPLIERS.STANDARD`: 2 (Ortho, Perpendicular, Extension)
  - `SNAP_RADIUS_MULTIPLIERS.EXTENDED`: 3 (Parallel - needs wider search)
  - `SNAP_GRID_DISTANCES.PARALLEL`: [0, 50, 100, 150]
  - `SNAP_GRID_DISTANCES.EXTENSION`: [25, 50, 100, 200, 300]
  - `SNAP_GEOMETRY.SQRT_2`: Math.sqrt(2) (diagonal calculations)
  - `SNAP_GEOMETRY.INV_SQRT_2`: 1/√2 ≈ 0.7071 (efficient division)
- **Files Migrated**:
  - `OrthoSnapEngine.ts` - 3 patterns migrated
  - `ParallelSnapEngine.ts` - 2 patterns migrated
  - `PerpendicularSnapEngine.ts` - 1 pattern migrated
  - `ExtensionSnapEngine.ts` - 2 patterns migrated
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers in snap engines
  - Documented reason for 3x vs 2x multiplier
  - Single point of change for snap configuration
  - Consistent snap behavior across engines
- **Companion**: ADR-079 (Geometric Precision), ADR-034 (Geometry Centralization)

### ADR-089: Point-In-Bounds Centralization
- **Canonical**: `SpatialUtils.pointInBounds()`, `SpatialUtils.pointInRect()` from `core/spatial/SpatialUtils.ts`
- **Impact**: 4 duplicate point-in-bounds implementations → 2 centralized functions
- **Problem**: Scattered point-in-bounds checking patterns:
  - `snap-engine-utils.ts:134` - Inline `point.x >= minX && point.x <= maxX && ...`
  - `UniversalMarqueeSelection.ts:408-409` - Inline vertex check against rectBounds
  - `SpatialUtils.ts:68` - Existing static method (UNUSED!)
  - `ISpatialIndex.ts:312` - Duplicate in namespace (DEAD CODE)
- **Two Bounds Formats**:
  - **SpatialBounds**: `{ minX, maxX, minY, maxY }` → Spatial indexing systems
  - **MinMax Point2D**: `{ min: Point2D, max: Point2D }` → Selection/rendering
- **Solution**: Two canonical functions for different formats:
  - `SpatialUtils.pointInBounds(point, bounds)` - For SpatialBounds format
  - `SpatialUtils.pointInRect(point, rect)` - For { min, max } Point2D format
- **Files Migrated**:
  - `snapping/engines/shared/snap-engine-utils.ts` - Uses `SpatialUtils.pointInBounds()`
  - `systems/selection/UniversalMarqueeSelection.ts` - Uses `SpatialUtils.pointInRect()`
  - `core/spatial/ISpatialIndex.ts` - Re-exports from SpatialUtils class (removed duplicate namespace)
  - `systems/zoom/utils/calculations.ts` - Wrapper delegates to `SpatialUtils.pointInRect()` (2026-02-01)
  - `systems/selection/shared/selection-duplicate-utils.ts` - Wrapper delegates to `SpatialUtils.pointInBounds()` (2026-02-01)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate point-in-bounds implementations
  - Support for both bounds formats (SpatialBounds and { min, max })
  - Type-safe Point2D interface
  - ISpatialIndex namespace now delegates to SpatialUtils class
- **Companion**: ADR-034 (Geometry Centralization), ADR-079 (Geometric Precision)

### ADR-090: Point Vector Operations Centralization
- **Canonical**: `subtractPoints()`, `addPoints()`, `scalePoint()`, `offsetPoint()` from `geometry-rendering-utils.ts`
- **Impact**: 15+ inline vector arithmetic patterns → 4 centralized functions
- **Problem**: Duplicate vector arithmetic patterns scattered across 8+ files:
  - `{ x: p1.x - p2.x, y: p1.y - p2.y }` - Vector subtraction
  - `{ x: point.x + dir.x * dist, y: point.y + dir.y * dist }` - Point offset
- **Solution**: Centralized vector arithmetic functions
- **API**:
  ```typescript
  // Vector subtraction: p1 - p2 = vector from p2 to p1
  subtractPoints(p1: Point2D, p2: Point2D): Point2D

  // Vector addition
  addPoints(p1: Point2D, p2: Point2D): Point2D

  // Scale vector by scalar
  scalePoint(point: Point2D, scalar: number): Point2D

  // Offset point by direction * distance (combines add + scale)
  offsetPoint(point: Point2D, direction: Point2D, distance: number): Point2D
  ```
- **Files Migrated**:
  - `geometry-utils.ts` - `angleBetweenPoints()` vector calculations
  - `useUnifiedDrawing.tsx` - Measure-angle tool vector calculations
  - `PolylineRenderer.ts` - Rectangle side vectors (4 patterns)
  - `useDynamicInputMultiPoint.ts` - Angle calculation vectors
  - `angle-utils.ts` - Uses `pointOnCircle()` for label positioning
  - `text-labeling-utils.ts` - Uses `offsetPoint()` for text positioning
  - `line-utils.ts` - Uses `offsetPoint()` for gap calculations
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate vector arithmetic
  - Consistent API: `subtractPoints(p1, p2)` instead of `{ x: p1.x - p2.x, ... }`
  - Clear semantic meaning (subtract vs offset vs scale)
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-073 (Midpoint), ADR-074 (Point On Circle)

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

### ADR-082: Enterprise Number Formatting System (AutoCAD-Grade)
- **Canonical**: `FormatterRegistry` from `formatting/FormatterRegistry.ts`
- **Hook**: `useFormatter()` from `formatting/useFormatter.ts`
- **Config**: `number-format-config.ts`
- **Impact**: 258 scattered `.toFixed()` patterns → 1 centralized, locale-aware system
- **Problem**: No locale awareness in number formatting (Greek uses comma, English uses period)
- **Solution**: Full AutoCAD-grade FormatterRegistry with:
  - Unit types (Scientific, Decimal, Engineering, Architectural, Fractional)
  - Locale-aware formatting (el-GR: `1.234,56` vs en-US: `1,234.56`)
  - Per-category precision configuration
  - Format templates (prefix/suffix like DIMPOST)
  - Hierarchical overrides (Global → Context → Per-element)
  - Zero suppression options (like DIMZIN)
- **AutoCAD System Variable Mapping**:
  | AutoCAD | This Config |
  |---------|-------------|
  | LUNITS | linearUnits |
  | LUPREC | precision.linear |
  | AUNITS | angularUnits |
  | AUPREC | precision.angular |
  | DIMZIN | zeroSuppression |
  | DIMDSEP | decimalSeparator |
  | DIMPOST | templates.* |
- **API**:
  ```typescript
  // Registry usage (non-React)
  const fmt = FormatterRegistry.getInstance();
  fmt.formatDistance(1234.567);  // "1.234,57" (el-GR) or "1,234.57" (en-US)
  fmt.formatAngle(45.5);         // "45,5°" (el-GR) or "45.5°" (en-US)
  fmt.formatDiameter(50);        // "Ø50,00" (el-GR) or "Ø50.00" (en-US)
  fmt.formatPercent(0.75);       // "75%"

  // React hook usage
  const { formatDistance, formatAngle } = useFormatter();
  ```
- **New Functions in distance-label-utils.ts**:
  - `formatDistanceLocale()` - Locale-aware distance formatting
  - `formatAngleLocale()` - Locale-aware angle formatting
  - `formatCoordinateLocale()` - Locale-aware coordinate formatting
- **File Structure**:
  ```
  src/subapps/dxf-viewer/
  ├── config/number-format-config.ts (150 lines)
  ├── formatting/
  │   ├── FormatterRegistry.ts (500 lines)
  │   ├── useFormatter.ts (150 lines)
  │   └── index.ts (exports)
  └── rendering/entities/shared/
      └── distance-label-utils.ts (MODIFIED)
  ```
- **Pattern**: Singleton + Factory + Strategy
- **Benefits**:
  - Zero inline `.toFixed()` patterns (incremental migration)
  - Locale-aware decimal separators
  - AutoCAD-compatible unit types
  - Cached Intl.NumberFormat instances
  - Full TypeScript (ZERO any)
- **Migration Strategy**: On-touch migration (replace `.toFixed()` when editing files)
- **Companion**: ADR-069 (formatDistance/formatAngle), ADR-081 (formatPercent), ADR-041 (Distance Labels)

### ADR-121: Zero Point Pattern Centralization (WORLD_ORIGIN, ZERO_VECTOR, EMPTY_BOUNDS)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `config/geometry-constants.ts`
- **Decision**: Centralize all `{ x: 0, y: 0 }` inline patterns to semantic constants
- **Problem**: 74 repetitions of `{ x: 0, y: 0 }` across 41 files with different semantic meanings:
  - World coordinate origin (coordinate transforms, rulers, grids)
  - Zero vectors (return values, fallbacks)
  - Empty bounds (error states, empty arrays)
  - Mutable state initialization (React useState)
- **Solution**: Semantic constants + factory functions for different use cases
- **Constants** (immutable with `Object.freeze()`):
  - `WORLD_ORIGIN: Readonly<Point2D>` - Reference point in world coordinates (transforms, rulers)
  - `ZERO_VECTOR: Readonly<Point2D>` - Generic zero point (returns, fallbacks)
  - `ZERO_DELTA: Readonly<Point2D>` - Zero movement vector (delta tracking)
  - `EMPTY_BOUNDS: Readonly<BoundingBox>` - Zero-size bounding box (empty arrays)
  - `DEFAULT_BOUNDS: Readonly<BoundingBox>` - Standard placeholder (100x100)
- **Factory Functions** (for mutable state):
  - `createZeroPoint(): Point2D` - Fresh mutable zero point (React state)
  - `createEmptyBounds(): BoundingBox` - Fresh mutable empty bounds
- **Utility Functions**:
  - `isAtOrigin(point: Point2D): boolean` - Check if point is at origin
  - `isEmptyBounds(bounds: BoundingBox): boolean` - Check if bounds are empty
- **API**:
  ```typescript
  // Immutable usage (coordinate transforms, rendering)
  import { WORLD_ORIGIN, ZERO_VECTOR, EMPTY_BOUNDS } from '../config/geometry-constants';

  const screenOrigin = worldToScreen(WORLD_ORIGIN, transform);
  return isValid ? result : ZERO_VECTOR;
  const bounds = entities.length > 0 ? calculateBounds(entities) : { ...EMPTY_BOUNDS };

  // Mutable usage (React state)
  import { createZeroPoint } from '../config/geometry-constants';

  const [position, setPosition] = useState<Point2D>(createZeroPoint());
  const dragDelta = useRef<Point2D>(createZeroPoint());
  ```
- **Files Migrated** (18 files, ~42 replacements):
  - **Phase 1 - Core Rendering** (5 files):
    - `rendering/ui/grid/GridRenderer.ts` - 3 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/ruler/RulerRenderer.ts` - 2 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/origin/OriginMarkersRenderer.ts` - 1 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/origin/OriginMarkerUtils.ts` - 1 worldOrigin → WORLD_ORIGIN
    - `rendering/passes/BackgroundPass.ts` - 1 inline → WORLD_ORIGIN
  - **Phase 2 - Geometry Utils** (3 files):
    - `rendering/entities/shared/geometry-utils.ts` - 3 returns/accumulators → ZERO_VECTOR
    - `rendering/entities/shared/line-utils.ts` - 1 unitVector → ZERO_VECTOR
    - `rendering/canvas/utils/CanvasUtils.ts` - 3 error returns → ZERO_VECTOR
  - **Phase 3 - Bounds & Fallbacks** (4 files):
    - `systems/zoom/utils/bounds.ts` - 4 fallback bounds → EMPTY_BOUNDS / DEFAULT_BOUNDS
    - `hooks/scene/useSceneState.ts` - 2 empty scene → EMPTY_BOUNDS
    - `grips/resolveTarget.ts` - 2 mock bbox → DEFAULT_BOUNDS
    - `systems/rulers-grid/types.ts` - Removed local DEFAULT_ORIGIN, re-exports from centralized
  - **Phase 4 - State Hooks** (3 files):
    - `hooks/useEntityDrag.ts` - 3 totalDelta init → createZeroPoint()
    - `hooks/useGripMovement.ts` - 2 totalDelta init → createZeroPoint()
    - `hooks/useViewState.ts` - 1 panStart init → createZeroPoint()
  - **Phase 5 - Misc Files** (2 files):
    - `systems/constraints/config.ts` - 1 basePoint → ZERO_VECTOR
    - `debug/CalibrationGridRenderer.ts` - 3 worldOrigin → WORLD_ORIGIN
- **Backward Compatibility**:
  - `systems/rulers-grid/types.ts` re-exports `DEFAULT_ORIGIN` from geometry-constants
- **Pattern**: Single Source of Truth (SSOT) + Factory Pattern
- **Benefits**:
  - Zero inline `{ x: 0, y: 0 }` patterns (semantic constants instead)
  - Semantic clarity: WORLD_ORIGIN vs ZERO_VECTOR vs ZERO_DELTA
  - Type safety with `Readonly<Point2D>` for immutable constants
  - Mutable state safety with factory functions (no shared references)
  - Single point of change for coordinate system origin
  - Consistent bounds handling across codebase
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "\{ *x: *0, *y: *0 *\}" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only geometry-constants.ts)
- **Companion**: ADR-065 (Distance Calculation), ADR-034 (Geometry Centralization), ADR-114 (Bounding Box)

### ADR-123: PreviewRenderer Color Centralization (hex → UI_COLORS)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `UI_COLORS` from `config/color-config.ts`
- **Decision**: Migrate 5 hardcoded hex colors in PreviewRenderer to centralized UI_COLORS
- **Problem**: PreviewRenderer.ts had 5 inline hex color values:
  - Line 105: `color: '#00FF00'` (preview default - green)
  - Line 111: `gripColor: '#00FF00'` (grip default - green)
  - Line 487: `ctx.strokeStyle = '#FFA500'` (arc stroke - orange)
  - Line 517: `ctx.fillStyle = '#FF00FF'` (angle text - fuchsia)
  - Line 710: `ctx.strokeStyle = '#000000'` (grip border - black)
- **Solution**: Replace inline hex with UI_COLORS references
- **New Color Added**:
  - `UI_COLORS.PREVIEW_ARC_ORANGE` (#FFA500) - Arc stroke in angle measurement
- **Existing Colors Used**:
  - `UI_COLORS.BRIGHT_GREEN` (#00ff00) - Preview/grip default
  - `UI_COLORS.DIMENSION_TEXT` (fuchsia) - Angle text
  - `UI_COLORS.BLACK` (#000000) - Grip border
- **Files Changed** (2 files):
  - `config/color-config.ts` - Added PREVIEW_ARC_ORANGE constant
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 5 replacements, added UI_COLORS import
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero hardcoded colors in PreviewRenderer
  - Consistent theming support
  - Single point of change for preview appearance
  - Type-safe color references
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -n "#00FF00\|#FFA500\|#FF00FF\|#000000" src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewRenderer.ts` (should return nothing)
- **Companion**: ADR-004 (Canvas Theme), ADR-119 (Opacity Constants), ADR-040 (Preview Canvas)

### ADR-124: Renderer Constants Centralization (DOT_RADIUS, TEXT_GAP, CIRCLE_LABEL)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `RENDER_GEOMETRY`, `TEXT_LABEL_OFFSETS`, `calculateTextGap()`
- **Location**: `config/text-rendering-config.ts`, `rendering/entities/shared/geometry-rendering-utils.ts`
- **Decision**: Centralize duplicate hardcoded values in entity renderers
- **Problem**: 8 hardcoded values across 5 files:
  - `const dotRadius = 4;` in ArcRenderer.ts, EllipseRenderer.ts, LineRenderer.ts
  - `clamp(30 * scale, 20, 60)` in CircleRenderer.ts, LineRenderer.ts
  - `- 25` label offset in CircleRenderer.ts (2 places), SnapModeIndicator.tsx
- **Solution**:
  - Add `RENDER_GEOMETRY.DOT_RADIUS = 4` to text-rendering-config.ts
  - Add `TEXT_LABEL_OFFSETS.CIRCLE_LABEL = 25` to text-rendering-config.ts
  - Add `calculateTextGap(scale)` utility function to geometry-rendering-utils.ts
- **Files Changed** (7 files):
  - `config/text-rendering-config.ts` - Added constants
  - `rendering/entities/shared/geometry-rendering-utils.ts` - Added calculateTextGap()
  - `rendering/entities/ArcRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS
  - `rendering/entities/EllipseRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS
  - `rendering/entities/LineRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS + calculateTextGap()
  - `rendering/entities/CircleRenderer.ts` - Using TEXT_LABEL_OFFSETS.CIRCLE_LABEL + calculateTextGap()
  - `canvas-v2/overlays/SnapModeIndicator.tsx` - Using TEXT_LABEL_OFFSETS.CIRCLE_LABEL
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Single source of truth for rendering constants
  - Easy global adjustments (change once, apply everywhere)
  - Eliminates duplicate formula code
  - Type-safe references
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Visual: Draw circle/arc/line entities, verify measurements and dots render correctly
- **Companion**: ADR-091 (Text Label Offsets), ADR-048 (Hardcoded Values), ADR-044 (Canvas Line Widths)

### ADR-125: Context Creation Pattern (Provider Colocation)
- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Problem**: Production error "Cannot read properties of null (reading 'Provider')"
- **Root Cause**: Context created in different file than Provider component. Bundle optimization can reorder module evaluation, causing context to be `null` when Provider tries to use it.
- **Decision**: Context MUST be created in SAME file as Provider component (colocation pattern)
- **Pattern**: Autodesk/Microsoft/Google enterprise standard
- **Files Fixed**:
  - `RulersGridContext` → moved to `systems/rulers-grid/RulersGridSystem.tsx`
  - `LevelsContext` → moved to `systems/levels/LevelsSystem.tsx`
- **Backward Compatibility**: Re-exports in original files (`useRulersGrid.ts`, `useLevels.ts`) with lazy loading to prevent circular dependencies
- **Implementation**:
  - Create context in Provider file: `export const MyContext = React.createContext<Type | null>(null);`
  - Re-export from hook file: `export { MyContext } from './MySystem';`
  - Use lazy loading for internal hook reference to prevent circular deps
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Production Build: `npm run build` (no "Provider is null" errors)
  - Runtime: Grid toggle ON/OFF, Rulers toggle ON/OFF, Level switching
- **Risk Level**: LOW (structural change with full backward compatibility)
- **Companion**: ADR-010 (Panel Type Centralization), ADR-030 (Data & State)

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

### ADR-085: Split Line Rendering Centralization
- **Canonical**: `renderSplitLineWithGap()`, `renderLineWithTextCheck()` from `rendering/entities/shared/line-rendering-utils.ts`
- **Decision**: Centralize split line rendering logic (line with gap for distance text)
- **Problem**: 2 parallel implementations with inconsistent gap sizes:
  - `BaseEntityRenderer.renderSplitLineWithGap()`: 30px gap, phase-aware
  - `line-rendering-utils.renderSplitLineWithGap()`: 40px gap, standalone
- **Solution**: Single Source of Truth in `line-rendering-utils.ts`
- **Gap Size**: Unified to `RENDER_GEOMETRY.SPLIT_LINE_GAP` (30px) from ADR-048
- **Gap Calculation**: Uses `calculateSplitLineGap()` from `line-utils.ts`
- **API**:
  - `renderSplitLineWithGap(ctx, startScreen, endScreen, gapSize?)` - Draw line with centered gap
  - `renderLineWithTextCheck(ctx, startScreen, endScreen, gapSize?)` - Conditional gap based on text settings
  - `renderContinuousLine(ctx, startScreen, endScreen)` - Draw solid line (no gap)
- **Files Changed**:
  - `line-rendering-utils.ts` - Canonical source, uses centralized gap calculation
  - `BaseEntityRenderer.ts` - Delegates to centralized utilities
- **Consumers**:
  - LineRenderer, PolylineRenderer, RectangleRenderer, AngleMeasurementRenderer (via BaseEntityRenderer)
  - CircleRenderer (via line-rendering-utils.ts)
- **Pattern**: Single Source of Truth (SSOT) + Delegation
- **Benefits**:
  - Zero duplicate split line rendering code
  - Consistent 30px gap across all renderers
  - Phase-aware behavior preserved in BaseEntityRenderer
  - CircleRenderer now uses same gap size as other renderers
- **Companion**: ADR-048 (RENDER_GEOMETRY), ADR-044 (Line Widths), ADR-065 (Distance Calculation)

### ADR-099: Polygon & Measurement Tolerances Centralization
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `POLYGON_TOLERANCES`, `MEASUREMENT_OFFSETS` from `config/tolerance-config.ts`
- **Decision**: Centralize polygon close detection and measurement positioning tolerances
- **Problem**: 5 hardcoded tolerance/offset constants in 3 files with duplicate values:
  - `CLOSE_THRESHOLD = 20` in `CanvasSection.tsx`
  - `CLOSE_TOLERANCE = 20` in `useDrawingHandlers.ts` (DUPLICATE VALUE!)
  - `EDGE_TOLERANCE = 15` in `CanvasSection.tsx`
  - `GRIP_OFFSET = 20` in `MeasurementPositioning.ts`
  - `TOP_EDGE_OFFSET = 60` in `MeasurementPositioning.ts`
- **Solution**: Extend existing `tolerance-config.ts` with 2 new sections
- **API**:
  - `POLYGON_TOLERANCES.CLOSE_DETECTION` (20) - Polygon auto-close threshold
  - `POLYGON_TOLERANCES.EDGE_DETECTION` (15) - Edge midpoint detection
  - `MEASUREMENT_OFFSETS.GRIP` (20) - Grip to label distance
  - `MEASUREMENT_OFFSETS.TOP_EDGE` (60) - Top edge adjustment
- **Files Changed**:
  - `config/tolerance-config.ts` - Added new sections (+40 lines)
  - `components/dxf-layout/CanvasSection.tsx` - 2 replacements
  - `hooks/drawing/useDrawingHandlers.ts` - 1 replacement
  - `systems/phase-manager/positioning/MeasurementPositioning.ts` - 2 replacements
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Eliminates duplicate `CLOSE_THRESHOLD` and `CLOSE_TOLERANCE` (same value in 2 files)
  - Single place to modify polygon detection sensitivity
  - Consistent measurement label positioning
- **Companion**: ADR-079 (GEOMETRY_PRECISION), ADR-095 (Snap Tolerance)

### ADR-086: Hover Utilities Scattered Code Centralization
- **Decision**: Replace inline calculations/formatting in hover utilities with centralized functions
- **Problem**: 3 hover utility files had inline code instead of using existing centralized functions:
  - `text-labeling-utils.ts`: Inline `Math.sqrt(Math.pow(...))` instead of `calculateDistance()`
  - `angle-utils.ts`: Inline `` `${degrees.toFixed(1)}°` `` instead of `formatAngle()`
  - `text-spline-renderers.ts`: Hardcoded `'14px Arial'` + inline angle format
- **Solution**: Replace with calls to existing enterprise functions:
  - `calculateDistance()` from `geometry-rendering-utils.ts` (ADR-065)
  - `formatAngle()` from `distance-label-utils.ts` (ADR-069)
  - `UI_FONTS.ARIAL.LARGE` from `text-rendering-config.ts` (ADR-042)
- **Files Changed**:
  - `utils/hover/text-labeling-utils.ts` - Use `calculateDistance()` (already imported!)
  - `utils/hover/angle-utils.ts` - Import & use `formatAngle()`
  - `utils/hover/text-spline-renderers.ts` - Import & use `UI_FONTS.ARIAL.LARGE` + `formatAngle()`
- **Lines Changed**: ~6 removed, ~5 added (imports + function calls)
- **Pattern**: DRY (Don't Repeat Yourself) + SSOT (Single Source of Truth)
- **Benefits**:
  - Zero duplicate distance calculation formulas
  - Consistent angle formatting across all hover utilities
  - Centralized font definitions (one place to change)
- **Companion**: ADR-042 (UI Fonts), ADR-065 (Distance Calculation), ADR-069 (formatAngle)

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
- **Canonical**: `UnifiedFrameScheduler` singleton from `rendering/core/UnifiedFrameScheduler.ts`
- **Pattern**: Single RAF loop with priority queue (Autodesk/Adobe pattern)
- **Features**:
  - Priority-based render queue (CRITICAL → BACKGROUND)
  - Dirty flag aggregation from multiple sources
  - Frame skipping optimization under load
  - Performance metrics collection via `getMetrics()`
  - Auto-start/stop based on registered systems
- **API**:
  - `UnifiedFrameScheduler.register(id, name, priority, render, isDirty?)` - Register render system
  - `UnifiedFrameScheduler.getMetrics()` - Get current FPS, frame timing
  - `UnifiedFrameScheduler.onFrame(callback)` - Subscribe to frame metrics
- **Consumers** (2026-02-01):
  - `DxfPerformanceOptimizer.ts` - Uses `onFrame()` for FPS tracking instead of parallel RAF loop
  - (Migrated: Removed duplicate `requestAnimationFrame(measureFPS)` loop)
- **Companion**: ADR-119 (RAF Consolidation)

### ADR-119: RAF Consolidation to UnifiedFrameScheduler
- **Status**: ✅ IMPLEMENTED (2026-02-01)
- **Decision**: All RAF loops must use `UnifiedFrameScheduler` instead of parallel `requestAnimationFrame()` calls
- **Problem**: Multiple parallel RAF loops competing for resources:
  - `UnifiedFrameScheduler` - Main render loop ✅
  - `DxfPerformanceOptimizer` - FPS measurement loop ❌ DUPLICATE
  - `useCentralizedMouseHandlers` - Panning (keep separate - high-frequency state updates)
  - `useEntityDrag` - Throttling (keep separate - state updates, not rendering)
- **Solution**:
  - `DxfPerformanceOptimizer` now uses `UnifiedFrameScheduler.onFrame()` instead of own RAF loop
  - Panning/drag RAF loops remain separate (high-frequency state updates, risky to consolidate)
- **Changes Made**:
  - `DxfPerformanceOptimizer.ts`: Removed `measureFPS()` RAF loop, now subscribes to scheduler metrics
  - Uses `UnifiedFrameScheduler.onFrame()` callback for FPS updates
  - Added cleanup via `unsubscribeFrameMetrics` in `destroy()` method
- **Benefits**:
  - Reduced from 5+ parallel RAF loops to 1 central + 2 specialized
  - More accurate FPS measurement (60-frame rolling average from scheduler)
  - Reduced CPU overhead from competing RAF loops
- **Companion**: ADR-030 (Unified Frame Scheduler), ADR-019 (Performance Thresholds)

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

### ADR-096: Interaction Timing Constants Centralization
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `PANEL_LAYOUT.TIMING` from `config/panel-tokens.ts`
- **Problem**: CRITICAL CONFLICT - `DOUBLE_CLICK_TIME` (400ms) vs `DOUBLE_CLICK_THRESHOLD` (300ms) in different files
- **Solution**: Centralize all interaction timing to `PANEL_LAYOUT.TIMING`
- **Decision**: Use 300ms as standard (CAD industry: 200-400ms range, 300ms is middle ground)
- **Constants Centralized**:
  - `DOUBLE_CLICK_MS: 300` - Double-click detection window
  - `DRAG_THRESHOLD_PX: 5` - Pixels to move before drag starts
  - `CURSOR_UPDATE_THROTTLE: 50` - Cursor context update throttle (20fps)
  - `SNAP_DETECTION_THROTTLE: 16` - Snap detection throttle (60fps)
- **Files Migrated**:
  - `systems/interaction/InteractionEngine.ts` (2 constants)
  - `systems/cursor/useCentralizedMouseHandlers.ts` (3 constants)
- **Benefits**: Single Source of Truth, consistent UX, no timing conflicts

### ADR-098: Timing Delays Centralization (setTimeout/setInterval)
- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `config/timing-config.ts`
- **Problem**: 18+ hardcoded timing values (50, 100, 150, 500, 1000, 2000 ms) scattered across 7 files
- **Solution**: Centralize all setTimeout/setInterval timing constants
- **Constants Categories**:
  - `INPUT_TIMING`: Focus delays (10ms, 50ms)
  - `FIELD_TIMING`: Field render delays (150ms)
  - `UI_TIMING`: Menu guards, tool transitions, anchor display (50ms, 100ms, 1000ms)
  - `STORAGE_TIMING`: Settings debounce, save status display (150ms, 500ms, 2000ms)
  - `COLLABORATION_TIMING`: Connection delays, cursor updates (100ms, 500ms)
- **Files Migrated**:
  - `useDynamicInputKeyboard.ts` (8 replacements)
  - `useDxfSettings.ts` (5 replacements)
  - `CollaborationEngine.ts` (2 replacements)
  - `ToolStateStore.ts` (1 replacement)
  - `useColorMenuState.ts` (1 replacement)
  - `useDynamicInputAnchoring.ts` (1 replacement)
  - `DxfSettingsStore.ts` (1 replacement)
- **Benefits**: Single Source of Truth, easy performance tuning, no magic numbers

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

### ADR-104: Entity Type Guards Centralization
- **Canonical**: `types/entities.ts` - 20 centralized type guards
- **Impact**: 100+ inline `entity.type === '...'` patterns → centralized type guards
- **Problem**: Scattered entity type checks across 35+ files with:
  - Duplicate type guard definitions in 2 files (MoveEntityCommand.ts: 8, CircleRenderer.ts: 1)
  - Inconsistent property validation (some with `'center' in entity`, some without)
  - Type narrowing issues requiring `as unknown as Entity` casting
- **Solution**: Migrate all inline checks to use centralized type guards from `types/entities.ts`
- **Type Guards Available**:
  ```typescript
  import {
    isLineEntity, isCircleEntity, isArcEntity, isEllipseEntity,
    isRectangleEntity, isRectEntity, isPolylineEntity, isLWPolylineEntity,
    isPointEntity, isTextEntity, isMTextEntity, isSplineEntity,
    isDimensionEntity, isBlockEntity, isAngleMeasurementEntity, isLeaderEntity,
    isHatchEntity, isXLineEntity, isRayEntity,
    type Entity
  } from '../../types/entities';
  ```
- **Pattern**:
  ```typescript
  // Before (inline - PROHIBITED)
  if (entity.type === 'circle' && 'center' in entity) { ... }

  // After (centralized - REQUIRED)
  if (isCircleEntity(entity as Entity)) {
    const circleEntity = entity as CircleEntity;
    // Use circleEntity.center, circleEntity.radius safely
  }
  ```
- **Files Migrated (Phase 1 - Duplicate Removal)**:
  - `core/commands/entity-commands/MoveEntityCommand.ts` - Removed 8 duplicate type guards
  - `rendering/entities/CircleRenderer.ts` - Removed 1 duplicate type guard
- **Files Migrated (Phase 2 - High Priority)**:
  - `systems/entity-creation/LevelSceneManagerAdapter.ts` - 9 replacements
  - `components/dxf-layout/CanvasSection.tsx` - 5 replacements
  - `rendering/entities/shared/entity-validation-utils.ts` - 5 replacements
  - `systems/selection/shared/selection-duplicate-utils.ts` - 4 replacements
  - `utils/geometry/GeometryUtils.ts` - 3 replacements
  - `snapping/engines/shared/snap-engine-utils.ts` - 2 replacements
  - `systems/phase-manager/PhaseManager.ts` - 2 replacements
  - `hooks/drawing/completeEntity.ts` - 1 replacement
  - `rendering/entities/shared/geometry-rendering-utils.ts` - 1 replacement
- **Files Migrated (Phase 3 - Rendering Entities)**:
  - `rendering/entities/LineRenderer.ts` - 3 replacements
  - `rendering/entities/CircleRenderer.ts` - 4 replacements (additional)
  - `rendering/entities/ArcRenderer.ts` - 3 replacements
  - `rendering/entities/EllipseRenderer.ts` - 3 replacements
  - `rendering/entities/RectangleRenderer.ts` - 4 replacements
  - `rendering/entities/PolylineRenderer.ts` - 4 replacements
  - `rendering/entities/PointRenderer.ts` - 3 replacements
  - `rendering/entities/TextRenderer.ts` - 3 replacements
  - `rendering/entities/SplineRenderer.ts` - 3 replacements
  - `rendering/entities/AngleMeasurementRenderer.ts` - 4 replacements
- **Benefits**:
  - Zero duplicate type guard definitions
  - Type-safe entity property access after guard
  - Single Source of Truth for entity type validation
  - Consistent type narrowing across codebase
  - Comment marker `// 🏢 ADR-104: Use centralized type guard` for traceability
- **Companion**: ADR-017 (Enterprise ID Generation), ADR-052 (DXF Export API Contract)

### ADR-105: Hit Test Fallback Tolerance Centralization
- **Canonical**: `TOLERANCE_CONFIG.HIT_TEST_FALLBACK` from `config/tolerance-config.ts`
- **Export Alias**: `HIT_TEST_FALLBACK` for direct import
- **Value**: 5 pixels (standard fallback for hit testing methods)
- **Impact**: 10+ hardcoded `tolerance: 5` or `tolerance = 5` patterns → centralized constant
- **Problem**: Scattered hardcoded tolerance values across 10 files:
  - `services/HitTestingService.ts` - main hit test service
  - `rendering/entities/CircleRenderer.ts` - circle hitTest method
  - `rendering/entities/SplineRenderer.ts` - spline hitTest method
  - `rendering/entities/TextRenderer.ts` - text hitTest method
  - `canvas-v2/dxf-canvas/DxfCanvas.tsx` - DXF canvas hit testing
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - layer hit testing
  - `systems/constraints/useConstraintsSystemState.ts` - constraint snap settings
  - `systems/cursor/useCentralizedMouseHandlers.ts` - marquee selection
  - `systems/selection/UniversalMarqueeSelection.ts` - universal selection
  - `systems/rulers-grid/config.ts` - ruler snap settings
- **Solution**: Replace all hardcoded `5` with `TOLERANCE_CONFIG.HIT_TEST_FALLBACK`
- **Pattern**:
  ```typescript
  // Before (hardcoded - PROHIBITED)
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = 5): boolean

  // After (centralized - REQUIRED)
  import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean
  ```
- **Benefits**:
  - Single Source of Truth for hit test fallback tolerance
  - Easy global adjustment if needed
  - Comment marker `// 🏢 ADR-105` for traceability
- **Companion**: ADR-095 (Snap Tolerance), ADR-099 (Polygon & Measurement Tolerances)

### ADR-129: Layer Entity Filtering Centralization
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Canonical**: `services/shared/layer-operation-utils.ts`
- **Decision**: Centralize all entity-layer filtering patterns to single source of truth
- **Problem**: 20+ duplicate inline filtering patterns across 5 files:
  - `services/LayerOperationsService.ts` - 6 occurrences (lines 126, 154, 255, 313, 341, 391)
  - `ui/hooks/useLayerOperations.ts` - 1 occurrence (line 78)
  - `ui/components/layers/hooks/useSearchFilter.ts` - 1 occurrence (line 8)
  - `ui/components/layers/hooks/useLayersCallbacks.ts` - 4 occurrences (lines 71, 149, 209, 228)
  - `ui/components/layers/hooks/useColorGroups.ts` - 1 occurrence (line 22)
- **Issues Found**:
  - Inconsistent null safety: Some patterns had `entity.layer &&` check, others didn't
  - Mixed visibility checks: `entity.visible !== false` vs `scene.layers[layer]?.visible !== false`
  - Code duplication: Same logic in 5+ files
  - No single source of truth for entity filtering
- **Solution**: Extended existing `layer-operation-utils.ts` with centralized utilities
- **API**:
  ```typescript
  // === SINGLE LAYER OPERATIONS ===
  getEntitiesByLayer(entities, layerName): AnySceneEntity[]
  getEntityIdsByLayer(entities, layerName): string[]
  countEntitiesInLayer(entities, layerName): number

  // === MULTI LAYER OPERATIONS ===
  getEntitiesByLayers(entities, layerNames): AnySceneEntity[]
  getEntityIdsByLayers(entities, layerNames): string[]

  // === WITH VISIBILITY CHECKS ===
  getVisibleEntitiesByLayer(entities, layerName): AnySceneEntity[]
  getVisibleEntityIdsByLayer(entities, layerName): string[]
  getVisibleEntityIdsByLayers(entities, layerNames): string[]
  getVisibleEntityIdsInLayers(entities, layers, layerNames): string[]

  // === ENTITY EXCLUSION OPERATIONS ===
  getEntitiesNotInLayer(entities, layerName): AnySceneEntity[]
  getEntitiesNotInLayers(entities, layerNames): AnySceneEntity[]

  // === HELPER FUNCTIONS ===
  entityBelongsToLayer(entity, layerName): boolean
  entityBelongsToLayers(entity, layerNames): boolean
  isEntityVisible(entity): boolean
  ```
- **Files Migrated**:
  - `services/LayerOperationsService.ts` - 6 replacements
  - `ui/hooks/useLayerOperations.ts` - 1 replacement
  - `ui/components/layers/hooks/useSearchFilter.ts` - 1 replacement
  - `ui/components/layers/hooks/useLayersCallbacks.ts` - 4 replacements
- **Pattern**:
  ```typescript
  // Before (inline - PROHIBITED)
  const entityIds = scene.entities
    .filter(entity => entity.layer === layerName)
    .map(entity => entity.id);

  // After (centralized - REQUIRED)
  import { getEntityIdsByLayer } from '../services/shared/layer-operation-utils';
  const entityIds = getEntityIdsByLayer(scene.entities, layerName);
  ```
- **Benefits**:
  - Zero inline layer filtering patterns (20+ eliminated)
  - Consistent null safety (100%)
  - Single Source of Truth for all entity-layer operations
  - Type-safe with `AnySceneEntity` type
  - ~50 lines of duplicate code removed
- **Companion**: ADR-104 (Entity Type Guards), ADR-017 (Enterprise ID)

### ADR-130: Default Layer Name Centralization
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Canonical**: `config/layer-config.ts`
- **Decision**: Centralize all `|| 'default'` layer name patterns to single source of truth
- **Problem**: 10+ hardcoded `'default'` layer fallbacks with inconsistent values:
  - `'default'` - 10 files (hardcoded)
  - `'general'` - `ENTERPRISE_CONSTANTS.DEFAULT_LAYER` (unused)
  - `'0'` - `CreateEntityCommand.ts` (DXF standard)
- **Files with Hardcoded `'default'`**:
  | File | Line | Context |
  |------|------|---------|
  | `utils/dxf-scene-builder.ts` | 71 | Entity layer assignment |
  | `rendering/passes/EntityPass.ts` | 135 | Batch key generation |
  | `rendering/hitTesting/HitTester.ts` | 379 | Hit test result |
  | `rendering/hitTesting/HitTester.ts` | 500 | Hit test result |
  | `systems/selection/utils.ts` | 78 | Layer lookup |
  | `state/overlay-manager.ts` | 100 | Current layer ID |
  | `services/HitTestingService.ts` | 155 | Hit test result |
  | `services/LayerOperationsService.ts` | 412 | Statistics |
- **Solution**: Centralized constants + utility functions in `config/layer-config.ts`
- **API**:
  ```typescript
  // === CONSTANTS ===
  DXF_DEFAULT_LAYER = '0'        // AutoCAD standard layer
  DEFAULT_LAYER_NAME = 'default' // Application default layer

  // === UTILITY FUNCTIONS ===
  getLayerNameOrDefault(layer: string | undefined | null): string
  getDxfLayerName(layer: string | undefined | null): string
  isDefaultLayer(layer: string | undefined | null): boolean
  ```
- **Files Migrated**:
  - `utils/dxf-scene-builder.ts` - 1 replacement
  - `rendering/passes/EntityPass.ts` - 1 replacement
  - `rendering/hitTesting/HitTester.ts` - 2 replacements
  - `systems/selection/utils.ts` - 1 replacement
  - `state/overlay-manager.ts` - 3 replacements (constant + initial state + createRegion)
  - `services/HitTestingService.ts` - 1 replacement
  - `services/LayerOperationsService.ts` - 1 replacement
  - `settings-provider/constants.ts` - Updated `ENTERPRISE_CONSTANTS.DEFAULT_LAYER`
  - `components/dxf-layout/CanvasSection.tsx` - 1 replacement
- **Files Skipped (Different Context)**:
  - `systems/cursor/useCentralizedMouseHandlers.ts:348` - `snap.activeMode || 'default'`
  - `systems/toolbars/utils.ts:168` - `action.group || 'default'`
- **Pattern**:
  ```typescript
  // Before (inline - PROHIBITED)
  const layerName = entity.layer || 'default';

  // After (centralized - REQUIRED)
  import { getLayerNameOrDefault } from '../config/layer-config';
  const layerName = getLayerNameOrDefault(entity.layer);
  ```
- **Benefits**:
  - Zero hardcoded layer fallbacks (8 eliminated)
  - Consistent layer naming across codebase
  - Single Source of Truth for default layer configuration
  - DXF compatibility via `getDxfLayerName()` for export
  - Type-safe with proper null handling
- **Companion**: ADR-129 (Layer Entity Filtering), ADR-104 (Entity Type Guards)

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

### ADR-092: Centralized localStorage Service
- **Canonical**: `storageGet()`, `storageSet()`, `storageRemove()`, `STORAGE_KEYS` from `utils/storage-utils.ts`
- **Decision**: Centralize all localStorage operations with SSR-safe, type-safe utilities
- **Problem**: 37+ scattered localStorage calls across 16 files with:
  - Inconsistent error handling
  - Missing SSR-safe checks
  - Duplicate JSON parse/stringify patterns
  - Different key naming conventions
- **Solution**: Extended existing `storage-utils.ts` with sync localStorage utilities
- **API**:
  - `STORAGE_KEYS` - Registry of all localStorage keys
  - `storageGet<T>(key, defaultValue): T` - SSR-safe getter with type safety
  - `storageSet<T>(key, value): boolean` - SSR-safe setter with quota handling
  - `storageRemove(key): boolean` - SSR-safe removal
  - `storageHas(key): boolean` - SSR-safe existence check
- **Key Registry**:
  - `STORAGE_KEYS.DEBUG_RULER` - `'debug.rulerDebug.enabled'`
  - `STORAGE_KEYS.DEBUG_ORIGIN_MARKERS` - `'debug.originMarkers.enabled'`
  - `STORAGE_KEYS.PERFORMANCE_MONITOR` - `'dxf-viewer-performance-monitor-enabled'`
  - `STORAGE_KEYS.OVERLAY_STATE` - `'dxf-viewer:overlay-state:v1'`
  - `STORAGE_KEYS.OVERLAY_STATE_PREFIX` - `'dxf-overlay-'` (per-level dynamic key)
  - `STORAGE_KEYS.RECENT_COLORS` - `'dxf-viewer:recent-colors'`
  - `STORAGE_KEYS.DXF_SETTINGS` - `'dxf-settings-v2'`
  - `STORAGE_KEYS.CURSOR_SETTINGS` - `'autocad_cursor_settings'`
  - `STORAGE_KEYS.AI_SNAPPING` - `'ai-snapping-data'`
  - `STORAGE_KEYS.RULERS_GRID_PREFIX` - `'rulers-grid-persistence'`
  - `STORAGE_KEYS.CONSTRAINTS_PREFIX` - `'dxf-viewer-constraints'`
  - `STORAGE_KEYS.COMMAND_HISTORY_PREFIX` - `'dxf-command-history'`
- **Files Migrated (Phase 1)**:
  - `debug/RulerDebugOverlay.ts` - Debug toggle persistence
  - `debug/OriginMarkersDebugOverlay.ts` - Debug toggle persistence
  - `hooks/usePerformanceMonitorToggle.ts` - Performance monitor state
  - `hooks/state/useOverlayState.ts` - Overlay editor state
  - `ui/color/RecentColorsStore.ts` - Recent colors LRU cache (SSR fix!)
- **Files Migrated (Phase 2 - Full Centralization)**:
  - `state/overlay-manager.ts` - Per-level overlay state persistence
  - `systems/cursor/config.ts` - Cursor settings persistence
  - `stores/DxfSettingsStore.ts` - DXF settings (general + overrides)
  - `systems/rulers-grid/usePersistence.ts` - Rulers/Grid persistence hook
  - `systems/rulers-grid/RulersGridSystem.tsx` - Main rulers/grid system
  - `systems/constraints/useConstraintsSystemState.ts` - Constraints system state
  - `systems/ai-snapping/AISnappingEngine.ts` - AI snapping learned data
  - `core/commands/CommandPersistence.ts` - Command history fallback storage
  - `ui/CursorSettingsPanel.tsx` - Cursor settings clear & reload
- **Relationship to LocalStorageDriver**:
  - `LocalStorageDriver` (ADR async) - Full enterprise async driver for settings
  - `storageGet/Set` (ADR-092 sync) - Lightweight sync utilities for simple state
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero SSR errors (automatic `typeof window` check)
  - Zero duplicate try/catch blocks
  - Consistent error logging with `[StorageService]` prefix
  - Quota exceeded handling built-in
  - Type-safe JSON serialization
- **Companion**: LocalStorageDriver (async enterprise), StorageManager (quota/cleanup)

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
