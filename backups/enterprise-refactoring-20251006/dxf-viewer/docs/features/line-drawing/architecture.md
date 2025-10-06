# Line Drawing System - Architecture & Core Components

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [lifecycle.md](lifecycle.md), [rendering-dependencies.md](rendering-dependencies.md), [coordinates-events.md](coordinates-events.md)

---

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING

---

## 📚 Navigation

| Document | Purpose |
|----------|---------|
| [← README](README.md) | Documentation index & quick start |
| **[architecture.md](architecture.md)** | **← YOU ARE HERE** |
| [coordinates-events.md](coordinates-events.md) | Coordinate systems & mouse events |
| [rendering-dependencies.md](rendering-dependencies.md) | Rendering pipeline & file dependencies |
| [status-report.md](status-report.md) | Current implementation status |
| [root-cause.md](root-cause.md) | Why settings were never applied |
| [lifecycle.md](lifecycle.md) | Preview/Completion phases |
| [implementation.md](implementation.md) | Code changes needed |
| [testing.md](testing.md) | Test scenarios & verification |

---

## 1. SYSTEM OVERVIEW

### What is the Line Drawing System?

The Line Drawing System allows users to draw CAD entities (Line, Circle, Rectangle, Polyline, Polygon, Arc) on the DXF canvas by clicking points. It's a core CAD functionality compatible with **AutoCAD/BricsCAD/ZWCAD** standards.

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

## 🔗 NEXT STEPS

**Continue Learning:**
- **[coordinates-events.md](coordinates-events.md)** - Understand coordinate systems & mouse event flow
- **[rendering-dependencies.md](rendering-dependencies.md)** - Learn rendering pipeline & file structure

**Jump to Implementation:**
- **[implementation.md](implementation.md)** - See exact code changes needed
- **[testing.md](testing.md)** - Know how to verify it works

---

**Last Updated:** 2025-10-05
**Part of:** Line Drawing System Documentation
**Next:** [Coordinate Systems & Mouse Events →](coordinates-events.md)
