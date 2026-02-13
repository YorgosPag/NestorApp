# 📚 Class Index

> **Complete alphabetical index of all centralized classes and services**
> Quick reference για developers

---

## 📋 Table of Contents

- [Core Systems](#core-systems)
- [Entity Renderers](#entity-renderers)
- [Canvas & Rendering](#canvas--rendering)
- [Snapping & Constraints](#snapping--constraints)
- [Selection & Interaction](#selection--interaction)
- [Zoom & Navigation](#zoom--navigation)
- [Services](#services)
- [Managers](#managers)
- [Utilities](#utilities)

---

## Core Systems

### ZoomManager ⭐
**Path**: `systems/zoom/ZoomManager.ts`
**Category**: Enterprise Core System
**Purpose**: Centralized zoom and pan operations

**Key Methods**:
- `zoomIn(center?, constraints?)` - Zoom in
- `zoomOut(center?, constraints?)` - Zoom out
- `wheelZoom(wheelDelta, center, constraints?, modifiers?)` - Mouse wheel zoom με modifiers
- `zoomToFit(bounds, viewport, alignToOrigin?)` - Fit to view
- `zoomTo100(center?)` - DPI-aware 1:1 zoom
- `zoomToWindow(start, end, viewport)` - Window zoom

**🏢 Enterprise Features**:
- Ctrl+Wheel fast zoom support
- Cursor-centered behavior
- History navigation
- DPI-aware scaling

**Used by**: 20+ files (Canvas, Keyboard, Mouse handlers, UI)

---

### RendererRegistry ⭐
**Path**: `rendering/RendererRegistry.ts`
**Category**: Entity Rendering
**Purpose**: Registry για όλους τους entity renderers

**Key Methods**:
- `register(entityType, renderer)` - Register renderer
- `getRenderer(entityType)` - Get renderer for type
- `registerStandardRenderers()` - Register all standard renderers
- `getSupportedTypes()` - List supported entity types

**Supported Types**: LINE, CIRCLE, ARC, POLYLINE, TEXT, ELLIPSE, SPLINE, POINT, etc.

**Used by**: DxfCanvas, Entity systems, Hit testing

---

### CoordinateTransforms ⭐
**Path**: `rendering/core/CoordinateTransforms.ts`
**Category**: Core Transforms
**Purpose**: World ↔ Screen coordinate conversions με Y-flip

**Key Functions**:
- `worldToScreen(worldPoint, transform, viewport)` - World → Screen
- `screenToWorld(screenPoint, transform, viewport)` - Screen → World
- `calculateZoomTransform(currentTransform, newScale, center, viewport)` - Cursor-centered zoom
- `calculatePanTransform(currentTransform, deltaPan)` - Pan calculation

**Used by**: 12+ files (All entity renderers, Canvas, Selection, Cursor)

---

### HitTestingService ⭐
**Path**: `services/HitTestingService.ts`
**Category**: Core Service
**Purpose**: Fast entity hit testing με spatial indexing

**Key Methods**:
- `findEntityAt(point, entities, tolerance)` - Find entity at point
- `findEntitiesInRegion(bounds, entities)` - Find entities in rectangle
- `buildSpatialIndex(entities)` - Build R-tree index
- `hitTestEntity(entity, point, tolerance)` - Test single entity

**Performance**: O(log n) με R-tree, not O(n) linear search

**Used by**: Selection system, Mouse handlers, Marquee selection

---

### FitToViewService ⭐
**Path**: `services/FitToViewService.ts`
**Category**: Core Service
**Purpose**: Centralized fit-to-view calculations

**Key Methods**:
- `calculateFitToViewTransform(scene, colorLayers, viewport, options?)` - Calculate transform
- `calculateFitToViewFromBounds(bounds, viewport, options?)` - From bounds only
- `smartFitToView(...)` - Conditional fit (only if content changed)
- `performFitToView(...)` - Calculate and apply transform
- `hasRenderableContent(scene, colorLayers)` - Check if has content

**Used by**: Canvas systems, Zoom system, UI buttons

---

## Entity Renderers

### LineRenderer
**Path**: `rendering/entities/line/LineRenderer.ts`
**Purpose**: Render LINE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### CircleRenderer
**Path**: `rendering/entities/circle/CircleRenderer.ts`
**Purpose**: Render CIRCLE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### ArcRenderer
**Path**: `rendering/entities/arc/ArcRenderer.ts`
**Purpose**: Render ARC entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### PolylineRenderer
**Path**: `rendering/entities/polyline/PolylineRenderer.ts`
**Purpose**: Render POLYLINE και LWPOLYLINE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### TextRenderer
**Path**: `rendering/entities/text/TextRenderer.ts`
**Purpose**: Render TEXT και MTEXT entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### EllipseRenderer
**Path**: `rendering/entities/ellipse/EllipseRenderer.ts`
**Purpose**: Render ELLIPSE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### SplineRenderer
**Path**: `rendering/entities/spline/SplineRenderer.ts`
**Purpose**: Render SPLINE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### RectangleRenderer
**Path**: `rendering/entities/rectangle/RectangleRenderer.ts`
**Purpose**: Render RECTANGLE entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### PointRenderer
**Path**: `rendering/entities/point/PointRenderer.ts`
**Purpose**: Render POINT entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

### AngleMeasurementRenderer
**Path**: `rendering/entities/angle/AngleMeasurementRenderer.ts`
**Purpose**: Render angle measurement entities
**Methods**: `render()`, `calculateBounds()`, `hitTest()`

---

## Canvas & Rendering

### DxfRenderer
**Path**: `canvas-v2/dxf-canvas/DxfRenderer.ts`
**Purpose**: Main DXF entity rendering engine
**Methods**: `render()`, `renderEntity()`, `clear()`

### LayerRenderer
**Path**: `canvas-v2/layer-canvas/LayerRenderer.ts`
**Purpose**: Overlay layer rendering
**Methods**: `render()`, `renderLayer()`, `clear()`

### CanvasManager
**Path**: `rendering/canvas/core/CanvasManager.ts`
**Purpose**: Canvas lifecycle και memory management
**Methods**: `createCanvas()`, `resizeCanvas()`, `disposeCanvas()`

### CrosshairRenderer
**Path**: `canvas-v2/layer-canvas/crosshair/CrosshairRenderer.ts`
**Purpose**: Render crosshair cursor
**Methods**: `render()`, `setPosition()`, `setStyle()`

### SelectionRenderer
**Path**: `canvas-v2/layer-canvas/selection/SelectionRenderer.ts`
**Purpose**: Render selection highlights
**Methods**: `render()`, `renderSelectionBox()`, `renderGrips()`

### GridRenderer
**Path**: `rendering/ui/grid/GridRenderer.ts`
**Purpose**: Render grid overlay
**Methods**: `render()`, `setGridSize()`, `setStyle()`

### RulerRenderer
**Path**: `rendering/ui/ruler/RulerRenderer.ts`
**Purpose**: Render ruler axes
**Methods**: `render()`, `setUnits()`, `setScale()`

### CursorRenderer
**Path**: `rendering/ui/cursor/CursorRenderer.ts`
**Purpose**: Render custom cursor states
**Methods**: `render()`, `setCursorType()`, `setPosition()`

### UIRenderer
**Path**: `rendering/ui/core/UIRenderer.ts`
**Purpose**: Base class για UI element rendering
**Methods**: `render()`, `clear()`, `update()`

### UIRenderContext
**Path**: `rendering/ui/core/UIRenderContext.ts`
**Purpose**: Context για UI rendering
**Properties**: `transform`, `viewport`, `settings`

---

## Snapping & Constraints

### ProSnapEngineV2
**Path**: `snapping/ProSnapEngineV2.ts`
**Purpose**: Main snap engine (v2 architecture)
**Methods**: `findSnapPoint()`, `enableMode()`, `disableMode()`

### SnapOrchestrator
**Path**: `snapping/orchestrator/SnapOrchestrator.ts`
**Purpose**: Orchestrates multiple snap engines
**Methods**: `findBestSnap()`, `registerEngine()`, `getPriority()`

### EndpointSnapEngine
**Path**: `snapping/engines/EndpointSnapEngine.ts`
**Purpose**: Snap to line/polyline endpoints
**Methods**: `findSnapPoints()`, `calculateDistance()`

### MidpointSnapEngine
**Path**: `snapping/engines/MidpointSnapEngine.ts`
**Purpose**: Snap to line midpoints
**Methods**: `findSnapPoints()`, `calculateMidpoint()`

### IntersectionSnapEngine
**Path**: `snapping/engines/IntersectionSnapEngine.ts`
**Purpose**: Snap to entity intersections
**Methods**: `findIntersections()`, `calculateIntersection()`

### CenterSnapEngine
**Path**: `snapping/engines/CenterSnapEngine.ts`
**Purpose**: Snap to circle/arc centers
**Methods**: `findSnapPoints()`, `getCenter()`

### PerpendicularSnapEngine
**Path**: `snapping/engines/PerpendicularSnapEngine.ts`
**Purpose**: Snap perpendicular to lines
**Methods**: `findSnapPoints()`, `calculatePerpendicular()`

### TangentSnapEngine
**Path**: `snapping/engines/TangentSnapEngine.ts`
**Purpose**: Snap tangent to curves
**Methods**: `findSnapPoints()`, `calculateTangent()`

### QuadrantSnapEngine
**Path**: `snapping/engines/QuadrantSnapEngine.ts`
**Purpose**: Snap to circle quadrants (0°, 90°, 180°, 270°)
**Methods**: `findSnapPoints()`, `getQuadrants()`

### NearestSnapEngine
**Path**: `snapping/engines/NearestSnapEngine.ts`
**Purpose**: Snap to nearest point on entity
**Methods**: `findSnapPoints()`, `projectToEntity()`

### ConstraintsSystem
**Path**: `systems/constraints/ConstraintsSystem.ts`
**Purpose**: Geometric constraints management
**Methods**: `applyConstraints()`, `enableConstraint()`, `disableConstraint()`

### OrthoConstraint
**Path**: `systems/constraints/OrthoConstraint.ts`
**Purpose**: Orthogonal (90°) constraint
**Methods**: `constrain()`, `isActive()`

### PolarConstraint
**Path**: `systems/constraints/PolarConstraint.ts`
**Purpose**: Polar angle constraint
**Methods**: `constrain()`, `setAngle()`, `setIncrement()`

---

## Selection & Interaction

### SelectionManager
**Path**: `systems/selection/SelectionManager.ts`
**Purpose**: Centralized selection state management
**Methods**: `selectEntity()`, `deselectEntity()`, `clearSelection()`, `getSelectedIds()`

### UniversalMarqueeSelection
**Path**: `systems/selection/UniversalMarqueeSelection.ts`
**Purpose**: Rectangle marquee selection (window/crossing)
**Methods**: `startMarquee()`, `updateMarquee()`, `endMarquee()`, `getEntities()`
**Status**: 🔒 STABLE (2026-02-13) — ΛΕΙΤΟΥΡΓΕΙ ΠΛΗΡΩΣ ΣΩΣΤΑ, ΜΗΝ ΤΡΟΠΟΠΟΙΗΘΕΙ

### SelectionSystem
**Path**: `systems/selection/SelectionSystem.ts`
**Purpose**: High-level selection orchestration
**Methods**: `handleClick()`, `handleMarquee()`, `filter()`

### GripsSystem
**Path**: `systems/grips/GripsSystem.ts`
**Purpose**: Entity grip visualization και management
**Methods**: `showGrips()`, `hideGrips()`, `updateGrips()`

### GripInteractionManager
**Path**: `systems/grip-interaction/GripInteractionManager.ts`
**Purpose**: Grip drag και manipulation
**Methods**: `startDrag()`, `updateDrag()`, `endDrag()`

### GripDetection
**Path**: `grips/GripDetection.ts`
**Purpose**: Detect grip under cursor
**Methods**: `detectGrip()`, `getGripAt()`

### GripManipulator
**Path**: `grips/GripManipulator.ts`
**Purpose**: Manipulate entity via grips
**Methods**: `move()`, `resize()`, `rotate()`

### GripVisualizer
**Path**: `grips/GripVisualizer.ts`
**Purpose**: Render grips on canvas
**Methods**: `render()`, `setStyle()`, `highlight()`

---

## Zoom & Navigation

### ViewportManager
**Path**: `systems/zoom/ViewportManager.ts`
**Purpose**: Viewport state management
**Methods**: `setViewport()`, `getViewport()`, `onResize()`

### PanManager
**Path**: `systems/zoom/PanManager.ts`
**Purpose**: Pan operation management
**Methods**: `startPan()`, `updatePan()`, `endPan()`

### NavigationController
**Path**: `systems/zoom/NavigationController.ts`
**Purpose**: Combined zoom/pan navigation
**Methods**: `handleWheel()`, `handlePan()`, `handleZoom()`

---

## Services

### EntityMergeService
**Path**: `services/EntityMergeService.ts`
**Purpose**: Merge entities από multiple sources
**Methods**: `mergeEntities()`, `deduplicateEntities()`, `geometryHash()`

### CanvasBoundsManager
**Path**: `services/CanvasBoundsManager.ts`
**Purpose**: Canvas bounds caching για performance
**Methods**: `getBounds()`, `updateBounds()`, `clearCache()`

### ColorLayerUtils
**Path**: `utils/ColorLayerUtils.ts`
**Purpose**: ColorLayer utilities
**Methods**: `toOverlayEntities()`, `calculateBounds()`, `hasVisibleLayers()`

---

## Managers

### ToolManager
**Path**: `systems/toolbars/ToolManager.ts`
**Purpose**: Tool lifecycle management
**Methods**: `setActiveTool()`, `getActiveTool()`, `executeTool()`

### HotkeyManager
**Path**: `systems/toolbars/HotkeyManager.ts`
**Purpose**: Keyboard shortcut management
**Methods**: `registerHotkey()`, `unregisterHotkey()`, `handleKey()`

### ToolRunner
**Path**: `systems/toolbars/ToolRunner.ts`
**Purpose**: Execute tool operations
**Methods**: `run()`, `cancel()`, `complete()`

---

## Utilities

### EntityValidation
**Path**: `utils/entity-validation-utils.ts`
**Purpose**: Entity data validation
**Functions**: `isValid()`, `validateLine()`, `validateCircle()`, `sanitize()`

### GeometricCalculations
**Path**: `snapping/utils/GeometricCalculations.ts`
**Purpose**: Geometric math utilities
**Functions**: `distance()`, `distanceToLine()`, `lineIntersection()`, `projectToLine()`

### AngleCalculation
**Path**: `utils/angle-calculation.ts`
**Purpose**: CAD angle utilities
**Functions**: `normalizeAngle()`, `angleBetween()`, `isOrthogonal()`

### BoundsUtils
**Path**: `utils/bounds-utils.ts`
**Purpose**: Bounds calculation utilities
**Functions**: `calculateBounds()`, `mergeBounds()`, `boundsIntersect()`

---

## Quick Lookup by Feature

### "I want to..."

**...add zoom functionality**
→ Use `ZoomManager` from `CanvasContext`

**...render a custom entity**
→ Create renderer implementing `EntityRenderer`, register με `RendererRegistry`

**...detect which entity user clicked**
→ Use `HitTestingService.findEntityAt()`

**...transform coordinates**
→ Use `CoordinateTransforms.worldToScreen()` / `screenToWorld()`

**...fit view to content**
→ Use `FitToViewService.calculateFitToViewTransform()`

**...implement snapping**
→ Use `ProSnapEngineV2` ή create custom snap engine

**...handle selection**
→ Use `SelectionManager` από `SelectionContext`

**...show grips**
→ Use `GripsSystem.showGrips()`

**...add keyboard shortcut**
→ Use `useKeyboardShortcuts` hook, or `HotkeyManager`

**...validate entity data**
→ Use `EntityValidation.isValid()` και `.sanitize()`

---

## Alphabetical Index

| Class | Category | Path |
|-------|----------|------|
| AngleCalculation | Utility | `utils/angle-calculation.ts` |
| AngleMeasurementRenderer | Entity Renderer | `rendering/entities/angle/` |
| ArcGrip | Grip | `grips/entities/ArcGrip.ts` |
| ArcRenderer | Entity Renderer | `rendering/entities/arc/` |
| CanvasBoundsManager | Service | `services/CanvasBoundsManager.ts` |
| CanvasManager | Canvas | `rendering/canvas/core/` |
| CenterSnapEngine | Snap | `snapping/engines/` |
| CircleGrip | Grip | `grips/entities/CircleGrip.ts` |
| CircleRenderer | Entity Renderer | `rendering/entities/circle/` |
| ColorLayerUtils | Utility | `utils/ColorLayerUtils.ts` |
| ConstraintsSystem | Constraint | `systems/constraints/` |
| CoordinateTransforms | Core | `rendering/core/` |
| CrosshairRenderer | UI Renderer | `canvas-v2/layer-canvas/crosshair/` |
| CursorRenderer | UI Renderer | `rendering/ui/cursor/` |
| DxfRenderer | Canvas | `canvas-v2/dxf-canvas/` |
| EllipseRenderer | Entity Renderer | `rendering/entities/ellipse/` |
| EndpointSnapEngine | Snap | `snapping/engines/` |
| EntityMergeService | Service | `services/EntityMergeService.ts` |
| EntityValidation | Utility | `utils/entity-validation-utils.ts` |
| FitToViewService | Service | `services/FitToViewService.ts` |
| GeometricCalculations | Utility | `snapping/utils/` |
| GridRenderer | UI Renderer | `rendering/ui/grid/` |
| GripDetection | Grip | `grips/GripDetection.ts` |
| GripInteractionManager | Grip | `systems/grip-interaction/` |
| GripManipulator | Grip | `grips/GripManipulator.ts` |
| GripsSystem | Grip | `systems/grips/` |
| GripVisualizer | Grip | `grips/GripVisualizer.ts` |
| HitTestingService | Service | `services/HitTestingService.ts` |
| HotkeyManager | Manager | `systems/toolbars/` |
| IntersectionSnapEngine | Snap | `snapping/engines/` |
| LayerRenderer | Canvas | `canvas-v2/layer-canvas/` |
| LineGrip | Grip | `grips/entities/LineGrip.ts` |
| LineRenderer | Entity Renderer | `rendering/entities/line/` |
| MidpointSnapEngine | Snap | `snapping/engines/` |
| NavigationController | Zoom | `systems/zoom/` |
| NearestSnapEngine | Snap | `snapping/engines/` |
| OrthoConstraint | Constraint | `systems/constraints/` |
| PanManager | Zoom | `systems/zoom/` |
| PerpendicularSnapEngine | Snap | `snapping/engines/` |
| PolarConstraint | Constraint | `systems/constraints/` |
| PointRenderer | Entity Renderer | `rendering/entities/point/` |
| PolylineGrip | Grip | `grips/entities/PolylineGrip.ts` |
| PolylineRenderer | Entity Renderer | `rendering/entities/polyline/` |
| ProSnapEngineV2 | Snap | `snapping/ProSnapEngineV2.ts` |
| QuadrantSnapEngine | Snap | `snapping/engines/` |
| RectangleRenderer | Entity Renderer | `rendering/entities/rectangle/` |
| RendererRegistry | Core | `rendering/RendererRegistry.ts` |
| RulerRenderer | UI Renderer | `rendering/ui/ruler/` |
| SelectionManager | Selection | `systems/selection/` |
| SelectionRenderer | UI Renderer | `canvas-v2/layer-canvas/selection/` |
| SelectionSystem | Selection | `systems/selection/` |
| SnapOrchestrator | Snap | `snapping/orchestrator/` |
| SplineRenderer | Entity Renderer | `rendering/entities/spline/` |
| TangentSnapEngine | Snap | `snapping/engines/` |
| TextGrip | Grip | `grips/entities/TextGrip.ts` |
| TextRenderer | Entity Renderer | `rendering/entities/text/` |
| ToolManager | Manager | `systems/toolbars/` |
| ToolRunner | Manager | `systems/toolbars/` |
| UIRenderer | UI Renderer | `rendering/ui/core/` |
| UIRenderContext | UI Renderer | `rendering/ui/core/` |
| UniversalMarqueeSelection | Selection | `systems/selection/` |
| ViewportManager | Zoom | `systems/zoom/` |
| ZoomManager | Core | `systems/zoom/ZoomManager.ts` |

---

## Statistics

| Category | Count |
|----------|-------|
| **Entity Renderers** | 10 |
| **Canvas Renderers** | 12 |
| **UI Renderers** | 8 |
| **Snap Engines** | 10 |
| **Constraints** | 6 |
| **Selection Classes** | 8 |
| **Grip Classes** | 10 |
| **Zoom Classes** | 6 |
| **Services** | 15+ |
| **Managers** | 20+ |
| **TOTAL CLASSES** | 100+ |

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Zoom & Pan System](../systems/zoom-pan.md)
- [Entity Management](../architecture/entity-management.md)
- [State Management](../architecture/state-management.md)

---

**📚 Complete Class Reference**
*100+ Enterprise Classes • Fully Centralized • Type-Safe*

Last Updated: 2025-10-03
