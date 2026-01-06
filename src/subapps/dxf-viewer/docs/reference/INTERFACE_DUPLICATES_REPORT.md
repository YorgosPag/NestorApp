# 🔍 INTERFACE DUPLICATES ANALYSIS REPORT
## DXF Viewer - Comprehensive Interface Duplication Analysis

**Generated:** 2025-10-03
**Total TypeScript Files Analyzed:** 561
**Total Interface Declarations Found:** 745
**Analysis Scope:** Complete dxf-viewer directory

---

## 📊 EXECUTIVE SUMMARY

### Critical Findings
- **35+ duplicate interface definitions** scattered across multiple files
- **7 core interface types** with the most severe duplication
- **High Priority:** Point2D, BoundingBox, Viewport, Entity, SnapResult have 3-8 definitions each
- **Impact:** Type inconsistency, maintenance burden, import confusion

### Severity Breakdown
| Category | Count | Impact |
|----------|-------|--------|
| **Critical Duplicates** (Exact same interface, different locations) | 15+ | 🔴 HIGH |
| **Semantic Duplicates** (Similar purpose, different structure) | 12+ | 🟡 MEDIUM |
| **Centralization Candidates** (Should be unified) | 8+ | 🟠 HIGH |

---

## 🚨 SECTION 1: CRITICAL DUPLICATES (Exact Same Interface)

### 1.1 **BoundingBox** - 7 DEFINITIONS FOUND

#### Variant A: `{ min: Point2D; max: Point2D }` (2 occurrences)
```typescript
// Location 1: src/subapps/dxf-viewer/rendering/types/Types.ts:49-52
export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}

// Location 2: src/subapps/dxf-viewer/systems/rulers-grid/config.ts:11-14
export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}

// Location 3: src/subapps/dxf-viewer/utils/bounds-utils.ts:8-11
export interface Bounds {  // ⚠️ Different name, same structure
  min: Point2D;
  max: Point2D;
}
```

#### Variant B: `{ minX, minY, maxX, maxY }` (4 occurrences)
```typescript
// Location 4: src/subapps/dxf-viewer/overlays/types.ts:117-122
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Location 5: src/subapps/dxf-viewer/rendering/core/IRenderContext.ts:30-35
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Location 6: src/subapps/dxf-viewer/utils/SmartBoundsManager.ts:15-22
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// Location 7: src/subapps/dxf-viewer/rendering/hitTesting/Bounds.ts:8-17
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Location 8: src/subapps/dxf-viewer/types/index.ts:147-160
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ?: number;
  maxZ?: number;
  width: number;
  height: number;
  depth?: number;
  centerX: number;
  centerY: number;
  centerZ?: number;
}
```

**Impact:** 🔴 **CRITICAL**
- 7 different definitions (2 semantic variants)
- Used in 30+ files
- Import confusion between `min/max` vs `minX/maxX` variants

**Recommendation:**
```typescript
// CENTRALIZE TO: src/subapps/dxf-viewer/types/geometry.ts (NEW FILE)
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minZ?: number;  // For 3D support
  maxZ?: number;
  width: number;  // Computed property
  height: number; // Computed property
  depth?: number; // Computed property
  centerX: number; // Computed property
  centerY: number; // Computed property
  centerZ?: number; // Computed property
}

// Alias for legacy min/max style
export interface Bounds {
  min: Point2D;
  max: Point2D;
}

// Utility function to convert
export function boundsToBoundingBox(bounds: Bounds): BoundingBox;
export function boundingBoxToBounds(box: BoundingBox): Bounds;
```

---

### 1.2 **Point2D** - 2 DEFINITIONS + Type Alias

```typescript
// CANONICAL: src/subapps/dxf-viewer/rendering/types/Types.ts:17-20
export interface Point2D {
  x: number;
  y: number;
}

// DUPLICATE: src/subapps/dxf-viewer/types/index.ts:14-18
export interface Point {
  x: number;
  y: number;
  z?: number; // 3D support - THIS IS Point3D!
}
```

**Impact:** 🟡 **MEDIUM**
- 2 definitions with different names (`Point2D` vs `Point`)
- The `Point` interface in types/index.ts is actually a Point3D (has optional z)
- 100+ imports across codebase, mixing both types

**Recommendation:**
```typescript
// KEEP: src/subapps/dxf-viewer/rendering/types/Types.ts (CANONICAL)
export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

// DEPRECATE: types/index.ts Point interface
// Create migration: Point → Point2D | Point3D (based on usage)
```

