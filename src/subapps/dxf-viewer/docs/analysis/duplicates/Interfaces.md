# =Ë ‘‘¦Ÿ¡‘ ”™ ›Ÿ¤¥ © INTERFACES

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â**: 2025-10-03
** µ´¯¿**: `src/subapps/dxf-viewer`
**Analyst**: Claude (Anthropic AI Developer)

---

## =Ê EXECUTIVE SUMMARY

### šÁ¯Ã¹¼± •ÅÁ®¼±Ä±
-  **Point2D**: š•¤¡™šŸ Ÿ™—œ•Ÿ Ãµ `rendering/types/Types.ts` (ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹ À±½Ä¿Í)
-   **Viewport**: **5 ”™ ›Ÿ¤¥ •£ DEFINITIONS** Ãµ ´¹±Æ¿ÁµÄ¹º¬ ±ÁÇµ¯±
-   **BoundingBox**: **6 ”™ ›Ÿ¤¥ •£ DEFINITIONS** ¼µ ´¹±Æ¿ÁµÄ¹º® ´¿¼®
-   **Entity**: **3 š¥¡™•£ DEFINITIONS** + À¿»»­Â À±Á±»»±³­Â
-   **SnapResult**: **5 ”™‘¦Ÿ¡•¤™š•£ VERSIONS** ³¹± Ä¿ ¯´¹¿ concept
-   **LineTemplate**: **2 ”™ ›Ÿ¤¥ •£ DEFINITIONS** Ãµ contexts
-   **Scene**: **3 ”™‘¦Ÿ¡•¤™š•£ DEFINITIONS**
-   **EntityModel**: **2 DEFINITIONS** (rendering vs utils)

### £Í½¿È·  Á¿²»·¼¬ÄÉ½
- **£Í½¿»¿ Critical Duplicates**: 8 ºÍÁ¹µÂ ¿¼¬´µÂ ´¹À»ÌÄÅÀÉ½
- **•ºÄ¹¼Î¼µ½± ‘ÁÇµ¯± À¿Å §Áµ¹¬¶¿½Ä±¹ Refactoring**: 35+
- **’±¸¼ÌÂ šµ½ÄÁ¹º¿À¿¯·Ã·Â**: 40% (¼Ì½¿ Point2D µ¯½±¹ À»®ÁÉÂ centralized)
- ** Á¿ÄµÁ±¹ÌÄ·Ä±**: =4 **HIGH** - ¤± ´¹À»ÌÄÅÀ± ´·¼¹¿ÅÁ³¿Í½ type conflicts º±¹ confusion

---

## =¨ š¡™¤™š‘ ”™ ›Ÿ¤¥ ‘ (Exact Duplicates)

### 1. L **BoundingBox Interface** (6 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) Extended Format** (¼µ computed properties):
```typescript
// =Í Location: types/index.ts:147
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

**B) Extended Format** (¯´¹± ¼µ A):
```typescript
// =Í Location: rendering/hitTesting/Bounds.ts:8
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
```

**C) Minimal Format** (min/max ¼µ Point2D):
```typescript
// =Í Location: rendering/types/Types.ts:49
export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}
```

**D) Simple Format**:
```typescript
// =Í Location: rendering/core/IRenderContext.ts:30
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
```

**E) Extended Format ¼µ region**:
```typescript
// =Í Location: overlays/types.ts:117
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
```

**F) Grid-specific Format**:
```typescript
// =Í Location: systems/rulers-grid/config.ts:11
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width?: number;   // Optional
  height?: number;  // Optional
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 35+
- `utils/SmartBoundsManager.ts`
- `utils/bounds-utils.ts`
- `rendering/hitTesting/HitTester.ts`
- `rendering/passes/EntityPass.ts`
- `services/CanvasBoundsManager.ts`
- `services/FitToViewService.ts`
- š±¹ À¿»»¬ ¬»»±...

