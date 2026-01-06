# = ‘‘¦Ÿ¡‘ ”™ ›Ÿ¤¥ ©: DRAW METHODS

**—¼µÁ¿¼·½¯±**: 2025-10-03
**Scope**: `src/subapps/dxf-viewer/` - Full codebase analysis
**š±Ä·³¿Á¯±**: Draw Methods (drawLine, drawCircle, fillRect, arc, stroke, fill)
**£ÄÌÇ¿Â**: •½Ä¿À¹Ã¼ÌÂ º±¹ Äµº¼·Á¯ÉÃ· Ì»É½ ÄÉ½ ´¹À»ÌÄÅÀÉ½ draw/rendering methods

---

## =Ê EXECUTIVE SUMMARY

### ‘À¿Äµ»­Ã¼±Ä± ˆÁµÅ½±Â:
- **71 ±ÁÇµ¯±** ¼µ canvas rendering methods
- **13 ±ÁÇµ¯±** ¼µ direct canvas primitives (fillRect, strokeRect, arc)
- **4 º±Ä·³¿Á¯µÂ ´¹À»¿ÄÍÀÉ½** Ä±ÅÄ¿À¿¹®¸·º±½
- **~100-150 ³Á±¼¼­Â ºÎ´¹º±** ´Å½·Ä¹º® ¼µ¯ÉÃ· ¼µÄ¬ Ä·½ ºµ½ÄÁ¹º¿À¿¯·Ã·

### š±Ä¬ÃÄ±Ã· šµ½ÄÁ¹º¿À¿¯·Ã·Â:
| Status | Draw Methods | Impact |
|--------|--------------|--------|
|  **CENTRALIZED** | Line rendering, split lines, continuous lines | Shared utilities exist |
|  **CENTRALIZED** | Circle rendering (radius/diameter modes) | Handled by BaseEntityRenderer |
|   **PARTIAL** | Hover rendering (duplicates ¼µ preview logic) | Needs consolidation |
| L **DUPLICATED** | Canvas primitive wrappers (arc, fillRect) | Low priority |

###  Á¿ÄµÁ±¹ÌÄ·ÄµÂ:
|  Á¿ÄµÁ±¹ÌÄ·Ä± | ‘Á¹¸¼ÌÂ ”¹À»¿ÄÍÀÉ½ | •À¯ÀÄÉÃ· |
|--------------|-------------------|----------|
| =4 CRITICAL | 0 |  Already centralized! |
| =à HIGH | 2 | Hover rendering duplicates preview logic |
| =á MEDIUM | 3 | Minor utility duplicates |
| =â LOW | Multiple | Acceptable domain-specific rendering |

---

##  š‘¤—“Ÿ¡™‘ 1: ALREADY CENTRALIZED (EXCELLENT)

### 1.1 Line Rendering -  CENTRALIZED

**šµ½ÄÁ¹ºÌ Module**: `rendering/entities/shared/line-rendering-utils.ts`

**Exported Functions**:
```typescript
/**
 *  CENTRALIZED: Split line ¼µ gap ³¹± text
 */
export function renderSplitLineWithGap(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize = 40
): void

/**
 *  CENTRALIZED: Continuous line
 */
export function renderContinuousLine(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D
): void

/**
 *  CENTRALIZED: Line ¼µ text-aware rendering
 */
export function renderLineWithTextCheck(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize = 40
): void
```

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ**:
- `LineRenderer.ts` 
- `CircleRenderer.ts` (³¹± radius/diameter lines) 
- `RectangleRenderer.ts` (³¹± split edges) 
- Œ»± Ä± entity renderers 

**Status**:  **PERFECT** - Zero duplication!

---

### 1.2 Geometry Utilities -  CENTRALIZED

**šµ½ÄÁ¹ºÌ Module**: `rendering/entities/shared/geometry-rendering-utils.ts`

