# 🏗️ Architecture Overview

> **High-level system design και architectural principles του DXF Viewer**
> Enterprise-grade architecture με centralized patterns

---

## 📋 Table of Contents

- [Introduction](#introduction)
- [Design Principles](#design-principles)
- [System Architecture](#system-architecture)
- [Core Patterns](#core-patterns)
- [Technology Stack](#technology-stack)
- [Module Organization](#module-organization)
- [Data Flow](#data-flow)
- [Performance Considerations](#performance-considerations)

---

## Introduction

Το **Pagonis Nestor DXF Viewer** είναι ένα **Enterprise-grade CAD viewer application** χτισμένο με React και TypeScript. Το σύστημα ακολουθεί αυστηρά **κεντρικοποιημένα patterns** για maximum maintainability και scalability.

### 🎯 Project Goals

1. **Zero Duplicates** - Κάθε functionality έχει μία και μόνο implementation
2. **Enterprise Standards** - Ακολουθεί AutoCAD/Figma/Blender best practices
3. **Performance First** - 60fps rendering, spatial indexing, caching
4. **Type Safety** - Full TypeScript coverage
5. **Backward Compatible** - Zero breaking changes με fallback chains

### 📊 System Scale

| Metric | Count |
|--------|-------|
| **Centralized Systems** | 17+ |
| **Manager Classes** | 20+ |
| **Services** | 15+ |
| **React Hooks** | 30+ |
| **Context Providers** | 10+ |
| **Entity Renderers** | 10+ |

---

## Design Principles

### 1. 🎯 Single Source of Truth

**Κάθε feature έχει ΕΝΑ centralized implementation point**

```typescript
// ✅ ΣΩΣΤΑ - Centralized
const zoomManager = useCanvasContext().zoomManager
zoomManager.zoomIn()

// ❌ ΛΑΘΟΣ - Duplicate logic
function myCustomZoom() {
  const newScale = currentScale * 1.1  // Duplicate!
  setTransform({ scale: newScale, ... })
}
```

**Examples**:
- `ZoomManager` → ΟΛΑ τα zoom operations
- `CoordinateTransforms` → ΟΛΑ τα coordinate conversions
- `HitTestingService` → ΟΛΑ τα hit tests
- `CanvasContext` → ΟΛΑ τα canvas refs

### 2. 🏢 Context-Based Dependency Injection

**Context providers για shared state και services**

```typescript
// Architecture
<CanvasProvider>           // Provides: zoomManager, dxfRef, transform
  <SelectionProvider>      // Provides: selectedIds, selectionMode
    <GripProvider>         // Provides: gripSettings, gripState
      <App />
    </GripProvider>
  </SelectionProvider>
</CanvasProvider>

// Consumption
const { zoomManager } = useCanvasContext()  // ✅ Centralized access
```

**Benefits**:
- ✅ No prop drilling
- ✅ Easy mocking για tests
- ✅ Single instance guarantee
- ✅ Type-safe με TypeScript

### 3. 🔄 Fallback Chains for Compatibility

**Graceful degradation αντί για breaking changes**

```typescript
// Priority 1: Centralized manager (newest)
if (context.zoomManager) {
  context.zoomManager.zoomIn()
}
// Priority 2: Imperative API (legacy)
else if (dxfRef.current?.zoomIn) {
  dxfRef.current.zoomIn()
}
// Priority 3: Custom events (oldest)
else {
  document.dispatchEvent(new CustomEvent('dxf-zoom', { detail: { action: 'in' } }))
}
```

**Result**: Zero breaking changes για existing code!

### 4. ⚡ Performance by Default

**Built-in optimizations σε όλα τα systems**

- **Spatial Indexing** - R-tree για O(log n) hit testing
- **Canvas Caching** - Bounds cache, rendering cache
- **rAF Batching** - 60fps guaranteed
- **Memoization** - React.memo, useMemo, useCallback everywhere
- **Lazy Loading** - Code splitting για systems

### 5. 🎨 Separation of Concerns

**Clear module boundaries**

```
DXF Viewer
├── Core Systems (rendering, transforms, hit testing)
├── UI Systems (zoom, selection, grips)
├── Drawing Tools (line, circle, polygon)
├── Services (import/export, bounds, merge)
└── State Management (contexts, stores)
```

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  React Application Layer                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Context Providers                        │  │
│  │  Canvas • Selection • Grip • Settings • Transform    │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Core Systems Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Zoom &  │  │Selection │  │ Drawing  │  │  Grips   │   │
│  │   Pan    │  │  System  │  │  Tools   │  │  System  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 Rendering Pipeline                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Entity  │  │Coordinate│  │  Canvas  │  │   Hit    │   │
│  │Renderers │  │Transform │  │ Manager  │  │ Testing  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Services Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │DXF Import│  │  Bounds  │  │  Entity  │  │  Spatial │   │
│  │  /Export │  │ Fitting  │  │  Merge   │  │  Index   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
DxfViewerContent (Root)
├── CanvasProvider ────────────────┐ (Context injection)
│   ├── SelectionProvider ────────┤
│   │   ├── GripProvider ─────────┤
│   │   │   ├── CanvasSection ────┤ (Main canvas area)
│   │   │   │   ├── LayerCanvas ──┤ (Overlays, UI)
│   │   │   │   └── DxfCanvas ────┤ (Main entities)
│   │   │   ├── Toolbar ──────────┤
│   │   │   ├── StatusBar ────────┤
│   │   │   └── DebugPanel ───────┤
└── ... more components
```

---

## Core Patterns

### Pattern 1: Manager Classes

**Centralized business logic με clear API**

```typescript
class ZoomManager {
  private config: ZoomConfig
  private currentTransform: ViewTransform
  private history: ZoomHistoryEntry[]

  // Public API
  zoomIn(center?, constraints?): ZoomResult
  zoomOut(center?, constraints?): ZoomResult
  wheelZoom(delta, center, constraints?, modifiers?): ZoomResult
  zoomToFit(bounds, viewport): ZoomResult
  // ... more methods
}
```

**Used in**:
- `ZoomManager` - Zoom operations
- `SelectionManager` - Entity selection
- `GripInteractionManager` - Grip manipulation
- `HitTestingService` - Hit detection
- `SpatialIndex` - Spatial queries

### Pattern 2: Service Layer

**Stateless utility functions με dependency injection**

```typescript
export const FitToViewService = {
  calculateFitToViewTransform(
    scene: DxfScene | null,
    colorLayers: ColorLayer[],
    viewport: Viewport
  ): FitToViewResult {
    const bounds = this.calculateCombinedBounds(scene, colorLayers)
    // ... calculation logic
    return { success: true, transform, bounds }
  }
}
```

**Used in**:
- `FitToViewService` - Viewport fitting calculations
- `EntityMergeService` - Entity merging
- `CanvasBoundsManager` - Bounds caching
- `HitTestingService` - Hit testing με spatial index

### Pattern 3: React Hooks

**Reusable stateful logic**

```typescript
export const useZoom = ({
  initialTransform,
  config,
  onTransformChange
}: UseZoomProps): UseZoomReturn => {
  const zoomManagerRef = useRef<ZoomManager>()

  if (!zoomManagerRef.current) {
    zoomManagerRef.current = new ZoomManager(initialTransform, config)
  }

  // Wrap manager methods με React callbacks
  const zoomIn = useCallback((center?, constraints?) => {
    const result = zoomManagerRef.current.zoomIn(center, constraints)
    onTransformChange?.(result.transform)
  }, [onTransformChange])

  return { zoomIn, zoomOut, zoomToFit, ... }
}
```

**Used in**:
- `useZoom` - Zoom functionality
- `useSelection` - Selection state
- `useDrawing` - Drawing tools
- `useGrips` - Grip interaction
- `useKeyboardShortcuts` - Global shortcuts

### Pattern 4: Context Providers

**Dependency injection για shared state**

```typescript
interface CanvasContextType {
  dxfRef: React.RefObject<any>
  overlayRef: React.RefObject<any>
  transform: ViewTransform
  setTransform: (t: ViewTransform) => void
  zoomManager: ZoomManager | null
  setZoomManager: (zm: ZoomManager) => void
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const [transform, setTransform] = useState<ViewTransform>(initialTransform)
  const [zoomManager, setZoomManager] = useState<ZoomManager | null>(null)
  // ... more state

  return (
    <CanvasContext.Provider value={{ transform, setTransform, zoomManager, ... }}>
      {children}
    </CanvasContext.Provider>
  )
}
```

**Used in**:
- `CanvasContext` - Canvas state και zoom manager
- `SelectionContext` - Selection state
- `GripContext` - Grip settings
- `TransformContext` - Global transforms

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Canvas 2D** | Native | Rendering engine |
| **R-tree** | Custom | Spatial indexing |

### State Management

| Tool | Purpose |
|------|---------|
| **React Context** | Global state (zoom, selection, grips) |
| **useState/useReducer** | Component-level state |
| **Zustand stores** | Style stores (text, grip, tool) |
| **Ref-based state** | Canvas instances, managers |

### Performance Tools

| Tool | Purpose |
|------|---------|
| **requestAnimationFrame** | 60fps rendering |
| **React.memo** | Component memoization |
| **useMemo/useCallback** | Hook optimization |
| **Spatial indexing (R-tree)** | O(log n) hit testing |
| **Canvas offscreen rendering** | Pre-rendering optimization |

---

## Module Organization

### Directory Structure

```
src/subapps/dxf-viewer/
├── app/                      # Main app component
├── canvas-v2/                # Canvas V2 architecture
│   ├── dxf-canvas/          # Main DXF canvas
│   └── layer-canvas/        # Overlay layer canvas
├── components/               # UI components
├── config/                   # Configuration files
├── contexts/                 # React contexts
├── core/                     # Core utilities
├── debug/                    # Debug tools
├── docs/                     # 📚 Documentation (NEW!)
│   ├── README.md            # Navigation index
│   ├── architecture/        # Architecture docs
│   ├── systems/             # System-specific docs
│   └── reference/           # API reference
├── hooks/                    # React hooks
├── rendering/                # Rendering pipeline
│   ├── entities/            # Entity renderers
│   ├── core/                # Core rendering
│   ├── ui/                  # UI rendering
│   └── canvas/              # Canvas management
├── services/                 # Business logic services
├── systems/                  # Core systems
│   ├── zoom/                # Zoom & pan system
│   ├── selection/           # Selection system
│   ├── grips/               # Grips system
│   ├── cursor/              # Cursor system
│   └── snapping/            # Snapping system
├── stores/                   # Zustand stores
├── types/                    # TypeScript types
└── utils/                    # Utility functions
```

### Import Organization

**Order of imports** (enforced by ESLint):
```typescript
// 1. External libraries
import React, { useState, useCallback } from 'react'
import type { Point2D } from 'some-library'

// 2. Internal types
import type { ViewTransform, Viewport } from '../../rendering/types/Types'

// 3. Internal modules
import { ZoomManager } from '../../systems/zoom/ZoomManager'
import { useCanvasContext } from '../../contexts/CanvasContext'

// 4. Styles
import styles from './Component.module.css'
```

---

## Data Flow

### User Interaction Flow

```
User Input (Mouse/Keyboard)
    ↓
Event Handler (useCentralizedMouseHandlers / useKeyboardShortcuts)
    ↓
Context Consumer (useCanvasContext)
    ↓
Manager/Service (ZoomManager, SelectionManager, etc)
    ↓
State Update (Context.setState, onTransformChange callback)
    ↓
Re-render (React reconciliation)
    ↓
Canvas Update (dxfRef.current.render())
```

### Entity Rendering Flow

```
DXF Import
    ↓
Scene Builder (dxf-scene-builder.ts)
    ↓
DxfScene Object (entities + metadata)
    ↓
DxfCanvas.render()
    ↓
For each entity:
    ↓
    RendererRegistry.getRenderer(entity.type)
    ↓
    EntityRenderer.render(ctx, entity, renderContext)
    ↓
Canvas 2D Context
```

### Transform Update Flow

```
Zoom/Pan Operation
    ↓
ZoomManager.zoomIn/Out/ToFit()
    ↓
calculateZoomTransform(newScale, center, viewport)
    ↓
ZoomResult { transform, scale, center, bounds, mode }
    ↓
onTransformChange(result.transform)
    ↓
CanvasContext.setTransform(transform)
    ↓
All consumers re-render (DxfCanvas, LayerCanvas, HUD)
    ↓
dxfRef.current.setTransform(transform)
    ↓
Canvas re-renders με new transform
```

---

## Performance Considerations

### 1. 🚀 Rendering Performance

**Target**: 60fps (16.67ms per frame)

**Optimizations**:
- ✅ **rAF batching** - Όλα τα updates μέσα σε requestAnimationFrame
- ✅ **Canvas caching** - Pre-rendered static content
- ✅ **Viewport culling** - Render μόνο visible entities
- ✅ **LOD (Level of Detail)** - Simplify geometry σε μικρά zoom levels

```typescript
// rAF batching example
const flushUpdates = () => {
  if (pendingUpdates.length > 0) {
    const batch = pendingUpdates.splice(0)
    batch.forEach(update => applyUpdate(update))
    render()
  }
}

const scheduleUpdate = (update) => {
  pendingUpdates.push(update)
  if (!rafId) {
    rafId = requestAnimationFrame(flushUpdates)
  }
}
```

### 2. 🔍 Hit Testing Performance

**Target**: < 1ms για hit test

**Optimizations**:
- ✅ **R-tree spatial index** - O(log n) αντί για O(n) linear search
- ✅ **Bounds pre-calculation** - Cache entity bounds
- ✅ **Hierarchical testing** - Bounds check πριν detailed check

```typescript
// Spatial index usage
const spatialIndex = new RTree()
entities.forEach(entity => {
  spatialIndex.insert(calculateBounds(entity), entity.id)
})

// Fast hit testing
const nearbyIds = spatialIndex.search(clickBounds)  // O(log n)
const hit = nearbyIds.find(id => detailedHitTest(entities[id], point))
```

### 3. 💾 Memory Management

**Optimizations**:
- ✅ **Weak references** - Avoid memory leaks
- ✅ **Cleanup on unmount** - Remove event listeners, cancel rAF
- ✅ **Lazy loading** - Load systems on demand
- ✅ **Object pooling** - Reuse Point2D objects

```typescript
// Cleanup pattern
useEffect(() => {
  const handleWheel = (e) => { /* ... */ }
  canvas.addEventListener('wheel', handleWheel)

  return () => {
    canvas.removeEventListener('wheel', handleWheel)  // ✅ Cleanup
    if (rafId) cancelAnimationFrame(rafId)             // ✅ Cancel pending rAF
  }
}, [])
```

### 4. 📦 Bundle Size

**Target**: < 500 KB initial bundle

**Optimizations**:
- ✅ **Code splitting** - Lazy load systems
- ✅ **Tree shaking** - Remove unused code
- ✅ **Dynamic imports** - Load on demand

```typescript
// Dynamic import example
const loadDrawingTools = async () => {
  const { DrawingTools } = await import('./systems/drawing-tools')
  return DrawingTools
}
```

---

## Related Documentation

- [Entity Management](./entity-management.md) - Entity rendering και validation
- [Coordinate Systems](./coordinate-systems.md) - Transform calculations
- [Rendering Pipeline](./rendering-pipeline.md) - Canvas rendering
- [State Management](./state-management.md) - Context providers
- [Zoom & Pan System](../systems/zoom-pan.md) - Zoom implementation

---

**🏢 Enterprise-Grade Architecture**
*Centralized • Performant • Maintainable*

Last Updated: 2025-10-03