#### ** ÁÌ²»·¼±**:
- L **Type incompatibility**: `{ min: Point2D; max: Point2D }` vs `{ minX, minY, maxX, maxY }`
- L **Computed properties**: œµÁ¹º­Â ­Ç¿Å½ `width/height/centerX/centerY`, ¬»»µÂ ÌÇ¹
- L **3D support**: œµÁ¹º­Â ­Ç¿Å½ `minZ/maxZ/depth`, ¬»»µÂ ÌÇ¹

#### **£ÍÃÄ±Ã·**: =4 **URGENT CONSOLIDATION**
šµ½ÄÁ¹º¿À¿¯·Ã· Ãµ **•‘** interface ¼µ variants:
```typescript
// =Í  ¡Ÿ¤‘£—: rendering/types/Geometry.ts
export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExtendedBoundingBox2D extends BoundingBox2D {
  readonly width: number;    // Computed
  readonly height: number;   // Computed
  readonly centerX: number;  // Computed
  readonly centerY: number;  // Computed
}

export interface BoundingBox3D extends BoundingBox2D {
  minZ: number;
  maxZ: number;
  readonly depth: number;    // Computed
}

// Utility type ³¹± compatibility
export interface LegacyBoundingBox {
  min: Point2D;
  max: Point2D;
}
```

---

### 2. L **Viewport Interface** (5 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) Minimal Format**:
```typescript
// =Í Location: rendering/types/Types.ts:41
export interface Viewport {
  x?: number;     // Optional x offset (defaults to 0)
  y?: number;     // Optional y offset (defaults to 0)
  width: number;
  height: number;
}
```

**B) Extended Format ¼µ modes**:
```typescript
// =Í Location: types/index.ts:103
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

**C) Minimal Format (duplicate)**:
```typescript
// =Í Locations:
// - snapping/SnapEngineCore.ts:20
// - snapping/ProSnapEngineV2.ts:19
// - snapping/orchestrator/SnapOrchestrator.ts:28
// - snapping/orchestrator/SnapEngineRegistry.ts:40
// - snapping/orchestrator/SnapContextManager.ts:10
// - canvas-v2/overlays/CrosshairOverlay.tsx:8
interface Viewport {
  width: number;
  height: number;
}
```

**D) ViewportState (µ¹´¹º® À±Á±»»±³®)**:
```typescript
// =Í Location: collaboration/CollaborationManager.ts:26
export interface ViewportState {
  center: Point2D;
  zoom: number;
  rotation: number;
  timestamp: number;
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 20+
- Œ»± Ä± snapping engine files (6 ±ÁÇµ¯±)
- `rendering/core/CoordinateTransforms.ts`
- `systems/zoom/ZoomManager.ts`
- `canvas-v2/overlays/CrosshairOverlay.tsx`
- `collaboration/CollaborationManager.ts`

#### ** ÁÌ²»·¼±**:
- L **Type incompatibility**: †»»µÂ ­Ç¿Å½ `center: Point`, ¬»»µÂ `x/y/width/height`
- L **Mode flags**: œµÁ¹º­Â ­Ç¿Å½ `snapMode/gridMode`, ¬»»µÂ ÌÇ¹
- L **Zoom level**: †»»µÂ ­Ç¿Å½ `zoom`, ¬»»µÂ ÌÇ¹

#### **£ÍÃÄ±Ã·**: =4 **URGENT CONSOLIDATION**
```typescript
// =Í  ¡Ÿ¤‘£—: rendering/types/Types.ts
export interface Viewport {
  x: number;        // Always explicit (no optional)
  y: number;
  width: number;
  height: number;
}

export interface ExtendedViewport extends Viewport {
  zoom: number;
  center: Point2D;  // Computed from x/y/width/height
}

export interface InteractiveViewport extends ExtendedViewport {
  snapMode: boolean;
  gridMode: boolean;
  orthoMode: boolean;
  polarMode: boolean;
}
```

---

### 3. L **SnapResult Interface** (5 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) Rendering UI Version**:
```typescript
// =Í Location: rendering/ui/snap/SnapTypes.ts:29
export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly entityId?: string;
  readonly priority: number;
}
```

**B) Canvas V2 Version** (simplified):
```typescript
// =Í Locations:
// - canvas-v2/overlays/SnapModeIndicator.tsx:5
// - canvas-v2/overlays/SnapIndicatorOverlay.tsx:5
interface SnapResult {
  point: Point2D;
  type: SnapType;
  entityId?: string;
}
```