**Exported Functions**:
```typescript
/**
 *  CENTRALIZED: Distance calculation
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number

/**
 *  CENTRALIZED: Midpoint calculation
 */
export function calculateMidpoint(point1: Point2D, point2: Point2D): Point2D

/**
 *  CENTRALIZED: Angle calculation
 */
export function calculateAngle(from: Point2D, to: Point2D): number

/**
 *  CENTRALIZED: Rotate point
 */
export function rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D

/**
 *  CENTRALIZED: Draw vertices path (for polylines, rectangles)
 */
export function drawVerticesPath(
  ctx: CanvasRenderingContext2D,
  screenVertices: Point2D[],
  closed: boolean
): void
```

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ**:
- Œ»± Ä± entity renderers 
- Snap engines 
- Hit testing 
- Grips system 
- Drawing hooks 

**Status**:  **PERFECT** - Single source of truth!

---

### 1.3 Circle Rendering -  CENTRALIZED (Phase-based)

**Implementation**: `CircleRenderer.ts` ¼µ universal 3-phase system

**Phases**:
1. **Geometry Phase**: Draw circle + radius/diameter line
2. **Measurements Phase**: Area, circumference, labels
3. **Dots Phase**: Endpoint indicators (deprecated)

**Modes Supported**:
-  Radius mode (center + cursor)
-  Diameter mode (2 points horizontal)
-  Two-point diameter mode (custom diameter line)

**šµ½ÄÁ¹º¿À¿¹·¼­½· ›¿³¹º®**:
```typescript
// CircleRenderer.ts - renderCircleGeometry()
if (isTwoPointDiameter || isDiameterMode) {
  //  §Á®Ã· ºµ½ÄÁ¹º¿À¿¹·¼­½·Â split line
  renderLineWithTextCheck(this.ctx, leftPoint, rightPoint);
} else {
  //  §Á®Ã· ºµ½ÄÁ¹º¿À¿¹·¼­½·Â split line ³¹± radius
  renderLineWithTextCheck(this.ctx, screenCenter, radiusEndPoint);
}
```

**Status**:  **EXCELLENT** - Œ»µÂ ¿¹ circle variants ÇÁ·Ã¹¼¿À¿¹¿Í½ centralized logic!

---

### 1.4 Rectangle Rendering -  CENTRALIZED

**Implementation**: `RectangleRenderer.ts` ¼µ 3-phase rendering

**šµ½ÄÁ¹º¿À¿¹·¼­½· ›¿³¹º®**:
```typescript
// RectangleRenderer.ts - renderRectangleGeometry()
if (this.shouldRenderSplitLine(entity, options)) {
  //  §Á®Ã· ºµ½ÄÁ¹º¿À¿¹·¼­½·Â split line ³¹± º¬¸µ À»µÅÁ¬
  for (let i = 0; i < screenVertices.length; i++) {
    const start = screenVertices[i];
    const end = screenVertices[(i + 1) % screenVertices.length];
    this.renderSplitLineWithGap(start, end, entity, options);
  }
} else {
  //  §Á®Ã· ºµ½ÄÁ¹º¿À¿¹·¼­½·Â drawVerticesPath
  drawVerticesPath(this.ctx, screenVertices, true);
  this.ctx.stroke();
}
```

**Status**:  **EXCELLENT** - Zero duplicate rectangle drawing code!

---

## =à š‘¤—“Ÿ¡™‘ 2: HOVER RENDERING DUPLICATES (HIGH PRIORITY)

### 2.1 Duplicate: Circle Hover vs Circle Preview

** ÁÌ²»·¼±**: Hover rendering ³¹± circles **duplicate** Ä·½ preview logic

#### Implementation #1: `CircleRenderer.ts` - Preview Logic (lines 166-286)
**Purpose**: Preview rendering during circle creation
**Code**: 120+ ³Á±¼¼­Â ³¹± radius/diameter modes, measurements, labels

```typescript
// CircleRenderer.ts - renderPreviewCircleWithMeasurements()
private renderPreviewCircleWithMeasurements(center: Point2D, radius: number, entity: EntityModel): void {
  // Draw circle
  ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);

  // Diameter mode logic
  if (isTwoPointDiameter) {
    renderContinuousLine(this.ctx, screenLeft, screenRight);
    // ... diameter label ...
  } else if (isDiameterMode) {
    renderContinuousLine(this.ctx, screenLeft, screenRight);
    // ... diameter label ...
  } else {
    // Radius mode ¼µ split line + label
    // ... radius rendering logic ...
  }

  // Area + circumference
  renderCircleAreaText(this.ctx, screenCenter, screenRadius, area, circumference);
}
```