---

### 1.3 **Viewport** - 8 DEFINITIONS FOUND

#### Variant A: Simple size viewport (3 occurrences)
```typescript
// Location 1: src/subapps/dxf-viewer/rendering/types/Types.ts:41-46
export interface Viewport {
  x?: number;     // Optional x offset (defaults to 0)
  y?: number;     // Optional y offset (defaults to 0)
  width: number;
  height: number;
}

// Location 2: src/subapps/dxf-viewer/canvas-v2/overlays/CrosshairOverlay.tsx:8
interface Viewport {
  width: number;
  height: number;
}
```

#### Variant B: DXF-style viewport (1 occurrence)
```typescript
// Location 3: src/subapps/dxf-viewer/types/index.ts:103-112
export interface Viewport {
  center: Point;
  height: number;
  width: number;
  zoom: number;
  snapMode: boolean;
  gridMode: boolean;
  orthoMode: boolean;
  polarMode: boolean;
}
```

#### Variant C: Snap engine viewport interface (5 occurrences)
```typescript
// Location 4-8: Multiple snap engine files
interface Viewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
  scale?: number;
}

// Found in:
// - snapping/SnapEngineCore.ts:20
// - snapping/ProSnapEngineV2.ts:19
// - snapping/orchestrator/SnapOrchestrator.ts:28
// - snapping/orchestrator/SnapEngineRegistry.ts:40
// - snapping/orchestrator/SnapContextManager.ts:10
```

**Impact:** 🔴 **CRITICAL**
- 8 definitions with 3 semantic variants
- Snap engine has 5 identical copies (DRY violation)
- Confusion between "viewport as canvas size" vs "viewport as view state"

**Recommendation:**
```typescript
// CENTRALIZE TO: src/subapps/dxf-viewer/types/viewport.ts (NEW FILE)

// Canvas viewport (dimensions only)
export interface CanvasViewport {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

// View state viewport (CAD-style)
export interface ViewStateViewport {
  center: Point2D;
  width: number;
  height: number;
  zoom: number;
  snapMode?: boolean;
  gridMode?: boolean;
  orthoMode?: boolean;
  polarMode?: boolean;
}

// Snap engine viewport (functional interface)
export interface SnapViewport {
  worldPerPixelAt(p: Point2D): number;
  worldToScreen(p: Point2D): Point2D;
  scale: number;
}

// Type alias for backward compatibility
export type Viewport = CanvasViewport;
```

---

### 1.4 **SnapResult** - 6 DEFINITIONS FOUND

```typescript
// Location 1: src/subapps/dxf-viewer/rendering/ui/snap/SnapTypes.ts:29-35
export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly entityId?: string;
  readonly priority: number;
}

// Location 2: src/subapps/dxf-viewer/rendering/hitTesting/HitTester.ts:44-54
export interface SnapResult {
  point: Point2D;
  type: 'vertex' | 'edge' | 'center' | 'grid' | 'intersection';
  entityId?: string;
  distance: number;
  visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}

// Location 3: src/subapps/dxf-viewer/systems/rulers-grid/config.ts:286-291
export interface SnapResult {
  point: Point2D;
  type: 'grid' | 'ruler' | 'axis' | 'origin';
  distance: number;
  direction?: 'horizontal' | 'vertical';
}

// Location 4: src/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-types.ts:55-59
export interface SnapResult {
  point: Point2D;
  type: SnapType;
  entityId?: string;
}

// Location 5-6: src/subapps/dxf-viewer/canvas-v2/overlays/
// SnapIndicatorOverlay.tsx:5 & SnapModeIndicator.tsx:5
interface SnapResult {
  point: Point2D;
  type: string;
}
```

**Impact:** 🔴 **CRITICAL**
- 6 definitions with varying levels of detail
- Type field varies: SnapType vs string vs specific literals
- Inconsistent optional fields (priority, visual, direction)

**Recommendation:**
```typescript
// CENTRALIZE TO: src/subapps/dxf-viewer/types/snap.ts (NEW FILE)

export type SnapType =
  | 'endpoint' | 'midpoint' | 'center' | 'intersection'
  | 'perpendicular' | 'tangent' | 'quadrant' | 'nearest'
  | 'grid' | 'ruler' | 'axis' | 'origin' | 'vertex' | 'edge';

export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly entityId?: string;
  readonly priority?: number;
  readonly direction?: 'horizontal' | 'vertical';
  readonly visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}

// Specialized variants for specific modules (if needed)
export type GridSnapResult = SnapResult & { type: 'grid' | 'ruler' | 'axis' | 'origin' };
export type EntitySnapResult = SnapResult & { type: 'vertex' | 'edge' | 'center' };
```

