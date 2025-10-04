# = ëùëõ•£ó îô†õü§•†©ù ENUMS & TYPE UNIONS - DXF VIEWER

**óºµ¡øº∑ΩØ± ëΩ¨ª≈√∑¬:** 2025-10-03
**ëΩ±ª≈ƒÆ¬:** Claude (Anthropic AI)
**†µ¥Øø ëΩ¨ª≈√∑¬:** `src/subapps/dxf-viewer/` - åª± ƒ± Enums & Type Unions
**£≈Ωøªπ∫¨ ë¡«µØ± ïª≠≥«∏∑∫±Ω:** 67 files ºµ type definitions

---

## =  ïö§ïõï£§ôöó £•ùü®ó

### í±√π∫¨ ï≈¡Æº±ƒ±

| ö±ƒ∑≥ø¡Ø± | îπ¿ªÃƒ≈¿± ë¡«µØ± | ö¡π√πºÃƒ∑ƒ± | †¡øƒµ¡±πÃƒ∑ƒ± |
|-----------|------------------|-------------|--------------|
| **EntityType** | 5 | =4 ö¡Ø√πºø | HIGH |
| **SnapType** | 4 | =4 ö¡Ø√πºø | HIGH |
| **ToolType** | 4 | =4 ö¡Ø√πºø | HIGH |
| **Status Types** | 6 | =4 ö¡Ø√πºø | HIGH |
| **PanelType** | 2 | =4 ö¡Ø√πºø | HIGH |
| **Mode Types** | 11 | =· ú≠ƒ¡πø | MEDIUM |
| **Style Types** | 7 | =· ú≠ƒ¡πø | MEDIUM |
| **Line Styles** | 3 | =‚ úπ∫¡Ã | LOW |
| **Grid/Ruler** | 2 | =‚ úπ∫¡Ã | LOW |
| **Geometry Types** |  OK | - | - |

**£•ùüõü îô†õü§•†©ù:** 28 duplicate enums/types
**ö°ô£ôúë:** 5 high-priority issues (20 files affected)

---

## 1„ ENTITYTYPE - §Õ¿øπ Entities =4

### =4 †¡Ã≤ª∑º±: îπ±√¿ø¡¨ √µ 5 ë¡«µØ±

**îô†õü§•†ü #1:** `types/entities.ts:26`
```typescript
export type EntityType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'text'
  | 'rectangle'
  | 'point'
  | 'dimension';
```
**§πº≠¬:** 8  **†ªÆ¡∑¬ - MASTER CANDIDATE**

**îô†õü§•†ü #2:** `types/viewerConfiguration.ts:15`
```typescript
export type EntityType = 'line' | 'text' | 'grip';
```
**§πº≠¬:** 3 † **Configuration-specific subset**

**îô†õü§•†ü #3:** `types/scene.ts:7` (inline)
```typescript
type: 'line' | 'polyline' | 'circle' | 'arc' | 'text' | 'block' | 'rectangle' | 'angle-measurement';
```
**§πº≠¬:** 8 † **à«µπ `'block'` ±ΩƒØ `'point'` + `'angle-measurement'`**

**îô†õü§•†ü #4:** `canvas-v2/dxf-canvas/dxf-types.ts:11` (inline)
```typescript
type: 'line' | 'circle' | 'arc' | 'polyline' | 'text';
```
**§πº≠¬:** 5 L **õµØ¿ø≈Ω 3 ƒÕ¿øπ**

**îô†õü§•†ü #5:** `types/index.ts:22` (DXFEntity interface)
```typescript
type: string; // ß…¡Ø¬ enum validation!
```
**§πº≠¬:** L **Generic string - NO VALIDATION**

### =  £Õ≥∫¡π√∑

| ë¡«µØø | line | polyline | circle | arc | text | rectangle | point | dimension | block | angle-measurement |
|--------|------|----------|--------|-----|------|-----------|-------|-----------|-------|------------------|
| `entities.ts` |  |  |  |  |  |  |  |  | L | L |
| `viewerConfig.ts` |  | L | L | L |  | L | L | L | L | L |
| `scene.ts` |  |  |  |  |  |  | L | L |  |  |
| `dxf-types.ts` |  |  |  |  |  | L | L | L | L | L |
| `index.ts` | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**MASTER LOCATION:** `types/entities.ts` (¿πø ¿ªÆ¡∑¬ + ∫±ªÕƒµ¡ø naming)

**ïùï°ìïôï£:**

1. **ïΩ∑º≠¡…√∑ Master:**
```typescript
// File: types/entities.ts
export type EntityType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'text'
  | 'rectangle'
  | 'point'
  | 'dimension'
  | 'block'              // ADD ±¿Ã scene.ts
  | 'angle-measurement'  // ADD ±¿Ã scene.ts
  | 'ellipse'            // ADD (exists in codebase but missing)
  | 'spline';            // ADD (exists in codebase but missing)
```

