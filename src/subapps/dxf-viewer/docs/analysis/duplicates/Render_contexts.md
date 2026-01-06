# = ëùëõ•£ó îô†õü§•†©ù RENDER CONTEXTS - DXF VIEWER

**óºµ¡øº∑ΩØ± ëΩ¨ª≈√∑¬:** 2025-10-03
**ëΩ±ª≈ƒÆ¬:** Claude (Anthropic AI)
**†µ¥Øø ëΩ¨ª≈√∑¬:** `src/subapps/dxf-viewer/` - åª± ƒ± Render Contexts
**£≈Ωøªπ∫¨ ë¡«µØ± ïª≠≥«∏∑∫±Ω:** 38 files ºµ context definitions/usage

---

## =  ïö§ïõï£§ôöó £•ùü®ó

### í±√π∫¨ ï≈¡Æº±ƒ±

| ö±ƒ∑≥ø¡Ø± | îπ¿ªÃƒ≈¿± | ì¡±ºº≠¬ | †¡øƒµ¡±πÃƒ∑ƒ± |
|-----------|-----------|---------|--------------|
| **Transform Types** | 2 types | ~20 | =4 HIGH |
| **Coordinate Transforms** | 3+ implementations | ~45 | =4 HIGH |
| **Transform Conversions** | 4 adapters | ~40 | =· MEDIUM |
| **Context Extensions** | 3+ patterns | ~15 | =· MEDIUM |
| **Legacy Contexts** | 1 system | ~10 | =‚ LOW |

**£•ùüõü îô†õü§•†©ù:** ~130 ≥¡±ºº≠¬

**7 öë§óìü°ôï£ CONTEXTS:**
1. IRenderContext (Core)
2. UIRenderContext (UI)
3. UIRenderContextImpl (Implementation)
4. HoverRenderContext (Legacy)
5. SnapEngineContext (Snap)
6. Canvas2DContext (Adapter)
7. Legacy Adapters (4 files)

---

## 1„ IRENDERCONTEXT - Core Rendering Context

### =Õ §ø¿ø∏µ√Ø±

**File:** `rendering/core/IRenderContext.ts`
**Lines:** 172 total

###  Definition

```typescript
export interface IRenderContext {
  readonly type: 'canvas2d' | 'webgl' | 'webgpu';
  readonly canvas: HTMLCanvasElement;
  readonly isHardwareAccelerated: boolean;

  // Transform operations
  worldToScreen(worldPoint: Point2D): Point2D;
  screenToWorld(screenPoint: Point2D): Point2D;
  setTransform(transform: Transform2D): void;
  getTransform(): Transform2D;

  // Drawing methods (abstracted)
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fill(): void;
  // ... more Canvas API methods

  // State management
  save(): void;
  restore(): void;
  getState(): RenderState;
  setState(state: RenderState): void;
}
```

### =  Transform2D

```typescript
export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;
}
```

### <Ø ß¡Æ√∑

- **Canvas2DContext** (implementation)
- **RenderPipeline**
- **BackgroundPass**, **EntityPass**, **OverlayPass**
- **RendererRegistry**

---

## 2„ UIRENDERCONTEXT - UI Rendering Context

### =Õ §ø¿ø∏µ√Ø±

**File:** `rendering/ui/core/UIRenderer.ts`
**Lines:** 94 total (interface section)

###  Definition

```typescript
export interface UIRenderContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: UITransform;
  readonly timestamp: number;
}

export interface UITransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation?: number;
}
```

### <Ø ß¡Æ√∑

- **UIRendererComposite**
- **GridRenderer**
- **RulerRenderer**
- **CrosshairRenderer**
- **CursorRenderer**
- **SnapRenderer**
- **OriginMarkersRenderer**
- **SelectionRenderer**

---

## 3„ UIRENDERCONTEXTIMPL - Implementation

### =Õ §ø¿ø∏µ√Ø±

**File:** `rendering/ui/core/UIRenderContext.ts`
**Lines:** 59 total

###  Definition

