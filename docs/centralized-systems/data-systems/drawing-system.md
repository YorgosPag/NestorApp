# ✏️ **DRAWING SYSTEM**

> **Enterprise CAD Drawing Architecture**: Complete drawing tools & rendering system
>
> Related ADRs: **ADR-005**, **ADR-032**, **ADR-040-049**, **ADR-053**, **ADR-056-057**

---

## 📋 **ADR-005: Line Drawing System**

**Status**: ✅ APPROVED | **Date**: 2026-01-03 | **Level**: 9.5/10 (AutoCAD/SolidWorks)

### Decision

| Rule | Description |
|------|-------------|
| **SINGLE DRAWING HOOK** | `useUnifiedDrawing` - όλα τα drawing tools |
| **SINGLE EVENT HANDLER** | `useDrawingHandlers` - όλα τα mouse events |
| **SINGLE ORCHESTRATOR** | `DrawingOrchestrator` - workflow coordination |
| **PROHIBITION** | ❌ New drawing implementations outside these |

### Architecture (2,300+ lines)

| Component | Location | Lines | Role |
|-----------|----------|-------|------|
| `useUnifiedDrawing` | `hooks/drawing/` | 760 | Master drawing hook |
| `useDrawingHandlers` | `hooks/drawing/` | 182 | Mouse event handlers |
| `DrawingOrchestrator` | `systems/drawing-orchestrator/` | 150 | Workflow coordinator |
| `EntityCreationSystem` | `systems/entity-creation/` | 228 | High-level entity API |
| `LineRenderer` | `rendering/entities/` | 229 | 3-phase line rendering |
| `PolylineRenderer` | `rendering/entities/` | 170+ | Polyline/polygon |

### Supported Drawing Tools

| Tool | Points | Entity Created |
|------|--------|----------------|
| `line` | 2 | LineEntity |
| `rectangle` | 2 | PolylineEntity (closed) |
| `circle` | 2 | CircleEntity |
| `polyline` | ∞ | PolylineEntity |
| `polygon` | ∞ | PolylineEntity (closed) |
| `measure-distance` | 2 | LineEntity with measurement |
| `measure-angle` | 3+ | Measurement entity |
| `measure-area` | ∞ | PolylineEntity with area |

### 3-Phase Rendering

| Phase | Style | Measurements | Use Case |
|-------|-------|--------------|----------|
| **Preview** | Blue dashed | ✅ | During drawing |
| **Completion** | Green solid | ✅ | Just completed |
| **Normal** | White solid | ❌ | Saved entity |
| **Interactive** | Hover/Selected | ✅ | User interaction |

### Implementation

```typescript
import { useUnifiedDrawing } from '@/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing';
import { useDrawingHandlers } from '@/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers';

const drawing = useUnifiedDrawing();
const handlers = useDrawingHandlers();

// Start drawing
drawing.startDrawing('line');

// Handle canvas click
handlers.onDrawingPoint(worldPoint);
```

---

## 📋 **ADR-032: Drawing State Machine**

**Status**: ✅ IMPLEMENTED | **Date**: 2026-01-25

### Problem
Boolean flags (`isDrawing: true/false`) caused race conditions.

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `core/state-machine/` |
| **PATTERN** | Formal State Machine (XState patterns) |
| **COMPLEMENTARY** | Works with `ToolStateManager` |

### State Diagram

```
    ┌──────────┐  SELECT_TOOL   ┌────────────┐
    │   IDLE   │ ────────────► │ TOOL_READY │
    └──────────┘               └─────┬──────┘
                                     │ ADD_POINT
                                     ▼
                            ┌─────────────────┐
                            │ COLLECTING_POINTS│◄─┐
                            └────────┬────────┘  │ ADD_POINT
                                     │           │
                    MIN_POINTS_REACHED│           │
                                     ▼           │
                            ┌─────────────────┐  │
                            │   COMPLETING    │──┘
                            └────────┬────────┘
                                     │ COMPLETE
                                     ▼
                            ┌─────────────────┐
                            │   COMPLETED     │
                            └─────────────────┘
```