2. **Configuration-Specific Subset:**
```typescript
// File: types/viewerConfiguration.ts
import type { EntityType } from './entities';

// Rename ≥π± clarity
export type SettingsEntityType = 'line' | 'text' | 'grip';
```

3. **îπ±≥¡±∆Æ Inline Definitions:**
```typescript
// L DELETE ±¿Ã scene.ts:
type: 'line' | 'polyline' | ...

//  REPLACE ºµ:
import type { EntityType } from './entities';
type: EntityType;
```

4. **Update Generic String:**
```typescript
// L DELETE ±¿Ã index.ts:
type: string;

//  REPLACE ºµ:
import type { EntityType } from './entities';
type: EntityType;
```

**SAVINGS:** ~40 ≥¡±ºº≠¬ + Type Safety!

---

## 2„ SNAPTYPE - §Õ¿øπ Snapping =4

### =4 †¡Ã≤ª∑º±: îπ±√¿ø¡¨ √µ 4 ë¡«µØ± ºµ îπ±∆ø¡µƒπ∫Ã Naming

**îô†õü§•†ü #1:** `snapping/extended-types.ts:10`  **MASTER**
```typescript
export enum ExtendedSnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent',
  QUADRANT = 'quadrant',
  NEAREST = 'nearest',
  EXTENSION = 'extension',
  NODE = 'node',
  INSERTION = 'insertion',
  NEAR = 'near',
  PARALLEL = 'parallel',
  ORTHO = 'ortho',
  GRID = 'grid',
  AUTO = 'auto',
  NONE = 'none'
}
```
**§πº≠¬:** 17  **†ªÆ¡∑¬ Enum**

**îô†õü§•†ü #2:** `rendering/ui/snap/SnapTypes.ts:13`
```typescript
export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'perpendicular'
  | 'parallel'
  | 'tangent'
  | 'quadrant'
  | 'nearest'
  | 'grid';
```
**§πº≠¬:** 10 † **Subset - Union Type**

**îô†õü§•†ü #3:** `canvas-v2/layer-canvas/layer-types.ts:53`
```typescript
export type SnapType = 'endpoint' | 'midpoint' | 'center' | 'intersection';
```
**§πº≠¬:** 4 L **úÃΩø ≤±√π∫¨**

**îô†õü§•†ü #4:** `ui/icons/iconRegistry.tsx:30`
```typescript
type SnapMode =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'center'
  | 'quadrant'
  | 'perpendicular'
  | 'tangent'
  | 'nearest'
  | 'parallel'
  | 'extension';
```
**§πº≠¬:** 10 † **îπ±∆ø¡µƒπ∫Ã åΩøº±: `SnapMode` vs `SnapType`**

### =  Inconsistencies

| Issue | Description |
|-------|-------------|
| **Naming** | `ExtendedSnapType` vs `SnapType` vs `SnapMode` |
| **Casing** | UPPERCASE (enum) vs lowercase (union) |
| **Missing Values** | ö¨∏µ ±¡«µØø ≠«µπ ¥π±∆ø¡µƒπ∫Ã subset |
| **Type vs Enum** | Enum (master) vs Union types (duplicates) |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**MASTER LOCATION:** `snapping/extended-types.ts`

**ïùï°ìïôï£:**

1. **Rename ≥π± Clarity:**
```typescript
// File: snapping/extended-types.ts
// L OLD:
export enum ExtendedSnapType { ... }

//  NEW (canonical name):
export enum SnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent',
  QUADRANT = 'quadrant',
  NEAREST = 'nearest',
  EXTENSION = 'extension',
  NODE = 'node',
  INSERTION = 'insertion',
  NEAR = 'near',
  PARALLEL = 'parallel',
  ORTHO = 'ortho',
  GRID = 'grid',
  AUTO = 'auto',
  NONE = 'none'
}

// Create subset ≥π± ≤±√π∫¨ snaps
export type BasicSnapType =
  | SnapType.ENDPOINT
  | SnapType.MIDPOINT
  | SnapType.CENTER
  | SnapType.INTERSECTION;
```

2. **Delete Duplicates:**
```typescript
// L DELETE rendering/ui/snap/SnapTypes.ts:SnapType
// L DELETE canvas-v2/layer-canvas/layer-types.ts:SnapType
// L DELETE ui/icons/iconRegistry.tsx:SnapMode

//  REPLACE Ãª± ºµ:
import { SnapType } from '../../snapping/extended-types';
```

3. **Update All Usages:**
- 52 ±¡«µØ± «¡∑√πºø¿øπøÕΩ snap types
- ú±∂π∫Æ ±Ωƒπ∫±ƒ¨√ƒ±√∑: `ExtendedSnapType` í `SnapType`

**SAVINGS:** ~60 ≥¡±ºº≠¬ + Consistency!

---

## 3„ TOOLTYPE - §Õ¿øπ Tools =4

