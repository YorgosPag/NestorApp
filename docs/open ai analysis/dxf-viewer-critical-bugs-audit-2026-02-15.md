# DXF Viewer - Critical Bugs Audit Report

Date: 2026-02-15
Scope: Static code audit in `src/subapps/dxf-viewer` (critical defects only).

## Finding 1 (Critical): Crosshair center and click point can diverge (coordinate source split)

### Evidence
- Canvas click world-point is computed in centralized canvas handlers from `e.currentTarget` snapshot:
  - `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:561`
  - `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:568`
- Crosshair immediate position is also updated by a second, container-based path:
  - `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:309`
  - `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:319`
- Container mouse-move handler is mounted on canvas stack container:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1716`

### Why this is critical
Two different writers update pointer/crosshair coordinates (canvas-based and container-based). When bounds differ (even temporarily), visible crosshair center and actual click world-point diverge. This directly affects precision drawing and selection.

### Risk
- Wrong placement of overlay points
- User-perceived "offset click" defect
- CAD precision workflow regression

---

## Finding 2 (Critical): Draft polygon preview is suppressed for first clicks

### Evidence
- Draft layer is created from `draftPolygon` and passed to renderer:
  - `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts:298`
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1737`
- Renderer hard-stops polygons with less than 3 vertices:
  - `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:483`
  - `if (polygon.vertices.length < 3) return;`

### Why this is critical
During overlay draw mode, first interactions are visually silent (no visible path/grips until enough points exist). This breaks immediate user feedback and causes false perception that clicks are not registered.

### Risk
- High UX failure in creation workflow
- Increased mis-click and duplicate input behavior
- Confusion with "non-working draw mode"

---

## Finding 3 (Critical): Event system split (window CustomEvent vs internal EventBus) breaks activation chain

### Evidence
- Producer dispatches window custom event:
  - `src/subapps/dxf-viewer/overlays/types.ts:185`
  - `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx:331`
- Consumer in `DxfViewerContent` listens on internal `eventBus.on(...)`:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:905`
- EventBus is one-way compatible (`emit` -> also window event), but `on` does **not** subscribe to window events:
  - `src/subapps/dxf-viewer/systems/events/EventBus.ts` (implementation of `emit` and `on`)

### Why this is critical
The architecture mixes two event channels that are not symmetric. Window-dispatched events are not guaranteed to reach `eventBus.on` subscribers. This can silently skip critical side-effects (e.g., layer/tool activation flows).

### Risk
- Non-deterministic behavior between panels and canvas
- Activation flows working in one place and failing in another
- Hard-to-debug regressions due to split event topology

---

## Executive Summary
Current critical risk areas in DXF Viewer are:
1. Coordinate SSoT violation (crosshair vs click computation paths)
2. Draft preview rendering gate for early polygon points
3. Split event architecture (`window` vs internal EventBus)

These issues affect core CAD behavior: precision input, visual feedback, and deterministic tool/panel orchestration.