**C) Layer Canvas Version**:
```typescript
// =Í Location: canvas-v2/layer-canvas/layer-types.ts:55
export interface SnapResult {
  point: Point2D;
  type: SnapType;  // 'endpoint' | 'midpoint' | 'center' | 'intersection'
  entityId?: string;
}
```

**D) HitTester Version**:
```typescript
// =Í Location: rendering/hitTesting/HitTester.ts:44
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
```

**E) Rulers/Grid Version**:
```typescript
// =Í Location: systems/rulers-grid/config.ts:286
export interface SnapResult {
  point: Point2D;
  type: 'grid' | 'ruler' | 'axis' | 'origin';
  distance: number;
  direction?: 'horizontal' | 'vertical';
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 15+
- `rendering/ui/snap/SnapRenderer.ts`
- `canvas-v2/overlays/*` (3 ±ÁÇµ¯±)
- `canvas-v2/layer-canvas/LayerRenderer.ts`
- `rendering/hitTesting/HitTester.ts`
- `systems/rulers-grid/*` (2 ±ÁÇµ¯±)

#### ** ÁÌ²»·¼±**:
- L **Type incompatibility**: ”¹±Æ¿ÁµÄ¹º¬ `type` values
- L **Missing fields**: †»»µÂ ­Ç¿Å½ `priority/distance/visual`, ¬»»µÂ ÌÇ¹
- L **Readonly vs Mutable**: †»»µÂ µ¯½±¹ readonly, ¬»»µÂ ÌÇ¹

#### **£ÍÃÄ±Ã·**: =4 **URGENT CONSOLIDATION**
```typescript
// =Í  ¡Ÿ¤‘£—: rendering/types/Snapping.ts
export type SnapType =
  | 'endpoint' | 'midpoint' | 'center' | 'intersection'
  | 'vertex' | 'edge' | 'grid' | 'ruler' | 'axis' | 'origin'
  | 'perpendicular' | 'parallel' | 'tangent' | 'quadrant' | 'nearest';

export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly priority: number;
  readonly entityId?: string;
  readonly direction?: 'horizontal' | 'vertical';
  readonly visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}
```

---

### 4. L **EntityModel Interface** (2 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) Rendering Types Version** (main):
```typescript
// =Í Location: rendering/types/Types.ts:55
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

  [key: string]: any;  //  Flexibility for specialized entities
}

// Legacy compatibility aliases
export type Entity = EntityModel;
export type AnySceneEntity = EntityModel;
```

**B) Utils Version** (legacy):
```typescript
// =Í Location: utils/entity-renderer.ts:13
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

  // Geometry (same as A)
  position?: Point2D;
  center?: Point2D;
  start?: Point2D;
  end?: Point2D;
  radius?: number;
  points?: Point2D[];

  [key: string]: any;
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 40+
- Œ»± Ä± rendering ±ÁÇµ¯±
- Œ»± Ä± entity-related utils
- Hit testing system
- Spatial indexing

#### ** ÁÌ²»·¼±**:
-  **£§•”Ÿ ™”™‘**: š±¹ Ä± ´Í¿ µ¯½±¹ ÀÁ±ºÄ¹º¬ ¯´¹±
-   **”™ ›Ÿ¤¥ Ÿ**: ”µ½ ÇÁµ¹¬¶µÄ±¹ ½± ÅÀ¬ÁÇµ¹ ÃÄ± 2 ¼­Á·

#### **£ÍÃÄ±Ã·**: =á **MEDIUM PRIORITY CONSOLIDATION**
-  šÁ¬Ä± **œŸŸ** Ä¿ `rendering/types/Types.ts:EntityModel`
- = ‘½Ä¹º±Ä­ÃÄ·Ãµ Ì»µÂ Ä¹Â ±½±Æ¿Á­Â ÃÄ¿ `utils/entity-renderer.ts` ¼µ import ±ÀÌ Types.ts

---

### 5. L **LineTemplate Interface** (2 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) LineSettingsContext Version**:
```typescript
// =Í Location: contexts/LineSettingsContext.tsx:16
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;
}
```

**B) LineConstants Version**:
```typescript
// =Í Location: contexts/LineConstants.tsx:69
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
    hoverWidth: number;
    hoverOpacity: number;
    finalColor: string;
    finalType: LineType;
    finalWidth: number;
    finalOpacity: number;
    activeTemplate: string | null;
  };
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 5+
- `contexts/LineSettingsContext.tsx`
- `contexts/LineConstants.tsx`
- `providers/DxfSettingsProvider.tsx`
- Components À¿Å ÇÁ·Ã¹¼¿À¿¹¿Í½ templates

#### ** ÁÌ²»·¼±**:
-   **Incompatible settings**: — ’ ­Çµ¹ expanded settings inline ±½Ä¯ ³¹± `LineSettings` type
- L **Different structure**: ”ÍÃº¿»¿ ½± Ä¹Â merge

#### **£ÍÃÄ±Ã·**: =á **MEDIUM PRIORITY CONSOLIDATION**
```typescript
// =Í  ¡Ÿ¤‘£—: settings-core/types.ts
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;  //  Use unified LineSettings type
}

export type TemplateCategory = 'engineering' | 'architectural' | 'electrical' | 'custom';
```

---

### 6. L **Scene Interface** (3 ”™ ›Ÿ¤¥ ‘)

#### ** ±Á±»»±³­Â:**

**A) SmartBoundsManager Version**:
```typescript
// =Í Location: utils/SmartBoundsManager.ts:35
interface Scene {
  entities: Entity[];
  bounds?: BoundingBox;
}
```

**B) SceneValidator/SceneUpdateManager Version**:
```typescript
// =Í Locations:
// - managers/SceneValidator.ts:9
// - managers/SceneUpdateManager.ts:12
// - managers/SceneStatistics.ts:8
interface Scene {
  entities: Entity[];
  layers: Record<string, Layer>;
  bounds?: BoundingBox;
}
```

**C) SceneModel Version** (full):
```typescript
// =Í Location: types/scene.ts:87
export interface SceneModel {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}
```

#### **‘ÁÇµ¯± À¿Å •À·Áµ¬¶¿½Ä±¹**: 10+
- `managers/*` (3 ±ÁÇµ¯±)
- `utils/SmartBoundsManager.ts`
- `types/scene.ts`
- `hooks/scene/useSceneManager.ts`

#### ** ÁÌ²»·¼±**:
-   **Incomplete definitions**: Ÿ¹ A & B ´µ½ ­Ç¿Å½ `units`
-   **Different entity types**: `Entity[]` vs `AnySceneEntity[]`
- L **Missing layers**: — A ´µ½ ­Ç¿Å½ layers

#### **£ÍÃÄ±Ã·**: =á **MEDIUM PRIORITY CONSOLIDATION**
```typescript
// =Í  ¡Ÿ¤‘£—: types/scene.ts (already exists!)
//  §Á·Ã¹¼¿À¿¯·Ãµ œŸŸ Ä¿ ÅÀ¬ÁÇ¿½ SceneModel
// = ‘½Ä¹º±Ä­ÃÄ·Ãµ Ì»µÂ Ä¹Â local Scene interfaces ¼µ SceneModel import
```

---

## = £—œ‘¤™š‘ ”™ ›Ÿ¤¥ ‘ (Semantic Duplicates)

### 7.   **Entity Variants** (À¿»»­Â À±Á±»»±³­Â)

¥À¬ÁÇ¿Å½ **À¿»»­Â À±Á±»»±³­Â** Ä¿Å Entity interface ³¹± ´¹±Æ¿ÁµÄ¹º¿ÍÂ ÄÍÀ¿ÅÂ:

**Locations:**
- `snapping/extended-types.ts:34` - `Entity` (generic)
- `snapping/engines/IntersectionSnapEngine.ts` - `PolylineEntity`, `CircleEntity`, `RectangleEntity`
- `snapping/engines/InsertionSnapEngine.ts` - `TextEntity`, `BlockEntity`, `DimensionEntity`, `LeaderEntity`, `HatchEntity`, `PointEntity`, `LineEntity`, `SplineEntity`
- `snapping/shared/GeometricCalculations.ts` - `PolylineEntity`, `RectangleEntity`
- `snapping/engines/shared/snap-engine-utils.ts` - `LegacyRectangleEntity`
- `types/scene.ts` - `LineEntity`, `PolylineEntity`, `CircleEntity`, `ArcEntity`, `TextEntity`, `BlockEntity`, `RectangleEntity`, `AngleMeasurementEntity`
- `types/entities.ts` - Various entity types
- `utils/SmartBoundsManager.ts:24` - `Entity`

#### ** ÁÌ²»·¼±**:
-   **Fragmentation**: š¬¸µ module ­Çµ¹ Ä¹Â ´¹º­Â Ä¿Å entity variants
-   **No inheritance**: ”µ½ ÅÀ¬ÁÇµ¹ º¿¹½® base interface
- L **Type confusion**: ”ÍÃº¿»¿ ½± º±Ä±»¬²µ¹Â À¿¹¿ Entity ½± ÇÁ·Ã¹¼¿À¿¹®Ãµ¹Â

#### **£ÍÃÄ±Ã·**: =4 **HIGH PRIORITY CONSOLIDATION**
```typescript
// =Í  ¡Ÿ¤‘£—: types/entities.ts (extend existing)
import type { EntityModel } from '../rendering/types/Types';

//  Œ»µÂ ¿¹ À±Á±»»±³­Â ½± extend Ä¿ EntityModel
export interface LineEntity extends EntityModel {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface CircleEntity extends EntityModel {
  type: 'circle';
  center: Point2D;
  radius: number;
}

// ... º.¿.º. ³¹± Ì»¿ÅÂ Ä¿ÅÂ ÄÍÀ¿ÅÂ
```

---

##  • ™¤¥§—œ••£ š•¤¡™šŸ Ÿ™—£•™£ (˜µÄ¹º¬  ±Á±´µ¯³¼±Ä±)

### 1.  **Point2D** -  »®ÁÉÂ šµ½ÄÁ¹º¿À¿¹·¼­½¿

```typescript
// =Í Location: rendering/types/Types.ts:17
export interface Point2D {
  x: number;
  y: number;
}
```

**‘ÁÇµ¯± À¿Å §Á·Ã¹¼¿À¿¹¿Í½** (80+):
-  Œ»± Ä± rendering ±ÁÇµ¯±
-  Œ»± Ä± snapping ±ÁÇµ¯±
-  Œ»± Ä± geometry utils
-  Canvas v2 modules
-  Overlay system
-  Scene types

**<¯  ±Á¬´µ¹³¼± £ÉÃÄ®Â §Á®Ã·Â**:
```typescript
// L OLD (duplicate):
// interface Point { x: number; y: number; }

//  NEW (centralized):
import type { Point2D } from '../rendering/types/Types';
```

---

### 2.  **LineSettings** - Unified ÃÄ¿ settings-core

```typescript
// =Í Location: settings-core/types.ts:14
export interface LineSettings {
  enabled: boolean;
  lineType: LineType;
  lineWidth: number;
  color: string;
  opacity: number;
  dashScale: number;
  dashOffset: number;
  lineCap: LineCapStyle;
  lineJoin: LineJoinStyle;
  breakAtCenter: boolean;
  // ... extended properties
}
```

**‘ÁÇµ¯± À¿Å §Á·Ã¹¼¿À¿¹¿Í½** (8+):
-  `contexts/LineSettingsContext.tsx`
-  `providers/DxfSettingsProvider.tsx`
-  `rendering/entities/*`

---

## =Ë  ¡Ÿ¤‘£•™£ š•¤¡™šŸ Ÿ™—£—£

### =4 **Phase 1: Critical Interfaces** (†¼µÃ· ”Á¬Ã·)

#### 1. **BoundingBox Consolidation**
```typescript
// =Í CREATE: rendering/types/Geometry.ts
export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExtendedBoundingBox2D extends BoundingBox2D {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

// Utility ³¹± migration
export function toBoundingBox2D(legacy: { min: Point2D; max: Point2D }): BoundingBox2D {
  return {
    minX: legacy.min.x,
    minY: legacy.min.y,
    maxX: legacy.max.x,
    maxY: legacy.max.y
  };
}
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (35+):
- `types/index.ts` ’ Use new BoundingBox2D
- `rendering/hitTesting/Bounds.ts` ’ Use ExtendedBoundingBox2D
- `rendering/core/IRenderContext.ts` ’ Use BoundingBox2D
- `overlays/types.ts` ’ Use BoundingBox2D
- `systems/rulers-grid/config.ts` ’ Use BoundingBox2D
- `utils/SmartBoundsManager.ts` ’ Use ExtendedBoundingBox2D
- Œ»± Ä± ¬»»± ±ÁÇµ¯± À¿Å ÇÁ·Ã¹¼¿À¿¹¿Í½ BoundingBox

#### 2. **Viewport Consolidation**
```typescript
// =Í UPDATE: rendering/types/Types.ts
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtendedViewport extends Viewport {
  zoom: number;
  readonly center: Point2D;  // Computed
}

// Utility ³¹± migration
export function toViewport(legacy: { center: Point; width: number; height: number }): Viewport {
  return {
    x: legacy.center.x - legacy.width / 2,
    y: legacy.center.y - legacy.height / 2,
    width: legacy.width,
    height: legacy.height
  };
}
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (20+):
- `types/index.ts` ’ Use ExtendedViewport
- `snapping/*` (6 ±ÁÇµ¯±) ’ Use Viewport
- `canvas-v2/overlays/CrosshairOverlay.tsx` ’ Use Viewport
- `collaboration/CollaborationManager.ts` ’ Use ExtendedViewport

#### 3. **SnapResult Consolidation**
```typescript
// =Í CREATE: rendering/types/Snapping.ts
export type SnapType =
  | 'endpoint' | 'midpoint' | 'center' | 'intersection'
  | 'vertex' | 'edge' | 'grid' | 'ruler' | 'axis' | 'origin'
  | 'perpendicular' | 'parallel' | 'tangent' | 'quadrant' | 'nearest';

export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly priority: number;
  readonly entityId?: string;
  readonly direction?: 'horizontal' | 'vertical';
  readonly visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (15+):
- `rendering/ui/snap/SnapTypes.ts` ’ Update existing
- `canvas-v2/overlays/*` (3 ±ÁÇµ¯±) ’ Use centralized
- `canvas-v2/layer-canvas/layer-types.ts` ’ Use centralized
- `rendering/hitTesting/HitTester.ts` ’ Use centralized
- `systems/rulers-grid/config.ts` ’ Use centralized

---

### =á **Phase 2: Medium Priority** (•ÀÌ¼µ½µÂ 2 µ²´¿¼¬´µÂ)

#### 4. **EntityModel Consolidation**
```typescript
// =Í ACTION: Remove duplicate from utils/entity-renderer.ts
//  Use ONLY: rendering/types/Types.ts:EntityModel

// Migration:
// - Search all imports from utils/entity-renderer.ts
// - Replace with: import type { EntityModel } from '../rendering/types/Types';
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (40+):
- `utils/entity-renderer.ts` ’ REMOVE local definition
- All imports ’ Update to use Types.ts

#### 5. **LineTemplate Consolidation**
```typescript
// =Í ACTION: Unify in settings-core/types.ts
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;  //  Already centralized
}

// Migration:
// - contexts/LineConstants.tsx ’ Expand inline settings to use LineSettings type
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (5+):
- `contexts/LineConstants.tsx` ’ Update structure
- `contexts/LineSettingsContext.tsx` ’ Already correct, keep as is

#### 6. **Scene Consolidation**
```typescript
// =Í ACTION: Use existing types/scene.ts:SceneModel everywhere
//  ALREADY EXISTS - just need to replace local definitions

// Migration:
// - utils/SmartBoundsManager.ts ’ import SceneModel
// - managers/* (3 files) ’ import SceneModel
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (10+):
- `utils/SmartBoundsManager.ts` ’ Use SceneModel
- `managers/SceneValidator.ts` ’ Use SceneModel
- `managers/SceneUpdateManager.ts` ’ Use SceneModel
- `managers/SceneStatistics.ts` ’ Use SceneModel

---

### =â **Phase 3: Entity Variants** (Long-term Refactoring)

#### 7. **Entity Type System**
```typescript
// =Í PROPOSAL: types/entities.ts (comprehensive update)
import type { EntityModel, Point2D } from '../rendering/types/Types';

// Base entity (already exists as EntityModel)
export type { EntityModel as BaseEntity };

// Specialized entities - All extend EntityModel
export interface LineEntity extends EntityModel {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface CircleEntity extends EntityModel {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface ArcEntity extends EntityModel {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface PolylineEntity extends EntityModel {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export interface RectangleEntity extends EntityModel {
  type: 'rectangle';
  corner1: Point2D;
  corner2: Point2D;
  rotation?: number;
}

export interface TextEntity extends EntityModel {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number;
}

export interface BlockEntity extends EntityModel {
  type: 'block';
  position: Point2D;
  name: string;
  scale: Point2D;
  rotation: number;
}

// ... continue for all entity types

// Union type ³¹± type safety
export type AnyEntity =
  | LineEntity
  | CircleEntity
  | ArcEntity
  | PolylineEntity
  | RectangleEntity
  | TextEntity
  | BlockEntity;
```

**‘ÁÇµ¯± ½± ±»»¬¾¿Å½** (50+):
- `snapping/*` ’ Use centralized entities
- `types/scene.ts` ’ Update to use centralized
- All rendering modules
- All geometry utils

---

## =Ê £¤‘¤™£¤™š‘ & METRICS

### š±Ä±½¿¼® ”¹À»ÌÄÅÀÉ½ ±½¬ Module
```
=Â rendering/           20 duplicates (BoundingBox, Viewport, SnapResult)
=Â snapping/            15 duplicates (Viewport, Entity variants)
=Â canvas-v2/           10 duplicates (SnapResult, Settings)
=Â types/               8 duplicates (BoundingBox, Viewport)
=Â contexts/            4 duplicates (LineTemplate)
=Â managers/            3 duplicates (Scene)
=Â utils/               5 duplicates (Entity, BoundingBox)
=Â systems/             5 duplicates (SnapResult, BoundingBox)
=Â overlays/            3 duplicates (BoundingBox)
=Â collaboration/       2 duplicates (Viewport)
```

### Impact Analysis
| Interface | Duplicates | Files Affected | Priority | Effort |
|-----------|------------|----------------|----------|--------|
| BoundingBox | 6 | 35+ | =4 High | 2 days |
| Viewport | 5 | 20+ | =4 High | 1.5 days |
| SnapResult | 5 | 15+ | =4 High | 1 day |
| Entity Variants | 10+ | 50+ | =4 High | 3 days |
| EntityModel | 2 | 40+ | =á Medium | 0.5 day |
| LineTemplate | 2 | 5+ | =á Medium | 0.5 day |
| Scene | 3 | 10+ | =á Medium | 0.5 day |
| **TOTAL** | **30+** | **175+** | - | **9-10 days** |

---

## <¯ ACTION PLAN

### •²´¿¼¬´± 1: Critical Consolidation
- [ ] **Day 1-2**: BoundingBox consolidation (35 files)
- [ ] **Day 3-4**: Viewport consolidation (20 files)
- [ ] **Day 5**: SnapResult consolidation (15 files)

### •²´¿¼¬´± 2: Medium Priority
- [ ] **Day 6**: EntityModel consolidation (40 files)
- [ ] **Day 7**: LineTemplate + Scene consolidation (15 files)
- [ ] **Day 8-9**: Entity variants phase 1 (25 files)
- [ ] **Day 10**: Testing + Documentation

### Post-Consolidation: Maintenance
- [ ] Create migration guide ³¹± developers
- [ ] Update architecture documentation
- [ ] Add ESLint rule ½± ±À¿ÆµÍ³µ¹ local interface definitions
- [ ] Setup automated tests ³¹± type consistency

---

## =¨ š™”¥Ÿ™ &  ¡Ÿ¦¥›‘•™£

### š¯½´Å½¿¹
1. **Breaking Changes**:  ¿»»¬ ±ÁÇµ¯± ¸± ÇÁµ¹±ÃÄ¿Í½ updates
2. **Type Conflicts**:  ¹¸±½¬ conflicts º±Ä¬ Ä¿ merge
3. **Runtime Errors**: ‘½ ´µ½ ³¯½µ¹ ÀÁ¿ÃµºÄ¹º® migration
4. **Time Investment**: ~10 days full-time work

###  Á¿ÆÅ»¬¾µ¹Â
1.  **Incremental Migration**: ˆ½± interface Ä· Æ¿Á¬
2.  **Backward Compatibility**: šÁ¬Ä± legacy types ¼µ deprecation warnings
3.  **Comprehensive Testing**: Test Ì»± Ä± modules ¼µÄ¬ ±ÀÌ º¬¸µ consolidation
4.  **Git Branches**: µÇÉÁ¹ÃÄÌ branch ³¹± º¬¸µ interface consolidation
5.  **Documentation**: •½·¼­ÁÉÃ· documentation ÀÁ¹½ Ä¿ merge

---

## =Ì £¥œ •¡‘£œ‘¤‘

### šÍÁ¹± •ÅÁ®¼±Ä±
1. =4 **£¿²±ÁÌ  ÁÌ²»·¼±**: 30+ ´¹À»ÌÄÅÀ± interfaces Ãµ 175+ ±ÁÇµ¯±
2.   **Type Confusion**: ”¹±Æ¿ÁµÄ¹º­Â structures ³¹± Ä¿ ¯´¹¿ concept
3.  **š±»Ì  ±Á¬´µ¹³¼±**: Point2D µ¯½±¹ À»®ÁÉÂ centralized
4. <¯ **•Æ¹ºÄÌ**: Consolidation µ¯½±¹ ´Å½±Ä® Ãµ 10 days

###  Á¿Äµ¹½Ì¼µ½·  Á¿ÄµÁ±¹ÌÄ·Ä±
1. =4 **URGENT**: BoundingBox, Viewport, SnapResult (±ÅÄ¬ ÀÁ¿º±»¿Í½ Ä± ÀµÁ¹ÃÃÌÄµÁ± conflicts)
2. =á **MEDIUM**: EntityModel, LineTemplate, Scene (Ã·¼±½Ä¹º¬ ±»»¬ »¹³ÌÄµÁ¿ ºÁ¯Ã¹¼±)
3. =â **LOW**: Entity variants (long-term refactoring)

### •ÀÌ¼µ½± ’®¼±Ä±
1.   ±Á¿ÅÃ¯±Ã· ±½±Æ¿Á¬Â ÃÄ¿½ “¹ÎÁ³¿
2. <¯ £Å¶®Ä·Ã· priorities & timeline
3. =( ˆ½±Á¾· Phase 1: Critical Consolidation
4. =İ Continuous documentation updates

---

**¤­»¿Â ‘½±Æ¿Á¬Â**

**Prepared by**: Claude (Anthropic AI Developer)
**Contact**: “¹ÎÁ³¿Â  ±³Î½·Â
**Date**: 2025-10-03