```typescript
export class UIRenderContextImpl implements UIRenderContext {
  constructor(
    public readonly ctx: CanvasRenderingContext2D,
    public readonly transform: UITransform,
    public readonly timestamp: number = Date.now()
  ) {}

  withTransform(transform: UITransform): UIRenderContextImpl {
    return new UIRenderContextImpl(this.ctx, transform, this.timestamp);
  }
}
```

---

## 4„ HOVERRENDERCONTEXT - Legacy Hover Context

### =Õ §ø¿ø∏µ√Ø±

**File:** `utils/hover/types.ts`
**Lines:** 19 total

###  Definition

```typescript
export interface HoverRenderContext {
  entity: EntityModel;
  ctx: CanvasRenderingContext2D;
  worldToScreen: WorldToScreenFn;
  options: RenderOptions;
}

export type WorldToScreenFn = (p: Point2D) => Point2D;
```

### <Ø ß¡Æ√∑ (Legacy System)

- `utils/hover/line-renderer.ts`
- `utils/hover/polyline-renderer.ts`
- `utils/hover/shape-renderers.ts`
- `utils/hover/text-spline-renderers.ts`

---

## 5„ SNAPENGINECONTEXT - Snap Engine Context

### =Õ §ø¿ø∏µ√Ø±

**File:** `snapping/shared/BaseSnapEngine.ts`
**Lines:** 215 total file

###  Definition

```typescript
export interface SnapEngineContext {
  entities: Entity[];
  worldRadiusAt: (point: Point2D) => number;
  worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => number;
  pixelTolerance: number;
  perModePxTolerance?: Record<ExtendedSnapType, number>;
  excludeEntityId?: string;
  maxCandidates: number;
}
```

---

## 6„ CANVAS2DCONTEXT - IRenderContext Implementation

### =Õ §ø¿ø∏µ√Ø±

**File:** `rendering/adapters/canvas2d/Canvas2DContext.ts`
**Lines:** 322 total

###  Key Implementation

```typescript
export class Canvas2DContext implements IRenderContext {
  private ctx: CanvasRenderingContext2D;
  private currentTransform: Transform2D;

  worldToScreen(worldPoint: Point2D): Point2D {
    const { scale, offsetX, offsetY } = this.currentTransform;
    return {
      x: worldPoint.x * scale + offsetX,
      y: worldPoint.y * scale + offsetY
    };
  }

  screenToWorld(screenPoint: Point2D): Point2D {
    const { scale, offsetX, offsetY } = this.currentTransform;
    return {
      x: (screenPoint.x - offsetX) / scale,
      y: (screenPoint.y - offsetY) / scale
    };
  }

  // ... full Canvas2D API implementation
}
```

---

## 7„ LEGACY ADAPTERS - Backward Compatibility

### =Õ §ø¿ø∏µ√Øµ¬

| File | Lines | Purpose |
|------|-------|---------|
| `rendering/ui/cursor/LegacyCursorAdapter.ts` | 100 | Cursor adapter |
| `rendering/ui/crosshair/LegacyCrosshairAdapter.ts` | 109 | Crosshair adapter |
| `rendering/ui/snap/LegacySnapAdapter.ts` | 116 | Snap adapter |
| `rendering/ui/grid/LegacyGridAdapter.ts` | 111 | Grid adapter |

###  Common Pattern

```typescript
export class LegacyCursorAdapter implements UIRenderer {
  render(context: UIRenderContext): void {
    // L DUPLICATE: Transform conversion
    const uiTransform: UITransform = transform ? {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotation: 0
    } : DEFAULT_UI_TRANSFORM;

    // L DUPLICATE: Context extension via type casting
    (uiContext as any).mousePosition = position;

    // Call legacy renderer
    this.legacyRenderer.render(/* ... */);
  }
}
```

---

## =4 îô†õü§•†ü #1: Transform Types

### †¡Ã≤ª∑º±

**2 ôîôüô §•†üô** ºµ ¥π±∆ø¡µƒπ∫¨ øΩÃº±ƒ±:

**Transform2D** (`rendering/core/IRenderContext.ts:18-23`):
```typescript
export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;
}
```

