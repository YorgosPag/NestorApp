# 🗺️ Coordinate Systems

> **Centralized coordinate transformations για CAD-accurate rendering**
> Y-flip behavior για AutoCAD compatibility

---

## 📋 Table of Contents

- [Overview](#overview)
- [Coordinate Spaces](#coordinate-spaces)
- [CoordinateTransforms (Core System)](#coordinatetransforms-core-system)
- [Y-Axis Behavior](#y-axis-behavior)
- [Transform Mathematics](#transform-mathematics)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Common Pitfalls](#common-pitfalls)

---

## Overview

Το **Coordinate System** χειρίζεται transformations μεταξύ διαφορετικών coordinate spaces:
- **World Space** - DXF drawing coordinates (millimeters, inches, etc)
- **Screen Space** - Canvas pixel coordinates
- **Viewport Space** - Visible area coordinates

### 🎯 Key Concepts

1. **Y-Flip** - CAD systems έχουν Y-axis προς τα πάνω, HTML canvas προς τα κάτω
2. **Transform Chain** - World → Zoom/Pan → Y-Flip → Screen
3. **Reversibility** - Όλα τα transforms είναι reversible (screen ↔ world)
4. **Centralization** - ΕΝΑ σημείο για ΟΛΑ τα coordinate calculations

---

## Coordinate Spaces

### 1. World Space (DXF Coordinates)

**Origin**: Arbitrary (0,0) στο DXF file
**Units**: User-defined (mm, inches, feet, etc)
**Y-Axis**: ↑ Up (CAD standard)

```
        Y ↑
          │
          │      • Entity at (100, 200)
          │
          └────────→ X
       (0,0)
```

### 2. Screen Space (Canvas Pixels)

**Origin**: Top-left corner (0,0)
**Units**: Pixels
**Y-Axis**: ↓ Down (HTML canvas standard)

```
    (0,0) ────────→ X
          │
          │      • Rendered at (450, 300)
          ↓
          Y
```

### 3. Transform Pipeline

```
World Point (100, 200)
    │
    ├─ Apply scale (zoom)
    │  → (100 * 1.5, 200 * 1.5) = (150, 300)
    │
    ├─ Apply offset (pan)
    │  → (150 + offsetX, 300 + offsetY) = (150 + 200, 300 + 50) = (350, 350)
    │
    └─ Apply Y-flip
       → (350, viewport.height - 350) = (350, 600 - 350) = (350, 250)

Screen Point (350, 250) ✅
```

---

## CoordinateTransforms (Core System)

### Path & Architecture

**Path**: `src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts`

**Responsibility**: ΟΛΑ τα coordinate transformations στην εφαρμογή

**Used by**: 12+ files (Entity renderers, Canvas, Selection, Cursor, Hit testing)

### A. Core Functions

#### worldToScreen

**Converts world coordinates → screen coordinates (με Y-flip)**

```typescript
export function worldToScreen(
  worldPoint: Point2D,
  transform: ViewTransform,
  viewport: Viewport
): Point2D {
  // Step 1: Apply scale
  const scaledX = worldPoint.x * transform.scale
  const scaledY = worldPoint.y * transform.scale

  // Step 2: Apply offset (pan)
  const offsetX = scaledX + transform.offsetX
  const offsetY = scaledY + transform.offsetY

  // Step 3: Apply Y-flip (CAD → Canvas)
  const screenX = offsetX
  const screenY = viewport.height - offsetY  // Y-flip here!

  return { x: screenX, y: screenY }
}
```

**Parameters**:
- `worldPoint` - Point σε world coordinates
- `transform` - Current zoom/pan transform
- `viewport` - Canvas dimensions (width, height)

**Returns**: Point σε screen coordinates (pixels)

#### screenToWorld

**Converts screen coordinates → world coordinates (reverse Y-flip)**

```typescript
export function screenToWorld(
  screenPoint: Point2D,
  transform: ViewTransform,
  viewport: Viewport
): Point2D {
  // Step 1: Reverse Y-flip (Canvas → CAD)
  const offsetX = screenPoint.x
  const offsetY = viewport.height - screenPoint.y  // Reverse Y-flip

  // Step 2: Remove offset (reverse pan)
  const scaledX = offsetX - transform.offsetX
  const scaledY = offsetY - transform.offsetY

  // Step 3: Remove scale (reverse zoom)
  const worldX = scaledX / transform.scale
  const worldY = scaledY / transform.scale

  return { x: worldX, y: worldY }
}
```

**Parameters**:
- `screenPoint` - Point σε screen coordinates (pixels)
- `transform` - Current zoom/pan transform
- `viewport` - Canvas dimensions

**Returns**: Point σε world coordinates (DXF units)

### B. Transform Calculations

#### calculateZoomTransform

**Calculates new transform για zoom operation (cursor-centered)**

```typescript
export function calculateZoomTransform(
  currentTransform: ViewTransform,
  newScale: number,
  zoomCenter: Point2D,  // Screen coordinates του cursor
  viewport: Viewport
): ViewTransform {
  // Convert zoom center to world coordinates (με current transform)
  const worldCenter = screenToWorld(zoomCenter, currentTransform, viewport)

  // Calculate new offsets που κρατούν το world point στο ίδιο screen position
  const newOffsetX = zoomCenter.x - worldCenter.x * newScale
  const newOffsetY = zoomCenter.y - worldCenter.y * newScale

  return {
    scale: newScale,
    offsetX: newOffsetX,
    offsetY: newOffsetY
  }
}
```

**Why cursor-centered?**
- ✅ Zoom στο σημείο που κοιτάς (intuitive UX)
- ✅ Standard σε AutoCAD, Figma, Blender
- ❌ Center-based zoom είναι confusing (object moves away από cursor)

#### calculatePanTransform

**Calculates new transform για pan operation**

```typescript
export function calculatePanTransform(
  currentTransform: ViewTransform,
  deltaPan: Point2D  // Screen-space pan delta
): ViewTransform {
  return {
    scale: currentTransform.scale,
    offsetX: currentTransform.offsetX + deltaPan.x,
    offsetY: currentTransform.offsetY + deltaPan.y
  }
}
```

---

## Y-Axis Behavior

### Why Y-Flip?

**CAD Systems** (AutoCAD, DXF format):
- Y-axis points **UP** ↑
- Origin typically at bottom-left
- Positive Y = higher elevation

**HTML Canvas**:
- Y-axis points **DOWN** ↓
- Origin at top-left
- Positive Y = lower on screen

**Without Y-flip**: Drawing θα εμφανιζόταν ανάποδα (mirrored vertically)

### Visual Example

**DXF File** (World Space):
```
    100 ↑ Y
        │
        │    ┌─────┐
        │    │  A  │  Rectangle at (50, 50) to (150, 100)
     50 │    └─────┘
        │
        └──────────→ X
        0   50    150
```

**Canvas Rendering** (με Y-flip):
```
    0 ──────────→ X
      │   50    150
      │
   50 │    ┌─────┐
      │    │  A  │  Rectangle rendered correctly
  100 ↓    └─────┘
      Y
```

**Without Y-flip** (WRONG):
```
    0 ──────────→ X
      │   50    150
      │
   50 │    └─────┘
      │    │  A  │  Rectangle upside down!
  100 ↓    ┌─────┐
      Y
```

### Implementation Detail

Y-flip happens **ONCE** στο `worldToScreen()`:

```typescript
// In worldToScreen()
const screenY = viewport.height - offsetY  // Y-flip

// In screenToWorld()
const offsetY = viewport.height - screenPoint.y  // Reverse Y-flip
```

**NOT** in entity renderers - αυτοί χρησιμοποιούν `worldToScreen()` που ήδη κάνει flip.

---

## Transform Mathematics

### ViewTransform Structure

```typescript
interface ViewTransform {
  scale: number      // Zoom level (1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
  offsetX: number    // Pan offset X (screen pixels)
  offsetY: number    // Pan offset Y (screen pixels)
}
```

### Transform Matrix (Conceptual)

```
┌                          ┐
│ scale    0      offsetX  │
│   0    scale   offsetY   │  (before Y-flip)
│   0      0        1      │
└                          ┘

Homogeneous coordinates:
[x', y', 1] = [x, y, 1] × TransformMatrix

x' = x * scale + offsetX
y' = y * scale + offsetY
```

Then Y-flip: `y_screen = viewport.height - y'`

### Zoom Centered on Point

**Goal**: Zoom από scale S1 → S2, κρατώντας το world point P στο ίδιο screen position

**Given**:
- Current transform: `{ scale: S1, offsetX: O1x, offsetY: O1y }`
- Zoom center (screen): `C_screen = (Cx, Cy)`
- New scale: `S2`

**Calculate**:
```typescript
// 1. World coordinates του zoom center (με current transform)
const P_world = screenToWorld(C_screen, currentTransform, viewport)
//   P_world.x = (Cx - O1x) / S1
//   P_world.y = (viewport.height - Cy - O1y) / S1

// 2. New offsets που κρατούν P_world στο C_screen
const O2x = Cx - P_world.x * S2
const O2y = Cy - P_world.y * S2

// 3. New transform
const newTransform = { scale: S2, offsetX: O2x, offsetY: O2y }
```

**Verification**:
```typescript
const C_after = worldToScreen(P_world, newTransform, viewport)
// C_after.x === Cx  ✅
// C_after.y === Cy  ✅
```

---

## API Reference

### Core Functions

```typescript
// World ↔ Screen conversions
function worldToScreen(worldPoint: Point2D, transform: ViewTransform, viewport: Viewport): Point2D
function screenToWorld(screenPoint: Point2D, transform: ViewTransform, viewport: Viewport): Point2D

// Transform calculations
function calculateZoomTransform(
  currentTransform: ViewTransform,
  newScale: number,
  zoomCenter: Point2D,
  viewport: Viewport
): ViewTransform

function calculatePanTransform(
  currentTransform: ViewTransform,
  deltaPan: Point2D
): ViewTransform

// Bounds transformations
function worldBoundsToScreen(bounds: Bounds, transform: ViewTransform, viewport: Viewport): Bounds
function screenBoundsToWorld(bounds: Bounds, transform: ViewTransform, viewport: Viewport): Bounds

// Distance transformations
function worldDistanceToScreen(distance: number, scale: number): number
function screenDistanceToWorld(distance: number, scale: number): number
```

### Types

```typescript
interface Point2D {
  x: number
  y: number
}

interface ViewTransform {
  scale: number      // Zoom level
  offsetX: number    // Pan X
  offsetY: number    // Pan Y
}

interface Viewport {
  width: number      // Canvas width (pixels)
  height: number     // Canvas height (pixels)
}

interface Bounds {
  min: Point2D       // Bottom-left corner (world space)
  max: Point2D       // Top-right corner (world space)
}
```

---

## Usage Examples

### Basic Conversion

```typescript
import { worldToScreen, screenToWorld } from '../rendering/core/CoordinateTransforms'

const transform = { scale: 1.5, offsetX: 100, offsetY: 50 }
const viewport = { width: 800, height: 600 }

// World → Screen
const worldPoint = { x: 200, y: 300 }
const screenPoint = worldToScreen(worldPoint, transform, viewport)
console.log(screenPoint)  // { x: 400, y: 100 } (example)

// Screen → World (reversible)
const backToWorld = screenToWorld(screenPoint, transform, viewport)
console.log(backToWorld)  // { x: 200, y: 300 } ✅ Same as input
```

### Entity Rendering

```typescript
class LineRenderer {
  render(ctx: CanvasRenderingContext2D, entity: LineEntity, renderContext: IRenderContext) {
    const { start, end } = entity.vertices  // World coordinates

    // Convert to screen coordinates
    const startScreen = worldToScreen(start, renderContext.transform, renderContext.viewport)
    const endScreen = worldToScreen(end, renderContext.transform, renderContext.viewport)

    // Draw on canvas (screen coordinates)
    ctx.beginPath()
    ctx.moveTo(startScreen.x, startScreen.y)
    ctx.lineTo(endScreen.x, endScreen.y)
    ctx.stroke()
  }
}
```

### Mouse Event Handling

```typescript
function handleCanvasClick(e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()

  // Screen coordinates (relative to canvas)
  const screenPoint = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }

  // Convert to world coordinates
  const worldPoint = screenToWorld(screenPoint, currentTransform, viewport)

  console.log(`Clicked at world position: (${worldPoint.x}, ${worldPoint.y})`)

  // Hit test entities σε world coordinates
  const hitEntity = findEntityAt(worldPoint, entities)
}
```

### Cursor-Centered Zoom

```typescript
function handleWheelZoom(e: WheelEvent) {
  const rect = canvas.getBoundingClientRect()
  const zoomCenter = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = currentTransform.scale * zoomFactor

  // Calculate new transform που κρατάει το cursor position fixed
  const newTransform = calculateZoomTransform(
    currentTransform,
    newScale,
    zoomCenter,
    viewport
  )

  setTransform(newTransform)
}
```

### Panning

```typescript
function handlePan(deltaX: number, deltaY: number) {
  const newTransform = calculatePanTransform(
    currentTransform,
    { x: deltaX, y: deltaY }
  )

  setTransform(newTransform)
}
```

---

## Common Pitfalls

### ❌ Pitfall 1: Forgetting Y-Flip

```typescript
// ❌ WRONG - Direct coordinate use
ctx.moveTo(entity.start.x, entity.start.y)  // Will be upside down!

// ✅ CORRECT - Use worldToScreen
const screenStart = worldToScreen(entity.start, transform, viewport)
ctx.moveTo(screenStart.x, screenStart.y)
```

### ❌ Pitfall 2: Double Y-Flip

```typescript
// ❌ WRONG - Y-flip twice
const screenPoint = worldToScreen(worldPoint, transform, viewport)  // Already flipped
const y = viewport.height - screenPoint.y  // Flipped again = WRONG!

// ✅ CORRECT - worldToScreen already did Y-flip
const screenPoint = worldToScreen(worldPoint, transform, viewport)
ctx.lineTo(screenPoint.x, screenPoint.y)  // Use as-is
```

### ❌ Pitfall 3: Wrong Viewport

```typescript
// ❌ WRONG - Using window size instead of canvas size
const viewport = { width: window.innerWidth, height: window.innerHeight }

// ✅ CORRECT - Use canvas dimensions
const viewport = { width: canvas.width, height: canvas.height }
```

### ❌ Pitfall 4: Mixing Coordinate Spaces

```typescript
// ❌ WRONG - Comparing world distance με screen distance
if (worldDistance < 5) { /* hit detected */ }  // What units is 5?

// ✅ CORRECT - Convert to same space first
const screenDistance = worldDistanceToScreen(worldDistance, transform.scale)
if (screenDistance < 5) { /* 5 pixels tolerance */ }
```

### ❌ Pitfall 5: Not Passing Viewport

```typescript
// ❌ WRONG - Missing viewport parameter
const screenPoint = worldToScreen(worldPoint, transform)  // Y-flip won't work!

// ✅ CORRECT - Always pass viewport
const screenPoint = worldToScreen(worldPoint, transform, viewport)
```

---

## Performance Considerations

### 1. Inline Calculations

Για hot paths (πχ rendering 1000s entities), inline math είναι ταχύτερο από function calls:

```typescript
// ✅ HOT PATH - Inline calculation
entities.forEach(entity => {
  const screenX = entity.x * transform.scale + transform.offsetX
  const screenY = viewport.height - (entity.y * transform.scale + transform.offsetY)
  ctx.lineTo(screenX, screenY)
})

// ❌ SLOWER - Function call overhead
entities.forEach(entity => {
  const screen = worldToScreen({ x: entity.x, y: entity.y }, transform, viewport)
  ctx.lineTo(screen.x, screen.y)
})
```

### 2. Object Pooling

Αποφυγή allocation νέων Point2D objects:

```typescript
// Reusable point object
const tempPoint = { x: 0, y: 0 }

function worldToScreenInPlace(worldPoint: Point2D, transform: ViewTransform, viewport: Viewport) {
  tempPoint.x = worldPoint.x * transform.scale + transform.offsetX
  tempPoint.y = viewport.height - (worldPoint.y * transform.scale + transform.offsetY)
  return tempPoint
}
```

### 3. Pre-calculate Scale Inverse

```typescript
// ✅ GOOD - Pre-calculate για batch operations
const scaleInv = 1 / transform.scale

screenPoints.forEach(sp => {
  const worldX = (sp.x - transform.offsetX) * scaleInv
  const worldY = (viewport.height - sp.y - transform.offsetY) * scaleInv
  // ...
})
```

---

## Related Documentation

- [Architecture Overview](./overview.md)
- [Entity Management](./entity-management.md)
- [Zoom & Pan System](../systems/zoom-pan.md)
- [Rendering Pipeline](./rendering-pipeline.md)

---

**🗺️ Centralized Coordinate System**
*CAD-Accurate • Y-Flip Aware • Reversible*

Last Updated: 2025-10-03