### Usage

```typescript
import { useDrawingMachine } from '@/subapps/dxf-viewer/core/state-machine';

const {
  state,        // 'IDLE' | 'TOOL_READY' | 'COLLECTING_POINTS' | etc.
  isDrawing,    // true when in any drawing state
  canComplete,  // true when min points reached
  addPoint,
  complete,
  cancel,
} = useDrawingMachine();
```

---

## 📋 **ADR-040: Preview Canvas Performance**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Problem
"Two Distance Numbers" bug - preview didn't clear immediately on completion.

### Decision
Dedicated `PreviewCanvas` + EventBus integration for instant clearing.

**Performance**: ~250ms → <16ms per frame

### Files
- `canvas-v2/preview-canvas/` + `PreviewRenderer`
- EventBus: `drawing:complete` event

---

## 📋 **ADR-041: Distance Label Centralization**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Decision
- **Canonical**: `renderDistanceLabel()` from `distance-label-utils.ts`
- **Prohibition**: Hardcoded distance label rendering

---

## 📋 **ADR-047: Close Polygon on First-Point Click**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Pattern
AutoCAD/BricsCAD pattern: Click on first point → snap and auto-close polygon.

Used for area measurement tool.

---

## 📋 **ADR-048: Unified Grip Rendering System**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Decision
- **Canonical**: `UnifiedGripRenderer` (Facade Pattern)
- **Location**: `rendering/grips/`
- **Result**: ~90 lines duplicate code removed

---

## 📋 **ADR-049: Unified Move Tool (DXF + Overlays)**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Decision
- **Canonical**: `MoveOverlayCommand.ts` (380+ lines)
- **Pattern**: Command Pattern with undo/redo
- **Features**: Real-time ghost rendering (AutoCAD/Figma), Command merging (500ms)

---

## 📋 **ADR-053: Drawing Context Menu**

**Status**: ✅ APPROVED | **Date**: 2026-01-30

### Decision
- **Canonical**: `DrawingContextMenu.tsx`
- **Pattern**: AutoCAD-style right-click menu
- **Features**: Undo last point, finish polyline, cancel drawing

---

## 📋 **ADR-056: Centralized Entity Completion Styles**

**Status**: ✅ APPROVED | **Date**: 2026-01-30

### Decision
- **Canonical**: `applyCompletionStyles()` from `hooks/useLineCompletionStyle.ts`
- **Pattern**: AutoCAD "Current Properties"
- **Prohibition**: Inline completion styles (hardcoded colors, lineweight)

---

## 📋 **ADR-057: Unified Entity Completion Pipeline**

**Status**: ✅ APPROVED | **Date**: 2026-01-30

### Decision
- **Canonical**: `completeEntity()` from `hooks/drawing/completeEntity.ts`
- **Result**: 4 code paths → 1 function
- **Pattern**: AutoCAD `acdbEntMake`

### What it handles
- Styles (ADR-056)
- Scene addition
- Undo tracking
- Events
- Tool persistence

### Prohibition
❌ Direct scene manipulation for entity completion

---

## 📚 **QUICK REFERENCE**

### Import Paths

| System | Import |
|--------|--------|
| Drawing Hook | `@/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing` |
| Drawing Handlers | `@/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers` |
| State Machine | `@/subapps/dxf-viewer/core/state-machine` |
| Entity Completion | `@/subapps/dxf-viewer/hooks/drawing/completeEntity` |
| Completion Styles | `@/subapps/dxf-viewer/hooks/useLineCompletionStyle` |
| Grip Renderer | `@/subapps/dxf-viewer/rendering/grips` |
| Distance Labels | `@/subapps/dxf-viewer/rendering/entities/shared/distance-label-utils` |

---

> **📍 Full Reference**: [centralized_systems.md](../../../src/subapps/dxf-viewer/docs/centralized_systems.md)
>
> **🔄 Last Updated**: 2026-01-31