### =4 †¡Ã≤ª∑º±: îπ±√¿ø¡¨ √µ 4 ë¡«µØ±

**îô†õü§•†ü #1:** `systems/toolbars/config.ts:9`  **MASTER**
```typescript
export type ToolType =
  | 'select'
  | 'line'
  | 'polyline'
  | 'circle'
  | 'circle-diameter'
  | 'circle-2p'
  | 'circle-2p-diameter'
  | 'circle-3p'
  | 'circle-tangent-tangent-radius'
  | 'arc'
  | 'arc-3p'
  | 'rectangle'
  | 'text'
  | 'dimension-linear'
  | 'dimension-aligned'
  | 'dimension-angular'
  | 'dimension-radial'
  | 'dimension-diameter'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'trim'
  | 'extend'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'mirror'
  | 'array'
  | 'measure-distance'
  | 'measure-area'
  | 'measure-angle'
  | 'snap-endpoint'
  | 'snap-midpoint'
  | 'snap-center'
  | 'snap-intersection'
  | 'snap-perpendicular'
  | 'snap-tangent'
  | 'snap-quadrant'
  | 'snap-nearest'
  | 'snap-parallel'
  | 'snap-extension'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-extents'
  | 'zoom-window'
  | 'zoom-previous'
  | 'pan'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'properties'
  | 'layers'
  | 'settings'
  | 'escape'
  | 'none';
```
**§πº≠¬:** 57  **Enterprise-Grade - MASTER**

**îô†õü§•†ü #2:** `types/index.ts:4`
```typescript
export type ToolType =
  | 'select'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'text'
  | 'move'
  | 'pan'
  | 'zoom'
  | 'measure-distance'
  | 'measure-area'
  | 'measure-angle';
```
**§πº≠¬:** 13 L **Subset - Basic Tools**

**îô†õü§•†ü #3:** `ui/toolbar/types.ts:4`
```typescript
export type ToolType =
  | 'select'
  | 'line'
  | 'polyline'
  | 'circle'
  | 'circle-diameter'
  | 'circle-2p-diameter'
  | 'circle-3p'
  | 'circle-tangent-tangent-radius'
  | 'arc'
  | 'arc-3p'
  | 'rectangle'
  | 'text'
  | 'dimension'
  | 'move'
  | 'rotate'
  | 'copy'
  | 'mirror'
  | 'scale'
  | 'trim'
  | 'extend'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'pan'
  | 'zoom'
  | 'measure-distance'
  | 'measure-area'
  | 'measure-angle'
  // ... more
```
**§πº≠¬:** 37 † **Extended - Circle Variants**

**îô†õü§•†ü #4:** `systems/tools/ToolStateManager.ts:22`
```typescript
const TOOL_DEFINITIONS: Record<ToolType, ToolInfo> = {
  'select': { /* ... */ },
  'line': { /* ... */ },
  'polyline': { /* ... */ },
  'circle': { /* ... */ },
  'rectangle': { /* ... */ },
  'arc': { /* ... */ },
  'text': { /* ... */ },
  'move': { /* ... */ },
  'copy': { /* ... */ },
  'rotate': { /* ... */ },
  'scale': { /* ... */ },
  'trim': { /* ... */ },
  'extend': { /* ... */ },
  'offset': { /* ... */ },
  'measure-distance': { /* ... */ },
  'measure-area': { /* ... */ },
  'measure-angle': { /* ... */ },
};
```
**§πº≠¬:** 17 † **Hardcoded Dictionary**

### =  Missing Values Comparison

| Source | Draw Tools | Edit Tools | Snap Tools | Dimension Tools | View Tools |
|--------|-----------|-----------|-----------|----------------|-----------|
| `systems/toolbars/config.ts` |  Full |  Full |  Full |  Full |  Full |
| `ui/toolbar/types.ts` |  Circle variants | † Basic | L None | † Generic | † Basic |
| `types/index.ts` |  Basic | † Move only | L None | L None | † Basic |
| `ToolStateManager.ts` |  Basic |  Basic | L None | L None | L None |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**MASTER LOCATION:** `systems/toolbars/config.ts` (¿πø ¿ªÆ¡∑¬ ∫±π enterprise-grade)

**ïùï°ìïôï£:**

1. **Delete Duplicates:**
```typescript
// L DELETE types/index.ts:ToolType
// L DELETE ui/toolbar/types.ts:ToolType

//  REPLACE Ãª± ºµ:
import type { ToolType } from '../systems/toolbars/config';
```

2. **Update ToolStateManager:**
```typescript
// File: systems/tools/ToolStateManager.ts
import type { ToolType } from '../toolbars/config';

// L OLD: Hardcoded dictionary
const TOOL_DEFINITIONS: Record<ToolType, ToolInfo> = { ... }

//  NEW: Dynamic registration
const TOOL_DEFINITIONS = new Map<ToolType, ToolInfo>();

// Register tools dynamically
TOOL_DEFINITIONS.set('select', { /* ... */ });
TOOL_DEFINITIONS.set('line', { /* ... */ });
// ...
```