#### Implementation #2: `utils/hover/shape-renderers.ts` - Hover Logic (lines 16-126)
**Purpose**: Hover rendering ³¹± selected circles
**Code**: 110+ ³Á±¼¼­Â **DUPLICATE** Ä·Â preview logic!

```typescript
// shape-renderers.ts - renderCircleHover()
export function renderCircleHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  //   DUPLICATE: Same circle drawing
  ctx.arc(screenCenterTransformed.x, screenCenterTransformed.y, screenRadiusTransformed, 0, Math.PI * 2);

  //   DUPLICATE: Same diameter mode logic
  if (isTwoPointDiameter || isDiameterMode) {
    ctx.moveTo(screenLeft.x, screenLeft.y);
    ctx.lineTo(screenRight.x, screenRight.y);
    // ... DUPLICATE diameter label ...
  } else {
    //   DUPLICATE: Same radius mode ¼µ split line
    // ... DUPLICATE radius rendering ...
  }

  //   DUPLICATE: Same area + circumference
  renderMeasurementLabel(ctx, ..., `•¼²±´Ì½: ${area.toFixed(2)}`, ...);
  renderMeasurementLabel(ctx, ..., ` µÁ¹Æ­Áµ¹±: ${circumference.toFixed(2)}`, ...);
}
```

### =% š¡™£™œŸ  ¡Ÿ’›—œ‘:

**110+ ³Á±¼¼­Â duplicate code** ³¹± circle rendering!

| Aspect | CircleRenderer (Preview) | shape-renderers.ts (Hover) |
|--------|-------------------------|----------------------------|
| **Purpose** | Preview during creation | Hover highlight |
| **Code Lines** | ~120 | ~110 |
| **Duplication** | L YES | L YES |
| **Styling** | Blue dashed (preview) | White dashed/solid (hover) |
| **Logic** | Radius/diameter modes |   **DUPLICATE** modes |
| **Measurements** | Area, circumference, labels |   **DUPLICATE** measurements |

**•À¯ÀÄÉÃ·**:
- **~110 ³Á±¼¼­Â duplicate code**
- **Maintenance burden**: Bugs ÀÁ­Àµ¹ ½± fix-±Á¿Å½ Ãµ 2 ¼­Á·
- **Inconsistency risk**: Logic changes Ãµ ­½± ¼­Á¿Â, ÌÇ¹ ÃÄ¿ ¬»»¿
- **Code bloat**: Unnecessary duplication

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =à HIGH

** Á¿Äµ¹½Ì¼µ½· ›ÍÃ·**:
1. **Extract** º¿¹½® rendering logic Ãµ shared utility
2. **Create** `renderCircleWithModes()` function À¿Å accept styling parameters
3. **Refactor** º±¹ Ä± ´Í¿ ½± ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä¿ shared utility