**UITransform** (`rendering/ui/core/UIRenderer.ts:44-49`):
```typescript
export interface UITransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation?: number;
}
```

**îôë¶ü°ë:** úÃΩø ƒø `readonly` modifier ∫±π ƒø ÃΩøº±!

### =  Impact

| Property | Transform2D | UITransform |
|----------|-------------|-------------|
| scale |  |  readonly |
| offsetX |  |  readonly |
| offsetY |  |  readonly |
| rotation |  optional |  optional + readonly |

**Files Affected:** 15+ files
**Duplicate Lines:** ~20

### <Ø †¡Ãƒ±√∑

```typescript
//  UNIFIED TYPE: rendering/types/Types.ts
export interface ViewTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation?: number;
}

// L DELETE: Transform2D
// L DELETE: UITransform
//  REPLACE ALL ºµ ViewTransform
```

**SAVINGS:** -20 ≥¡±ºº≠¬

---

## =4 îô†õü§•†ü #2: worldToScreen/screenToWorld Implementations

### †¡Ã≤ª∑º±

**3+ IMPLEMENTATIONS** ƒ∑¬ Ø¥π±¬ ªµπƒø≈¡≥Ø±¬:

**Implementation #1:** `Canvas2DContext.ts` (lines 139-153)
```typescript
worldToScreen(worldPoint: Point2D): Point2D {
  const { scale, offsetX, offsetY } = this.currentTransform;
  return {
    x: worldPoint.x * scale + offsetX,
    y: worldPoint.y * scale + offsetY
  };
}

screenToWorld(screenPoint: Point2D): Point2D {
  const { scale, offsetX, offsetY } = this.currentTransform;
  return {
    x: (screenPoint.x - offsetX) / scale,
    y: (screenPoint.y - offsetY) / scale
  };
}
```

**Implementation #2:** `HoverRenderContext` (function-based)
```typescript
export type WorldToScreenFn = (p: Point2D) => Point2D;

// Usage:
const screenPoint = worldToScreen(worldPoint);
```

**Implementation #3:** `SnapContextManager.ts` (worldRadiusAt)
```typescript
worldRadiusAt(point: Point2D): number {
  const scale = this.transform.scale;
  return this.pixelTolerance / scale;
}
```

**ï†ô†õïüù:** •¿¨¡«µπ óîó ƒø `CoordinateTransforms` class!

**File:** `rendering/core/CoordinateTransforms.ts`
```typescript
export class CoordinateTransforms {
  static worldToScreen(
    worldPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport
  ): Point2D {
    return {
      x: worldPoint.x * transform.scale + transform.offsetX,
      y: worldPoint.y * transform.scale + transform.offsetY
    };
  }

  static screenToWorld(
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport
  ): Point2D {
    return {
      x: (screenPoint.x - transform.offsetX) / transform.scale,
      y: (screenPoint.y - transform.offsetY) / transform.scale
    };
  }
}
```

### =  Impact

**Files ºµ duplicate logic:** 3+
**Duplicate Lines:** ~45

### <Ø †¡Ãƒ±√∑

```typescript
//  SINGLE SOURCE OF TRUTH: CoordinateTransforms (óîó •†ë°ßïô!)

// L DELETE ±¿Ã Canvas2DContext:
class Canvas2DContext {
  worldToScreen(worldPoint: Point2D): Point2D {
    // L DELETE implementation
    return CoordinateTransforms.worldToScreen(worldPoint, this.currentTransform, this.viewport);
  }
}

// L DELETE HoverRenderContext.WorldToScreenFn
//  REPLACE ºµ:
interface HoverRenderContext {
  transform: ViewTransform;
  viewport: Viewport;
  // Use: CoordinateTransforms.worldToScreen(point, transform, viewport)
}
```

**SAVINGS:** -45 ≥¡±ºº≠¬

---

## =· îô†õü§•†ü #3: Transform Conversion Logic

### †¡Ã≤ª∑º±

**4 LEGACY ADAPTERS** ≠«ø≈Ω ƒøΩ Ø¥πø ∫Œ¥π∫± ºµƒ±ƒ¡ø¿Æ¬:

**LegacyCursorAdapter.ts** (lines 45-50):
```typescript
const uiTransform: UITransform = transform ? {
  scale: transform.scale,
  offsetX: transform.offsetX,
  offsetY: transform.offsetY,
  rotation: 0
} : DEFAULT_UI_TRANSFORM;
```

**LegacyCrosshairAdapter.ts** (lines 45-50):
```typescript
const uiTransform: UITransform = transform ? {
  scale: transform.scale,
  offsetX: transform.offsetX,
  offsetY: transform.offsetY,
  rotation: 0
} : DEFAULT_UI_TRANSFORM;
```

**LegacySnapAdapter.ts** (lines 45-50):
```typescript
const uiTransform: UITransform = transform ? {
  scale: transform.scale,
  offsetX: transform.offsetX,
  offsetY: transform.offsetY,
  rotation: 0
} : DEFAULT_UI_TRANSFORM;
```

**LegacyGridAdapter.ts** (lines 45-50):
```typescript
const uiTransform: UITransform = transform ? {
  scale: transform.scale,
  offsetX: transform.offsetX,
  offsetY: transform.offsetY,
  rotation: 0
} : DEFAULT_UI_TRANSFORM;
```

**ôîôü£ ö©îôöë£** √µ 4 ±¡«µØ±!

### =  Impact

**Files:** 4 legacy adapters
**Duplicate Lines:** 4 ◊ 10 = ~40

### <Ø †¡Ãƒ±√∑

```typescript
//  NEW UTILITY: rendering/utils/transform-utils.ts
export class TransformUtils {
  /**
   * Convert any transform to ViewTransform
   */
  static toViewTransform(transform: any): ViewTransform {
    if (!transform) {
      return { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
    }

    return {
      scale: transform.scale ?? 1,
      offsetX: transform.offsetX ?? 0,
      offsetY: transform.offsetY ?? 0,
      rotation: transform.rotation ?? 0
    };
  }

  /**
   * Default transform
   */
  static defaultTransform(): ViewTransform {
    return { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
  }
}

//  USAGE √µ Ãªø≈¬ ƒø≈¬ adapters:
const viewTransform = TransformUtils.toViewTransform(transform);
```

**SAVINGS:** -40 ≥¡±ºº≠¬

---

## =· îô†õü§•†ü #4: Context Extension Pattern

### †¡Ã≤ª∑º±

**TYPE CASTING PATTERN** µ¿±Ω±ª±º≤¨Ωµƒ±π √µ 3+ adapters:

**LegacyCrosshairAdapter.ts** (line 53):
```typescript
(uiContext as any).mousePosition = position;
```

**LegacyCursorAdapter.ts** (line 71):
```typescript
(uiContext as any).mousePosition = position;
```

**LegacySnapAdapter.ts** (line 86):
```typescript
(uiContext as any).snapData = convertedSnapResults;
```

**†¡Ã≤ª∑º±:** ß¨Ωµƒ±π ƒø type safety!

### =  Impact

**Files:** 3+ adapters
**Pattern Repetitions:** 5+
**Duplicate Lines:** ~15

### <Ø †¡Ãƒ±√∑

```typescript
//  NEW TYPE: rendering/ui/core/ExtendedUIRenderContext.ts
export interface ExtendedUIRenderContext extends UIRenderContext {
  // Optional extensions
  mousePosition?: Point2D;           // For Crosshair/Cursor
  snapData?: SnapResult[];          // For Snap
  selectionData?: SelectionBox;     // For Selection
  worldTransform?: ViewTransform;   // For Origin/Debug
}

//  FACTORY ºµ type safety
export function createExtendedUIRenderContext(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  transform: ViewTransform,
  extensions?: Partial<ExtendedUIRenderContext>
): ExtendedUIRenderContext {
  const base: UIRenderContext = {
    ctx,
    transform,
    timestamp: Date.now()
  };

  return { ...base, ...extensions };
}

//  USAGE:
const context = createExtendedUIRenderContext(ctx, viewport, transform, {
  mousePosition: { x: 100, y: 200 }
});
// Type-safe! No casting needed!
```