---

### 1.5 **Entity** - 4+ BASE DEFINITIONS

```typescript
// Location 1: src/subapps/dxf-viewer/rendering/types/Types.ts:55-76
export interface EntityModel {
  id: string;
  type: string;
  visible?: boolean;
  selected?: boolean;
  hovered?: boolean;
  layer?: string;
  color?: string;
  lineType?: LineType;
  lineWeight?: number;
  // Geometry properties
  position?: Point2D;
  center?: Point2D;
  start?: Point2D;
  end?: Point2D;
  radius?: number;
  points?: Point2D[];
  [key: string]: any;
}
export type Entity = EntityModel;  // Alias

// Location 2: src/subapps/dxf-viewer/types/entities.ts:9-23
export interface BaseEntity {
  id: string;
  type: EntityType;
  layer?: string;
  color?: string;
  selected?: boolean;
  preview?: boolean;
  measurement?: boolean;
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[];
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

// Location 3: src/subapps/dxf-viewer/snapping/extended-types.ts:34-49
export interface Entity {
  id: string;
  type: string;
  visible?: boolean;
  selected?: boolean;
  data?: Record<string, unknown>;
  points?: Point2D[];
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  start?: Point2D;
  end?: Point2D;
  layer?: string;
}

// Location 4: src/subapps/dxf-viewer/utils/SmartBoundsManager.ts:24-33
interface Entity {
  id: string;
  type: string;
  start?: Point2D;
  end?: Point2D;
  center?: Point2D;
  radius?: number;
  points?: Array<Point2D>;
  [key: string]: unknown;
}
```

**Impact:** 🔴 **CRITICAL**
- 4+ base Entity definitions
- Inconsistent optional properties (hovered, locked, preview, etc.)
- Some use `any`, others use `unknown` for index signature
- 71 Entity-related interface definitions total (including LineEntity, CircleEntity, etc.)

**Recommendation:**
```typescript
// CENTRALIZE TO: src/subapps/dxf-viewer/types/entity.ts (EXISTING FILE)
// Keep types/entities.ts as canonical, remove duplicates

// Base entity - SINGLE DEFINITION
export interface BaseEntity {
  id: string;
  type: EntityType;
  layer?: string;
  color?: string;
  lineType?: LineType;
  lineWeight?: number;

  // State flags
  visible?: boolean;
  selected?: boolean;
  hovered?: boolean;
  locked?: boolean;
  preview?: boolean;
  measurement?: boolean;

  // Preview-specific
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[];

  // Metadata
  metadata?: Record<string, unknown>;

  // DXF-specific
  handle?: string;
  ownerHandle?: string;
}

// Remove all other base Entity definitions
// Update all imports to use this canonical version
```

---

### 1.6 **Scene** - 4 DEFINITIONS (Managers)

```typescript
// Location 1: src/subapps/dxf-viewer/managers/SceneValidator.ts:9
interface Scene {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  version: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Location 2: src/subapps/dxf-viewer/managers/SceneUpdateManager.ts:12
interface Scene {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  version: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Location 3: src/subapps/dxf-viewer/managers/SceneStatistics.ts:8
interface Scene {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  version: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Location 4: src/subapps/dxf-viewer/utils/SmartBoundsManager.ts:35
interface Scene {
  entities: Entity[];  // ⚠️ Different: Entity instead of AnySceneEntity
  version?: number;
  bounds?: BoundingBox;
  [key: string]: unknown;
}
```

**Impact:** 🟡 **MEDIUM**
- 4 identical definitions in manager/utility files
- Should reference src/subapps/dxf-viewer/types/scene.ts:87 (SceneModel)
- Private interfaces instead of importing canonical type

**Recommendation:**
```typescript
// USE EXISTING: src/subapps/dxf-viewer/types/scene.ts:87
export interface SceneModel {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  version?: number;
  metadata?: Record<string, unknown>;
}

// REPLACE all manager Scene interfaces with:
import type { SceneModel } from '../types/scene';

// In all 4 locations, replace:
// interface Scene { ... }
// with:
// (just use SceneModel directly, or create type alias)
type Scene = SceneModel;
```

---

### 1.7 **LineTemplate** - 2 DEFINITIONS