**Refactored Structure**:
```typescript
// New file: rendering/entities/shared/circle-rendering-utils.ts

export interface CircleRenderOptions {
  center: Point2D;
  radius: number;
  mode: 'radius' | 'diameter' | 'twoPointDiameter';
  style: {
    strokeStyle: string;
    lineWidth: number;
    lineDash: number[];
  };
  showMeasurements: boolean;
  measurementColor: string;
}

/**
 *  CENTRALIZED: Universal circle rendering ¼µ Ì»± Ä± modes
 */
export function renderCircleWithModes(
  ctx: CanvasRenderingContext2D,
  options: CircleRenderOptions,
  worldToScreen: (p: Point2D) => Point2D
): void {
  const { center, radius, mode, style, showMeasurements, measurementColor } = options;

  // Apply style
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.lineDash);

  // Draw circle
  const screenCenter = worldToScreen(center);
  const screenRadius = radius * getCurrentScale(); // Helper function
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw radius/diameter line based on mode
  if (mode === 'twoPointDiameter' || mode === 'diameter') {
    const { leftPoint, rightPoint } = calculateDiameterPoints(center, radius);
    const screenLeft = worldToScreen(leftPoint);
    const screenRight = worldToScreen(rightPoint);
    renderContinuousLine(ctx, screenLeft, screenRight);

    if (showMeasurements) {
      const diameter = radius * 2;
      const label = mode === 'twoPointDiameter'
        ? `”¹¬¼µÄÁ¿Â: ${diameter.toFixed(2)} (2P)`
        : `D: ${diameter.toFixed(2)}`;
      renderMeasurementLabel(ctx, screenCenter.x, screenCenter.y - 25, label, measurementColor);
    }
  } else {
    // Radius mode
    const radiusEndPoint = { x: center.x + radius, y: center.y };
    const screenRadiusEnd = worldToScreen(radiusEndPoint);

    // Split line ¼µ gap ³¹± label
    const textGap = 30;
    const { gapStart, gapEnd } = calculateLineGap(screenCenter, screenRadiusEnd, textGap);

    ctx.beginPath();
    ctx.moveTo(screenCenter.x, screenCenter.y);
    ctx.lineTo(gapStart.x, gapStart.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gapEnd.x, gapEnd.y);
    ctx.lineTo(screenRadiusEnd.x, screenRadiusEnd.y);
    ctx.stroke();

    if (showMeasurements) {
      const label = `R: ${radius.toFixed(2)}`;
      renderMeasurementLabel(ctx, (gapStart.x + gapEnd.x) / 2, screenCenter.y, label, measurementColor);
    }
  }

  // Area and circumference
  if (showMeasurements) {
    const area = Math.PI * radius * radius;
    const circumference = 2 * Math.PI * radius;
    renderCircleAreaText(ctx, screenCenter, screenRadius, area, circumference, measurementColor);
  }
}
```

**Refactored Usage**:
```typescript
// CircleRenderer.ts - Preview
renderCircleWithModes(this.ctx, {
  center,
  radius,
  mode: isDiameterMode ? 'diameter' : (isTwoPointDiameter ? 'twoPointDiameter' : 'radius'),
  style: {
    strokeStyle: '#0099ff', // Blue for preview
    lineWidth: 2,
    lineDash: [5, 5]
  },
  showMeasurements: true,
  measurementColor: '#00ff00'
}, this.worldToScreen);

// shape-renderers.ts - Hover
renderCircleWithModes(ctx, {
  center,
  radius,
  mode: isDiameterMode ? 'diameter' : (isTwoPointDiameter ? 'twoPointDiameter' : 'radius'),
  style: {
    strokeStyle: options.hovered ? '#FFFFFF' : '#FFFFFF',
    lineWidth: options.hovered ? 2 : 1,
    lineDash: options.hovered ? [5, 5] : []
  },
  showMeasurements: true,
  measurementColor: UI_COLORS.MEASUREMENT_TEXT
}, worldToScreen);
```

**Expected Result**:
-  **~110 ³Á±¼¼­Â reduction** (single implementation)
-  **Consistent behavior** between preview º±¹ hover
-  **Easier maintenance**: Bug fixes Ãµ ­½± ¼­Á¿Â
-  **Reusable**: œÀ¿Áµ¯ ½± ÇÁ·Ã¹¼¿À¿¹·¸µ¯ º±¹ ±ÀÌ ¬»»± modules

---

### 2.2 Duplicate: Rectangle Hover vs Rectangle Preview

** ±ÁÌ¼¿¹± º±Ä¬ÃÄ±Ã·** ¼µ circles - hover rendering duplicates preview logic

**Current Status**:   Temporarily disabled ³¹± testing
```typescript
// shape-renderers.ts - renderRectangleHover()
export function renderRectangleHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  return; //    ¡Ÿ£©¡™‘ ‘ ••¡“Ÿ Ÿ™—œ•Ÿ “™‘ TESTING º¯ÄÁ¹½É½ grips

  // L DUPLICATE: Same polyline hover logic
  renderPolylineHover({ entity, ctx, worldToScreen });
}
```