**SAVINGS:** -15 ≥¡±ºº≠¬ type casting + Type Safety!

---

## =‚ îô†õü§•†ü #5: ctx Property Repetition

### †¡Ã≤ª∑º±

**ctx PROPERTY** µ¿±Ω±ª±º≤¨Ωµƒ±π √µ 3+ interfaces:

**UIRenderContext:**
```typescript
readonly ctx: CanvasRenderingContext2D;
```

**HoverRenderContext:**
```typescript
ctx: CanvasRenderingContext2D;
```

**Canvas2DContext:** (implicit/private)
```typescript
private ctx: CanvasRenderingContext2D;
```

### =  Impact

**Files:** 3+ contexts
**Duplicate Lines:** ~15

### <Ø †¡Ãƒ±√∑

**ö°ë§ó£ó:** ë≈ƒÃ µØΩ±π ∆≈√π∫Ã - ∫¨∏µ rendering context «¡µπ¨∂µƒ±π ƒø canvas context.

**NO ACTION NEEDED** - ë≈ƒÃ ¥µΩ µØΩ±π ¿¡±≥º±ƒπ∫Ã ¥π¿ªÃƒ≈¿ø.

---

## =‚ îô†õü§•†ü #6: HoverRenderContext Legacy

### †¡Ã≤ª∑º±

`HoverRenderContext` µØΩ±π **LEGACY SYSTEM** ¿ø≈ ¥µΩ «¡∑√πºø¿øπµØ ƒø unified UIRenderer pattern.

### =  Impact

**Files:** 5 hover renderers
**Duplicate Lines:** ~10 (context definition)

### <Ø †¡Ãƒ±√∑ (Long-term)

```typescript
// L DEPRECATE: HoverRenderContext
//  MIGRATE TO: UIRenderer system

// Migration path:
// 1. Convert hover renderers í UIRenderer implementations
// 2. Use UIRendererComposite
// 3. Delete HoverRenderContext

// Example:
export class LineHoverRenderer implements UIRenderer {
  render(context: ExtendedUIRenderContext): void {
    const entity = context.hoveredEntity;
    // ... use UIRenderContext instead of HoverRenderContext
  }
}
```

**SAVINGS:** -10 ≥¡±ºº≠¬ + Consistency!

---

## =  £•ùüõôöó ëùëõ•£ó îô†õü§•†©ù

### £≈≥∫µΩƒ¡…ƒπ∫Ã¬ †ØΩ±∫±¬

| # | îπ¿ªÃƒ≈¿ø | ë¡«µØ± | ì¡±ºº≠¬ | †¡øƒµ¡±πÃƒ∑ƒ± |
|---|-----------|---------|---------|--------------|
| 1 | Transform Types | 2 | ~20 | =4 HIGH |
| 2 | worldToScreen implementations | 3+ | ~45 | =4 HIGH |
| 3 | Transform conversions | 4 | ~40 | =· MEDIUM |
| 4 | Context extensions | 3+ | ~15 | =· MEDIUM |
| 5 | ctx property | 3+ | ~15 (NO ACTION) | =‚ LOW |
| 6 | HoverRenderContext | 1 | ~10 | =‚ LOW |

**£•ùüõü:** ~130 ≥¡±ºº≠¬ actionable duplicates

### ö±ƒ±ΩøºÆ †¡øƒµ¡±πÃƒ∑ƒ±¬

```
Total: 130 lines

   HIGH Priority: 65 lines (50%)
   MEDIUM Priority: 55 lines (42%)
   LOW Priority: 10 lines (8%)
```

---

## <Ø †°ü§ïôùüúïùó £§°ë§óìôöó - 3 ¶ë£ïô£

### =4 PHASE 1: Quick Wins (1-2 hours)

**£ƒÃ«ø¬:** ïæ¨ªµπ»∑ µÕ∫øª…Ω ¥π¿ªøƒÕ¿…Ω

**ïùï°ìïôï£:**