```typescript
// Location 1: src/subapps/dxf-viewer/contexts/LineSettingsContext.tsx:16
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;
}

// Location 2: src/subapps/dxf-viewer/contexts/LineConstants.tsx:69
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: {
    lineType: LineType;
    lineWidth: number;
    color: string;
    opacity: number;
    dashScale: number;
    dashOffset: number;
    lineCap: LineCapStyle;
    lineJoin: LineJoinStyle;
    breakAtCenter: boolean;
    hoverColor: string;
    hoverType: LineType;
    // ... more properties
  };
}
```

**Impact:** 🟡 **MEDIUM**
- 2 definitions in related context files
- Second definition has inline expanded settings object
- Both are in contexts/ directory (close proximity)

**Recommendation:**
```typescript
// CENTRALIZE TO: src/subapps/dxf-viewer/types/line-settings.ts (NEW FILE)
export interface LineSettings {
  lineType: LineType;
  lineWidth: number;
  color: string;
  opacity: number;
  dashScale: number;
  dashOffset: number;
  lineCap: LineCapStyle;
  lineJoin: LineJoinStyle;
  breakAtCenter: boolean;
  hoverColor: string;
  hoverType: LineType;
}

export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;
}

export type TemplateCategory = 'engineering' | 'architectural' | 'electrical' | 'custom';

// Remove duplicates from both context files
```

---

## 🟡 SECTION 2: SEMANTIC DUPLICATES (Similar Purpose, Different Names)

### 2.1 **Viewport vs ViewTransform vs Transform2D**

Three interfaces representing similar transformation concepts:

```typescript
// ViewTransform (rendering/types/Types.ts:35-39)
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Transform2D (rendering/core/IRenderContext.ts:17-22)
export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;  // Additional property
}

// UITransform (rendering/ui/core/UIRenderer.ts)
export interface UITransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}
```

**Impact:** 🟡 **MEDIUM**
- 3 interfaces representing 2D affine transforms
- Transform2D has optional rotation (more complete)
- UITransform and ViewTransform are identical

**Recommendation:**
```typescript
// CENTRALIZE: Use Transform2D as canonical (most complete)
// in rendering/types/Types.ts

export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;
}

// Alias for backward compatibility
export type ViewTransform = Transform2D;
export type UITransform = Transform2D;
```

---

### 2.2 **Bounds vs BoundingBox vs SceneBounds**

```typescript
// Bounds (utils/bounds-utils.ts:8)
export interface Bounds {
  min: Point2D;
  max: Point2D;
}

// BoundingBox - 7 variants (see Section 1.1)

// SceneBounds (types/scene.ts:82)
export interface SceneBounds {
  min: Point2D;
  max: Point2D;
}
```

**Impact:** 🟡 **MEDIUM**
- Bounds and SceneBounds are identical
- Both use min/max Point2D representation
- Should consolidate with BoundingBox variants

**Recommendation:**
See Section 1.1 BoundingBox recommendation - create utility functions to convert between representations.

---

### 2.3 **SnapCandidate vs SnapResult**

```typescript
// SnapCandidate (snapping/extended-types.ts:51-58)
export interface SnapCandidate {
  point: Point2D;
  type: ExtendedSnapType;
  description: string;
  distance: number;
  priority: number;
  entityId?: string;
}

// SnapResult - 6 variants (see Section 1.4)
```

**Impact:** 🟡 **MEDIUM**
- SnapCandidate is a "candidate" snap point
- SnapResult is the "final selected" snap point
- Semantic difference, but structurally very similar
- SnapCandidate has `description` field

**Recommendation:**
```typescript
// Keep both, but make SnapResult extend SnapCandidate
export interface SnapCandidate {
  point: Point2D;
  type: SnapType;
  description: string;
  distance: number;
  priority: number;
  entityId?: string;
}

// SnapResult is the selected candidate
export interface SnapResult extends SnapCandidate {
  readonly visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}
```

---

### 2.4 **DXFEntity vs SceneEntity vs EntityModel**