**£ÍÃÄ±Ã·**:  ±ÁÌ¼¿¹± »ÍÃ· ¼µ circles - extract shared utility ³¹± rectangle rendering

---

## =á š‘¤—“Ÿ¡™‘ 3: MINOR UTILITY DUPLICATES (MEDIUM PRIORITY)

### 3.1 Canvas Arc Wrapper

**Observation**: Multiple direct calls to `ctx.arc()` across renderers

**Locations**:
- `CircleRenderer.ts`: 4 occurrences
- `SnapRenderer.ts`: 4 occurrences
- `GridRenderer.ts`: 1 occurrence
- `CursorRenderer.ts`: 1 occurrence
- `BaseEntityRenderer.ts`: 2 occurrences

**Analysis**:
- **Not critical**: Direct canvas API calls µ¯½±¹ OK
- **No complex logic**: Simple `ctx.arc()` wrapper ´µ½ ÀÁ¿Ã¸­Äµ¹ value
- **Performance**: Wrapper function call overhead

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =á MEDIUM (low priority)

**Action**: Keep direct `ctx.arc()` calls - wrapper ´µ½ ÀÁ¿ÃÆ­Áµ¹ benefit

---

### 3.2 FillRect/StrokeRect Calls

**Observation**: Multiple direct calls to `ctx.fillRect()` / `ctx.strokeRect()`

**Locations**:
- `CanvasUtils.ts`: 1 occurrence
- `UIRendererComposite.ts`: 1 occurrence

**Analysis**:
- **Very few occurrences**: œÌ½¿ 2 locations
- **Simple operations**: ”µ½ ÇÁµ¹¬¶µÄ±¹ abstraction
- **Domain-specific**: š¬¸µ usage ­Çµ¹ ´¹±Æ¿ÁµÄ¹ºÌ context

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =â LOW (no action needed)

**Reason**: Too few occurrences, domain-specific usage

---

### 3.3 BeginPath/Stroke Patterns

**Observation**: Standard canvas pattern: `beginPath() ’ moveTo/lineTo ’ stroke()`

**Occurrences**: 71 ±ÁÇµ¯± ¼µ rendering methods

**Analysis**:
- **Standard pattern**: ‘ÅÄÌ µ¯½±¹ Ä¿ º±½¿½¹ºÌ Canvas API workflow
- **Cannot abstract**: š¬¸µ rendering operation ­Çµ¹ ´¹±Æ¿ÁµÄ¹º® geometry
- **Already optimized**: Centralized utilities (renderContinuousLine, renderSplitLineWithGap) exist

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =â LOW (no action needed)

**Reason**: Standard Canvas API usage - abstraction ´µ½ ­Çµ¹ ½Ì·¼±

---

## =â š‘¤—“Ÿ¡™‘ 4: ACCEPTABLE DOMAIN-SPECIFIC RENDERING (LOW PRIORITY)

### 4.1 Entity-Specific Renderers

**Observation**: š¬¸µ entity ­Çµ¹ Ä¿ ´¹ºÌ Ä¿Å renderer

**Renderers**:
- `LineRenderer.ts` - Line entities
- `CircleRenderer.ts` - Circle entities
- `RectangleRenderer.ts` - Rectangle entities
- `EllipseRenderer.ts` - Ellipse entities
- `ArcRenderer.ts` - Arc entities
- `PolylineRenderer.ts` - Polyline entities
- `SplineRenderer.ts` - Spline entities
- `TextRenderer.ts` - Text entities
- `PointRenderer.ts` - Point entities
- `AngleMeasurementRenderer.ts` - Angle measurements

**Analysis**:
- **Domain separation**: š¬¸µ renderer handle ´¹±Æ¿ÁµÄ¹ºÌ entity type
- **Good architecture**: Single Responsibility Principle
- **RendererRegistry**: Centralized lookup system
- **BaseEntityRenderer**: Shared base class ¼µ common functionality

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =â LOW (no action needed)

**Reason**: This is **good modular design**, ÌÇ¹ harmful duplication!

**Best Practice**: šÁ±Ä®ÃÄµ Ä¿ÅÂ separate renderers - º±»ÍÄµÁ· cohesion º±¹ maintainability