1. **Unified Transform Type** (30m)
   - Create `ViewTransform` √ƒø `rendering/types/Types.ts`
   - Replace `Transform2D` í `ViewTransform` (5 files)
   - Replace `UITransform` í `ViewTransform` (10 files)
   - **SAVINGS:** -20 lines

2. **Transform Utils** (30m)
   - Create `TransformUtils` class
   - Replace conversion logic √µ 4 legacy adapters
   - **SAVINGS:** -40 lines

**TOTAL PHASE 1:** -60 lines, 1 hour

### =· PHASE 2: Core Consolidation (2-3 hours)

**£ƒÃ«ø¬:** öµΩƒ¡π∫ø¿øØ∑√∑ coordinate transforms

**ïùï°ìïôï£:**

3. **Coordinate Transform Delegation** (1.5h)
   - Update `Canvas2DContext` Ω± «¡∑√πºø¿øπµØ `CoordinateTransforms`
   - Update `HoverRenderContext` (migration plan)
   - Update `SnapContextManager`
   - **SAVINGS:** -45 lines

4. **Extended Context Mechanism** (1h)
   - Create `ExtendedUIRenderContext`
   - Create `createExtendedUIRenderContext` factory
   - Replace type casting √µ 3+ adapters
   - **SAVINGS:** -15 lines + Type Safety

**TOTAL PHASE 2:** -60 lines, 2.5 hours

### =‚ PHASE 3: Long-term Cleanup (Ãƒ±Ω ≠«µπ¬ «¡ÃΩø)

**£ƒÃ«ø¬:** Deprecate legacy systems

**ïùï°ìïôï£:**

5. **Hover System Migration** (3-4h)
   - Convert hover renderers í UIRenderer
   - Deprecate `HoverRenderContext`
   - Use `UIRendererComposite`
   - **SAVINGS:** -10 lines + Consistency

**TOTAL PHASE 3:** -10 lines, 3-4 hours

---

## =¡ †°ü§ïôùüúïùó îüúó úï§ë §óù öïù§°ôöü†üôó£ó

```
src/subapps/dxf-viewer/rendering/
   types/
      Types.ts                     #  ViewTransform (UNIFIED)

   core/
      IRenderContext.ts            #  Uses ViewTransform
      CoordinateTransforms.ts      #  SINGLE SOURCE OF TRUTH
      RenderPipeline.ts

   ui/
      core/
          UIRenderer.ts            #  Uses ViewTransform
          UIRenderContext.ts       #  Uses ViewTransform
          ExtendedUIRenderContext.ts  #  NEW (Type-safe extensions)
          UIRendererComposite.ts

   adapters/
      canvas2d/
          Canvas2DContext.ts       #  Delegates to CoordinateTransforms

   utils/
       transform-utils.ts           #  NEW (Conversion utilities)
```

---

## = LEGACY vs MODERN PATTERNS

### L LEGACY PATTERN

```typescript
// Multiple transform types
interface Transform2D { ... }
interface UITransform { ... }

// Duplicate coordinate conversion
class Canvas2DContext {
  worldToScreen(p: Point2D): Point2D {
    // ... duplicate math
  }
}

// Unsafe context extensions
(context as any).mousePosition = position;

// Function-based coordinate conversion
type WorldToScreenFn = (p: Point2D) => Point2D;
```

###  MODERN PATTERN

```typescript
// Single transform type
interface ViewTransform { ... }

// Centralized coordinate conversion
CoordinateTransforms.worldToScreen(point, transform, viewport);

// Type-safe context extensions
interface ExtendedUIRenderContext extends UIRenderContext {
  mousePosition?: Point2D;
}

// Unified rendering interface
interface UIRenderer {
  render(context: UIRenderContext): void;
}
```

---

## =» ëùëúïùüúïùë ë†ü§ïõï£úë§ë

### úµƒ¨ ƒ∑Ω †ªÆ¡∑ öµΩƒ¡π∫ø¿øØ∑√∑

**Before:**
- Context types: 7 different contexts
- Transform types: 3 (ViewTransform, Transform2D, UITransform)
- worldToScreen implementations: 3+
- Type safety: Medium (type casting)
- Duplicate code: ~130 lines