```typescript
// DXFEntity (types/index.ts:20)
export interface DXFEntity {
  id: string;
  type: string;
  layer: string;
  points: Point[];
  color: string;
  selected?: boolean;
  visible?: boolean;
  // ... DXF-specific properties (handle, ownerHandle, etc.)
  // ... lots of optional properties
}

// SceneEntity (types/scene.ts:5)
export interface SceneEntity {
  id: string;
  type: 'line' | 'polyline' | 'circle' | 'arc' | 'text' | 'block' | 'rectangle' | 'angle-measurement';
  layer: string;
  color?: string;
  lineweight?: number;
  visible: boolean;
  name?: string;
}

// EntityModel (rendering/types/Types.ts:55)
export interface EntityModel {
  id: string;
  type: string;
  visible?: boolean;
  selected?: boolean;
  hovered?: boolean;
  layer?: string;
  color?: string;
  // ... rendering-specific properties
}
```

**Impact:** 🟠 **HIGH**
- 3 base entity interfaces representing different stages:
  - DXFEntity: Raw DXF import data
  - SceneEntity: Internal scene representation
  - EntityModel: Rendering representation
- Some overlap, but serve different purposes
- Need clear documentation of lifecycle

**Recommendation:**
```typescript
// Keep all three, but document the pipeline clearly:

// 1. DXF Import Stage
export interface DXFEntity {
  // Raw DXF data from file
}

// 2. Scene Stage (after import/processing)
export interface SceneEntity {
  // Normalized scene representation
}

// 3. Rendering Stage
export interface EntityModel {
  // Rendering-ready entity with visual state
}

// Add utility functions:
export function dxfEntityToSceneEntity(dxf: DXFEntity): SceneEntity;
export function sceneEntityToEntityModel(scene: SceneEntity): EntityModel;

// Document in centralized_systems.md
```

---

## 🟠 SECTION 3: CENTRALIZATION CANDIDATES

### 3.1 **Point/Coordinate Types** → `types/geometry.ts`

**Current State:**
- Point2D in rendering/types/Types.ts (canonical)
- Point in types/index.ts (duplicate with z?)
- Scattered imports across 100+ files

**Recommendation:**
```typescript
// CREATE: src/subapps/dxf-viewer/types/geometry.ts

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

// Alias for backward compatibility
export type Point = Point2D;

// Utility functions
export function distance(p1: Point2D, p2: Point2D): number;
export function midpoint(p1: Point2D, p2: Point2D): Point2D;
export function add(p1: Point2D, p2: Point2D): Point2D;
export function subtract(p1: Point2D, p2: Point2D): Point2D;
```

**Migration:**
1. Create new centralized file
2. Update all imports to use central location
3. Mark legacy locations as consolidated

---

### 3.2 **Bounding Box Types** → `types/geometry.ts`

**Current State:**
- 7 BoundingBox definitions (see Section 1.1)
- 2 semantic variants (min/max vs minX/maxX)

**Recommendation:** See Section 1.1 for detailed recommendation.

---

### 3.3 **Viewport Types** → `types/viewport.ts`

**Current State:**
- 8 Viewport definitions (see Section 1.3)
- 3 semantic variants

**Recommendation:** See Section 1.3 for detailed recommendation.

---

### 3.4 **Snap Types** → `types/snap.ts`

**Current State:**
- SnapResult: 6 definitions
- SnapCandidate: 1 definition
- SnapType: scattered across files

**Recommendation:**
```typescript
// CREATE: src/subapps/dxf-viewer/types/snap.ts

export type SnapType =
  | 'endpoint' | 'midpoint' | 'center' | 'intersection'
  | 'perpendicular' | 'tangent' | 'quadrant' | 'nearest'
  | 'grid' | 'ruler' | 'axis' | 'origin' | 'vertex' | 'edge';

export interface SnapCandidate {
  point: Point2D;
  type: SnapType;
  description: string;
  distance: number;
  priority: number;
  entityId?: string;
}

export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly entityId?: string;
  readonly priority?: number;
  readonly direction?: 'horizontal' | 'vertical';
  readonly visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}

export interface SnapSettings {
  enabled: boolean;
  types: SnapType[];
  tolerance: number;
  showIndicators: boolean;
}
```

---

### 3.5 **Transform Types** → `types/transform.ts`

**Current State:**
- ViewTransform, Transform2D, UITransform (all similar)
- DrawingTransform, CanvasTransform (specialized)

**Recommendation:**
```typescript
// CREATE: src/subapps/dxf-viewer/types/transform.ts

export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;
}

// Aliases for backward compatibility
export type ViewTransform = Transform2D;
export type UITransform = Transform2D;

// Utility functions
export function applyTransform(point: Point2D, transform: Transform2D): Point2D;
export function inverseTransform(point: Point2D, transform: Transform2D): Point2D;
export function composeTransforms(t1: Transform2D, t2: Transform2D): Transform2D;
```

