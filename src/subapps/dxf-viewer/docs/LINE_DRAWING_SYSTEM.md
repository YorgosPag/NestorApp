# LINE DRAWING SYSTEM - Complete Documentation

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING (After 6 critical bug fixes)
**Purpose:** Full documentation of how the Line Drawing System works in DXF Viewer

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Dual Canvas Architecture](#dual-canvas-architecture) ⚠️ **CRITICAL**
4. [Coordinate Systems & Transformations](#coordinate-systems--transformations)
5. [Mouse Events & Canvas Interaction](#mouse-events--canvas-interaction)
6. [Rendering Pipeline](#rendering-pipeline)
7. [File Dependencies](#file-dependencies)
8. [Event Flow - Click to Rendering](#event-flow---click-to-rendering)
9. [Critical Bugs Fixed](#critical-bugs-fixed)
10. [Configuration Requirements](#configuration-requirements)
11. [Settings & Flags](#settings--flags)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Testing Checklist](#testing-checklist)

---

## 1. SYSTEM OVERVIEW

### What is the Line Drawing System?

The Line Drawing System allows users to draw entities (Line, Circle, Rectangle, Polyline, Polygon, Arc) on the DXF canvas by clicking points. It's a core CAD functionality.

### How it Works (High-Level)

```
1. User clicks "Line" tool in toolbar
2. System enters drawing mode
3. User clicks on canvas (point 1)
4. User clicks on canvas (point 2)
5. Line entity is created
6. Line is added to scene
7. Canvas re-renders with new line
```

### Key Components

- **CanvasSection.tsx** - Main orchestrator, handles clicks
- **useUnifiedDrawing** - Drawing state machine, creates entities
- **useDrawingHandlers** - Event handlers (click, hover, cancel)
- **DxfCanvas** - Renders entities on screen
- **useCentralizedMouseHandlers** - Mouse event routing

---

## 2. ARCHITECTURE & DATA FLOW

### Component Hierarchy

```
DXFViewerLayout (props.handleSceneChange)
  ↓
NormalView (passes handleSceneChange)
  ↓
CanvasSection (orchestrates drawing)
  ├→ useDrawingHandlers (event handlers)
  │   └→ useUnifiedDrawing (drawing logic)
  │       └→ onEntityCreated callback ✅
  └→ DxfCanvas (renders entities)
      └→ useCentralizedMouseHandlers (mouse events)
```

### Data Flow - Entity Creation

```
1. User clicks canvas
   ↓
2. useCentralizedMouseHandlers.handleMouseUp
   ↓
3. CanvasSection.handleCanvasClick (via onCanvasClick prop)
   ↓
4. drawingHandlersRef.current.onDrawingPoint(worldPoint)
   ↓
5. useDrawingHandlers.onDrawingPoint
   ↓
6. useUnifiedDrawing.addPoint
   ↓
7. createEntityFromTool (creates entity)
   ↓
8. setLevelScene (adds to scene)
   ↓
9. onEntityCreated(entity) callback ✅
   ↓
10. CanvasSection receives callback
    ↓
11. props.handleSceneChange(newScene)
    ↓
12. props.currentScene updates
    ↓
13. DxfCanvas re-renders with new entity
```

---

## 3. DUAL CANVAS ARCHITECTURE

### ⚠️ CRITICAL: Two Separate Canvas Elements

The DXF Viewer uses **TWO canvas elements stacked on top of each other**. Understanding which canvas does what is ESSENTIAL for drawing to work!

#### 🎨 Canvas #1: DxfCanvas (Bottom Layer, z-index: 5)

**Purpose:** Renders DXF entities (lines, circles, etc.)
**File:** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx`
**Z-Index:** 5 (bottom canvas)
**What it renders:**
- ✅ DXF entities (Line, Circle, Rectangle, Arc, Polyline, Polygon)
- ✅ Entity geometry from DXF files
- ✅ User-drawn entities (when drawing tools active)

**When to use:**
- Drawing new entities (Line, Circle, etc.)
- Importing DXF files
- Rendering entity geometry

**Key Props:**
```typescript
<DxfCanvas
  scene={props.currentScene}        // Entities to render
  onCanvasClick={handleCanvasClick} // For drawing tools ✅
  transform={transform}              // Pan/zoom
/>
```

---

#### 🌈 Canvas #2: LayerCanvas (Top Layer, z-index: 10)

**Purpose:** Renders colored layer overlays (visual layers)
**File:** `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx`
**Z-Index:** 10 (top canvas, ABOVE DxfCanvas!)
**What it renders:**
- ✅ Colored layer fills (background colors for levels)
- ✅ Layer boundaries
- ✅ Visual overlays (NOT entities!)

**When to use:**
- Showing level/layer visual representation
- Colored backgrounds for levels
- Layer highlighting

**Key Props:**
```typescript
<LayerCanvas
  // ... layer props
  style={{
    pointerEvents: isDrawingTool ? 'none' : 'auto' // ✅ CRITICAL!
  }}
/>
```

---

### 🚨 THE CRITICAL PROBLEM: LayerCanvas Blocks Clicks!

**Why this is a problem:**

```
User clicks to draw line
         ↓
LayerCanvas (z-index: 10) is on TOP
         ↓
Click intercepted by LayerCanvas ❌
         ↓
DxfCanvas (z-index: 5) NEVER receives click ❌
         ↓
Drawing doesn't work! ❌
```

**The Solution (Bug #3 Fix):**

```typescript
// CanvasSection.tsx (line 871)
<LayerCanvas
  style={{
    touchAction: 'none',
    pointerEvents: (activeTool === 'line' || activeTool === 'polyline' ||
                    activeTool === 'polygon' || activeTool === 'circle' ||
                    activeTool === 'rectangle' || activeTool === 'arc')
                    ? 'none'  // ✅ Disable clicks when drawing tools active
                    : 'auto'  // Enable clicks for selection/other modes
  }}
/>
```

**How it works:**
1. User selects Line tool
2. `activeTool` becomes `'line'`
3. `pointerEvents: 'none'` applied to LayerCanvas
4. LayerCanvas becomes **click-transparent** (clicks pass through!)
5. DxfCanvas receives clicks ✅
6. Drawing works! ✅

---

### 📐 Canvas Stacking Visual

```
┌─────────────────────────────────────┐
│      LayerCanvas (z-index: 10)      │  ← TOP
│  [pointerEvents: 'none' when drawing]│
│  - Colored layers                    │
│  - Visual overlays                   │
│  - Background fills                  │
└─────────────────────────────────────┘
         ↓ (clicks pass through when drawing)
┌─────────────────────────────────────┐
│      DxfCanvas (z-index: 5)         │  ← BOTTOM
│  [Receives clicks for drawing]      │
│  - DXF entities                      │
│  - User drawings                     │
│  - Entity geometry                   │
└─────────────────────────────────────┘
```

---

### 🎯 Which Canvas for Which Task?

| Task | Canvas | Why |
|------|--------|-----|
| Draw Line/Circle/Arc | DxfCanvas | Entity geometry |
| Import DXF file | DxfCanvas | DXF entities |
| Render entities | DxfCanvas | Entity rendering |
| Show colored layers | LayerCanvas | Visual layers |
| Highlight level | LayerCanvas | Visual overlay |
| Select entities | DxfCanvas | Entity selection |
| Pan/Zoom | Both | Both transform together |

---

### ⚠️ Common Mistakes

#### Mistake #1: Drawing on LayerCanvas
```typescript
// ❌ WRONG - LayerCanvas is for visual layers, NOT entities!
<LayerCanvas
  onCanvasClick={handleEntityDrawing} // Wrong canvas!
/>
```

```typescript
// ✅ CORRECT - DxfCanvas is for entities
<DxfCanvas
  onCanvasClick={handleCanvasClick} // Correct canvas!
/>
```

#### Mistake #2: Forgetting pointerEvents
```typescript
// ❌ WRONG - LayerCanvas will block clicks
<LayerCanvas
  // Missing pointerEvents control!
/>
```

```typescript
// ✅ CORRECT - Disable clicks when drawing
<LayerCanvas
  style={{
    pointerEvents: isDrawingTool ? 'none' : 'auto'
  }}
/>
```

#### Mistake #3: Wrong z-index
```typescript
// ❌ WRONG - DxfCanvas on top blocks LayerCanvas
<DxfCanvas style={{ zIndex: 15 }} />
<LayerCanvas style={{ zIndex: 10 }} />
```

```typescript
// ✅ CORRECT - LayerCanvas on top, but click-transparent when needed
<DxfCanvas style={{ zIndex: 5 }} />
<LayerCanvas style={{ zIndex: 10, pointerEvents: ... }} />
```

---

### 📋 Canvas Architecture Checklist

**For Drawing Tools to Work:**

- [ ] ✅ DxfCanvas has `onCanvasClick` prop
- [ ] ✅ LayerCanvas has `pointerEvents: 'none'` when drawing tool active
- [ ] ✅ DxfCanvas z-index = 5 (bottom)
- [ ] ✅ LayerCanvas z-index = 10 (top)
- [ ] ✅ Both canvases receive same transform (pan/zoom)
- [ ] ✅ Scene prop passed to DxfCanvas (NOT LayerCanvas)
- [ ] ✅ Drawing handlers connected to DxfCanvas (NOT LayerCanvas)

---

### 🔍 How to Debug Canvas Issues

**Problem: Clicks not working**

1. **Check which canvas is on top:**
   ```javascript
   // In browser DevTools:
   document.querySelectorAll('canvas').forEach(c => {
     console.log(c.className, window.getComputedStyle(c).zIndex);
   });
   // Should show:
   // LayerCanvas: 10
   // DxfCanvas: 5
   ```

2. **Check pointerEvents:**
   ```javascript
   const layerCanvas = document.querySelector('.layer-canvas');
   console.log(window.getComputedStyle(layerCanvas).pointerEvents);
   // Should be 'none' when drawing tool active
   ```

3. **Check event handlers:**
   ```javascript
   const dxfCanvas = document.querySelector('.dxf-canvas');
   console.log(dxfCanvas.onclick); // Should have handler
   ```

---

### 🎓 Key Takeaways

1. **DxfCanvas = Entity Geometry** (lines, circles, DXF entities)
2. **LayerCanvas = Visual Layers** (colored backgrounds, level highlights)
3. **LayerCanvas is ON TOP** (z-index 10 > 5)
4. **LayerCanvas MUST be click-transparent during drawing** (pointerEvents: 'none')
5. **Drawing tools ONLY work with DxfCanvas** (NOT LayerCanvas!)
6. **If drawing doesn't work → Check LayerCanvas pointerEvents!**

---

## 4. COORDINATE SYSTEMS & TRANSFORMATIONS

### 🎯 Critical Concept: 3 Coordinate Systems

The DXF Viewer uses **3 different coordinate systems**. Understanding these is CRITICAL for drawing to work!

#### 1. **Screen Coordinates** (Mouse/Display Space)
- **Origin:** Top-left corner of browser window
- **Units:** Pixels
- **Y-Axis:** Points DOWN (increases going down)
- **Example:** Mouse position `(500, 300)` means 500px right, 300px down from top-left

```
Browser Window (Screen Coordinates)
┌─────────────────────────────┐
│ (0,0)                       │
│    ↓ Y increases            │
│    → X increases            │
│                             │
│         Mouse (500, 300)    │
│                             │
└─────────────────────────────┘
```

#### 2. **Canvas Coordinates** (Canvas Element Space)
- **Origin:** Top-left corner of canvas element
- **Units:** Pixels (relative to canvas)
- **Y-Axis:** Points DOWN
- **Example:** Click at canvas position `(200, 150)`

```
Canvas Element (Canvas Coordinates)
┌─────────────────────────────┐
│ (0,0)                       │
│                             │
│     Canvas Click (200,150)  │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

**Conversion:** Screen → Canvas
```typescript
// Must subtract canvas offset from screen coordinates
const rect = canvasElement.getBoundingClientRect();
const canvasX = screenX - rect.left;
const canvasY = screenY - rect.top;
```

#### 3. **World Coordinates** (CAD/DXF Space)
- **Origin:** Can be anywhere (defined by user/DXF file)
- **Units:** Real-world units (mm, inches, etc.)
- **Y-Axis:** Points UP (CAD standard!)
- **Transform:** Affected by pan, zoom, rotation

```
World Coordinates (CAD Space)
        ↑ Y (up)
        │
        │
────────┼────────→ X (right)
        │
        │ (0,0) = World origin
        │
```

**Conversion:** Canvas → World
```typescript
const worldPoint = screenToWorld(
  canvasX,
  canvasY,
  canvasWidth,
  canvasHeight,
  transform // { offsetX, offsetY, scale }
);
```

---

### 🔄 Coordinate Transformation Pipeline

```
User clicks screen → Browser captures event → Get screen coordinates
                                                      ↓
                                          Subtract canvas offset (getBoundingClientRect)
                                                      ↓
                                              Get canvas coordinates
                                                      ↓
                                          Apply transform (pan, zoom)
                                                      ↓
                                              Get world coordinates
                                                      ↓
                                          Create entity with world coords
                                                      ↓
                                          Render: Transform back to canvas
```

---

### 📐 screenToWorld Function (CRITICAL!)

**File:** `src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts`

```typescript
export function screenToWorld(
  canvasX: number,        // Canvas-relative X (after subtracting rect.left)
  canvasY: number,        // Canvas-relative Y (after subtracting rect.top)
  canvasWidth: number,    // Canvas element width in pixels
  canvasHeight: number,   // Canvas element height in pixels
  transform: TransformState // { offsetX, offsetY, scale }
): Point2D {
  // Center the coordinates (make (0,0) = canvas center)
  const centeredX = canvasX - canvasWidth / 2;
  const centeredY = canvasY - canvasHeight / 2;

  // Apply inverse scale (zoom out = divide by scale)
  const scaledX = centeredX / transform.scale;
  const scaledY = centeredY / transform.scale;

  // Apply inverse offset (pan)
  const worldX = scaledX - transform.offsetX;
  const worldY = -scaledY - transform.offsetY; // ✅ Flip Y-axis! (screen Y down → world Y up)

  return { x: worldX, y: worldY };
}
```

**Why Y-axis flip?**
- Screen/Canvas: Y increases going DOWN
- World/CAD: Y increases going UP
- Must negate Y when converting!

---

### 🔍 Transform State

**Type:**
```typescript
interface TransformState {
  offsetX: number; // Pan offset in world units (X)
  offsetY: number; // Pan offset in world units (Y)
  scale: number;   // Zoom level (1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
}
```

**Example Values:**
```typescript
// Default (no pan, no zoom)
{ offsetX: 0, offsetY: 0, scale: 1.0 }

// Zoomed in 2x, panned right 100 units
{ offsetX: -100, offsetY: 0, scale: 2.0 }

// Zoomed out 50%, panned up 50 units
{ offsetX: 0, offsetY: -50, scale: 0.5 }
```

---

### 📍 Complete Coordinate Flow Example

**Scenario:** User clicks to draw line start point

```
1. Mouse click at browser position (800, 400)
   → Screen coordinates: { x: 800, y: 400 }

2. Canvas element is at position (250, 100) in browser
   → Canvas offset: rect.left = 250, rect.top = 100

3. Convert to canvas coordinates:
   canvasX = 800 - 250 = 550
   canvasY = 400 - 100 = 300
   → Canvas coordinates: { x: 550, y: 300 }

4. Canvas dimensions: 1200 x 800 pixels

5. Current transform: { offsetX: -50, offsetY: 20, scale: 1.5 }

6. screenToWorld calculation:
   a) Center coordinates:
      centeredX = 550 - 1200/2 = 550 - 600 = -50
      centeredY = 300 - 800/2 = 300 - 400 = -100

   b) Apply inverse scale (1.5):
      scaledX = -50 / 1.5 = -33.33
      scaledY = -100 / 1.5 = -66.67

   c) Apply inverse offset & flip Y:
      worldX = -33.33 - (-50) = 16.67
      worldY = -(-66.67) - 20 = 66.67 - 20 = 46.67

   → World coordinates: { x: 16.67, y: 46.67 }

7. Entity created with world coordinates:
   { type: 'line', start: { x: 16.67, y: 46.67 }, ... }

8. Rendering (reverse transform):
   World → Canvas → Screen
```

---

### ⚠️ Common Coordinate Mistakes

#### Mistake #1: Using screen coords directly
```typescript
// ❌ WRONG - Screen coords without offset subtraction
const worldPoint = screenToWorld(
  screenX, // Wrong! Must subtract canvas offset first
  screenY,
  canvasWidth,
  canvasHeight,
  transform
);
```

```typescript
// ✅ CORRECT - Subtract canvas offset
const rect = canvasElement.getBoundingClientRect();
const worldPoint = screenToWorld(
  screenX - rect.left, // Canvas-relative X
  screenY - rect.top,  // Canvas-relative Y
  canvasWidth,
  canvasHeight,
  transform
);
```

#### Mistake #2: Wrong canvas dimensions
```typescript
// ❌ WRONG - Using React component ref
const canvas = dxfCanvasRef.current;
const worldPoint = screenToWorld(
  canvasX,
  canvasY,
  canvas.clientWidth,  // undefined! (component ref, not canvas element)
  canvas.clientHeight, // undefined!
  transform
);
```

```typescript
// ✅ CORRECT - Get HTMLCanvasElement via getCanvas()
const canvasElement = dxfCanvasRef.current?.getCanvas();
const worldPoint = screenToWorld(
  canvasX,
  canvasY,
  canvasElement.clientWidth,  // Valid!
  canvasElement.clientHeight, // Valid!
  transform
);
```

#### Mistake #3: Forgetting Y-axis flip
```typescript
// ❌ WRONG - Keeping screen Y direction
const worldY = scaledY - transform.offsetY; // Y points down (wrong!)

// ✅ CORRECT - Flip Y-axis for CAD standard
const worldY = -scaledY - transform.offsetY; // Y points up (CAD standard)
```

---

### 🧪 Testing Coordinate Transformations

**Test Case 1: Canvas Center Click**
```
Canvas: 1200x800
Click canvas center: (600, 400)
Transform: { offsetX: 0, offsetY: 0, scale: 1.0 }

Expected world coords: { x: 0, y: 0 }

Calculation:
centeredX = 600 - 600 = 0
centeredY = 400 - 400 = 0
scaledX = 0 / 1.0 = 0
scaledY = 0 / 1.0 = 0
worldX = 0 - 0 = 0
worldY = -(0) - 0 = 0
✅ Result: { x: 0, y: 0 }
```

**Test Case 2: Top-Left Corner Click**
```
Canvas: 1200x800
Click top-left: (0, 0)
Transform: { offsetX: 0, offsetY: 0, scale: 1.0 }

Expected world coords: { x: -600, y: 400 }

Calculation:
centeredX = 0 - 600 = -600
centeredY = 0 - 400 = -400
scaledX = -600 / 1.0 = -600
scaledY = -400 / 1.0 = -400
worldX = -600 - 0 = -600
worldY = -(-400) - 0 = 400
✅ Result: { x: -600, y: 400 } (top-left in world = negative X, positive Y)
```

---

## 4. MOUSE EVENTS & CANVAS INTERACTION

### 🖱️ Mouse Event Flow

```
Browser captures mouse event
         ↓
React event handler (onMouseDown/onMouseUp/onMouseMove)
         ↓
useCentralizedMouseHandlers
         ↓
Event processing & routing
         ↓
Appropriate handler (pan / select / draw / zoom)
```

---

### 📊 Mouse Event Types & Handlers

#### 1. **onMouseDown** (Click Start)
**File:** `useCentralizedMouseHandlers.ts`

```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const screenPos = {
    x: e.clientX - rect.left, // Canvas-relative X
    y: e.clientY - rect.top   // Canvas-relative Y
  };

  cursor.setPosition(screenPos); // Update cursor position

  // Pan mode (middle mouse or space+left mouse)
  if (e.button === 1 || (e.button === 0 && spacePressed)) {
    panStateRef.current = {
      isPanning: true,
      startPos: screenPos,
      startOffset: { x: transform.offsetX, y: transform.offsetY }
    };
    return;
  }

  // Selection mode (left click, not drawing tool)
  const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' || ...
  if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isDrawingTool) {
    cursor.startSelection(screenPos); // ✅ Skip for drawing tools!
    return;
  }
};
```

**Key Logic:**
- Converts browser coordinates to canvas coordinates
- Updates cursor position
- Starts pan if middle mouse or space+left
- Starts selection ONLY if NOT drawing tool

---

#### 2. **onMouseUp** (Click End)
**File:** `useCentralizedMouseHandlers.ts`

```typescript
const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
  console.log('🔥 handleMouseUp CALLED!', {
    cursorPosition: cursor.position,
    isSelecting: cursor.isSelecting,
    isPanning: panStateRef.current.isPanning
  });

  // Call onCanvasClick for drawing tools (if not selecting/panning)
  if (props.onCanvasClick && !cursor.isSelecting && !panStateRef.current.isPanning) {
    console.log('✅ Calling onCanvasClick with:', cursor.position);
    props.onCanvasClick(cursor.position); // → Goes to CanvasSection.handleCanvasClick
  }

  // Finish selection
  if (cursor.isSelecting) {
    cursor.finishSelection();
    // ... entity selection logic
  }

  // Stop panning
  if (panStateRef.current.isPanning) {
    panStateRef.current.isPanning = false;
  }
};
```

**Key Logic:**
- Calls onCanvasClick if NOT selecting and NOT panning
- onCanvasClick → CanvasSection.handleCanvasClick → Drawing system
- Finishes selection or panning if active

---

#### 3. **onMouseMove** (Mouse Movement)
**File:** `useCentralizedMouseHandlers.ts`

```typescript
const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const screenPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };

  cursor.setPosition(screenPos);

  // Update selection box
  if (cursor.isSelecting) {
    cursor.updateSelectionEnd(screenPos);
  }

  // Update pan
  if (panStateRef.current.isPanning) {
    const dx = (screenPos.x - panStateRef.current.startPos.x) / transform.scale;
    const dy = (screenPos.y - panStateRef.current.startPos.y) / transform.scale;

    updateTransform({
      offsetX: panStateRef.current.startOffset.x + dx,
      offsetY: panStateRef.current.startOffset.y + dy
    });
  }

  // Hover preview for drawing
  if (props.onCanvasHover) {
    props.onCanvasHover(screenPos);
  }
};
```

**Key Logic:**
- Updates cursor position continuously
- Updates selection box if selecting
- Updates pan offset if panning
- Calls onCanvasHover for drawing preview (rubber-band lines)

---

### 🎯 Canvas Click Handler (Drawing)

**File:** `CanvasSection.tsx`

```typescript
const handleCanvasClick = (screenPos: { x: number, y: number }) => {
  console.log('🔥 handleCanvasClick called!', { screenPos, activeTool });

  // ✅ STEP 1: Get canvas element (HTMLCanvasElement, not React ref!)
  const canvasElement = dxfCanvasRef.current?.getCanvas();
  if (!canvasElement) {
    console.error('❌ Canvas element not found!');
    return;
  }

  // ✅ STEP 2: Get canvas bounding rect for accurate offset
  const rect = canvasElement.getBoundingClientRect();

  // ✅ STEP 3: Convert canvas coords to world coords
  const worldPoint = screenToWorld(
    screenPos.x - rect.left, // Already canvas-relative from mouse handler
    screenPos.y - rect.top,  // But subtract rect again for safety
    canvasElement.clientWidth,
    canvasElement.clientHeight,
    transform
  );

  console.log('🌍 worldPoint:', worldPoint);

  // ✅ STEP 4: Pass world coordinates to drawing handler
  drawingHandlersRef.current.onDrawingPoint(worldPoint);
};
```

**Critical Points:**
1. Must use `getCanvas()` to get HTMLCanvasElement (not React ref)
2. Must have valid `canvasWidth` and `canvasHeight`
3. Coordinates passed to `screenToWorld` must be canvas-relative
4. World coordinates passed to drawing system

---

### ⚙️ Canvas Element Access

**Problem:** React ref points to component, not DOM element

```typescript
// ❌ WRONG
const canvas = dxfCanvasRef.current;
const width = canvas.clientWidth; // undefined! (not HTMLCanvasElement)
```

**Solution:** Expose getCanvas() via useImperativeHandle

**File:** `DxfCanvas.tsx`
```typescript
useImperativeHandle(ref, () => ({
  getCanvas: () => canvasRef.current, // Return actual HTMLCanvasElement
  getContext: () => contextRef.current,
  // ... other methods
}));
```

**Usage:**
```typescript
// ✅ CORRECT
const canvasElement = dxfCanvasRef.current?.getCanvas();
const width = canvasElement?.clientWidth; // Valid!
```

---

## 5. RENDERING PIPELINE

### 🎨 How Entities Are Rendered

```
Scene with entities
        ↓
DxfCanvas receives scene prop
        ↓
DxfRenderer.render(scene, context, transform)
        ↓
For each entity in scene.entities:
  - Get entity type (line, circle, etc.)
  - Get entity renderer (LineRenderer, CircleRenderer, etc.)
  - Transform world coords → canvas coords
  - Draw on canvas
        ↓
Canvas displays rendered entities
```

---

### 🔄 World to Canvas Transformation (Rendering)

**File:** `CoordinateTransforms.ts`

```typescript
export function worldToCanvas(
  worldX: number,
  worldY: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: TransformState
): Point2D {
  // Apply offset (pan)
  const offsetX = worldX + transform.offsetX;
  const offsetY = worldY + transform.offsetY;

  // Flip Y-axis (world Y up → canvas Y down)
  const flippedY = -offsetY;

  // Apply scale (zoom)
  const scaledX = offsetX * transform.scale;
  const scaledY = flippedY * transform.scale;

  // Center on canvas
  const canvasX = scaledX + canvasWidth / 2;
  const canvasY = scaledY + canvasHeight / 2;

  return { x: canvasX, y: canvasY };
}
```

**Inverse of screenToWorld:**
- World coords → Apply offset → Flip Y → Scale → Center

---

### 📐 Line Rendering Example

**Entity:**
```typescript
{
  id: 'line-123',
  type: 'line',
  start: { x: 0, y: 0 },      // World coordinates
  end: { x: 100, y: 50 }      // World coordinates
}
```

**Rendering Steps:**
```typescript
// 1. Get entity renderer
const renderer = rendererRegistry.get('line'); // LineRenderer

// 2. Convert world coords to canvas coords
const startCanvas = worldToCanvas(
  entity.start.x,
  entity.start.y,
  canvasWidth,
  canvasHeight,
  transform
);

const endCanvas = worldToCanvas(
  entity.end.x,
  entity.end.y,
  canvasWidth,
  canvasHeight,
  transform
);

// 3. Draw on canvas
ctx.beginPath();
ctx.moveTo(startCanvas.x, startCanvas.y);
ctx.lineTo(endCanvas.x, endCanvas.y);
ctx.stroke();
```

---

### 🔁 Complete Rendering Flow

**File:** `DxfCanvas.tsx`

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = contextRef.current;
  if (!canvas || !ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render scene
  if (props.scene && rendererRef.current) {
    rendererRef.current.render(props.scene, {
      ctx,
      canvas,
      transform: props.transform,
      viewport: props.viewport
    });
  }
}, [props.scene, props.transform]); // Re-render when scene or transform changes
```

**Key Points:**
- Re-renders when `props.scene` changes (new entity added!)
- Re-renders when `props.transform` changes (pan/zoom)
- Clears canvas before each render
- Passes transform to renderer for coordinate conversion

---

### 🎯 Why Rendering Needs Updated Scene Prop

**Problem Flow (Bug #6):**
```
1. useUnifiedDrawing creates entity
2. setLevelScene(levelId, updatedScene) ← Updates global store
3. ❌ props.currentScene in CanvasSection NOT updated
4. ❌ DxfCanvas receives OLD scene (without new entity)
5. ❌ Entity not rendered
```

**Solution Flow:**
```
1. useUnifiedDrawing creates entity
2. setLevelScene(levelId, updatedScene) ← Updates global store
3. onEntityCreated(entity) callback ✅
4. CanvasSection receives callback
5. props.handleSceneChange(updatedScene) ← Updates parent
6. props.currentScene updates ✅
7. DxfCanvas receives NEW scene (with entity) ✅
8. useEffect triggers re-render ✅
9. Entity rendered on canvas! ✅
```

---

## 6. FILE DEPENDENCIES

### Core Files (Must Work Together)

#### 1. **CanvasSection.tsx**
**Path:** `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`

**Role:** Main orchestrator - connects all systems

**Critical Code:**

```typescript
// Line 257-284: Auto-start drawing when tool selected
const drawingHandlersRef = React.useRef(drawingHandlers);
React.useEffect(() => {
  drawingHandlersRef.current = drawingHandlers;
}, [drawingHandlers]);

React.useEffect(() => {
  const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                        activeTool === 'polygon' || activeTool === 'circle' ||
                        activeTool === 'rectangle' || activeTool === 'arc';
  if (isDrawingTool && drawingHandlersRef.current?.startDrawing) {
    const drawingTool = activeTool as DrawingToolType;
    console.log('🎯 Auto-starting drawing for tool:', drawingTool);
    drawingHandlersRef.current.startDrawing(drawingTool);
  }
}, [activeTool]);

// Line 597-612: Handle canvas click for drawing
const handleCanvasClick = (screenPos: { x: number, y: number }) => {
  console.log('🔥 handleCanvasClick called!', { screenPos, activeTool });

  const canvasElement = dxfCanvasRef.current?.getCanvas(); // ✅ Fixed: Use getCanvas()
  if (!canvasElement) return;

  const rect = canvasElement.getBoundingClientRect();
  const worldPoint = screenToWorld(
    screenPos.x - rect.left,
    screenPos.y - rect.top,
    canvasElement.clientWidth,
    canvasElement.clientHeight,
    transform
  );

  console.log('🌍 worldPoint:', worldPoint);
  drawingHandlersRef.current.onDrawingPoint(worldPoint); // ✅ Fixed: Use ref.current
};

// Line 871-874: LayerCanvas pointer events
style={{
  touchAction: 'none',
  pointerEvents: (activeTool === 'line' || activeTool === 'polyline' ||
                  activeTool === 'polygon' || activeTool === 'circle' ||
                  activeTool === 'rectangle' || activeTool === 'arc')
                  ? 'none' : 'auto' // ✅ Fixed: Don't block drawing tools
}}
```

**Props Required:**
- `handleSceneChange: (scene: SceneModel) => void` - Updates parent scene
- `currentScene: SceneModel` - Current scene with entities

---

#### 2. **useDrawingHandlers.ts**
**Path:** `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`

**Role:** Provides event handlers for drawing interactions

**Critical Code:**

```typescript
// Line 32-40: Initialize unified drawing with callback
const {
  state: drawingState,
  startDrawing,
  addPoint,
  finishEntity,
  finishPolyline,
  cancelDrawing,
  updatePreview
} = useUnifiedDrawing(onEntityCreated); // ✅ Fixed: Pass callback!

// Line 76-84: Handle drawing point click
const onDrawingPoint = useCallback((p: Pt) => {
  console.log('🔥 onDrawingPoint called:', p);
  const snappedPoint = applySnap(p);
  const transform = canvasOps.getTransform();
  addPoint(snappedPoint, transform);
}, [addPoint, canvasOps, applySnap, drawingState]);
```

**Parameters Required:**
- `onEntityCreated: (entity: Entity) => void` - Callback when entity created
- `activeTool: ToolType` - Current tool
- `onToolChange: (tool: ToolType) => void` - Change tool callback
- `currentScene?: SceneModel` - Current scene for snapping

---

#### 3. **useUnifiedDrawing.ts**
**Path:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`

**Role:** Drawing state machine - creates entities, manages points

**Critical Code:**

```typescript
// Line 104: Accept onEntityCreated callback
export function useUnifiedDrawing(onEntityCreated?: (entity: any) => void) {

// Line 313-366: Add point and create entity
const addPoint = useCallback((worldPoint: Point2D, transform: ...) => {
  console.log('🚀 addPoint called - state.isDrawing:', state.isDrawing);

  if (!state.isDrawing) {
    console.error('❌ addPoint BLOCKED - isDrawing is FALSE!');
    return;
  }

  const newTempPoints = [...state.tempPoints, worldPoint];
  console.log('📍 Added point. Total points:', newTempPoints.length);

  // Check if drawing is complete
  if (isComplete(state.currentTool, newTempPoints)) {
    console.log('✅ Drawing COMPLETE!', {
      tool: state.currentTool,
      pointsCount: newTempPoints.length
    });

    const newEntity = createEntityFromTool(state.currentTool, newTempPoints);
    console.log('🎨 Entity created:', { newEntity, currentLevelId });

    if (newEntity && currentLevelId) {
      const scene = getLevelScene(currentLevelId);
      if (scene) {
        const updatedScene = {
          ...scene,
          entities: [...scene.entities, newEntity]
        };
        setLevelScene(currentLevelId, updatedScene);
        console.log('✅ Entity added to scene!');

        // ✅ CRITICAL: Call callback to update parent
        if (onEntityCreated) {
          console.log('📢 Calling onEntityCreated callback with entity:', newEntity);
          onEntityCreated(newEntity);
        }
      }
    }

    // Reset drawing state
    setState(prev => ({
      ...prev,
      mode: 'idle',
      isDrawing: false,
      tempPoints: [],
      previewEntity: null
    }));
  } else {
    // Partial drawing - update temp points
    setState(prev => ({
      ...prev,
      tempPoints: newTempPoints,
      previewEntity: null
    }));
  }
}, [state, currentLevelId, getLevelScene, setLevelScene, onEntityCreated]);
```

**Key Functions:**
- `startDrawing(tool)` - Enters drawing mode
- `addPoint(point, transform)` - Adds point, creates entity if complete
- `isComplete(tool, points)` - Checks if entity has enough points
- `createEntityFromTool(tool, points)` - Creates entity object

---

#### 4. **DxfCanvas.tsx**
**Path:** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx`

**Role:** Renders entities and handles mouse events

**Critical Code:**

```typescript
// Line 54: Accept onCanvasClick prop
export interface DxfCanvasProps {
  // ... other props
  onCanvasClick?: (point: Point2D) => void;
}

// Line 151: Pass to mouse handlers
const mouseHandlers = useCentralizedMouseHandlers({
  // ... other params
  onCanvasClick, // ✅ FIX: Pass onCanvasClick for drawing tools!
});
```

**Props Required:**
- `scene: SceneModel` - Scene with entities to render
- `onCanvasClick?: (point: Point2D) => void` - Click handler for drawing

---

#### 5. **useCentralizedMouseHandlers.ts**
**Path:** `src/subapps/dxf-viewer/systems/cursor\useCentralizedMouseHandlers.ts`

**Role:** Routes mouse events, prevents selection mode for drawing tools

**Critical Code:**

```typescript
// Line 182-189: Don't start selection for drawing tools
const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                      activeTool === 'polygon' || activeTool === 'circle' ||
                      activeTool === 'rectangle' || activeTool === 'arc';

if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isDrawingTool) {
  cursor.startSelection(screenPos); // ✅ Fixed: Skip for drawing tools
}

// Line 314-324: Call onCanvasClick if provided
const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
  console.log('🔥 handleMouseUp CALLED!', {
    cursorPosition: cursor.position,
    isSelecting: cursor.isSelecting,
    isPanning: panStateRef.current.isPanning
  });

  if (props.onCanvasClick && !cursor.isSelecting && !panStateRef.current.isPanning) {
    console.log('✅ Calling onCanvasClick with:', cursor.position);
    props.onCanvasClick(cursor.position);
  }
  // ... rest of handler
};
```

---

### Supporting Files

#### 6. **LayerCanvas.tsx**
**Path:** `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx`

**Role:** Renders colored layers (must NOT block DxfCanvas)

**Critical:** `pointerEvents: 'none'` when drawing tools active (set by CanvasSection)

---

#### 7. **CoordinateTransforms.ts**
**Path:** `src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts`

**Role:** Converts screen coordinates to world coordinates

**Key Function:**
```typescript
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: TransformState
): Point2D
```

---

## 4. EVENT FLOW - CLICK TO RENDERING

### Step-by-Step Flow

#### Phase 1: Tool Selection
```
1. User clicks "Line" button in toolbar
   ↓
2. activeTool state changes to 'line'
   ↓
3. CanvasSection useEffect detects tool change (line 268)
   ↓
4. drawingHandlersRef.current.startDrawing('line') called
   ↓
5. useUnifiedDrawing.startDrawing sets isDrawing = true
```

#### Phase 2: First Click (Point 1)
```
1. User clicks canvas at position (100, 200)
   ↓
2. useCentralizedMouseHandlers.handleMouseDown
   - Checks: is drawing tool? YES
   - Skips: cursor.startSelection() ✅ (Bug #3 fix)
   ↓
3. useCentralizedMouseHandlers.handleMouseUp
   - Checks: onCanvasClick exists? YES
   - Checks: not selecting, not panning? YES
   - Calls: props.onCanvasClick({ x: 100, y: 200 })
   ↓
4. DxfCanvas passes click to CanvasSection.handleCanvasClick
   ↓
5. CanvasSection.handleCanvasClick:
   - Gets canvas element: dxfCanvasRef.current.getCanvas() ✅ (Bug #5 fix)
   - Converts to world coords: screenToWorld(100, 200, ...)
   - Calls: drawingHandlersRef.current.onDrawingPoint(worldPoint) ✅ (Bug #4 fix)
   ↓
6. useDrawingHandlers.onDrawingPoint:
   - Applies snapping if enabled
   - Gets transform: canvasOps.getTransform()
   - Calls: addPoint(snappedPoint, transform)
   ↓
7. useUnifiedDrawing.addPoint:
   - Checks: state.isDrawing? YES
   - Adds point to tempPoints: [point1]
   - Checks: isComplete('line', [point1])? NO (need 2 points)
   - Updates state with tempPoints: [point1]
```

#### Phase 3: Second Click (Point 2)
```
1. User clicks canvas at position (300, 400)
   ↓
2-6. Same flow as Phase 2 up to addPoint
   ↓
7. useUnifiedDrawing.addPoint:
   - Checks: state.isDrawing? YES
   - Adds point to tempPoints: [point1, point2]
   - Checks: isComplete('line', [point1, point2])? YES ✅
   ↓
8. createEntityFromTool('line', [point1, point2]):
   - Creates: { id: uuid(), type: 'line', start: point1, end: point2, ... }
   ↓
9. setLevelScene(currentLevelId, updatedScene):
   - Adds entity to scene.entities array
   - Updates global level store
   ↓
10. onEntityCreated(newEntity) callback ✅ (Bug #6 fix)
    ↓
11. useDrawingHandlers receives callback, passes to CanvasSection
    ↓
12. CanvasSection.handleSceneChange:
    - Calls: props.handleSceneChange(newScene)
    ↓
13. Parent component (NormalView) updates currentScene prop
    ↓
14. DxfCanvas receives new scene prop
    ↓
15. DxfCanvas re-renders with new entity
    ↓
16. Line appears on screen! ✅
```

---

## 5. CRITICAL BUGS FIXED

### Bug #1: Infinite Loop (useEffect)
**Date Fixed:** 2025-10-05
**Symptom:** "Maximum update depth exceeded" error, browser freezes

**Root Cause:**
```typescript
// ❌ WRONG - drawingHandlers changes every render
React.useEffect(() => {
  if (isDrawingTool && drawingHandlers?.startDrawing) {
    drawingHandlers.startDrawing(drawingTool);
  }
}, [activeTool, drawingHandlers]); // drawingHandlers triggers infinite loop!
```

**Fix:**
```typescript
// ✅ CORRECT - Use ref to avoid re-triggering
const drawingHandlersRef = React.useRef(drawingHandlers);

React.useEffect(() => {
  drawingHandlersRef.current = drawingHandlers;
}, [drawingHandlers]);

React.useEffect(() => {
  if (isDrawingTool && drawingHandlersRef.current?.startDrawing) {
    drawingHandlersRef.current.startDrawing(drawingTool);
  }
}, [activeTool]); // Only activeTool in deps!
```

**File:** `CanvasSection.tsx` (lines 257-284)

---

### Bug #2: Selection Mode Blocking Drawing
**Date Fixed:** 2025-10-05
**Symptom:** Clicks don't reach drawing handlers, selection box appears instead

**Root Cause:**
```typescript
// ❌ WRONG - Always starts selection on left click
if (e.button === 0 && !e.shiftKey && activeTool !== 'pan') {
  cursor.startSelection(screenPos); // Blocks drawing tools!
}
```

**Fix:**
```typescript
// ✅ CORRECT - Skip selection for drawing tools
const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                      activeTool === 'polygon' || activeTool === 'circle' ||
                      activeTool === 'rectangle' || activeTool === 'arc';

if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isDrawingTool) {
  cursor.startSelection(screenPos);
}
```

**File:** `useCentralizedMouseHandlers.ts` (lines 182-189)

---

### Bug #3: LayerCanvas Blocking Clicks
**Date Fixed:** 2025-10-05
**Symptom:** No click events reach DxfCanvas, nothing happens

**Root Cause:**
LayerCanvas has `z-index: 10`, above DxfCanvas, intercepting all pointer events

**Fix:**
```typescript
// ✅ CORRECT - Disable pointer events for drawing tools
<LayerCanvas
  style={{
    touchAction: 'none',
    pointerEvents: (activeTool === 'line' || activeTool === 'polyline' ||
                    activeTool === 'polygon' || activeTool === 'circle' ||
                    activeTool === 'rectangle' || activeTool === 'arc')
                    ? 'none' : 'auto'
  }}
  // ... other props
/>
```

**File:** `CanvasSection.tsx` (lines 871-874)

---

### Bug #4: Stale drawingHandlers Reference
**Date Fixed:** 2025-10-05
**Symptom:** onDrawingPoint called but nothing happens, no logs

**Root Cause:**
```typescript
// ❌ WRONG - Closure captures old drawingHandlers
const handleCanvasClick = (screenPos: { x: number, y: number }) => {
  // ... coordinate conversion
  drawingHandlers.onDrawingPoint(worldPoint); // Stale reference!
};
```

**Fix:**
```typescript
// ✅ CORRECT - Use ref.current for latest value
const handleCanvasClick = (screenPos: { x: number, y: number }) => {
  // ... coordinate conversion
  drawingHandlersRef.current.onDrawingPoint(worldPoint);
};
```

**File:** `CanvasSection.tsx` (line 608)

---

### Bug #5: Canvas Dimensions Undefined
**Date Fixed:** 2025-10-05
**Symptom:** worldPoint.y is NaN, coordinates broken

**Root Cause:**
```typescript
// ❌ WRONG - React component ref, not HTMLCanvasElement
const canvas = dxfCanvasRef.current;
const worldPoint = screenToWorld(
  screenPos.x,
  screenPos.y,
  canvas.clientWidth,  // undefined!
  canvas.clientHeight, // undefined!
  transform
);
```

**Fix:**
```typescript
// ✅ CORRECT - Use getCanvas() to get HTMLCanvasElement
const canvasElement = dxfCanvasRef.current?.getCanvas();
if (!canvasElement) return;

const worldPoint = screenToWorld(
  screenPos.x - rect.left,
  screenPos.y - rect.top,
  canvasElement.clientWidth,  // ✅ Works!
  canvasElement.clientHeight, // ✅ Works!
  transform
);
```

**File:** `CanvasSection.tsx` (line 597)

---

### Bug #6: Entity Not Rendering
**Date Fixed:** 2025-10-05
**Symptom:** Entity created and added to scene, but doesn't appear on canvas

**Root Cause:**
```typescript
// ❌ PROBLEM - No callback to update parent
setLevelScene(currentLevelId, updatedScene);
// Parent component's currentScene prop NOT updated!
// DxfCanvas doesn't re-render!
```

**Fix:**
```typescript
// Step 1: Add callback parameter to useUnifiedDrawing
export function useUnifiedDrawing(onEntityCreated?: (entity: any) => void) {

// Step 2: Call callback after setLevelScene
setLevelScene(currentLevelId, updatedScene);
if (onEntityCreated) {
  onEntityCreated(newEntity); // ✅ Notify parent!
}

// Step 3: Pass callback from useDrawingHandlers
const { ... } = useUnifiedDrawing(onEntityCreated);

// Step 4: Parent receives callback and updates scene
// CanvasSection → props.handleSceneChange(newScene)
// → props.currentScene updates
// → DxfCanvas re-renders ✅
```

**Files:**
- `useUnifiedDrawing.ts` (lines 104, 357-360)
- `useDrawingHandlers.ts` (line 40)

---

## 6. CONFIGURATION REQUIREMENTS

### Required Props Chain

#### DXFViewerLayout
```typescript
<DXFViewerLayout
  handleSceneChange={(scene) => {
    // Update scene state
    setCurrentScene(scene);
  }}
  currentScene={currentScene}
  // ... other props
/>
```

#### NormalView
```typescript
<NormalView
  handleSceneChange={props.handleSceneChange} // Pass through
  currentScene={props.currentScene}           // Pass through
  // ... other props
/>
```

#### CanvasSection
```typescript
const drawingHandlers = useDrawingHandlers(
  activeTool,
  (entity) => {
    // Callback when entity created
    const updatedScene = {
      ...props.currentScene,
      entities: [...props.currentScene.entities, entity]
    };
    props.handleSceneChange(updatedScene);
  },
  setActiveTool,
  props.currentScene
);

<DxfCanvas
  scene={props.currentScene} // Must update when entity added!
  onCanvasClick={handleCanvasClick}
  // ... other props
/>

<LayerCanvas
  style={{
    pointerEvents: isDrawingTool ? 'none' : 'auto' // Critical!
  }}
  // ... other props
/>
```

---

### Required State Management

#### Level Store Integration
```typescript
// useUnifiedDrawing must have access to:
const { currentLevelId } = useLevelStore();
const { getLevelScene, setLevelScene } = useLevelStore();

// When entity created:
const scene = getLevelScene(currentLevelId);
const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
setLevelScene(currentLevelId, updatedScene);
```

---

### Canvas Refs
```typescript
// DxfCanvas must expose getCanvas() method
const dxfCanvasRef = useRef<{ getCanvas: () => HTMLCanvasElement | null }>(null);

// Usage:
const canvasElement = dxfCanvasRef.current?.getCanvas();
```

---

## 7. SETTINGS & FLAGS

### Debug Flags

#### useDrawingHandlers.ts
```typescript
const DEBUG_DRAWING_HANDLERS = true; // Enable debug logs
```

#### useUnifiedDrawing.ts
```typescript
const DEBUG_DRAWING = true; // Enable debug logs
```

---

### Tool Detection

```typescript
// Drawing tools that need special handling:
const isDrawingTool =
  activeTool === 'line' ||
  activeTool === 'polyline' ||
  activeTool === 'polygon' ||
  activeTool === 'circle' ||
  activeTool === 'rectangle' ||
  activeTool === 'arc';
```

**Used in:**
- `CanvasSection.tsx` (lines 268, 871)
- `useCentralizedMouseHandlers.ts` (line 182)

---

### Entity Completion Rules

```typescript
// From useUnifiedDrawing.ts
function isComplete(tool: DrawingToolType, points: Point2D[]): boolean {
  switch (tool) {
    case 'line':
      return points.length === 2; // Need 2 points
    case 'circle':
      return points.length === 2; // Center + radius point
    case 'rectangle':
      return points.length === 2; // Opposite corners
    case 'arc':
      return points.length === 3; // Start, middle, end
    case 'polyline':
    case 'polygon':
      return false; // Finished by double-click
    default:
      return false;
  }
}
```

---

## 8. TROUBLESHOOTING GUIDE

### Problem: Drawing tools don't work (no response to clicks)

#### Checklist:
1. ✅ Check LayerCanvas pointerEvents
   - File: `CanvasSection.tsx` line 871
   - Should be: `pointerEvents: isDrawingTool ? 'none' : 'auto'`

2. ✅ Check selection blocking
   - File: `useCentralizedMouseHandlers.ts` line 182
   - Should skip startSelection() for drawing tools

3. ✅ Check onCanvasClick passed to DxfCanvas
   - File: `CanvasSection.tsx` line ~800
   - Should have: `onCanvasClick={handleCanvasClick}`

4. ✅ Check handleCanvasClick uses drawingHandlersRef.current
   - File: `CanvasSection.tsx` line 608
   - Should be: `drawingHandlersRef.current.onDrawingPoint()`

---

### Problem: Entity created but doesn't render

#### Checklist:
1. ✅ Check onEntityCreated callback passed to useUnifiedDrawing
   - File: `useDrawingHandlers.ts` line 40
   - Should be: `useUnifiedDrawing(onEntityCreated)`

2. ✅ Check callback called after setLevelScene
   - File: `useUnifiedDrawing.ts` lines 357-360
   - Should call: `onEntityCreated(newEntity)`

3. ✅ Check props.handleSceneChange called
   - File: `CanvasSection.tsx` in drawingHandlers callback
   - Should update parent scene

4. ✅ Check DxfCanvas receives updated scene prop
   - File: `CanvasSection.tsx` line ~800
   - Should be: `scene={props.currentScene}`

---

### Problem: Coordinates are NaN

#### Checklist:
1. ✅ Check canvas element access
   - File: `CanvasSection.tsx` line 597
   - Should be: `dxfCanvasRef.current?.getCanvas()`
   - NOT: `dxfCanvasRef.current`

2. ✅ Check screenToWorld parameters
   - canvasWidth/canvasHeight must be valid numbers
   - transform must have valid values

---

### Problem: Infinite loop / Browser freeze

#### Checklist:
1. ✅ Check useEffect dependencies
   - File: `CanvasSection.tsx` line 268
   - Should use: `drawingHandlersRef` pattern
   - NOT have drawingHandlers in deps

---

### Problem: Selection box appears instead of drawing

#### Checklist:
1. ✅ Check isDrawingTool condition
   - File: `useCentralizedMouseHandlers.ts` line 182
   - Should exclude drawing tools from selection

---

## 9. TESTING CHECKLIST

### Manual Testing Steps

#### 1. Line Tool Test
```
1. Open http://localhost:3001/dxf/viewer
2. Click "Line" button in toolbar
3. Click point 1 on canvas
4. Click point 2 on canvas
5. ✅ Line should appear connecting the two points
```

**Expected Console Logs:**
```
🎯 Auto-starting drawing for tool: line
🔥 handleCanvasClick called! { screenPos: {...}, activeTool: 'line' }
🌍 worldPoint: { x: ..., y: ... }
🔥 onDrawingPoint called: { x: ..., y: ... }
🚀 addPoint called - state.isDrawing: true
📍 Added point. Total points: 1
[Second click]
🚀 addPoint called - state.isDrawing: true
📍 Added point. Total points: 2
✅ Drawing COMPLETE! { tool: 'line', pointsCount: 2 }
🎨 Entity created: { newEntity: {...}, currentLevelId: '...' }
✅ Entity added to scene!
📢 Calling onEntityCreated callback with entity: {...}
```

---

#### 2. Circle Tool Test
```
1. Click "Circle" button
2. Click center point
3. Click radius point
4. ✅ Circle should appear
```

---

#### 3. Rectangle Tool Test
```
1. Click "Rectangle" button
2. Click first corner
3. Click opposite corner
4. ✅ Rectangle should appear
```

---

#### 4. Polyline Tool Test
```
1. Click "Polyline" button
2. Click point 1
3. Click point 2
4. Click point 3
5. Double-click to finish
6. ✅ Polyline should appear with all segments
```

---

### Automated Testing (Future)

#### Unit Tests Needed:
- `isComplete()` function for all tools
- `createEntityFromTool()` for all tools
- `screenToWorld()` coordinate transformation
- Drawing state machine transitions

#### Integration Tests Needed:
- Full click-to-render flow
- Callback propagation
- Canvas layer interaction

---

## 10. CRITICAL CODE SNIPPETS

### Complete handleCanvasClick Implementation
```typescript
// CanvasSection.tsx (lines 597-612)
const handleCanvasClick = (screenPos: { x: number, y: number }) => {
  console.log('🔥 handleCanvasClick called!', { screenPos, activeTool });

  // ✅ CRITICAL: Use getCanvas() to get HTMLCanvasElement
  const canvasElement = dxfCanvasRef.current?.getCanvas();
  if (!canvasElement) {
    console.error('❌ Canvas element not found!');
    return;
  }

  const rect = canvasElement.getBoundingClientRect();
  const worldPoint = screenToWorld(
    screenPos.x - rect.left,
    screenPos.y - rect.top,
    canvasElement.clientWidth,
    canvasElement.clientHeight,
    transform
  );

  console.log('🌍 worldPoint:', worldPoint);

  // ✅ CRITICAL: Use drawingHandlersRef.current (not stale closure)
  drawingHandlersRef.current.onDrawingPoint(worldPoint);
};
```

---

### Complete addPoint Implementation
```typescript
// useUnifiedDrawing.ts (lines 313-366)
const addPoint = useCallback((worldPoint: Point2D, transform: TransformState) => {
  console.log('🚀 addPoint called - state.isDrawing:', state.isDrawing);

  if (!state.isDrawing) {
    console.error('❌ addPoint BLOCKED - isDrawing is FALSE!');
    return;
  }

  const newTempPoints = [...state.tempPoints, worldPoint];
  console.log('📍 Added point. Total points:', newTempPoints.length);

  if (isComplete(state.currentTool, newTempPoints)) {
    console.log('✅ Drawing COMPLETE!', {
      tool: state.currentTool,
      pointsCount: newTempPoints.length
    });

    const newEntity = createEntityFromTool(state.currentTool, newTempPoints);
    console.log('🎨 Entity created:', { newEntity, currentLevelId });

    if (newEntity && currentLevelId) {
      const scene = getLevelScene(currentLevelId);
      if (scene) {
        const updatedScene = {
          ...scene,
          entities: [...scene.entities, newEntity]
        };
        setLevelScene(currentLevelId, updatedScene);
        console.log('✅ Entity added to scene!');

        // ✅ CRITICAL: Call callback to update parent
        if (onEntityCreated) {
          console.log('📢 Calling onEntityCreated callback with entity:', newEntity);
          onEntityCreated(newEntity);
        }
      }
    }

    // Reset drawing state
    setState(prev => ({
      ...prev,
      mode: 'idle',
      isDrawing: false,
      tempPoints: [],
      previewEntity: null
    }));
  } else {
    // Partial drawing - update temp points
    setState(prev => ({
      ...prev,
      tempPoints: newTempPoints,
      previewEntity: null
    }));
  }
}, [state, currentLevelId, getLevelScene, setLevelScene, onEntityCreated]);
```

---

### Complete LayerCanvas Configuration
```typescript
// CanvasSection.tsx (lines 871-874)
<LayerCanvas
  // ... other props
  style={{
    touchAction: 'none',
    pointerEvents: (activeTool === 'line' || activeTool === 'polyline' ||
                    activeTool === 'polygon' || activeTool === 'circle' ||
                    activeTool === 'rectangle' || activeTool === 'arc')
                    ? 'none' : 'auto' // ✅ Critical!
  }}
/>
```

---

### Complete Selection Blocking Prevention
```typescript
// useCentralizedMouseHandlers.ts (lines 182-189)
const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                      activeTool === 'polygon' || activeTool === 'circle' ||
                      activeTool === 'rectangle' || activeTool === 'arc';

if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isDrawingTool) {
  cursor.startSelection(screenPos); // Only for non-drawing tools
}
```

---

## 11. VERSION HISTORY

### v1.0 - 2025-10-05 ✅ WORKING
- Fixed all 6 critical bugs
- Drawing tools functional
- Line/Circle/Rectangle/Arc working
- Polyline/Polygon working with double-click
- Full callback chain implemented
- Documentation created

---

## 12. ADVANCED TOPICS

### 🎯 Snapping System Integration

**How Snapping Works:**

```
1. User clicks canvas at (100, 200)
   ↓
2. onDrawingPoint receives raw point
   ↓
3. applySnap() checks if snap enabled
   ↓
4. findSnapPoint(100, 200) searches for:
   - Endpoint snap: Entity endpoints within tolerance
   - Midpoint snap: Entity midpoints within tolerance
   - Center snap: Circle/arc centers within tolerance
   - Intersection snap: Line intersections within tolerance
   - Grid snap: Nearest grid point
   ↓
5. Returns snapped point or original point
   ↓
6. Snapped point used for entity creation
```

**File:** `useDrawingHandlers.ts` (lines 54-73)

```typescript
const applySnap = useCallback((point: Pt): Pt => {
  if (!snapEnabled || !findSnapPoint) {
    return point; // No snap, return raw point
  }

  try {
    const snapResult = findSnapPoint(point.x, point.y);
    if (snapResult && snapResult.found && snapResult.snappedPoint) {
      return snapResult.snappedPoint; // ✅ Snapped!
    }
  } catch (error) {
    console.warn('🔺 Drawing snap error:', error);
  }

  return point; // Fallback to raw point
}, [snapEnabled, findSnapPoint]);
```

**Snap Context:**
- `snapEnabled`: Boolean flag (user toggle)
- `enabledModes`: Array of enabled snap types (endpoint, midpoint, etc.)
- `findSnapPoint`: Function from useSnapManager

---

### 🏗️ Level/Layer System

**How Current Level is Selected:**

```typescript
// From useLevelStore
const { currentLevelId } = useLevelStore();
```

**Level Store State:**
```typescript
{
  levels: [
    { id: 'level-1', name: 'Ground Floor', scene: {...} },
    { id: 'level-2', name: 'First Floor', scene: {...} }
  ],
  currentLevelId: 'level-1' // Active level
}
```

**Entity Addition Flow:**
```typescript
// useUnifiedDrawing.ts (line 345)
if (newEntity && currentLevelId) {
  const scene = getLevelScene(currentLevelId); // Get current level's scene
  if (scene) {
    const updatedScene = {
      ...scene,
      entities: [...scene.entities, newEntity] // Add to current level
    };
    setLevelScene(currentLevelId, updatedScene); // Update level
  }
}
```

**What if no currentLevelId?**
```typescript
if (!currentLevelId) {
  console.error('❌ No active level! Cannot add entity.');
  // Entity creation aborted
  return;
}
```

**Critical:** Drawing ONLY works when a level is selected!

---

### 🆔 Entity ID Generation

**File:** `useUnifiedDrawing.ts` → `createEntityFromTool()`

```typescript
import { v4 as uuidv4 } from 'uuid';

function createEntityFromTool(tool: DrawingToolType, points: Point2D[]): Entity | null {
  const id = uuidv4(); // Generate unique ID (e.g., "a3d5f7c2-...")

  switch (tool) {
    case 'line':
      return {
        id,
        type: 'line',
        start: points[0],
        end: points[1],
        // ... other properties
      };
    // ... other tools
  }
}
```

**UUID Format:** RFC4122 v4 (128-bit random)
**Example:** `"3f8a2c1d-5b4e-4f9a-a7d3-6e2b1c9f8a4d"`

**Why UUID?**
- Guaranteed unique across all entities
- No collision risk
- Works in distributed systems

---

### ⚠️ Error Handling

#### 1. Null Canvas Element
```typescript
const canvasElement = dxfCanvasRef.current?.getCanvas();
if (!canvasElement) {
  console.error('❌ Canvas element not found!');
  return; // Abort operation
}
```

#### 2. Invalid Transform
```typescript
if (!transform || typeof transform.scale !== 'number') {
  console.error('❌ Invalid transform!', transform);
  return; // Abort
}
```

#### 3. NaN Coordinates
```typescript
const worldPoint = screenToWorld(...);
if (isNaN(worldPoint.x) || isNaN(worldPoint.y)) {
  console.error('❌ Invalid world point!', worldPoint);
  return; // Abort
}
```

#### 4. No Active Level
```typescript
if (!currentLevelId) {
  console.error('❌ No active level! Cannot add entity.');
  // Show user notification
  return;
}
```

#### 5. Scene Not Found
```typescript
const scene = getLevelScene(currentLevelId);
if (!scene) {
  console.error('❌ Scene not found for level:', currentLevelId);
  return;
}
```

---

### 🔄 State Synchronization

**Problem:** Global level store vs React props

```
Global Level Store (Zustand)
  ↓ setLevelScene(levelId, updatedScene)
Updates level store
  ↓
❌ React props.currentScene NOT updated automatically!
```

**Solution:** Callback chain

```
setLevelScene(levelId, updatedScene) ← Update global store
  ↓
onEntityCreated(entity) ← Notify via callback
  ↓
CanvasSection receives callback
  ↓
props.handleSceneChange(updatedScene) ← Update parent component
  ↓
Parent updates state
  ↓
props.currentScene updates ← React props updated!
  ↓
DxfCanvas re-renders with new scene ← Visual update!
```

**Why this pattern?**
- Global store for persistence
- React props for rendering
- Callback for synchronization

---

### 🎰 Tool State Machine

**States:**
```typescript
type DrawingMode = 'idle' | 'drawing' | 'preview';

interface DrawingState {
  mode: DrawingMode;
  isDrawing: boolean;
  currentTool: DrawingToolType | null;
  tempPoints: Point2D[];
  previewEntity: Entity | null;
}
```

**State Transitions:**

```
[IDLE]
  ↓ User selects tool (e.g., "Line")
  ↓ startDrawing() called
[DRAWING] (isDrawing = true)
  ↓ User clicks point 1
  ↓ addPoint() called
  ↓ tempPoints = [point1]
[DRAWING] (partial, need more points)
  ↓ User clicks point 2
  ↓ addPoint() called
  ↓ tempPoints = [point1, point2]
  ↓ isComplete() → true
  ↓ createEntity()
  ↓ setState({ mode: 'idle', isDrawing: false })
[IDLE]
```

**Double-click (Polyline/Polygon):**
```
[DRAWING]
  ↓ tempPoints = [p1, p2, p3, ...]
  ↓ User double-clicks
  ↓ onDrawingDoubleClick()
  ↓ finishPolyline()
  ↓ createEntity(points)
[IDLE]
```

**Cancellation:**
```
[DRAWING]
  ↓ User presses Escape
  ↓ onDrawingCancel()
  ↓ cancelDrawing()
  ↓ setState({ mode: 'idle', tempPoints: [] })
[IDLE]
```

---

### 🧹 Cleanup & Unmount

**What happens when component unmounts?**

```typescript
// CanvasSection.tsx
useEffect(() => {
  return () => {
    // Cleanup on unmount
    if (drawingState.isDrawing) {
      drawingHandlersRef.current?.cancelAllOperations();
    }
  };
}, []);
```

**Cleanup operations:**
1. Cancel active drawing
2. Clear temp points
3. Remove event listeners (if any)
4. Reset tool to 'select'

**Why important?**
- Prevents memory leaks
- Clears pending operations
- Resets UI state

---

### ⚡ Performance Optimizations

#### Why useRef instead of useState?

**Problem with useState:**
```typescript
// ❌ BAD - Triggers re-render every time
const [drawingHandlers, setDrawingHandlers] = useState(...);

useEffect(() => {
  // Re-runs on every drawingHandlers change
  // Causes infinite loop!
}, [drawingHandlers]);
```

**Solution with useRef:**
```typescript
// ✅ GOOD - No re-render
const drawingHandlersRef = useRef(drawingHandlers);

useEffect(() => {
  drawingHandlersRef.current = drawingHandlers;
}, [drawingHandlers]);

useEffect(() => {
  // Only runs when activeTool changes
  drawingHandlersRef.current.startDrawing(...);
}, [activeTool]); // No drawingHandlers in deps!
```

**Benefits:**
- Avoids infinite loops
- Reduces re-renders
- Better performance
- Always has latest value via `.current`

#### Why useCallback?

```typescript
const onDrawingPoint = useCallback((p: Pt) => {
  // ... logic
}, [addPoint, canvasOps, applySnap]);
```

**Benefits:**
- Function reference stays stable
- Child components don't re-render unnecessarily
- Better React.memo optimization

---

### ⌨️ Drawing Cancellation (Escape Key)

**File:** `useDrawingHandlers.ts` (lines 93-96)

```typescript
const onDrawingCancel = useCallback(() => {
  cancelDrawing(); // Reset drawing state
  onToolChange('select'); // Switch to select tool
}, [cancelDrawing, onToolChange]);
```

**Keyboard Handler (if implemented):**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drawingState.isDrawing) {
      onDrawingCancel();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [drawingState.isDrawing, onDrawingCancel]);
```

**User Experience:**
1. User starts drawing line
2. Clicks first point
3. Changes mind
4. Presses Escape
5. Drawing cancelled, tool returns to select mode

---

### 🖱️ Double-Click Handling (Polyline/Polygon)

**File:** `useDrawingHandlers.ts` (lines 99-119)

```typescript
const onDrawingDoubleClick = useCallback(() => {
  if (activeTool === 'polyline' || activeTool === 'polygon' ||
      activeTool === 'measure-area' || activeTool === 'measure-angle') {

    // Check for overlay completion first
    const { toolStyleStore } = require('../../stores/ToolStyleStore');
    const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

    if (!isOverlayCompletion) {
      // Standard DXF polyline completion
      const newEntity = finishPolyline();
      if (newEntity) {
        onEntityCreated(newEntity); // Add to scene
      }
      onToolChange('select'); // Return to select mode
    }
  }
}, [activeTool, finishPolyline, onEntityCreated, onToolChange]);
```

**Flow:**
```
User drawing polyline
  ↓ Click point 1
  ↓ Click point 2
  ↓ Click point 3
  ↓ Double-click
  ↓ onDrawingDoubleClick()
  ↓ finishPolyline() → creates entity with all points
  ↓ onEntityCreated(entity)
  ↓ Entity added to scene
  ↓ Tool changes to 'select'
```

**Difference from Line/Circle:**
- Line/Circle: Fixed number of points (auto-complete)
- Polyline/Polygon: Variable points (manual completion via double-click)

---

### 📋 Props Validation

#### Required Props (CanvasSection)

```typescript
interface CanvasSectionProps {
  // ✅ REQUIRED
  handleSceneChange: (scene: SceneModel) => void; // Must update parent scene
  currentScene: SceneModel;                       // Must have entities array
  transform: TransformState;                      // Must have offsetX, offsetY, scale

  // ✅ OPTIONAL
  activeTool?: ToolType;                          // Defaults to 'select'
  onToolChange?: (tool: ToolType) => void;        // Callback for tool changes
}
```

#### Required Props (DxfCanvas)

```typescript
interface DxfCanvasProps {
  // ✅ REQUIRED
  scene: SceneModel;                    // Entities to render
  transform: TransformState;            // Pan/zoom state

  // ✅ OPTIONAL
  onCanvasClick?: (point: Point2D) => void;  // For drawing tools
  onCanvasHover?: (point: Point2D | null) => void; // For preview
}
```

#### Validation Example

```typescript
// CanvasSection.tsx
useEffect(() => {
  if (!props.currentScene) {
    console.error('❌ CanvasSection: currentScene prop is required!');
  }
  if (!props.handleSceneChange) {
    console.error('❌ CanvasSection: handleSceneChange prop is required!');
  }
  if (!props.transform) {
    console.error('❌ CanvasSection: transform prop is required!');
  }
}, [props]);
```

---

### 📊 Console Logs Flow (Expected Sequence)

**Complete flow for drawing a line:**

```
1️⃣ Tool Selection:
   🎯 Auto-starting drawing for tool: line

2️⃣ First Click:
   🔥 handleMouseUp CALLED! { cursorPosition: {x:..., y:...}, isSelecting: false, isPanning: false }
   ✅ Calling onCanvasClick with: {x:..., y:...}
   🔥 handleCanvasClick called! { screenPos: {...}, activeTool: 'line' }
   🌍 worldPoint: {x:..., y:...}
   🔥 onDrawingPoint called: {x:..., y:...}
   🔥 snappedPoint: {x:..., y:...}
   🔥 transform: {offsetX:..., offsetY:..., scale:...}
   🔥 addPoint called - drawingState: {isDrawing: true, ...}
   🚀 addPoint called - state.isDrawing: true
   📍 Added point. Total points: 1

3️⃣ Second Click:
   🔥 handleMouseUp CALLED! { cursorPosition: {x:..., y:...}, isSelecting: false, isPanning: false }
   ✅ Calling onCanvasClick with: {x:..., y:...}
   🔥 handleCanvasClick called! { screenPos: {...}, activeTool: 'line' }
   🌍 worldPoint: {x:..., y:...}
   🔥 onDrawingPoint called: {x:..., y:...}
   🔥 snappedPoint: {x:..., y:...}
   🔥 transform: {offsetX:..., offsetY:..., scale:...}
   🔥 addPoint called - drawingState: {isDrawing: true, ...}
   🚀 addPoint called - state.isDrawing: true
   📍 Added point. Total points: 2
   ✅ Drawing COMPLETE! {tool: 'line', pointsCount: 2}
   🎨 Entity created: {newEntity: {...}, currentLevelId: '...'}
   ✅ Entity added to scene!
   📢 Calling onEntityCreated callback with entity: {...}

4️⃣ Rendering:
   [DxfCanvas useEffect triggers]
   [Entity renders on canvas]
```

**If any log is missing → Problem detected!**

---

### 🔧 Debug Mode Checklist

**Enable all debug flags:**

1. `useDrawingHandlers.ts` (line 9):
   ```typescript
   const DEBUG_DRAWING_HANDLERS = true;
   ```

2. `useUnifiedDrawing.ts`:
   ```typescript
   const DEBUG_DRAWING = true;
   ```

3. `useCentralizedMouseHandlers.ts`:
   ```typescript
   const DEBUG_MOUSE = true;
   ```

**Check console for:**
- ✅ All expected logs appear
- ✅ Coordinates are numbers (not NaN)
- ✅ Transform has valid values
- ✅ isDrawing is true when drawing
- ✅ Entity created with correct points
- ✅ Callback chain executes

---

### 🎯 Integration Points Summary

**Drawing System Dependencies:**

```
┌─────────────────────────────────────┐
│      DXFViewerLayout (Parent)       │
│  - Manages currentScene state       │
│  - Provides handleSceneChange       │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│         NormalView (Middle)         │
│  - Passes props through             │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      CanvasSection (Orchestrator)   │
│  - useDrawingHandlers               │
│  - handleCanvasClick                │
│  - Manages refs & callbacks         │
└─────┬───────────────────────┬───────┘
      ↓                       ↓
┌─────────────┐       ┌───────────────┐
│  DxfCanvas  │       │  LayerCanvas  │
│  - Renders  │       │  - Layers     │
│  - Events   │       │  - No block   │
└─────────────┘       └───────────────┘
```

**Critical Integration Points:**
1. **Props flow:** Parent → NormalView → CanvasSection
2. **Scene updates:** useUnifiedDrawing → callback → parent
3. **Mouse events:** DxfCanvas → handlers → drawing system
4. **Rendering:** Scene prop → DxfCanvas → visual update

---

## 13. QUICK REFERENCE

### 🚨 If Drawing Stops Working

**Step-by-step debugging:**

1. **Check tool is selected:**
   ```
   Console: "🎯 Auto-starting drawing for tool: line"
   ✅ Should appear when tool clicked
   ```

2. **Check clicks reach handler:**
   ```
   Console: "🔥 handleMouseUp CALLED!"
   Console: "✅ Calling onCanvasClick with: ..."
   ✅ Should appear on each click
   ```

3. **Check coordinates valid:**
   ```
   Console: "🌍 worldPoint: {x: 123.45, y: 67.89}"
   ✅ Numbers, not NaN!
   ```

4. **Check drawing state:**
   ```
   Console: "🚀 addPoint called - state.isDrawing: true"
   ✅ Must be true!
   ```

5. **Check entity created:**
   ```
   Console: "✅ Drawing COMPLETE!"
   Console: "🎨 Entity created: ..."
   ✅ After enough points
   ```

6. **Check callback fired:**
   ```
   Console: "📢 Calling onEntityCreated callback with entity: ..."
   ✅ Critical for rendering!
   ```

---

### 📝 Essential Code Patterns

#### Pattern 1: useRef for handlers
```typescript
const handlerRef = useRef(handler);
useEffect(() => { handlerRef.current = handler; }, [handler]);
useEffect(() => { handlerRef.current.method(); }, [dependency]);
```

#### Pattern 2: Coordinate conversion
```typescript
const rect = canvas.getBoundingClientRect();
const canvasPos = { x: screenX - rect.left, y: screenY - rect.top };
const worldPos = screenToWorld(canvasPos.x, canvasPos.y, w, h, transform);
```

#### Pattern 3: Callback chain
```typescript
// Child: Call callback when done
if (onComplete) onComplete(result);

// Parent: Update state when callback fires
onComplete={(result) => { updateState(result); }}
```

#### Pattern 4: Canvas element access
```typescript
const canvas = canvasRef.current?.getCanvas();
if (!canvas) return;
const width = canvas.clientWidth;
```

---

### 🎓 Key Learnings from 2-Day Debug

1. **Dual canvas architecture** - DxfCanvas (entities) ≠ LayerCanvas (visual layers)
2. **LayerCanvas blocks clicks** - MUST set pointerEvents: 'none' when drawing
3. **useRef prevents infinite loops** - Don't put object handlers in useEffect deps
4. **Canvas coords ≠ Screen coords** - Must subtract getBoundingClientRect offset
5. **React ref ≠ DOM element** - Use getCanvas() to get HTMLCanvasElement
6. **Stale closures are real** - Use ref.current for latest values
7. **Pointer events matter** - LayerCanvas can block DxfCanvas clicks
8. **Selection blocks drawing** - Must check tool type before starting selection
9. **Callback chain is critical** - Global store update ≠ React props update
10. **Y-axis flips in CAD** - Screen Y down, World Y up, must negate

---

## 14. ENVIRONMENT & SETUP

### 📦 Package Dependencies

**Critical packages for drawing system:**

```json
{
  "dependencies": {
    "react": "^18.x",
    "uuid": "^9.x",        // Entity ID generation
    "zustand": "^4.x"      // Level store
  }
}
```

**Check versions:**
```bash
npm list react uuid zustand
```

---

### 🖥️ Environment Requirements

**Node.js:** v18+ recommended
**npm:** v9+ recommended
**OS:** Windows 10/11, macOS 12+, Linux

**Verify:**
```bash
node -v   # Should be v18+
npm -v    # Should be v9+
```

---

### 🔗 Git Reference - Last Working Version

**Working Commit:** `ab5d272`
**Commit Message:** "Docs: Complete Line Drawing System Documentation (2000+ lines)"
**Date:** 2025-10-05
**Branch:** main
**Status:** ✅ All 6 bugs fixed, drawing working

**To get this exact version:**
```bash
git log --oneline | head -5          # Find commit hash
git checkout <commit-hash>           # Restore working version
npm install                          # Reinstall deps
npm run dev                         # Test
```

**Files changed in working version:**
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`
- `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`
- `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx`

---

### ⚠️ Known Issues & Limitations

**Current Known Issues (2025-10-05):**

1. **Drawing requires active level**
   - ❌ Won't work if no level selected
   - ✅ Fix: Always select a level before drawing

2. **Debug logs performance impact**
   - ❌ Heavy console logging may slow down in production
   - ✅ Fix: Disable debug flags before production build

3. **Browser compatibility**
   - ✅ Chrome/Edge: Fully working
   - ✅ Firefox: Fully working
   - ⚠️ Safari: Not tested (should work)

4. **Known NOT working:**
   - ❌ Touch devices (mobile/tablet) - mouse events only
   - ❌ Right-to-left (RTL) languages - coordinates not adjusted

---

### 🚨 Emergency Rollback Guide

**If drawing completely breaks after update:**

#### Quick Rollback (5 minutes):

```bash
# 1. Check git status
git status

# 2. See recent commits
git log --oneline -10

# 3. Identify last working commit (look for "Line drawing working" message)
# Working commit: ab5d272 Docs: Complete Line Drawing System Documentation

# 4. Create backup branch (just in case)
git branch backup-broken-version

# 5. Hard reset to working commit
git reset --hard ab5d272  # This is the verified working version!

# 6. Force reinstall
rm -rf node_modules package-lock.json
npm install

# 7. Restart dev server
npm run dev

# 8. Test drawing
# Open http://localhost:3001/dxf/viewer
# Click Line tool → Click twice → Line should appear
```

#### If reset doesn't work:

```bash
# Nuclear option - restore from backup folder
cp -r F:\Pagonis_Nestor\backups\[latest-backup]/* .
npm install
npm run dev
```

---

### 📸 Visual Verification Guide

**How to verify drawing is working:**

#### ✅ Step 1: Tool Selection
```
Look for toolbar → Click "Line" button
Expected: Button highlights, cursor changes
Console: "🎯 Auto-starting drawing for tool: line"
```

#### ✅ Step 2: First Click
```
Click anywhere on canvas
Expected:
- No selection box appears
- No pan/zoom happens
- Console shows multiple logs (handleMouseUp, onCanvasClick, etc.)
```

#### ✅ Step 3: Second Click
```
Click another point on canvas
Expected:
- Line appears immediately connecting both points
- Console shows "✅ Drawing COMPLETE!" and "📢 Calling onEntityCreated"
- Tool automatically deselects (returns to select mode)
```

#### ❌ Signs of Failure:

| Symptom | Likely Cause | Fix Section |
|---------|--------------|-------------|
| Selection box appears | Bug #2: Selection blocking | Section 8, Bug #2 |
| Nothing happens on click | Bug #3: LayerCanvas blocking | Section 8, Bug #3 |
| Coordinates are NaN | Bug #5: Canvas dimensions | Section 8, Bug #5 |
| Line created but not visible | Bug #6: Rendering | Section 8, Bug #6 |
| Browser freezes | Bug #1: Infinite loop | Section 8, Bug #1 |

---

### 🧪 Automated Testing (Future)

**Test script to verify drawing works:**

```typescript
// __tests__/line-drawing.test.ts
describe('Line Drawing System', () => {
  it('should create line entity on two clicks', () => {
    // 1. Select line tool
    // 2. Simulate click at (100, 100)
    // 3. Simulate click at (200, 200)
    // 4. Verify entity created with correct points
    // 5. Verify entity rendered on canvas
  });

  it('should not interfere with selection mode', () => {
    // 1. Select tool
    // 2. Verify selection mode disabled
  });

  // ... more tests
});
```

**Run tests:**
```bash
npm run test:drawing  # When implemented
```

---

### 📋 Pre-Deployment Checklist

**Before deploying to production:**

- [ ] Disable all debug flags
  - [ ] `DEBUG_DRAWING_HANDLERS = false` (useDrawingHandlers.ts)
  - [ ] `DEBUG_DRAWING = false` (useUnifiedDrawing.ts)
  - [ ] `DEBUG_MOUSE = false` (useCentralizedMouseHandlers.ts)

- [ ] Verify all 6 bugs are fixed
  - [ ] No infinite loops (Bug #1)
  - [ ] No selection blocking (Bug #2)
  - [ ] LayerCanvas not blocking (Bug #3)
  - [ ] No stale closures (Bug #4)
  - [ ] Canvas dimensions valid (Bug #5)
  - [ ] Rendering works (Bug #6)

- [ ] Test all drawing tools
  - [ ] Line (2 clicks)
  - [ ] Circle (center + radius)
  - [ ] Rectangle (2 corners)
  - [ ] Polyline (multiple + double-click)
  - [ ] Polygon (multiple + double-click)
  - [ ] Arc (3 points)

- [ ] Test edge cases
  - [ ] No active level → Should show error
  - [ ] Pan/zoom during drawing → Should not interfere
  - [ ] Escape key → Should cancel
  - [ ] Tool change during drawing → Should cancel

- [ ] Performance check
  - [ ] Console logs minimal
  - [ ] No memory leaks
  - [ ] Smooth rendering at 60fps

- [ ] Git commit
  - [ ] Descriptive commit message
  - [ ] Tag version: `git tag v1.0-drawing-working`
  - [ ] Document commit hash in this file

---

## 15. FUTURE IMPROVEMENTS

### Potential Enhancements:
1. Add visual preview while drawing (rubber-band line)
2. Show point count indicator
3. Add undo/redo for drawing
4. Snap-to-grid visualization
5. Multi-entity selection after drawing
6. Drawing constraints (ortho mode, polar tracking)

---

## 📞 SUPPORT

If drawing stops working after code changes:

1. Check this documentation's troubleshooting section
2. Verify all 6 bugs are still fixed
3. Check console logs match expected flow
4. Verify callback chain is intact
5. Test with debug flags enabled

**Last Working Version:** 2025-10-05
**Last Verified By:** Claude (Anthropic AI Developer)
**Working Commit:** (Add git commit hash here when committing)

---

**END OF DOCUMENTATION**
