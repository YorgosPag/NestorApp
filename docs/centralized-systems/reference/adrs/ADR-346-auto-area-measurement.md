# ADR-346: Auto Area Measurement (Point-and-Click)

**Status:** ✅ IMPLEMENTED  
**Date:** 2026-05-12  
**Domain:** DXF Viewer — Measurement Tools  

---

## Context

The existing `measure-area` tool requires the user to manually click 3+ polygon vertices to define the area boundary. For closed DXF polylines (LWPOLYLINE/POLYLINE with `closed: true`) and overlay polygons, the boundary is already known. A point-and-click auto-detect mode eliminates manual tracing.

## Decision

Add `auto-measure-area` as a second option inside the existing `measure-area` dropdown button.

### User flow

1. User clicks ▾ on the "Measure Area" toolbar button and selects "Αυτόματη Εμβαδομέτρηση"  
2. Tool activates (`activeTool === 'auto-measure-area'`)  
3. User clicks INSIDE any closed polygon (DXF or overlay)  
4. System finds all containing polygons, picks the smallest (most specific hit)  
5. `AutoAreaResultPanel` appears near the click showing area + perimeter + source  
6. Panel auto-dismisses when user switches tool; manual X button also available

### Architecture

| Component | Role |
|-----------|------|
| `ui/toolbar/types.ts` | `ToolType` union extended with `'auto-measure-area'` |
| `systems/tools/ToolStateManager.ts` | Tool registered (category: measurement, allowsContinuous: true) |
| `ui/toolbar/toolDefinitions.tsx` | `measure-area` button gains `dropdownOptions` array (ScanLine icon) |
| `systems/auto-area/AutoAreaResultStore.ts` | Module-level pub/sub store for click result (ADR-040 pattern) |
| `systems/auto-area/AutoAreaPreviewStore.ts` | Module-level pub/sub store for hover polygon preview |
| `systems/auto-area/auto-area-hit.ts` | SSOT for hit-test logic: `collectAreaCandidates`, `getAutoAreaHitPolygon` |
| `systems/auto-area/auto-area-geometry.ts` | Half-edge planar face algorithm for connected line segments |
| `hooks/canvas/useCanvasClickHandler.ts` | Priority 1.7: `handleAutoAreaClick` (uses auto-area-hit SSOT) |
| `hooks/canvas/useAutoAreaMouseMove.ts` | Wraps unified mouse-move, updates preview store (throttled 50ms) |
| `hooks/tools/useSpecialTools.ts` | Clears both stores on tool change |
| `components/dxf-layout/AutoAreaResultPanel.tsx` | `useSyncExternalStore` subscriber, Tailwind floating card |
| `components/dxf-layout/AutoAreaPreviewOverlay.tsx` | SVG polygon highlight, subscribes to AutoAreaPreviewStore |
| `components/dxf-layout/CanvasLayerStack.tsx` | Renders both overlays (non-high-freq, ADR-040 safe) |
| `components/dxf-layout/CanvasSection.tsx` | Calls `useAutoAreaMouseMove`, passes wrapped handler to stack |

### Hit-test algorithm

```
candidates = []
for each LWPOLYLINE/POLYLINE with closed=true AND vertices.length >= 3:
    if isPointInPolygon(point, vertices): candidates.push({ area, polygon, source: 'dxf-polyline' })
for each RectangleEntity/RectEntity:
    verts = [tl, tr, br, bl]
    if isPointInPolygon(point, verts): candidates.push({ area=w*h, polygon: verts, source: 'dxf-polyline' })
for each CircleEntity:
    if dist(point, center) < radius: candidates.push({ area=πr², polygon: approx64pts, ... })
for each LineEntity: collect for face detection
faces = findClosedPolygonsFromLines(linePairs, snapTolerance)
for each face: if isPointInPolygon(point, face): candidates.push(...)
for each overlay with polygon.length >= 3:
    if isPointInPolygon(point, polygon): candidates.push({ area, source: 'overlay' })
best = candidates with minimum area  // most specific (innermost polygon)

// Hole subtraction — net area
allPolygons = all closed entities (no worldPoint filter)
inside = allPolygons where area < best.area AND all vertices inside best.polygon
directHoles = inside where NOT (all vertices inside any other 'inside' polygon)
              // removes doubly-nested shapes (e.g. objects inside a hole)
netArea = best.area - sum(directHoles.area)
```