---

### 4.2 UI Element Renderers

**Observation**: UI elements ­Ç¿Å½ ´¹º¿ÍÂ Ä¿ÅÂ renderers

**Renderers**:
- `CrosshairRenderer.ts` - Crosshair overlay
- `CursorRenderer.ts` - Cursor rendering
- `SnapRenderer.ts` - Snap indicators
- `GridRenderer.ts` - Grid background
- `RulerRenderer.ts` - Ruler margins
- `OriginMarkersRenderer.ts` - Origin markers
- `SelectionRenderer.ts` - Selection box

**Analysis**:
- **UI separation**: UI elements ¾µÇÉÁ¹ÃÄ¬ ±ÀÌ entities
- **UIRendererComposite**: Centralized coordination
- **Independent rendering**: š¬¸µ UI element ­Çµ¹ ´¹ºÌ Ä¿Å rendering cycle

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =â LOW (no action needed)

**Reason**: **Excellent architecture** - UI elements properly separated from entities

---

## =Ê SUMMARY TABLE: ALL FINDINGS

| # | Category | Issue | Priority | LOC Duplicated | Impact | Action Needed |
|---|----------|-------|----------|---------------|--------|---------------|
| 1 | Line Rendering |  Centralized |  N/A | 0 |  Perfect | None |
| 2 | Geometry Utils |  Centralized |  N/A | 0 |  Perfect | None |
| 3 | Circle Rendering |  Centralized |  N/A | 0 |  Perfect | None |
| 4 | Rectangle Rendering |  Centralized |  N/A | 0 |  Perfect | None |
| 5 | Circle Hover |   Duplicates preview | =à HIGH | ~110 | Code duplication | Extract shared utility |
| 6 | Rectangle Hover |   Duplicates preview | =à HIGH | ~40 | Code duplication | Extract shared utility |
| 7 | Arc Wrappers | Minor repeats | =á MEDIUM | 0 | Low | Keep as-is |
| 8 | FillRect/StrokeRect | Few occurrences | =â LOW | 0 | None | Keep as-is |
| 9 | BeginPath/Stroke | Standard pattern | =â LOW | 0 | None | Keep as-is |
| 10 | Entity Renderers | Domain-specific | =â LOW | 0 |  Good design | Keep separate |
| 11 | UI Renderers | Domain-specific | =â LOW | 0 |  Good design | Keep separate |

**Total Duplicated LOC**: ~150 (hover rendering only)
**Critical Issues**: 0 
**High Priority Issues**: 2 (Circle Hover, Rectangle Hover)
**Already Centralized**: 4 major categories 

---

## <¯ RECOMMENDED ACTION PLAN

### Phase 1: Extract Circle Hover Utility (Week 1)
**Priority**: =à HIGH

**Task 1.1: Create Shared Circle Utility**
-  Create `rendering/entities/shared/circle-rendering-utils.ts`
-  Implement `renderCircleWithModes()` universal function
-  Support radius/diameter/twoPointDiameter modes
-  Accept styling parameters (colors, line style, measurements)

**Task 1.2: Refactor CircleRenderer**
-  Replace preview logic ¼µ shared utility
-  Pass preview styling (blue dashed)
-  Test preview rendering

**Task 1.3: Refactor Circle Hover**
-  Replace hover logic ¼µ shared utility
-  Pass hover styling (white dashed/solid)
-  Test hover rendering

**Expected Reduction**: ~110 ³Á±¼¼­Â

---

### Phase 2: Extract Rectangle Hover Utility (Week 1)
**Priority**: =à HIGH

**Task 2.1: Create Shared Rectangle Utility**
-  Create `rendering/entities/shared/rectangle-rendering-utils.ts`
-  Implement `renderRectangleWithMeasurements()` function
-  Support split lines, measurements, corner arcs

**Task 2.2: Refactor RectangleRenderer + Hover**
-  Replace duplicate logic ¼µ shared utility
-  Test both preview º±¹ hover

**Expected Reduction**: ~40 ³Á±¼¼­Â

---