3. **Create Subsets (Optional):**
```typescript
// File: systems/toolbars/config.ts
export type DrawTool = Extract<ToolType, 'line' | 'polyline' | 'circle' | 'arc' | 'rectangle' | 'text'>;
export type EditTool = Extract<ToolType, 'move' | 'copy' | 'rotate' | 'scale' | 'trim' | 'extend'>;
export type MeasureTool = Extract<ToolType, 'measure-distance' | 'measure-area' | 'measure-angle'>;
export type ViewTool = Extract<ToolType, 'zoom-in' | 'zoom-out' | 'zoom-extents' | 'pan'>;
```

**SAVINGS:** ~150 ≥¡±ºº≠¬ + Type Safety!

---

## 4„ STATUS TYPES - †øªª±¿ª¨ Status Types =4

### =4 †¡Ã≤ª∑º±: îπ±√¿ø¡¨ √µ 6 Contexts ºµ Overlapping Names

**îô†õü§•†ü #1:** `overlays/types.ts:11`
```typescript
export type Status = PropertyStatus;
// Imports from central: 'üπ∫ø¿µ¥øÕ«ø≈' | 'îµ√ºµ≈º≠Ωø' | '†¡ø¬ †Œª∑√∑' | '†ø≈ª∑º≠Ωø' | ...
```

**îô†õü§•†ü #2:** `types/overlay.ts:32`
```typescript
export type RegionStatus =
  | 'draft'
  | 'active'
  | 'locked'
  | 'hidden'
  | 'üπ∫ø¿µ¥øÕ«ø≈'
  | 'îµ√ºµ≈º≠Ωø'
  | '†¡ø¬ †Œª∑√∑'
  | '†ø≈ª∑º≠Ωø'
  | '†¡ø¬ ïΩøπ∫Ø±√∑'
  | PropertyStatus;
```
**§πº≠¬:** 11 (4 state + 7 property status)

**îô†õü§•†ü #3:** `types/index.ts:203`
```typescript
export type Status = 'idle' | 'loading' | 'success' | 'error';
```
**§πº≠¬:** 4 L **NAME COLLISION ºµ overlays/types.ts:Status**

**îô†õü§•†ü #4:** `services/ServiceHealthMonitor.ts:30`
```typescript
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}
```

**îô†õü§•†ü #5:** `systems/collaboration/CollaborationEngine.ts:52`
```typescript
export enum ConflictStrategy {
  LAST_WRITE_WINS = 'last-write-wins',
  MERGE = 'merge',
  OPERATIONAL_TRANSFORM = 'operational-transform',
  USER_CHOICE = 'user-choice'
}
```

**îô†õü§•†ü #6:** `systems/ai-snapping/AISnappingEngine.ts:13`
```typescript
export enum SnapConfidence {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  PERFECT = 'perfect'
}
```

### =  Inconsistencies

| Type | Context | §πº≠¬ | Issue |
|------|---------|-------|-------|
| `Status` (overlays) | Property status | 7 | ïªª∑Ωπ∫¨ values |
| `RegionStatus` | Overlay regions | 11 | Mix µªª∑Ωπ∫¨ + state |
| `Status` (index) | App state | 4 | L **NAME COLLISION** |
| `HealthStatus` | Service health | 4 | Domain-specific  |
| `ConflictStrategy` | Collaboration | 4 | Domain-specific  |
| `SnapConfidence` | AI snapping | 4 | Domain-specific  |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**ïùï°ìïôï£:**

1. **Rename ≥π± Clarity:**
```typescript
// L OLD: types/index.ts
export type Status = 'idle' | 'loading' | 'success' | 'error';

//  NEW: Rename ≥π± Ω± ±¿ø∆Õ≥ø≈ºµ collision
export type AppStatus = 'idle' | 'loading' | 'success' | 'error';
// Æ
export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';
```

2. **Keep PropertyStatus Central:**
```typescript
//  KEEP: overlays/types.ts
export type PropertyStatus =
  | 'üπ∫ø¿µ¥øÕ«ø≈'
  | 'îµ√ºµ≈º≠Ωø'
  | '†¡ø¬ †Œª∑√∑'
  | '†ø≈ª∑º≠Ωø'
  | '†¡ø¬ ïΩøπ∫Ø±√∑';
```

3. **Simplify RegionStatus:**
```typescript
// File: types/overlay.ts
import type { PropertyStatus } from '../overlays/types';

export type RegionState = 'draft' | 'active' | 'locked' | 'hidden';

export type RegionStatus = RegionState | PropertyStatus;
// Explicit union - clearer intent
```

