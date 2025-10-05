# Line Drawing System - Coordinate Systems & Mouse Events

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [architecture.md](architecture.md), [rendering-dependencies.md](rendering-dependencies.md), [implementation.md](implementation.md)

---

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING

---

## 📚 Navigation

| Document | Purpose |
|----------|---------|
| [← README](README.md) | Documentation index & quick start |
| [architecture.md](architecture.md) | Core architecture & dual canvas |
| **[coordinates-events.md](coordinates-events.md)** | **← YOU ARE HERE** |
| [rendering-dependencies.md](rendering-dependencies.md) | Rendering pipeline & file dependencies |
| [status-report.md](status-report.md) | Current implementation status |
| [root-cause.md](root-cause.md) | Why settings were never applied |
| [lifecycle.md](lifecycle.md) | Preview/Completion phases |
| [implementation.md](implementation.md) | Code changes needed |
| [testing.md](testing.md) | Test scenarios & verification |

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

## 5. MOUSE EVENTS & CANVAS INTERACTION

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

## 🔗 NEXT STEPS

**Continue Learning:**
- **[rendering-dependencies.md](rendering-dependencies.md)** - Learn rendering pipeline & file dependencies
- **[implementation.md](implementation.md)** - See exact code changes needed

**Previous:**
- **[← architecture.md](architecture.md)** - Core architecture & dual canvas system

---

**Last Updated:** 2025-10-05
**Part of:** Line Drawing System Documentation
**Next:** [Rendering Pipeline & File Dependencies →](rendering-dependencies.md)