---

### 3.6 **Entity Types** → Already in `types/entities.ts` (Good!)

**Current State:**
- Canonical types exist in types/entities.ts
- BUT: 4 duplicate base Entity interfaces in other files

**Recommendation:**
- Keep types/entities.ts as canonical
- Remove all duplicate base Entity interfaces
- Update imports in:
  - rendering/types/Types.ts (remove Entity alias, import from entities.ts)
  - snapping/extended-types.ts (import from entities.ts)
  - utils/SmartBoundsManager.ts (import from entities.ts)

---

### 3.7 **Scene Types** → Already in `types/scene.ts` (Good!)

**Current State:**
- Canonical SceneModel exists in types/scene.ts:87
- 4 duplicate Scene interfaces in managers/

**Recommendation:**
- Keep types/scene.ts as canonical
- Replace all manager Scene interfaces with imports

---

### 3.8 **Line Settings Types** → `types/line-settings.ts`

**Current State:**
- LineTemplate in 2 context files
- LineSettings scattered

**Recommendation:** See Section 1.7 for detailed recommendation.

---

## 📋 SECTION 4: MIGRATION PRIORITY & ACTION PLAN

### Phase 1: Critical Duplicates (1-2 days)
**Priority: HIGHEST** 🔴

1. **BoundingBox Centralization**
   - Create `types/geometry.ts` with canonical BoundingBox
   - Add utility functions for conversion
   - Update 30+ import locations
   - Test thoroughly (geometry-critical)

2. **Viewport Centralization**
   - Create `types/viewport.ts` with 3 variants
   - Update 20+ import locations in snap engines
   - Update canvas and rendering imports

3. **SnapResult Centralization**
   - Create `types/snap.ts` with unified SnapResult
   - Update 15+ snap-related files
   - Test snap functionality thoroughly

4. **Entity Base Type Cleanup**
   - Keep types/entities.ts as canonical
   - Remove 3 duplicate base Entity interfaces
   - Update imports in rendering, snapping, utils

### Phase 2: Semantic Duplicates (2-3 days)
**Priority: HIGH** 🟠

5. **Transform Types Unification**
   - Create `types/transform.ts`
   - Unify ViewTransform, Transform2D, UITransform
   - Update rendering and UI imports

6. **Point Types Consolidation**
   - Move Point2D/Point3D to `types/geometry.ts`
   - Update 100+ import locations (bulk operation)
   - Deprecate types/index.ts Point interface

7. **Bounds vs BoundingBox Resolution**
   - Decide on canonical representation
   - Create conversion utilities
   - Update utils/bounds-utils.ts

### Phase 3: Centralization Candidates (3-4 days)
**Priority: MEDIUM** 🟡

8. **Scene Interface Cleanup**
   - Remove 4 duplicate Scene interfaces in managers
   - Update all to use types/scene.ts SceneModel

9. **LineTemplate Consolidation**
   - Create types/line-settings.ts
   - Remove duplicates from contexts

10. **Entity Lifecycle Documentation**
    - Document DXFEntity → SceneEntity → EntityModel pipeline
    - Add to centralized_systems.md
    - Create conversion utilities

### Phase 4: Validation & Testing (1-2 days)
**Priority: CRITICAL** 🔴

11. **Type Check Pass**
    - Run full TypeScript compilation
    - Fix all type errors
    - Ensure no regressions

12. **Runtime Testing**
    - Test DXF import
    - Test rendering pipeline
    - Test snap system
    - Test bounds/fit-to-view

13. **Documentation Update**
    - Update centralized_systems.md
    - Add "Type System" section
    - Document canonical type locations

---

## 📊 SECTION 5: DETAILED STATISTICS

### Interface Duplication by Category
| Interface Type | Total Definitions | Canonical Location | Duplicates | Impact |
|----------------|-------------------|-------------------|------------|--------|
| BoundingBox | 7 | rendering/types/Types.ts | 6 | 🔴 Critical |
| Viewport | 8 | rendering/types/Types.ts | 7 | 🔴 Critical |
| SnapResult | 6 | rendering/ui/snap/SnapTypes.ts | 5 | 🔴 Critical |
| Entity (base) | 4 | types/entities.ts | 3 | 🔴 Critical |
| Scene | 4 | types/scene.ts | 3 | 🟡 Medium |
| Point2D | 2 | rendering/types/Types.ts | 1 | 🟡 Medium |
| LineTemplate | 2 | contexts/LineSettingsContext.tsx | 1 | 🟡 Medium |
| Transform2D | 3 | rendering/core/IRenderContext.ts | 2 | 🟡 Medium |