4. **Keep Domain-Specific Enums:**
```typescript
//  KEEP: ServiceHealthMonitor.ts (domain-specific)
export enum HealthStatus { ... }

//  KEEP: CollaborationEngine.ts (domain-specific)
export enum ConflictStrategy { ... }

//  KEEP: AISnappingEngine.ts (domain-specific)
export enum SnapConfidence { ... }
```

**SAVINGS:** ~20 ≥¡±ºº≠¬ + Name Collision Fix!

---

## 5„ PANELTYPE - UI Panel Types =4

### =4 †¡Ã≤ª∑º±: 2 îπ±∆ø¡µƒπ∫¨ `PanelType` ºµ îπ±∆ø¡µƒπ∫≠¬ §πº≠¬

**îô†õü§•†ü #1:** `ui/reducers/floatingPanelReducer.ts:10`  **ACTIVE**
```typescript
export type PanelType =
  | 'overlay'
  | 'levels'
  | 'hierarchy'
  | 'layers'
  | 'colors';
```
**§πº≠¬:** 5  **Active Implementation**

**îô†õü§•†ü #2:** `types/index.ts:204` L **CONFLICT**
```typescript
export type PanelType =
  | 'layers'
  | 'properties'
  | 'blocks'
  | 'styles'
  | 'variables';
```
**§πº≠¬:** 5 L **îπ±∆ø¡µƒπ∫≠¬ §πº≠¬! (úÃΩø 'layers' ∫øπΩÃ)**

### =  £Õ≥∫¡π√∑

| Panel | floatingPanelReducer | types/index |
|-------|---------------------|-------------|
| overlay |  | L |
| levels |  | L |
| hierarchy |  | L |
| layers |  |  |
| colors |  | L |
| properties | L |  |
| blocks | L |  |
| styles | L |  |
| variables | L |  |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**OPTION 1: Rename ≥π± Different Contexts**
```typescript
// File: ui/reducers/floatingPanelReducer.ts
export type FloatingPanelType =
  | 'overlay'
  | 'levels'
  | 'hierarchy'
  | 'layers'
  | 'colors';

// File: types/index.ts
export type DxfPanelType =
  | 'layers'
  | 'properties'
  | 'blocks'
  | 'styles'
  | 'variables';
```

**OPTION 2: Merge √µ àΩ± Unified Type**
```typescript
// File: types/panels.ts (NEW)
export type PanelType =
  | 'overlay'
  | 'levels'
  | 'hierarchy'
  | 'layers'
  | 'colors'
  | 'properties'
  | 'blocks'
  | 'styles'
  | 'variables';

// Create subsets
export type FloatingPanelType = Extract<PanelType, 'overlay' | 'levels' | 'hierarchy' | 'layers' | 'colors'>;
export type DxfPanelType = Extract<PanelType, 'layers' | 'properties' | 'blocks' | 'styles' | 'variables'>;
```

**†°ü§ë£ó:** **Option 1** (different contexts, clearer intent)

**SAVINGS:** ~15 ≥¡±ºº≠¬ + Name Collision Fix!

---

## 6„ MODE TYPES - Drawing/Selection/Editor Modes =·

### =· †¡Ã≤ª∑º±: 11 îπ±∆ø¡µƒπ∫¨ Mode Types

| Type | ë¡«µØø | §πº≠¬ | Domain |
|------|--------|-------|--------|
| **ViewerMode** | `types/viewerConfiguration.ts:13` | 3: `'normal' \| 'preview' \| 'completion'` | Viewer state |
| **ViewMode** | `types/index.ts:202` | 3: `'hidden' \| 'normal' \| 'fullscreen'` | Window mode |
| **OverlayEditorMode** | `overlays/types.ts:87` | 3: `'select' \| 'draw' \| 'edit'` | Overlay editing |
| **SelectionMode** | `systems/selection/config.ts:20` | 4: `'point' \| 'window' \| 'crossing' \| 'lasso'` | Selection |
| **ConstraintMode** | `systems/constraints/config.ts:10` | 3: `'absolute' \| 'relative' \| 'dynamic'` | Constraints |
| **SnapRenderMode** | `rendering/ui/snap/SnapTypes.ts:75` | 3: `'normal' \| 'highlight' \| 'preview'` | Snap rendering |
| **GridRenderMode** | `rendering/ui/grid/GridTypes.ts:54` | 3: `'lines' \| 'dots' \| 'crosses'` | Grid rendering |
| **RulerRenderMode** | `rendering/ui/ruler/RulerTypes.ts:79` | 2: `'normal' \| 'highlight'` | Ruler rendering |
| **CrosshairRenderMode** | `rendering/ui/crosshair/CrosshairTypes.ts:51` | 2: `'normal' \| 'active'` | Crosshair rendering |
| **CursorRenderMode** | `rendering/ui/cursor/CursorTypes.ts:62` | 2: `'normal' \| 'active'` | Cursor rendering |
| **ZoomMode** | `systems/zoom/zoom-types.ts:9` | 3: `'in' \| 'out' \| 'extents'` | Zoom operations |