### Phase 3: Documentation & Best Practices (Week 2)
**Priority**: =á MEDIUM

**Task 3.1: Document Rendering Architecture**
-  Document centralized utilities
-  Create "Rendering Best Practices" guide
-  Add JSDoc comments Ãµ shared utilities

**Task 3.2: Code Review Guidelines**
-  Checklist ³¹± new renderers
-  Lint rules ³¹± detecting duplicate rendering logic
-  Examples of proper shared utility usage

---

## =È EXPECTED RESULTS

### Code Quality Metrics:
-  **~150 ³Á±¼¼­Â reduction** (hover duplicates)
-  **2 shared utilities created** (circle, rectangle)
-  **Consistent rendering** (preview = hover styling)
-  **Zero breaking changes** (styling parameters maintain flexibility)

### š±Ä¬ÃÄ±Ã·  Á¹½ vs œµÄ¬:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Circle Rendering LOC** | 230 (120 preview + 110 hover) | 120 (shared utility) | -47% |
| **Rectangle Rendering LOC** | 80 (40 preview + 40 hover) | 40 (shared utility) | -50% |
| **Centralized Draw Methods** | 4 | 6 | +50% |
| **Duplicate Draw Code** | ~150 LOC | 0 LOC | -100%  |

### Developer Experience:
-  **Single source of truth** ³¹± circle/rectangle rendering
-  **Consistent behavior** between preview º±¹ hover
-  **Easier maintenance**: Bug fixes Ãµ ­½± ¼­Á¿Â
-  **Reusable utilities**: œÀ¿Á¿Í½ ½± ÇÁ·Ã¹¼¿À¿¹·¸¿Í½ ±ÀÌ ¬»»± modules
-  **Clear architecture**: Shared utilities documented º±¹ discoverable

---

## =Ú ARCHITECTURAL INSIGHTS

### <Æ What's Working Well:

1. **BaseEntityRenderer Class**
   -  Excellent base class ¼µ shared functionality
   -  3-phase rendering system (geometry ’ measurements ’ dots)
   -  Centralized styling methods
   -  Transform utilities (worldToScreen, screenToWorld)

2. **Shared Line Utilities**
   -  `renderSplitLineWithGap()` - Universal split line rendering
   -  `renderContinuousLine()` - Simple continuous lines
   -  `renderLineWithTextCheck()` - Text-aware rendering
   -  Used by all entity renderers 

3. **Geometry Utilities**
   -  `calculateDistance()` - Single source of truth ³¹± distance
   -  `calculateMidpoint()` - Midpoint calculation
   -  `drawVerticesPath()` - Universal polyline/polygon rendering
   -  `rotatePoint()`, `getPerpendicularDirection()` - Geometry helpers

4. **Entity Renderer Registry**
   -  Centralized lookup system
   -  Type-safe renderer selection
   -  Easy to extend ¼µ new entity types

###   What Needs Improvement:

1. **Hover Rendering**
   - L Duplicates preview logic
   - L Not using shared utilities
   - L ~150 LOC duplication
   - **Solution**: Extract shared utilities (Phase 1-2)

2. **Circle Mode Handling**
   -   Mode logic scattered (diameterMode, twoPointDiameter)
   - **Solution**: Already handled well Ãµ shared utility proposal

---

## =' TECHNICAL BEST PRACTICES

###  DO (Current Good Practices):

1. **Use Shared Utilities**
   ```typescript
   //  GOOD: Use shared utility
   renderSplitLineWithGap(ctx, start, end, gapSize);

   // L BAD: Duplicate split line logic
   const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
   ctx.beginPath();
   ctx.moveTo(start.x, start.y);
   ctx.lineTo(midpoint.x - gap, midpoint.y);
   // ... duplicate logic ...
   ```

2. **Extend BaseEntityRenderer**
   ```typescript
   //  GOOD: Inherit shared functionality
   export class MyRenderer extends BaseEntityRenderer {
     render(entity: EntityModel, options: RenderOptions): void {
       this.renderWithPhases(entity, options, ...);
     }
   }
   ```