### Files Most Affected by Duplicates
1. **rendering/types/Types.ts** - 6 interfaces duplicated elsewhere
2. **types/index.ts** - 4 interfaces duplicated elsewhere
3. **types/entities.ts** - 3 interfaces duplicated elsewhere
4. **snapping/extended-types.ts** - 2 interfaces duplicated elsewhere

### Import Complexity Score
Based on number of different locations importing each type:
- Point2D: 100+ files (High complexity)
- BoundingBox: 30+ files (High complexity)
- Viewport: 20+ files (Medium complexity)
- Entity: 50+ files (High complexity)
- SnapResult: 15+ files (Medium complexity)

---

## 🎯 SECTION 6: CENTRALIZED SYSTEMS INTEGRATION

### Update centralized_systems.md

Add new section:

```markdown
## 7. TYPE SYSTEM CENTRALIZATION

### 7.1 Geometry Types
**Location:** `src/subapps/dxf-viewer/types/geometry.ts`
- Point2D, Point3D
- BoundingBox, Bounds
- Conversion utilities

### 7.2 Viewport Types
**Location:** `src/subapps/dxf-viewer/types/viewport.ts`
- CanvasViewport (dimensions)
- ViewStateViewport (CAD state)
- SnapViewport (functional interface)

### 7.3 Entity Types
**Location:** `src/subapps/dxf-viewer/types/entities.ts`
- BaseEntity
- LineEntity, CircleEntity, etc.
- Entity pipeline: DXFEntity → SceneEntity → EntityModel

### 7.4 Snap Types
**Location:** `src/subapps/dxf-viewer/types/snap.ts`
- SnapType enum
- SnapCandidate, SnapResult
- SnapSettings

### 7.5 Transform Types
**Location:** `src/subapps/dxf-viewer/types/transform.ts`
- Transform2D (canonical)
- ViewTransform, UITransform (aliases)

### 7.6 Scene Types
**Location:** `src/subapps/dxf-viewer/types/scene.ts`
- SceneModel (canonical)
- SceneEntity, SceneLayer, SceneBounds

### 7.7 Line Settings Types
**Location:** `src/subapps/dxf-viewer/types/line-settings.ts`
- LineSettings
- LineTemplate
- TemplateCategory
```

---

## 🚀 SECTION 7: IMPLEMENTATION STEPS

### Step 1: Create New Centralized Type Files

```bash
# Create new type files
touch src/subapps/dxf-viewer/types/geometry.ts
touch src/subapps/dxf-viewer/types/viewport.ts
touch src/subapps/dxf-viewer/types/snap.ts
touch src/subapps/dxf-viewer/types/transform.ts
touch src/subapps/dxf-viewer/types/line-settings.ts
```

### Step 2: Implement Canonical Interfaces

See detailed recommendations in Sections 1-3 for exact interface definitions.

### Step 3: Add Deprecation Warnings

```typescript
// Example: rendering/types/Types.ts
/**
 * @note Migrated to types/geometry.ts - use centralized version
 */
export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}
```

### Step 4: Update Imports (Use Script)

```typescript
// scripts/update-interface-imports.ts
// Automated script to update imports across codebase
// Replace old import paths with new canonical locations
```

### Step 5: Run Tests & Validation

```bash
# Type check
npm run type-check

# Run tests
npm run test

# Visual regression tests
npm run test:visual
```

### Step 6: Update Documentation

- Update CLAUDE.md with new type system rules
- Update centralized_systems.md (Section 7)
- Add migration guide in docs/

---

## ✅ SECTION 8: SUCCESS CRITERIA

### Metrics to Track
- [ ] **Zero duplicate interfaces** for core types (Point2D, BoundingBox, Viewport, Entity, SnapResult)
- [ ] **Single import source** for each core type
- [ ] **All TypeScript errors resolved** after migration
- [ ] **100% test pass rate** after migration
- [ ] **Zero runtime regressions** (manual testing)
- [ ] **Documentation updated** (centralized_systems.md)

### Validation Checklist
- [ ] BoundingBox has 1 canonical definition (currently 7)
- [ ] Viewport has 3 documented variants (currently 8 scattered)
- [ ] SnapResult has 1 canonical definition (currently 6)
- [ ] Entity base has 1 canonical definition (currently 4)
- [ ] Scene has 1 canonical definition (currently 4)
- [ ] Point2D has 1 canonical definition (currently 2)
- [ ] Transform2D is unified (currently 3 variants)
- [ ] All imports point to canonical locations