### =  Inconsistencies

**NAME COLLISION:** `ViewerMode` vs `ViewMode` (¥π±∆ø¡µƒπ∫¨ ¿¡¨≥º±ƒ±!)

**Render Modes Pattern:** Consistent pattern ±ªª¨ ¥π±√¿±¡º≠Ω± √µ ¥π±∆ø¡µƒπ∫¨ files

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**ïùï°ìïôï£:**

1. **Rename ≥π± Clarity:**
```typescript
// L OLD: types/index.ts
export type ViewMode = 'hidden' | 'normal' | 'fullscreen';

//  NEW:
export type WindowMode = 'hidden' | 'normal' | 'fullscreen';
// Æ
export type AppViewMode = 'hidden' | 'normal' | 'fullscreen';
```

2. **Keep Domain-Specific Modes:**
```typescript
//  KEEP: åª± ƒ± render modes (domain-specific)
// - SnapRenderMode
// - GridRenderMode
// - RulerRenderMode
// - CrosshairRenderMode
// - CursorRenderMode

//  KEEP: System-specific modes
// - ViewerMode
// - OverlayEditorMode
// - SelectionMode
// - ConstraintMode
// - ZoomMode
```

**†°ü§ë£ó:** Rename ºÃΩø ƒø `ViewMode` í `WindowMode` ≥π± Ω± ±¿ø∆Õ≥ø≈ºµ confusion ºµ `ViewerMode`

**SAVINGS:** ~10 ≥¡±ºº≠¬ + Clarity!

---

## 7„ STYLE TYPES - Overlapping Style Interfaces =·

### =· †¡Ã≤ª∑º±: 7 Style Interfaces ºµ Overlap

| Type | ë¡«µØø | Properties | Purpose |
|------|--------|------------|---------|
| **OverlayStyle** | `overlays/types.ts:17` | `stroke`, `fill`, `lineWidth`, `opacity` | Overlay regions |
| **RegionStyle** | `types/overlay.ts:6` | `stroke`, `fill`, `lineWidth`, `opacity` | **DUPLICATE!** |
| **EntityStyle** | `rendering/types/Types.ts:157` | `strokeColor`, `fillColor`, `lineWidth`, `lineDash`, `alpha` | Entity rendering |
| **ToolStyle** | `stores/ToolStyleStore.ts:8` | Extended | Runtime tool styles |
| **TextStyle (index)** | `types/index.ts:80` | DXF text | DXF configuration |
| **TextStyle (stores)** | `stores/TextStyleStore.ts:6` | Runtime text | Runtime styles |
| **GripStyle** | `stores/GripStyleStore.ts:10` | Grip-specific | Grip rendering |

### =  Property Name Inconsistencies

| Concept | OverlayStyle | EntityStyle |
|---------|-------------|-------------|
| Stroke Color | `stroke` | `strokeColor` |
| Fill Color | `fill` | `fillColor` |
| Opacity | `opacity` | `alpha` |

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**ïùï°ìïôï£:**

1. **Merge Duplicates:**
```typescript
// L DELETE: types/overlay.ts:RegionStyle
//  KEEP: overlays/types.ts:OverlayStyle (rename if needed)

// Or merge both:
// File: types/styles.ts (NEW)
export interface RegionStyle {
  stroke: string;
  fill: string;
  lineWidth: number;
  opacity: number;
}

export type OverlayStyle = RegionStyle; // Alias
```

2. **Normalize EntityStyle:**
```typescript
// File: rendering/types/Types.ts
export interface EntityStyle {
  // L OLD naming:
  strokeColor: string;
  fillColor: string;
  alpha: number;

  //  NEW naming (consistent ºµ OverlayStyle):
  stroke: string;
  fill: string;
  opacity: number;

  // Keep unique properties:
  lineWidth: number;
  lineDash?: number[];
  shadowBlur?: number;
  shadowColor?: string;
}
```

3. **Keep Store-Specific Styles:**
```typescript
//  KEEP: Runtime styles (different purpose)
// - ToolStyleStore
// - TextStyleStore
// - GripStyleStore
```

**SAVINGS:** ~30 ≥¡±ºº≠¬ + Property Name Consistency!

---

## 8„ GEOMETRY TYPES - Point2D, Viewport, Transform 

###  STATUS: â¥∑ öµΩƒ¡π∫ø¿øπ∑º≠Ωø!

**Master Definition:** `rendering/types/Types.ts`

```typescript
// Line 17:
export interface Point2D {
  x: number;
  y: number;
}

// Line 35:
export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

// Line 41:
export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}
```

**Usage:**  åª± ƒ± ±¡«µØ± import ±¿Ã `rendering/types/Types.ts`

**ë†ü§ïõï£úë:**  **PERFECT - NO ACTION NEEDED!** <∆