`isPointInPolygon` uses ray-casting (GeometryUtils.ts — centralized).  
`calculatePolygonArea` uses Shoelace formula (geometry-polyline-utils.ts — centralized).  
`findClosedPolygonsFromLines` uses half-edge planar face traversal (auto-area-geometry.ts).

### Hover preview

On mousemove (throttled 50ms), `useAutoAreaMouseMove` calls `getAutoAreaHitPolygon` (same hit-test as click). The result polygon world-coords are stored in `AutoAreaPreviewStore`. `AutoAreaPreviewOverlay` converts them to screen coords via `CoordinateTransforms.worldToScreen` and renders an SVG `<polygon>` with a dashed blue stroke. This gives the user real-time visual feedback about which region will be measured before clicking.

### ADR-040 compliance

- Both `AutoAreaResultPanel` and `AutoAreaPreviewOverlay` call `useSyncExternalStore` independently — **not** in CanvasLayerStack shell. The shell merely renders them.
- Both stores are module-level (same pattern as HoverStore, ImmediatePositionStore).
- No canvas rendering — pure HTML/SVG overlays.

### i18n

Keys added to `dxf-viewer-shell` namespace:
- `tools.measureAreaManual`, `tools.measureAreaAuto`
- `autoArea.*` section (title, area, grossArea, deductions, perimeter, layer, noPolygon, dismiss, sourceDxf, sourceOverlay)

---

## Consequences

- **+** Point-and-click area for DXF drawings, no manual vertex selection  
- **+** Works for both DXF closed polylines and overlay polygons  
- **+** Self-contained: store + panel + click handler touch no forbidden files  
- **–** Area displayed in m² (unit system hardcoded to metric; configurable unit system is future work)  
- **–** Nested polygon hit: innermost wins by area; overlapping-same-area edge case: first candidate wins
- **+** Hole subtraction: closed shapes entirely inside the measured polygon are automatically subtracted; only direct children (not doubly-nested) are subtracted to avoid double-counting

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-12 | Initial implementation — ADR-346 created |
| 2026-05-13 | Hover preview — `AutoAreaPreviewStore` + `AutoAreaPreviewOverlay` (SVG) + `useAutoAreaMouseMove`; `auto-area-hit.ts` extracted as shared SSOT |
| 2026-05-13 | Hole subtraction — `collectHoleAreas` in `auto-area-hit.ts`; `AutoAreaResult` gains `netArea/holesCount/holesArea`; panel shows gross + deduction rows when holes detected |
| 2026-05-13 | Fix SVG overlay offset — `AutoAreaPreviewOverlay` moved inside `canvas-stack` div (was sibling → wrong containing block) |
| 2026-05-13 | Hover preview shows annulus — `AutoAreaPreviewStore` gains `holes: Point2D[][]`; `getAutoAreaHitResult()` added; `AutoAreaPreviewOverlay` uses SVG compound path + `fill-rule="evenodd"` (outer + hole contours, donut fill) |
| 2026-05-13 | Fix rectangle detection — `getRectVertices()` uses `corner1/corner2` (drawing-tool format) before `x/y/width/height` (import format); supports ellipses (`isEllipseEntity`) and full-circle arcs (`isArcEntity` with span ≥ 359.9°); `isPolygonInsideOuter` now uses centroid + sampled vertices (fixes concentric-circle precision); hole area threshold changed from absolute `−0.001` to relative `outerArea × (1−1e−9)` to handle small-scale drawings |
| 2026-05-13 | Perf fix — `findClosedPolygonsFromLines` (O(n²) half-edge build) cached via `WeakMap<entities, Map<roundedScale, faces>>` in `auto-area-hit.ts`; was recomputed on every mousemove (924ms/frame → ~0ms on cache hit); invalidates automatically when entities ref changes or scale changes by >0.1% |