**After:**
- Context types: 5 (cleaned up)
- Transform types: 1 (ViewTransform)
- worldToScreen implementations: 1 (CoordinateTransforms)
- Type safety: High (ExtendedUIRenderContext)
- Duplicate code: ~20 lines

**REDUCTION:** -110 lines (-85%)

### Quality Improvements

1.  **Single Transform Type** - ViewTransform everywhere
2.  **Single Source of Truth** - CoordinateTransforms ≥π± coordinate conversion
3.  **Type Safety** - No more `as any` casting
4.  **Consistency** - Unified rendering patterns
5.  **Maintainability** - Easier to update/fix bugs

---

## =° öëõë PATTERNS †ü• •†ë°ßü•ù

###  òµƒπ∫¨ ¿ø≈ í¡Æ∫±:

1. **UIRenderer Interface** - Unified contract ≥π± UI rendering
2. **UIRendererComposite** - Centralized orchestration
3. **CoordinateTransforms** - óîó •†ë°ßïô! ë¿ª¨ ¥µΩ «¡∑√πºø¿øπµØƒ±π ¿±ΩƒøÕ
4. **Legacy Adapters** - ö±ªÃ pattern ≥π± backward compatibility
5. **RenderPipeline** - Clean abstraction ≥π± rendering passes

### <ì ú±∏Æº±ƒ±:

**ìπ±ƒØ ≈¿¨¡«ø≈Ω ƒÃ√± contexts;**
- Historical evolution (Legacy í Modern)
- Different concerns (Entity vs UI vs Snap)
- Adapter pattern ≥π± compatibility

**§π ¿Æ≥µ ∫±ª¨;**
- Separation of concerns
- Extensibility (UIRenderer interface)
- Backward compatibility (Legacy adapters)

**§π «¡µπ¨∂µƒ±π ≤µªƒØ…√∑;**
- Unify transform types
- Use CoordinateTransforms everywhere
- Type-safe context extensions

---

## =Ä §ïõôöó £•£§ë£ó

**ìπŒ¡≥ø, ≤¡Æ∫± ~130 ≥¡±ºº≠¬ ¥π¿ªÃƒ≈¿…Ω ∫Œ¥π∫± √µ render contexts!**

### =4 öÕ¡π± †¡ø≤ªÆº±ƒ±:

1. **2 Transform Types** (Transform2D, UITransform) - Ø¥π± ¿¡¨≥º±ƒ±!
2. **3+ worldToScreen implementations** - µΩŒ ≈¿¨¡«µπ ƒø CoordinateTransforms!
3. **4 Legacy Adapters** ºµ ƒøΩ Ø¥πø conversion code
4. **Type Casting Pattern** `(context as any).property` - unsafe!

###  ö±ª¨ ù≠±:

**à«µπ¬ Æ¥∑ ƒø `CoordinateTransforms` class!** ë¿ª¨ ¥µΩ ƒø «¡∑√πºø¿øπøÕΩ Ãª± ƒ± contexts. ë≈ƒÃ ∫¨Ωµπ ƒø fix ¿øªÕ ¿πø µÕ∫øªø.

### <Ø †¡øƒµπΩÃºµΩ∑ î¡¨√∑:

**START ºµ PHASE 1 (Quick Wins):**
- Ò Time: 1 hour
- =æ Savings: -60 lines
- <Ø Impact: Immediate (unified transform type)

**THEN PHASE 2 (Core Consolidation):**
- Ò Time: 2.5 hours
- =æ Savings: -60 lines
- <Ø Impact: High (single source of truth)

**LATER PHASE 3 (Long-term):**
- Ò Time: 3-4 hours (Ãƒ±Ω ≠«µπ¬)
- =æ Savings: -10 lines
- <Ø Impact: Consistency improvements

**Total Impact:** -130 lines, Type Safety++, Single Source of Truth

**ò≠ªµπ¬ Ω± æµ∫πΩÆ√ø≈ºµ ºµ Phase 1;** =Ä

---

**§ïõü£ ëùë¶ü°ë£**