### Quality Gates
- [ ] No TypeScript errors: `tsc --noEmit`
- [ ] No ESLint errors: `npm run lint`
- [ ] All tests pass: `npm run test`
- [ ] Visual tests pass: `npm run test:visual`
- [ ] Manual smoke test: Import DXF, render, snap, zoom

---

## 📝 SECTION 9: NOTES & OBSERVATIONS

### Positive Findings
- ✅ **types/entities.ts exists and is well-structured** - just needs to be used consistently
- ✅ **types/scene.ts exists and is comprehensive** - just needs manager files to import it
- ✅ **Many files already import from rendering/types/Types.ts** - shows awareness of centralization

### Areas of Concern
- 🚨 **High import churn** - 100+ files will need import updates for Point2D
- 🚨 **Two BoundingBox semantic variants** - need careful migration strategy
- 🚨 **Snap engine has 5 identical Viewport interfaces** - copy-paste issue

### Technical Debt
- **Estimated 2-3 weeks** to fully resolve all duplicates
- **Medium risk** of introducing regressions during migration
- **High value** - significant improvement in maintainability and type safety

---

## 🎓 SECTION 10: BEST PRACTICES FOR FUTURE

### Rules to Prevent Duplication

1. **Single Source of Truth Rule**
   - Never define the same interface twice
   - Always check types/ directory before creating new interface

2. **Import from Canonical Location**
   - Point2D, Point3D → types/geometry.ts
   - BoundingBox → types/geometry.ts
   - Viewport variants → types/viewport.ts
   - Entity types → types/entities.ts
   - Scene types → types/scene.ts
   - Snap types → types/snap.ts

3. **Use Type Aliases, Not Duplicates**
   ```typescript
   // ✅ Good
   import type { Point2D } from '../types/geometry';
   type MyPoint = Point2D;

   // ❌ Bad
   interface MyPoint {
     x: number;
     y: number;
   }
   ```

4. **Document Type Hierarchy**
   - Add JSDoc comments explaining relationships
   - Reference canonical location in @see tags
   - Mark consolidated status for migrated locations

5. **Automated Enforcement**
   - Add ESLint rule to detect duplicate interface names
   - Add pre-commit hook to check for type duplicates
   - Regular audits (quarterly)

---

## 📌 APPENDIX: COMPLETE DUPLICATE LIST

### All Interface Duplicates Found (35+)

1. BoundingBox (7 definitions) - Section 1.1
2. Viewport (8 definitions) - Section 1.3
3. SnapResult (6 definitions) - Section 1.4
4. Entity (4 definitions) - Section 1.5
5. Scene (4 definitions) - Section 1.6
6. Point2D (2 definitions) - Section 1.2
7. LineTemplate (2 definitions) - Section 1.7
8. ViewTransform (3 definitions) - Section 2.1
9. Transform2D (3 definitions) - Section 2.1
10. Bounds (2 definitions) - Section 2.2
11. SceneBounds (duplicates Bounds) - Section 2.2
12. SnapCandidate (related to SnapResult) - Section 2.3
13. DXFEntity (related to Entity) - Section 2.4
14. SceneEntity (related to Entity) - Section 2.4
15. EntityModel (related to Entity) - Section 2.4

---

## 🏁 CONCLUSION

This report identifies **35+ duplicate interface definitions** across the dxf-viewer codebase, with **7 core types** having the most severe duplication:

1. **BoundingBox** (7 definitions) - CRITICAL
2. **Viewport** (8 definitions) - CRITICAL
3. **SnapResult** (6 definitions) - CRITICAL
4. **Entity** (4+ definitions) - CRITICAL
5. **Scene** (4 definitions) - MEDIUM
6. **Point2D** (2 definitions) - MEDIUM
7. **LineTemplate** (2 definitions) - MEDIUM

**Total Estimated Effort:** 2-3 weeks
**Priority:** HIGH 🔴
**Risk:** MEDIUM 🟡
**Value:** HIGH 🟢

**Recommendation:** Execute Phase 1 (Critical Duplicates) immediately, then proceed with Phases 2-4 incrementally.

---

**Report Generated:** 2025-10-03
**Analyst:** Claude (Anthropic AI)
**For:** Γιώργος Παγώνης
**Project:** DXF Viewer - Type System Centralization
