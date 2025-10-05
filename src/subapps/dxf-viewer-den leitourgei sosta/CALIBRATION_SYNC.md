# 🎯 CALIBRATION & SYNCHRONIZATION - MASTER DOCUMENTATION

**Τελευταία Ενημέρωση**: 2025-10-01
**Status**: ✅ Production Ready

---

## 📋 ΠΕΡΙΕΧΟΜΕΝΑ

1. [Επισκόπηση Συστήματος](#επισκόπηση-συστήματος)
2. [Single Source of Truth - CoordinateTransforms](#single-source-of-truth)
3. [Canvas Architecture](#canvas-architecture)
4. [Coordinate Systems & Transforms](#coordinate-systems--transforms)
5. [Rendering Pipeline](#rendering-pipeline)
6. [Mouse/Cursor Integration](#mousecursor-integration)
7. [Rulers & Grid Synchronization](#rulers--grid-synchronization)
8. [Debug & Calibration Tools](#debug--calibration-tools)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🎯 ΕΠΙΣΚΟΠΗΣΗ ΣΥΣΤΗΜΑΤΟΣ

Το DXF Viewer χρησιμοποιεί **κεντρικοποιημένο coordinate system** με **δύο canvas layers**:

### Βασική Αρχιτεκτονική:

```
┌─────────────────────────────────────────┐
│         SCREEN COORDINATES              │
│  (Browser viewport, pixel-based)        │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   DxfCanvas (Base Layer)        │   │
│  │   - Grid                        │   │
│  │   - Rulers                      │   │
│  │   - DXF Entities                │   │
│  │   - Debug Overlays              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   LayerCanvas (Overlay Layer)   │   │
│  │   - Selection Box               │   │
│  │   - Snap Indicators             │   │
│  │   - Cursor/Crosshair            │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│      WORLD COORDINATES (CAD)            │
│  (DXF space, mm/units-based)            │
└─────────────────────────────────────────┘
```

### Κλειδιά Στοιχεία:
- ✅ **1 Coordinate System** (CoordinateTransforms)
- ✅ **2 Canvas Layers** (DxfCanvas + LayerCanvas)
- ✅ **Synchronized Rendering** (Grid, Rulers, Entities)
- ✅ **Centralized Mouse Handling** (CursorSystem)

---

## 🔑 SINGLE SOURCE OF TRUTH

### CoordinateTransforms.ts
**Διαδρομή**: `src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts`

**Ρόλος**: Η **ΜΟΝΗ** πηγή αλήθειας για μετατροπές συντεταγμένων.

#### Κύριες Μέθοδοι:

```typescript
// 1. World → Screen (DXF → Pixels)
screenToWorld(screenX: number, screenY: number, transform: ViewTransform): Point2D

// 2. Screen → World (Pixels → DXF)
worldToScreen(worldX: number, worldY: number, transform: ViewTransform): Point2D

// 3. Transform Calculation
calculateViewTransform(
  viewport: Viewport,
  bounds: Bounds,
  scale: number,
  panOffset: Point2D
): ViewTransform
```

#### Coordinate Layout (FIXED):

```typescript
export const COORDINATE_LAYOUT = {
  ORIGIN: 'BOTTOM_LEFT',  // (0,0) στην κάτω αριστερή γωνία
  Y_AXIS: 'UP',           // Y+ πάει πάνω (AutoCAD style)
  MARGINS: {
    top: 30,    // Horizontal ruler height
    left: 30,   // Vertical ruler width
    bottom: 0,
    right: 0
  }
}
```

#### ViewTransform Structure:

```typescript
interface ViewTransform {
  scale: number;      // Zoom level (pixels per world unit)
  offsetX: number;    // Screen X offset (pixels)
  offsetY: number;    // Screen Y offset (pixels)
}
```

---

## 🖼️ CANVAS ARCHITECTURE

### 1. DxfCanvas (Base Layer)
**Διαδρομή**: `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx`

**Rendering Order**:
1. **Grid** (`GridRenderer`) - Background
2. **Rulers** (`RulerRenderer`) - Frame
3. **DXF Entities** (`DxfRenderer`) - Content
4. **Debug Overlays** (`RulerTickMarkersRenderer`, `CalibrationGridRenderer`)

**Z-Index**: 5

**Χρήση**:
```tsx
<DxfCanvas
  scene={scene}
  transform={transform}
  viewport={viewport}
  gridSettings={gridSettings}
  rulerSettings={rulerSettings}
  renderOptions={renderOptions}
/>
```

### 2. LayerCanvas (Overlay Layer)
**Διαδρομή**: `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx`

**Rendering Order**:
1. **Selection Box** (`SelectionRenderer`)
2. **Snap Indicators** (`SnapRenderer`)
3. **Crosshair** (`CrosshairRenderer`)
4. **Cursor** (`CursorRenderer`)

**Z-Index**: 10

**Χρήση**:
```tsx
<LayerCanvas
  transform={transform}
  viewport={viewport}
  crosshairSettings={crosshairSettings}
  cursorSettings={cursorSettings}
  snapSettings={snapSettings}
/>
```

---

## 🔄 COORDINATE SYSTEMS & TRANSFORMS

### Transform Flow:

```
User Input (Mouse)
    ↓
Screen Coordinates (pixels)
    ↓
CoordinateTransforms.screenToWorld()
    ↓
World Coordinates (DXF units)
    ↓
Entity Processing
    ↓
CoordinateTransforms.worldToScreen()
    ↓
Screen Rendering (canvas)
```

### Συγχρονισμός Transforms:

**1. Centralized State (CanvasContext)**
```typescript
// src/subapps/dxf-viewer/contexts/CanvasContext.tsx
const [transform, setTransform] = useState<ViewTransform>({
  scale: 1.0,
  offsetX: 0,
  offsetY: 0
});
```

**2. Propagation στα Canvas**
```typescript
// DxfViewerContent.tsx
<DxfCanvas transform={transform} ... />
<LayerCanvas transform={transform} ... />
```

**3. Same Transform = Perfect Alignment** ✅

---

## 🎨 RENDERING PIPELINE

### Unified Rendering Flow:

#### 1. Grid Rendering
**Αρχείο**: `src/subapps/dxf-viewer/rendering/ui/grid/GridRenderer.ts`

**Υπολογισμοί**:
```typescript
// Grid line calculation (EXACTLY matches rulers)
const step = gridSpacing * transform.scale;
const startY = transform.offsetY % step;

for (let y = startY; y <= viewport.height; y += step) {
  const worldY = (y - transform.offsetY) / transform.scale;
  // Draw horizontal grid line at y
}
```

#### 2. Rulers Rendering
**Αρχείο**: `src/subapps/dxf-viewer/rendering/ui/ruler/RulerRenderer.ts`

**Horizontal Ruler** (Bottom):
```typescript
// Position: viewport.height - rulerHeight (bottom of screen)
const rulerRect = {
  x: 0,
  y: viewport.height - rulerHeight,
  width: viewport.width,
  height: rulerHeight
};

// Tick positions
const step = tickInterval * transform.scale;
const startX = transform.offsetX % step;

for (let x = startX; x <= viewport.width; x += step) {
  const worldX = (x - transform.offsetX) / transform.scale;
  // Draw tick at x, rulerRect.y + rulerRect.height / 2
}
```

**Vertical Ruler** (Left):
```typescript
// Position: x = 0 (left edge)
const rulerRect = {
  x: 0,
  y: 0,
  width: rulerWidth,
  height: viewport.height
};

// Tick positions (SAME as Grid!)
const step = tickInterval * transform.scale;
const startY = transform.offsetY % step;

for (let y = startY; y <= viewport.height; y += step) {
  const worldY = (y - transform.offsetY) / transform.scale;
  // Draw tick at rulerRect.x + rulerRect.width / 2, y
}
```

#### 3. DXF Entities Rendering
**Αρχείο**: `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts`

**Entity Transform**:
```typescript
// Each entity uses CoordinateTransforms
const screenPos = CoordinateTransforms.worldToScreen(
  entity.worldX,
  entity.worldY,
  transform
);

// Render at screen position
ctx.lineTo(screenPos.x, screenPos.y);
```

---

## 🖱️ MOUSE/CURSOR INTEGRATION

### Centralized Mouse Handling
**Αρχείο**: `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`

**Flow**:
```
Mouse Event (LayerCanvas)
    ↓
useCentralizedMouseHandlers
    ↓
CoordinateTransforms.screenToWorld()
    ↓
Update CursorSystem state
    ↓
Render Cursor/Crosshair (LayerCanvas)
```

### Cursor System
**Αρχείο**: `src/subapps/dxf-viewer/systems/cursor/CursorSystem.tsx`

**State Management**:
```typescript
interface CursorState {
  position: Point2D | null;        // Screen coordinates
  worldPosition: Point2D | null;   // World coordinates
  isSelecting: boolean;
  selectionStart: Point2D | null;
  selectionCurrent: Point2D | null;
}
```

**Coordinate Conversion**:
```typescript
// Mouse event → World coordinates
const handleMouseMove = (e: React.MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const worldPos = CoordinateTransforms.screenToWorld(
    screenX,
    screenY,
    transform
  );

  setCursorPosition({ screenX, screenY, worldPos });
};
```

### Cursor Rendering
**Αρχείο**: `src/subapps/dxf-viewer/rendering/ui/cursor/CursorRenderer.ts`

```typescript
render(position: Point2D, viewport: Viewport, settings: CursorSettings) {
  // Position is already in screen coordinates
  // No transform needed - direct rendering
  ctx.arc(position.x, position.y, settings.radius, 0, Math.PI * 2);
}
```

---

## 📏 RULERS & GRID SYNCHRONIZATION

### RulersGridSystem
**Διαδρομή**: `src/subapps/dxf-viewer/systems/rulers-grid/RulersGridSystem.tsx`

**Critical Synchronization Points**:

#### 1. Shared Transform
```typescript
// Both Grid and Rulers receive SAME transform
<GridRenderer transform={transform} />
<RulerRenderer transform={transform} />
```

#### 2. Identical Calculations
```typescript
// Grid calculation
const gridStep = gridSpacing * transform.scale;
const gridStartY = transform.offsetY % gridStep;

// Ruler calculation (MUST MATCH!)
const rulerStep = tickInterval * transform.scale;
const rulerStartY = transform.offsetY % rulerStep;

// IF gridSpacing === tickInterval → Perfect alignment! ✅
```

#### 3. Origin Alignment
```typescript
// Both use BOTTOM_LEFT origin from COORDINATE_LAYOUT
const origin = {
  x: transform.offsetX,  // Screen X of world (0,0)
  y: transform.offsetY   // Screen Y of world (0,0)
};
```

### Ruler Settings (Default)
```typescript
// src/subapps/dxf-viewer/systems/rulers-grid/config.ts
export const DEFAULT_RULER_SETTINGS = {
  horizontal: {
    enabled: false,
    height: 30,
    position: 'bottom',  // 🔧 FIXED: Was 'top', now 'bottom'
    tickInterval: 100,   // mm (MUST match grid spacing!)
    // ...
  },
  vertical: {
    enabled: false,
    width: 30,
    position: 'left',
    tickInterval: 100,   // mm (MUST match grid spacing!)
    // ...
  }
}
```

### Grid Settings (Default)
```typescript
export const DEFAULT_GRID_SETTINGS = {
  visual: {
    enabled: false,
    spacing: 100,        // mm (MUST match ruler tickInterval!)
    style: 'lines',
    // ...
  }
}
```

---

## 🛠️ DEBUG & CALIBRATION TOOLS

### 1. Ruler Debug Overlay
**Αρχείο**: `src/subapps/dxf-viewer/debug/RulerDebugOverlay.ts`

**Purpose**: Enterprise-grade ruler calibration and verification

**Global Instance**:
```typescript
// Available globally
window.rulerDebugOverlay.toggle();
window.rulerDebugOverlay.getStatus();
```

**Features**:
- ✅ Tick Markers (Red/Green dots)
- ✅ Calibration Grid (Cyan 100mm grid)
- ✅ Alignment Verification

### 2. Ruler Tick Markers Renderer
**Αρχείο**: `src/subapps/dxf-viewer/debug/RulerTickMarkersRenderer.ts`

**Critical Calculations**:

**Horizontal Ticks**:
```typescript
// MUST match RulerRenderer horizontal tick calculation
const rulerHeight = 30;
const rulerY = viewport.height - rulerHeight / 2;  // Middle of bottom ruler

const majorTickInterval = 100;  // mm
const step = majorTickInterval * transform.scale;
const startX = transform.offsetX % step;

for (let x = startX; x <= viewport.width; x += step) {
  const worldX = (x - transform.offsetX) / transform.scale;
  // Draw red dot at (x, rulerY)
  ctx.arc(x, rulerY, 4, 0, Math.PI * 2);
}
```

**Vertical Ticks**:
```typescript
// MUST match RulerRenderer vertical tick calculation
const rulerWidth = 30;
const rulerX = rulerWidth / 2;  // Middle of left ruler

const majorTickInterval = 100;  // mm
const step = majorTickInterval * transform.scale;
const startY = transform.offsetY % step;

// 🔧 CRITICAL: Start from startY (NOT startY + offset!)
for (let y = startY; y <= viewport.height; y += step) {
  const worldY = (y - transform.offsetY) / transform.scale;
  // Draw red dot at (rulerX, y)
  ctx.arc(rulerX, y, 4, 0, Math.PI * 2);
}
```

### 3. Calibration Grid Renderer
**Αρχείο**: `src/subapps/dxf-viewer/debug/CalibrationGridRenderer.ts`

**Purpose**: Visual reference grid for alignment verification

```typescript
// Cyan grid lines every 100mm
const gridSpacing = 100;  // mm
const step = gridSpacing * transform.scale;

// Horizontal lines (SAME calculation as Grid/Rulers!)
const startY = transform.offsetY % step;
for (let y = startY; y <= viewport.height; y += step) {
  ctx.strokeStyle = 'cyan';
  ctx.moveTo(0, y);
  ctx.lineTo(viewport.width, y);
}
```

### 4. Origin Markers
**Αρχείο**: `src/subapps/dxf-viewer/rendering/ui/origin/OriginMarkersRenderer.ts`

**Purpose**: Visual marker at world (0,0) origin

```typescript
// Mark world origin on screen
const screenOrigin = CoordinateTransforms.worldToScreen(0, 0, transform);

ctx.strokeStyle = 'magenta';
ctx.lineWidth = 3;
// Draw cross at origin
ctx.moveTo(screenOrigin.x - 10, screenOrigin.y);
ctx.lineTo(screenOrigin.x + 10, screenOrigin.y);
ctx.moveTo(screenOrigin.x, screenOrigin.y - 10);
ctx.lineTo(screenOrigin.x, screenOrigin.y + 10);
```

---

## 🚨 TROUBLESHOOTING GUIDE

### Problem: Rulers/Grid Misalignment

**Symptoms**:
- Grid lines don't match ruler ticks
- Debug markers offset from rulers
- Origin (0,0) not at expected position

**Root Causes & Solutions**:

#### 1. Different Transform Objects
**Problem**: Grid and Rulers receive different transform instances

**Solution**:
```typescript
// ❌ WRONG - Different transforms
<GridRenderer transform={gridTransform} />
<RulerRenderer transform={rulerTransform} />

// ✅ CORRECT - Same transform
<GridRenderer transform={transform} />
<RulerRenderer transform={transform} />
```

#### 2. Mismatched Spacing/Interval
**Problem**: Grid spacing ≠ Ruler tick interval

**Solution**:
```typescript
// Ensure matching values
const TICK_INTERVAL = 100;  // mm

gridSettings.visual.spacing = TICK_INTERVAL;
rulerSettings.horizontal.tickInterval = TICK_INTERVAL;
rulerSettings.vertical.tickInterval = TICK_INTERVAL;
```

#### 3. Different Calculation Methods
**Problem**: Grid uses different Y-calculation than Rulers

**Solution**:
```typescript
// ❌ WRONG
const gridStartY = someCustomCalculation();

// ✅ CORRECT - Use SAME calculation
const startY = transform.offsetY % step;  // For BOTH Grid and Rulers
```

#### 4. Wrong Canvas for Debug Rendering
**Problem**: Debug markers render on LayerCanvas, rulers on DxfCanvas

**Solution**:
```typescript
// ❌ WRONG - Different canvas
// LayerRenderer renders debug markers

// ✅ CORRECT - Same canvas as rulers
// DxfCanvas renders BOTH rulers AND debug markers
```

#### 5. Ruler Position Confusion
**Problem**: Hardcoded positions don't match actual ruler settings

**Solution**:
```typescript
// Always use actual ruler settings
const rulerHeight = rulerSettings.horizontal.height;  // Don't hardcode 30!
const rulerPosition = rulerSettings.horizontal.position;  // 'top' or 'bottom'

// Calculate position dynamically
const rulerY = rulerPosition === 'bottom'
  ? viewport.height - rulerHeight / 2
  : rulerHeight / 2;
```

---

## 📊 VERIFICATION CHECKLIST

### Pre-Deployment Verification:

- [ ] **Grid-Ruler Alignment**
  - Grid lines align perfectly with ruler major ticks
  - Test at multiple zoom levels (0.5x, 1.0x, 2.0x, 5.0x)

- [ ] **Debug Markers**
  - Red dots exactly on ruler major ticks (100mm)
  - Green dots exactly on ruler minor ticks (10mm)
  - Test with debug overlay enabled: `window.rulerDebugOverlay.toggle()`

- [ ] **Mouse Coordinates**
  - Cursor world position matches ruler readings
  - (0,0) origin marker at bottom-left corner
  - Crosshair aligns with grid/ruler intersections

- [ ] **Multi-Canvas Sync**
  - Selection box aligns with entities
  - Snap indicators at correct grid points
  - Crosshair/cursor at correct position

- [ ] **Transform Consistency**
  - All systems use same transform object
  - Pan/Zoom updates all renderers
  - No coordinate drift after operations

---

## 🔑 KEY FILES REFERENCE

### Core Coordinate System:
- `rendering/core/CoordinateTransforms.ts` - **Single Source of Truth**
- `rendering/types/Types.ts` - Type definitions

### Canvas Layers:
- `canvas-v2/dxf-canvas/DxfCanvas.tsx` - Base rendering layer
- `canvas-v2/layer-canvas/LayerCanvas.tsx` - Overlay layer

### Renderers (UI):
- `rendering/ui/grid/GridRenderer.ts` - Grid rendering
- `rendering/ui/ruler/RulerRenderer.ts` - Ruler rendering
- `rendering/ui/crosshair/CrosshairRenderer.ts` - Crosshair
- `rendering/ui/cursor/CursorRenderer.ts` - Cursor
- `rendering/ui/origin/OriginMarkersRenderer.ts` - Origin markers

### Debug Tools:
- `debug/RulerDebugOverlay.ts` - Debug overlay manager
- `debug/RulerTickMarkersRenderer.ts` - Tick markers (red/green dots)
- `debug/CalibrationGridRenderer.ts` - Calibration grid (cyan)

### Systems:
- `systems/cursor/CursorSystem.tsx` - Centralized cursor state
- `systems/cursor/useCentralizedMouseHandlers.ts` - Mouse event handling
- `systems/rulers-grid/RulersGridSystem.tsx` - Rulers & Grid system

### Context:
- `contexts/CanvasContext.tsx` - Canvas state & transform

---

## 📝 NOTES & BEST PRACTICES

### 1. Transform Immutability
```typescript
// ✅ CORRECT - Create new transform
const newTransform = {
  ...transform,
  scale: transform.scale * 1.2
};
setTransform(newTransform);

// ❌ WRONG - Mutate existing
transform.scale *= 1.2;  // Don't do this!
```

### 2. Coordinate Conversion
```typescript
// Always use CoordinateTransforms - NEVER manual calculations!

// ✅ CORRECT
const worldPos = CoordinateTransforms.screenToWorld(x, y, transform);

// ❌ WRONG
const worldPos = { x: x / scale, y: y / scale };  // Missing offset, wrong Y-axis!
```

### 3. Debug Mode
```typescript
// Enable debug overlay via console
window.rulerDebugOverlay.toggle();

// Check status
const status = window.rulerDebugOverlay.getStatus();
console.log('Debug enabled:', status.enabled);
console.log('Tick markers:', status.features.tickMarkers);
console.log('Calibration grid:', status.features.calibrationGrid);
```

### 4. Performance
```typescript
// Render debug tools ONLY when enabled
if (typeof window !== 'undefined' && (window as any).rulerDebugOverlay) {
  const rulerStatus = rulerDebug.getStatus();
  if (rulerStatus.enabled) {
    // Render debug overlays
  }
}
```

---

## 🎓 LEARNING RESOURCES

### CAD Coordinate Systems:
- AutoCAD User Coordinate System (UCS)
- Rhino World/Construction Plane
- SolidWorks Coordinate Systems

### Canvas Rendering:
- HTML5 Canvas API
- Coordinate Transformations
- Multi-layer Rendering

### React Patterns:
- Context API for shared state
- useRef for canvas management
- useEffect for rendering sync

---

**Τελευταία Ενημέρωση**: 2025-10-01
**Συντάκτης**: Claude (Anthropic AI) & Γιώργος Παγώνης
**Status**: ✅ Production Ready - Fully Calibrated & Synchronized