---

## 9„ LINE STYLE TYPES - Line/Cap/Join Styles =‚

### =‚ †¡Ã≤ª∑º±: 3 Duplicates

**îô†õü§•†ü #1:** `settings-core/types.ts:10`  **MASTER**
```typescript
export type LineType = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'dash-dot-dot';
export type LineCapStyle = 'butt' | 'round' | 'square';
export type LineJoinStyle = 'miter' | 'round' | 'bevel';
```

**îô†õü§•†ü #2:** `rendering/ui/crosshair/CrosshairTypes.ts:30`
```typescript
export type CrosshairLineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';
```

**îô†õü§•†ü #3:** `rendering/ui/cursor/CursorTypes.ts:13`
```typescript
export type CursorLineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';
```

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**ïùï°ìïôï£:**

```typescript
// L DELETE CrosshairLineStyle
// L DELETE CursorLineStyle

//  REPLACE ºµ:
import type { LineType } from '../../../settings-core/types';

// Usage:
export interface CrosshairConfig {
  lineStyle: LineType;  // Instead of CrosshairLineStyle
  // ...
}
```

**SAVINGS:** ~15 ≥¡±ºº≠¬

---

## = GRID/RULER CONFIGURATION TYPES =‚

### =‚ †¡Ã≤ª∑º±: 2 Duplicates

**îô†õü§•†ü #1:** `systems/rulers-grid/config.ts`  **MASTER**
```typescript
export interface GridSettings { /* 73 lines */ }
export interface RulerSettings { /* 17 lines */ }
```

**îô†õü§•†ü #2:** `canvas-v2/layer-canvas/layer-types.ts`
```typescript
export interface GridSettings { /* simplified version */ }
export interface RulerSettings { /* type alias ºµ comment */ }
```

### <Ø †¡Ãƒ±√∑ öµΩƒ¡π∫ø¿øØ∑√∑¬

**ïùï°ìïôï£:**

```typescript
// L DELETE ±¿Ã canvas-v2/layer-canvas/layer-types.ts

//  REPLACE ºµ:
import type { GridSettings, RulerSettings } from '../../systems/rulers-grid/config';
```

**SAVINGS:** ~90 ≥¡±ºº≠¬

---

## =  £•ùüõôöó ëùëõ•£ó

### £ƒ±ƒπ√ƒπ∫¨ ëΩ¨ ö±ƒ∑≥ø¡Ø±

| ö±ƒ∑≥ø¡Ø± | îπ¿ªÃƒ≈¿± | ë¡«µØ± | ì¡±ºº≠¬ | ö¡π√πºÃƒ∑ƒ± |
|-----------|-----------|---------|---------|-------------|
| EntityType | 1 enum | 5 | ~40 | =4 HIGH |
| SnapType | 1 enum + 3 types | 4 | ~60 | =4 HIGH |
| ToolType | 4 types | 4 | ~150 | =4 HIGH |
| Status Types | 6 types/enums | 6 | ~20 | =4 HIGH |
| PanelType | 2 types | 2 | ~15 | =4 HIGH |
| Mode Types | 11 types | 11 | ~10 | =· MEDIUM |
| Style Types | 7 interfaces | 7 | ~30 | =· MEDIUM |
| Line Styles | 3 types | 3 | ~15 | =‚ LOW |
| Grid/Ruler | 2 interfaces | 2 | ~90 | =‚ LOW |
| **Geometry** | ** OK** | **-** | **-** | **-** |

**£•ùüõü:**
- **28 duplicate enums/types**
- **44 affected files**
- **~430 ≥¡±ºº≠¬ duplicate code**

### ö±ƒ±ΩøºÆ ö¡π√πºÃƒ∑ƒ±¬

```
Total Duplicates: 28 (100%)

   HIGH Priority (∫¡Ø√πº±): 5 categories (20 files, 285 lines) - 66%
   MEDIUM Priority (º≠ƒ¡π±): 2 categories (18 files, 40 lines) - 9%
   LOW Priority (ºπ∫¡¨): 2 categories (4 files, 105 lines) - 24%

Already Centralized: 1 category (Geometry) 
```

### Potential Savings

| Priority | Categories | Lines Saved | Time Estimate |
|----------|-----------|-------------|--------------|
| =4 HIGH | 5 | ~285 | 4-5 hours |
| =· MEDIUM | 2 | ~40 | 1-2 hours |
| =‚ LOW | 2 | ~105 | 30 min |

**TOTAL POTENTIAL SAVINGS:** ~430 ≥¡±ºº≠¬ (-65% ƒ…Ω enum duplicates)

---

## <Ø †°ü§ïôùüúïùó £§°ë§óìôöó - PHASED APPROACH

### =4 PHASE 1: Critical Duplicates (HIGH PRIORITY)

**Time:** 4-5 hours
**Impact:** 285 lines saved, type safety improvements