3. **Use Transform Utilities**
   ```typescript
   //  GOOD: Use centralized transforms
   const screenPoint = this.worldToScreen(worldPoint);

   // L BAD: Manual transform calculations
   const screenX = worldPoint.x * scale + offsetX;
   const screenY = worldPoint.y * scale + offsetY;
   ```

### L DON'T (Anti-patterns to Avoid):

1. **Don't Duplicate Rendering Logic**
   ```typescript
   // L BAD: Duplicate circle rendering
   function renderMyCircle() {
     ctx.arc(...);
     // ... 50 lines of duplicate logic ...
   }

   //  GOOD: Use shared utility
   renderCircleWithModes(ctx, options, worldToScreen);
   ```

2. **Don't Create Unnecessary Wrappers**
   ```typescript
   // L BAD: Unnecessary wrapper
   function myArc(x, y, r) {
     ctx.arc(x, y, r, 0, Math.PI * 2);
   }

   //  GOOD: Direct canvas API
   ctx.arc(x, y, r, 0, Math.PI * 2);
   ```

3. **Don't Abstract Standard Patterns**
   ```typescript
   // L BAD: Over-abstraction
   function drawPath(fn) {
     ctx.beginPath();
     fn();
     ctx.stroke();
   }

   //  GOOD: Standard pattern
   ctx.beginPath();
   ctx.moveTo(...);
   ctx.lineTo(...);
   ctx.stroke();
   ```

---

##  CONCLUSION

‘ÅÄ® · ±½±Æ¿Á¬ µ½ÄÌÀ¹Ãµ º±¹ Äµº¼·Á¯ÉÃµ Ä·½ º±Ä¬ÃÄ±Ã· ÄÉ½ **draw methods** ÃÄ¿ `dxf-viewer` codebase:

### <Æ Highlights:

1.  **EXCELLENT CENTRALIZATION**: 4 major categories ®´· centralized!
   - Line rendering
   - Geometry utilities
   - Circle rendering
   - Rectangle rendering

2. =à **2 HIGH-PRIORITY ISSUES**: Hover rendering duplicates
   - Circle hover (~110 LOC)
   - Rectangle hover (~40 LOC)

3. =â **GOOD ARCHITECTURE**: Entity renderers properly separated

### =Ê Statistics:

- **Total Files Scanned**: 71
- **Canvas Rendering Methods**: 13 files ¼µ primitives
- **Duplicate LOC**: ~150 (hover only)
- **Centralized Utilities**:  4 major categories
- **Critical Issues**: **0** 

### <¯ Recommendation:

**Follow the 2-phase action plan** ³¹± consolidation Ä¿Å hover rendering.

**Timeline**: 2 weeks (1 week ³¹± hover utilities + 1 week documentation)

**Risk Level**: =â LOW (pure refactoring, zero breaking changes)

**Key Takeaway**: ¤¿ DXF Viewer project ­Çµ¹ **®´· µ¾±¹ÁµÄ¹º® ºµ½ÄÁ¹º¿À¿¯·Ã·** ÄÉ½ draw methods! œÌ½¿ Ä¿ hover rendering ÇÁµ¹¬¶µÄ±¹ minor consolidation.

---

**‘½±Æ¿Á¬ ´·¼¹¿ÅÁ³®¸·ºµ**: 2025-10-03
**Total Draw Methods Analyzed**: 70+ functions
**Critical Duplicates**: 0 
**High Priority Duplicates**: 2 (hover rendering)
**LOC Reduction Potential**: ~150 ³Á±¼¼­Â

---

*=% ‘ÅÄ® · ±½±Æ¿Á¬ ´·¼¹¿ÅÁ³®¸·ºµ ¼µ  ›—¡— ±½¬»ÅÃ· Ì»¿Å Ä¿Å dxf-viewer codebase, ÃÍ¼ÆÉ½± ¼µ Ä¹Â ¿´·³¯µÂ Ä¿Å ”•š‘›Ÿ“Ÿ¥ •¡“‘£™‘£.*

* š¥¡™Ÿ •¥¡—œ‘: ¤¿ project ­Çµ¹ —”— µ¾±¹ÁµÄ¹º® centralization architecture ³¹± draw methods!*
