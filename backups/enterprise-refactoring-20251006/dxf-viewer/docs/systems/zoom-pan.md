# 🔍 Zoom & Pan System

> **Enterprise-grade zoom and pan functionality για το DXF Viewer**
> Κεντρικοποιημένο σύστημα με AutoCAD-class features

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Enterprise Features](#enterprise-features)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Mouse Controls](#mouse-controls)
- [Implementation Details](#implementation-details)

---

## Overview

Το Zoom & Pan System είναι ένα **κεντρικοποιημένο Enterprise-grade σύστημα** που χειρίζεται όλες τις zoom και pan operations στο DXF Viewer.

### 🎯 Design Principles

1. **Single Source of Truth** - Ένας ZoomManager για όλα τα zoom operations
2. **Cursor-Centered Behavior** - Zoom γύρω από το cursor, όχι το center
3. **Cross-Platform Support** - Ctrl (Windows/Linux) + Cmd (macOS)
4. **Browser Conflict Avoidance** - NO Ctrl+± shortcuts (hijacked by browser)
5. **Backward Compatibility** - Zero breaking changes με fallback chains

### ✅ Features

- ✅ Mouse Wheel zoom (cursor-centered)
- ✅ Ctrl+Wheel → Fast zoom (2x speed)
- ✅ Shift+Wheel → Horizontal pan
- ✅ Keyboard shortcuts (Shift+0/1, Numpad +/-, bare +/-)
- ✅ Zoom to fit / selection / window
- ✅ DPI-aware 100% zoom (1:1 real-world scale)
- ✅ History navigation (previous/next)
- ✅ Constraints (min/max scale, bounds)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CanvasProvider (Root)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           ZoomManager (Single Instance)               │  │
│  │  • zoomIn/Out • wheelZoom • zoomToFit • history      │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │ (consumes via Context)           │
│           ┌───────────────┼───────────────┐                 │
│           │               │               │                 │
│    ┌──────▼─────┐  ┌─────▼──────┐  ┌────▼──────┐          │
│    │ Keyboard   │  │   Mouse    │  │  Canvas   │          │
│    │ Shortcuts  │  │  Handlers  │  │Operations │          │
│    │ (useKey... │  │(useCentr..│  │(useCanvas.│          │
│    └────────────┘  └────────────┘  └───────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (Wheel/Keyboard)
    ↓
useCentralizedMouseHandlers / useKeyboardShortcuts
    ↓
Detect modifiers (Ctrl/Shift)
    ↓
useZoom.handleWheelZoom(deltaY, center, constraints, modifiers)
    ↓
ZoomManager.wheelZoom(deltaY, center, constraints, modifiers)
    ├─ modifiers.ctrlKey → CTRL_WHEEL_IN/OUT (1.2/0.8 = fast)
    └─ No modifier → WHEEL_IN/OUT (1.1/0.9 = normal)
    ↓
calculateZoomTransform(newScale, center, viewport)
    ↓
Update transform + emit events
    ↓
Canvas re-renders
```

---

## Core Components

### A. ZoomManager (ΚΕΝΤΡΙΚΗ ΚΛΑΣΗ)

**Path**: `src/subapps/dxf-viewer/systems/zoom/ZoomManager.ts`

**Ευθύνη**: Centralized zoom logic για ΟΛΑ τα zoom operations

**Key Methods**:
```typescript
class ZoomManager {
  // Basic zoom
  zoomIn(center?: Point2D, constraints?: ZoomConstraints): ZoomResult
  zoomOut(center?: Point2D, constraints?: ZoomConstraints): ZoomResult

  // Wheel zoom με Enterprise modifiers
  wheelZoom(
    wheelDelta: number,
    center: Point2D,
    constraints?: ZoomConstraints,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ): ZoomResult

  // Advanced zoom
  zoomToFit(bounds: Bounds, viewport: Viewport, alignToOrigin?: boolean): ZoomResult
  zoomToScale(scale: number, center?: Point2D): ZoomResult
  zoomTo100(center?: Point2D): ZoomResult  // 🎯 DPI-aware 1:1
  zoomToWindow(start: Point2D, end: Point2D, viewport: Viewport): ZoomResult

  // History
  zoomPrevious(): ZoomResult | null
  zoomNext(): ZoomResult | null
  clearHistory(): void

  // State
  getCurrentTransform(): ViewTransform
  setTransform(transform: ViewTransform, mode?: ZoomMode): void
}
```

### B. useZoom Hook

**Path**: `src/subapps/dxf-viewer/systems/zoom/hooks/useZoom.ts`

**Ευθύνη**: React hook wrapper γύρω από ZoomManager

**API**:
```typescript
const useZoom = ({
  initialTransform: ViewTransform,
  config?: Partial<ZoomConfig>,
  onTransformChange?: (transform: ViewTransform) => void
}): UseZoomReturn

interface UseZoomReturn {
  zoomIn(center?, constraints?): void
  zoomOut(center?, constraints?): void
  handleWheelZoom(wheelDelta, center, constraints?, modifiers?): void
  zoomToFit(bounds, viewport, alignToOrigin?): ZoomResult
  zoomTo100(center?): ZoomResult
  // ... more methods
  zoomManager: ZoomManager  // Direct access για advanced use
}
```

### C. Keyboard Shortcuts

**Path**: `src/subapps/dxf-viewer/hooks/useKeyboardShortcuts.ts`

**Ευθύνη**: Centralized keyboard shortcut handling

**Architecture**:
- ✅ Consumes `ZoomManager` από `CanvasContext` (NOT from props/refs)
- ✅ Input field detection (no shortcuts when typing)
- ✅ Cross-platform modifiers (Ctrl/Cmd)
- ✅ NO browser conflicts (removed Ctrl+± shortcuts)

### D. Mouse Handlers

**Path**: `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`

**Ευθύνη**: Centralized mouse event handling

**Features**:
- ✅ Modifier detection: `e.ctrlKey || e.metaKey`, `e.shiftKey`
- ✅ Ctrl+Wheel → Fast zoom (passes modifiers to ZoomManager)
- ✅ Shift+Wheel → Horizontal pan (offsetX adjustment)
- ✅ Canvas bounds caching (performance)
- ✅ rAF-based smooth panning

### E. Canvas Operations Hook

**Path**: `src/subapps/dxf-viewer/hooks/interfaces/useCanvasOperations.ts`

**Ευθύνη**: Imperative API για backward compatibility

**Fallback Chain**:
```typescript
Priority 1: zoomManager (from CanvasContext)
    ↓ (if not available)
Priority 2: dxfRef.current.zoomIn() (imperative API)
    ↓ (if not available)
Priority 3: Custom events (legacy fallback)
```

**Features**:
- ✅ Zero breaking changes (4 existing files use this)
- ✅ NaN/Infinity guards (prevents flickering)
- ✅ Unchanged optimization (skip updates if values same)

---

## Enterprise Features

### 🏢 1. Ctrl+Wheel Fast Zoom (2025-10-03)

**What**: Ctrl/Cmd+Wheel = 2x ταχύτερο zoom

**Implementation**:
```typescript
// zoom-constants.ts
export const ZOOM_FACTORS = {
  WHEEL_IN: 1.1,        // Normal: 10% per step
  WHEEL_OUT: 0.9,
  CTRL_WHEEL_IN: 1.2,   // Fast: 20% per step (2x faster)
  CTRL_WHEEL_OUT: 0.8,
}

// ZoomManager.ts
wheelZoom(wheelDelta, center, constraints?, modifiers?) {
  const useCtrlZoom = modifiers?.ctrlKey === true
  const factor = wheelDelta > 0
    ? (useCtrlZoom ? CTRL_WHEEL_IN : WHEEL_IN)
    : (useCtrlZoom ? CTRL_WHEEL_OUT : WHEEL_OUT)
  // ...
}
```

**Why**: Standard σε AutoCAD, Blender - ταχύτερη navigation σε μεγάλα drawings

### 🏢 2. Shift+Wheel Horizontal Pan (2025-10-03)

**What**: Shift+Wheel = pan αριστερά/δεξιά

**Implementation**:
```typescript
// useCentralizedMouseHandlers.ts
if (modifiers.shiftKey) {
  e.preventDefault()
  const panSpeed = 2  // Pixels per wheel unit
  const panDeltaX = e.deltaY * panSpeed

  const newTransform = {
    ...transform,
    offsetX: transform.offsetX - panDeltaX
  }
  onTransformChange?.(newTransform)
  return  // Skip zoom logic
}
```

**Why**: AutoCAD standard - pan χωρίς να πιάνεις middle mouse button

### 🏢 3. Browser Conflict Avoidance (2025-10-03)

**Problem**: Ctrl/Cmd+± shortcuts hijacked by browser (page zoom)

**Solution**:
```typescript
// ❌ REMOVED (browser conflict):
- Ctrl/Cmd + +/-  → Page zoom (can't preventDefault!)
- Ctrl/Cmd + 0    → Reset page zoom

// ✅ KEPT (no conflicts):
- Shift + 0/1     → 100% zoom / Fit to view
- Numpad +/-      → Zoom in/out
- +/- (bare)      → Zoom in/out (fallback)
- Mouse Wheel     → Primary zoom method
- Ctrl+Wheel      → Fast zoom (works!)
```

**Why**: Enterprise CAD systems (AutoCAD, Blender) avoid Ctrl+± για αυτόν το λόγο

### 🏢 4. DPI-Aware 100% Zoom (2025-10-01)

**What**: True 1:1 scale που λαμβάνει υπόψη device pixel ratio

**Implementation**:
```typescript
zoomTo100(center?: Point2D): ZoomResult {
  const dpr = typeof window !== 'undefined'
    ? window.devicePixelRatio || 1
    : 1
  const scale100 = 1.0 * dpr  // True 1:1 για high-DPI displays
  return this.zoomToScale(scale100, center)
}
```

**Why**: Σε 4K displays, 1.0 scale ≠ real-world 1:1 - χρειάζεται DPI correction

### 🏢 5. Context-Based Dependency Injection (2025-10-03)

**Architecture**:
```typescript
// CanvasContext.tsx
interface CanvasContextType {
  dxfRef: React.RefObject<any>
  overlayRef: React.RefObject<any>
  transform: ViewTransform
  setTransform: (t: ViewTransform) => void
  zoomManager: ZoomManager | null        // 🏢 Enterprise
  setZoomManager: (zm: ZoomManager) => void
}

// DxfViewerContent.tsx
<CanvasProvider>
  {/* Entire app wrapped with context */}
</CanvasProvider>

// useKeyboardShortcuts.ts
const canvasContext = useCanvasContext()
const zoomManager = canvasContext?.zoomManager  // ✅ Centralized access
```

**Benefits**:
- ✅ Single Source of Truth
- ✅ No prop drilling
- ✅ Easy testing (mock context)
- ✅ Backward compatible (fallback chains)

---

## API Reference

### ZoomManager

```typescript
// Constructor
new ZoomManager(initialTransform: ViewTransform, config?: Partial<ZoomConfig>)

// Zoom Operations
zoomIn(center?: Point2D, constraints?: ZoomConstraints): ZoomResult
zoomOut(center?: Point2D, constraints?: ZoomConstraints): ZoomResult
wheelZoom(wheelDelta: number, center: Point2D, constraints?: ZoomConstraints, modifiers?: Modifiers): ZoomResult
zoomToFit(bounds: Bounds, viewport: Viewport, alignToOrigin?: boolean): ZoomResult
zoomToScale(scale: number, center?: Point2D): ZoomResult
zoomTo100(center?: Point2D): ZoomResult
zoomToWindow(start: Point2D, end: Point2D, viewport: Viewport): ZoomResult

// History
zoomPrevious(): ZoomResult | null
zoomNext(): ZoomResult | null
clearHistory(): void
getHistory(): ZoomHistoryEntry[]

// State
getCurrentTransform(): ViewTransform
setTransform(transform: ViewTransform, mode?: ZoomMode): void
setConfig(config: Partial<ZoomConfig>): void
getConfig(): ZoomConfig
```

### Types

```typescript
interface ViewTransform {
  scale: number      // Current zoom level (1.0 = 100%)
  offsetX: number    // Pan offset X (pixels)
  offsetY: number    // Pan offset Y (pixels)
}

interface ZoomConstraints {
  minScale?: number          // Minimum zoom (default: 0.1)
  maxScale?: number          // Maximum zoom (default: 50)
  viewport?: Viewport        // Viewport dimensions
  contentBounds?: Bounds     // Content bounds για clamping
}

interface ZoomResult {
  transform: ViewTransform   // New transform
  scale: number              // New scale
  center: Point2D            // Zoom center
  bounds: Bounds             // Visible bounds
  mode: ZoomMode             // Operation mode
  timestamp: number          // Timestamp
}

type ZoomMode =
  | 'wheel'       // Mouse wheel zoom
  | 'keyboard'    // Keyboard zoom (+/-)
  | 'fit'         // Fit to view
  | 'scale'       // Zoom to scale
  | 'window'      // Window zoom
  | 'previous'    // History navigation
  | 'programmatic' // API call

interface Modifiers {
  ctrlKey?: boolean   // Ctrl (Win/Linux) or Cmd (macOS)
  shiftKey?: boolean  // Shift key
}
```

---

## Usage Examples

### Basic Zoom Operations

```typescript
import { useZoom } from '../systems/zoom/hooks/useZoom'

function MyComponent() {
  const zoom = useZoom({
    initialTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    onTransformChange: (t) => console.log('Transform:', t)
  })

  return (
    <div>
      <button onClick={() => zoom.zoomIn()}>Zoom In</button>
      <button onClick={() => zoom.zoomOut()}>Zoom Out</button>
      <button onClick={() => zoom.zoomTo100()}>100%</button>
    </div>
  )
}
```

### Wheel Zoom με Modifiers

```typescript
import { useCentralizedMouseHandlers } from '../systems/cursor/useCentralizedMouseHandlers'

function Canvas() {
  const handlers = useCentralizedMouseHandlers({
    scene: currentScene,
    transform,
    viewport,
    onWheelZoom: zoomSystem.handleWheelZoom  // ✅ Auto-handles modifiers
  })

  return (
    <canvas
      onWheel={handlers.handleWheel}  // Ctrl+Wheel = fast, Shift+Wheel = pan
    />
  )
}
```

### Programmatic Zoom

```typescript
// Zoom to fit all entities
const bounds = calculateSceneBounds(scene)
zoom.zoomToFit(bounds, viewport)

// Zoom to 200%
zoom.zoomToScale(2.0)

// Zoom to window selection
zoom.zoomToWindow(startPoint, endPoint, viewport)
```

### Using ZoomManager Directly

```typescript
import { ZoomManager } from '../systems/zoom/ZoomManager'

const manager = new ZoomManager(
  { scale: 1, offsetX: 0, offsetY: 0 },
  { minScale: 0.5, maxScale: 10 }
)

const result = manager.wheelZoom(
  wheelDelta: -120,  // Scroll up
  center: { x: 400, y: 300 },
  constraints: { viewport: { width: 800, height: 600 } },
  modifiers: { ctrlKey: true }  // Fast zoom!
)

console.log('New scale:', result.scale)
```

---

## Keyboard Shortcuts

### ✅ Active Shortcuts (Enterprise-Compliant)

| Shortcut | Action | Notes |
|----------|--------|-------|
| **Shift + 1** | Fit to view | Fast access, no browser conflict |
| **Shift + 0** | 100% zoom (1:1) | DPI-aware real-world scale |
| **Numpad +** | Zoom in | Works on all keyboards |
| **Numpad -** | Zoom out | Works on all keyboards |
| **+ (bare)** | Zoom in | Fallback for keyboards without numpad |
| **- (bare)** | Zoom out | Fallback for keyboards without numpad |

### ❌ Removed Shortcuts (Browser Conflicts)

| Shortcut | Reason | Alternative |
|----------|--------|-------------|
| ~~Ctrl/Cmd + +~~ | Browser hijacks (page zoom) | Use Numpad+ or Ctrl+Wheel |
| ~~Ctrl/Cmd + -~~ | Browser hijacks (page zoom) | Use Numpad- or Ctrl+Wheel |
| ~~Ctrl/Cmd + 0~~ | Browser hijacks (reset zoom) | Use Shift+0 |

### 🔜 Planned Shortcuts

| Shortcut | Action | Status |
|----------|--------|--------|
| **Shift + 2** | Zoom to selection | TODO |
| **Z** | Zoom command (AutoCAD) | TODO |
| **?** | Shortcuts help overlay | TODO |

---

## Mouse Controls

### ✅ Active Controls

| Control | Action | Speed |
|---------|--------|-------|
| **Mouse Wheel ↑/↓** | Zoom in/out (cursor-centered) | Normal (10% per step) |
| **Ctrl + Wheel ↑/↓** | Fast zoom | 2x faster (20% per step) |
| **Shift + Wheel ↑/↓** | Horizontal pan | Left/right scrolling |
| **Middle Mouse Drag** | Pan | Smooth panning |

### 🔜 Planned Controls

| Control | Action | Status |
|---------|--------|--------|
| **Double-click Middle** | Fit to view | TODO |

---

## Implementation Details

### 📁 File Structure

```
systems/zoom/
├── ZoomManager.ts              // Core manager class
├── zoom-types.ts               // TypeScript interfaces
├── zoom-constants.ts           // Zoom factors & defaults
├── hooks/
│   └── useZoom.ts             // React hook wrapper
└── utils/
    ├── calculations.ts         // Zoom math
    └── transforms.ts          // Transform utilities
```

### 🔗 Dependencies

```typescript
// Internal dependencies
import { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types'
import { CanvasContext } from '../../contexts/CanvasContext'
import { canvasBoundsService } from '../../services/CanvasBoundsManager'

// External dependencies
import { useCallback, useRef, useMemo } from 'react'
```

### 🎯 Key Algorithms

**1. Cursor-Centered Zoom Transform**:
```typescript
function calculateZoomTransform(
  currentTransform: ViewTransform,
  newScale: number,
  center: Point2D,  // Cursor position
  viewport: Viewport
): ViewTransform {
  // World coordinates of zoom center
  const worldX = (center.x - currentTransform.offsetX) / currentTransform.scale
  const worldY = (center.y - currentTransform.offsetY) / currentTransform.scale

  // New offset που κρατάει το world point στο ίδιο screen position
  const newOffsetX = center.x - worldX * newScale
  const newOffsetY = center.y - worldY * newScale

  return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY }
}
```

**2. Fit to View Transform**:
```typescript
function calculateFitTransform(
  bounds: Bounds,
  viewport: Viewport,
  padding: number = 50,
  maxScale: number = 50,
  minScale: number = 0.1,
  alignToOrigin: boolean = false
): ViewTransform {
  const contentWidth = bounds.max.x - bounds.min.x
  const contentHeight = bounds.max.y - bounds.min.y

  const scaleX = (viewport.width - 2 * padding) / contentWidth
  const scaleY = (viewport.height - 2 * padding) / contentHeight
  const scale = Math.min(scaleX, scaleY, maxScale)

  // Center content in viewport
  const offsetX = (viewport.width - contentWidth * scale) / 2 - bounds.min.x * scale
  const offsetY = (viewport.height - contentHeight * scale) / 2 - bounds.min.y * scale

  return { scale, offsetX, offsetY }
}
```

### ⚡ Performance Optimizations

1. **Bounds Caching**:
   ```typescript
   // Canvas bounds cached to avoid getBoundingClientRect() spam
   const rect = canvasBoundsService.getBounds(canvas)
   ```

2. **requestAnimationFrame Batching**:
   ```typescript
   // Pan updates batched με rAF για smooth 60fps
   if (!panState.animationId) {
     panState.animationId = requestAnimationFrame(flushPanUpdates)
   }
   ```

3. **NaN Guards**:
   ```typescript
   // Prevent NaN flickering
   if (!Number.isFinite(scale) || scale <= 0) {
     console.warn('Invalid scale, resetting to 1')
     scale = 1
   }
   ```

4. **Unchanged Optimization**:
   ```typescript
   // Skip update if values unchanged (prevents infinite loops)
   const current = getTransform()
   if (current.scale === newScale &&
       current.offsetX === newOffsetX &&
       current.offsetY === newOffsetY) {
     return  // No change
   }
   ```

---

## Testing

### Unit Tests (TODO)

```typescript
describe('ZoomManager', () => {
  it('should zoom in με cursor-centered behavior', () => {
    const manager = new ZoomManager({ scale: 1, offsetX: 0, offsetY: 0 })
    const result = manager.zoomIn({ x: 400, y: 300 })
    expect(result.scale).toBe(1.1)
  })

  it('should use fast zoom με Ctrl modifier', () => {
    const result = manager.wheelZoom(-120, { x: 400, y: 300 }, undefined, { ctrlKey: true })
    expect(result.scale).toBe(1.2)  // Fast (not 1.1)
  })
})
```

### Integration Tests (TODO)

```typescript
describe('Zoom System Integration', () => {
  it('should pan horizontally με Shift+Wheel', () => {
    const { container } = render(<DxfCanvas />)
    fireEvent.wheel(container, { deltaY: 100, shiftKey: true })
    expect(getTransform().offsetX).toHaveChanged()
  })
})
```

---

## Troubleshooting

### Common Issues

**Q: Ctrl++ doesn't work!**
A: Removed due to browser conflict. Use Ctrl+Wheel or Numpad+ instead.

**Q: Zoom feels slow!**
A: Try Ctrl+Wheel για 2x ταχύτερο zoom.

**Q: Shift+Wheel doesn't pan!**
A: Check ότι το `useCentralizedMouseHandlers` χρησιμοποιείται στο canvas.

**Q: Transform becomes NaN!**
A: Guards υπάρχουν, αλλά check ότι viewport dimensions είναι valid.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Canvas Context](../architecture/state-management.md#canvas-context)
- [Coordinate Systems](../architecture/coordinate-systems.md)
- [Mouse Handlers](../systems/selection.md#mouse-interaction)

---

**🏢 Enterprise-Grade Zoom System**
*Centralized • Performant • Cross-Platform*

Last Updated: 2025-10-03