1. **EntityType Unification** (1h)
   - Master: `types/entities.ts`
   - Add missing: `'block'`, `'angle-measurement'`, `'ellipse'`, `'spline'`
   - Delete duplicates: 4 files
   - Update imports: ~30 files

2. **SnapType Unification** (1.5h)
   - Master: `snapping/extended-types.ts`
   - Rename: `ExtendedSnapType` í `SnapType`
   - Create: `BasicSnapType` subset
   - Delete duplicates: 3 files
   - Update imports: ~52 files

3. **ToolType Unification** (1h)
   - Master: `systems/toolbars/config.ts`
   - Delete duplicates: 2 files
   - Update ToolStateManager: Dynamic registration
   - Update imports: ~25 files

4. **Status Types Cleanup** (30m)
   - Rename: `types/index.ts:Status` í `AppStatus`
   - Keep: `PropertyStatus` (central)
   - Simplify: `RegionStatus` í union type

5. **PanelType Resolution** (30m)
   - Rename: `types/index.ts:PanelType` í `DxfPanelType`
   - Keep: `ui/reducers/floatingPanelReducer.ts:PanelType`

### =· PHASE 2: Style & Mode Types (MEDIUM PRIORITY)

**Time:** 1-2 hours
**Impact:** 40 lines saved, consistency improvements

6. **Style Interfaces Merge** (1h)
   - Merge: `OverlayStyle` + `RegionStyle`
   - Normalize: `EntityStyle` property names
   - Document: Store-specific styles

7. **ViewMode Rename** (30m)
   - Rename: `types/index.ts:ViewMode` í `WindowMode`
   - Keep: All domain-specific modes

### =‚ PHASE 3: Small Duplicates (LOW PRIORITY)

**Time:** 30 min
**Impact:** 105 lines saved

8. **Line Style Types** (15m)
   - Delete: `CrosshairLineStyle`, `CursorLineStyle`
   - Use: `LineType` ±¿Ã `settings-core/types.ts`

9. **Grid/Ruler Settings** (15m)
   - Master: `systems/rulers-grid/config.ts`
   - Delete: `canvas-v2/layer-canvas/layer-types.ts` duplicates

---

## =¡ †°ü§ïôùüúïùó îüúó úï§ë §óù öïù§°ôöü†üôó£ó

```
src/subapps/dxf-viewer/
   types/
      entities.ts          #  EntityType (MASTER - 12 values)
      app-status.ts         #  AppStatus (renamed)
      panels.ts             #  FloatingPanelType, DxfPanelType
      styles.ts             #  RegionStyle (unified)

   snapping/
      types.ts              #  SnapType (MASTER - renamed)
                             #  BasicSnapType (subset)

   systems/
      toolbars/
         config.ts         #  ToolType (MASTER - 57 values)
                            #  DrawTool, EditTool, etc. (subsets)
      rulers-grid/
         config.ts         #  RulerSettings, GridSettings
      ...

   settings-core/
      types.ts              #  LineType, LineCapStyle, LineJoinStyle

   rendering/
       types/
           Types.ts          #  Point2D, Viewport, ViewTransform
                              #  EntityStyle (normalized)
```

---

## =Ä §ïõôöó £•£§ë£ó

**ìπŒ¡≥ø, ∑ ∫±ƒ¨√ƒ±√∑ ƒ…Ω Enums/Types µØΩ±π úôö§ó:**

###  ï¿πƒ≈«Øµ¬:
- **Geometry Types** (Point2D, Viewport, Transform): 100% ∫µΩƒ¡π∫ø¿øπ∑º≠Ω± 
- **Service-specific Enums** (HealthStatus, ConflictStrategy): Well-organized 

### L ö¡Ø√πº± öµΩ¨:
- **5 high-priority duplicates** (EntityType, SnapType, ToolType, Status, PanelType)
- **20 affected files** ≥π± ƒ± ∫¡Ø√πº±
- **285 ≥¡±ºº≠¬ duplicate code** √ƒ± high-priority

### <Ø †¡øƒµπΩÃºµΩ∑ î¡¨√∑

**PHASE 1 (HIGH PRIORITY):** 4-5 hours í -285 lines
1.  EntityType Unification
2.  SnapType Unification
3.  ToolType Unification
4.  Status Types Cleanup
5.  PanelType Resolution

**PHASE 2 (MEDIUM):** 1-2 hours í -40 lines
6.  Style Interfaces Merge
7.  ViewMode Rename

**PHASE 3 (LOW):** 30 min í -105 lines
8.  Line Style Types
9.  Grid/Ruler Settings

**Total Impact:** ~430 ≥¡±ºº≠¬ reduction, 100% type safety, zero name collisions

**ò≠ªµπ¬ Ω± æµ∫πΩÆ√ø≈ºµ ºµ ƒ∑Ω Phase 1;** =Ä

---

**§ïõü£ ëùë¶ü°ë£**
