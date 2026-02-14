# DXF Viewer Hover/Selection/Grips Research Report

Date: 2026-02-14
Scope: `src/subapps/dxf-viewer` (DXF entities: line, rectangle, circle, arc, polyline, measurements)

## Executive Summary
- The current implementation is click-first selection, not true hover-first highlighting.
- `hover` visual behavior is explicitly unsupported for shape entities (`circle`, `rectangle/rect`, `arc`, `ellipse`).
- Grips are shown for selected entities, not for merely hovered entities.
- In practice, this explains exactly what you see: no AutoCAD-like glow-on-crosshair for many entities, while grips appear after selection.

## What Exists Today

### 1) Hover rendering support is incomplete by design
- Hover manager marks these as unsupported:
  - `src/subapps/dxf-viewer/utils/hover/index.ts:16`
  - `src/subapps/dxf-viewer/utils/hover/index.ts:17`
  - `src/subapps/dxf-viewer/utils/hover/index.ts:70`
- Shape hover stubs were removed:
  - `src/subapps/dxf-viewer/utils/hover/shape-renderers.ts`
- Entity renderers confirm no shape-hover integration:
  - `src/subapps/dxf-viewer/rendering/entities/CircleRenderer.ts:21`
  - `src/subapps/dxf-viewer/rendering/entities/ArcRenderer.ts:9`

### 2) Selection is handled on click in CanvasSection (manual hit-test)
- Select-tool entity picking block:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1294`
- On hit, selection is set:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1363`
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1364`
- On empty click, selection clears:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1386`

### 3) DxfCanvas has hit-test callback plumbing, but parent does not feed on-entity hover/selection callback
- API supports it:
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx:65`
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx:206`
- Mouse handlers use it only when callback exists:
  - `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:257`
  - `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:667`
- Current parent wiring for `DxfCanvas` passes `onCanvasClick` and `onEntitiesSelected`, not `onEntitySelect`:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1919`
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1962`
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1967`

### 4) Rendering path is selected/normal only (no active hoveredEntity state in DXF pass)
- Per-entity render options use only selected vs normal:
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:117`
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:123`
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:126`
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:127`

### 5) Highlight bus currently behaves as select-sync channel
- Parent ignores non-select modes:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:927`
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:928`
- This means hover-mode bus events are effectively not used for main selected ids sync.

## Entity Coverage Matrix (Current)
- `line`: hit-test/select supported, grips on select.
- `polyline/lwpolyline`: hit-test/select supported, grips on select.
- `rectangle/rect`: click select supported in `CanvasSection`; hover visuals unsupported by hover manager.
- `circle`: click select supported; hover visuals unsupported by hover manager.
- `arc`: click select supported; hover visuals unsupported by hover manager.
- `angle-measurement`: selection path exists, but hover-first visual is not wired as global behavior.

## Root Causes
1. No unified `hoveredEntityId` state driving DXF rendering.
2. Hover visual subsystem explicitly excludes key shape entities.
3. Event flow is split: select-on-click logic in `CanvasSection`, hit-test infra in `DxfCanvas`/`useCentralizedMouseHandlers`, rendering in `DxfRenderer`.
4. Grips are tied to selected IDs (`renderOptions.selectedEntityIds`), not hover candidate IDs.

## Proposed Implementation Plan (AutoCAD-like behavior)

### Phase 1: Unify hover state
- Add centralized `hoveredEntityId` for DXF entities (single source of truth).
- Feed it from mouse-move hit-test (throttled) in `DxfCanvas` path.
- Keep click selection separate (`selectedEntityIds`).

### Phase 2: Wire hover rendering in DXF render path
- Pass `hoveredEntityId` into `DxfRenderer` and set per-entity `hovered` render option.
- Ensure selected+hover precedence is deterministic.

### Phase 3: Implement shape hover visuals
- Add proper hover rendering for `circle`, `arc`, `rectangle/rect`, `ellipse` (not stubs).
- Match AutoCAD-style visual language (highlight stroke + optional thickness/opacity).

### Phase 4: Grip policy
- Keep default: grips visible on selection click.
- Optional toggle (if desired): show passive grips on hover (off by default for visual noise/perf).

### Phase 5: Hit-test consistency
- Remove duplicated point hit-test logic in `CanvasSection` where possible.
- Reuse centralized `HitTestingService`/`HitTester` for both hover and click-select.

### Phase 6: Performance/safety
- Throttle hover hit-testing.
- Skip hover processing while dragging/panning.
- Add focused tests for hover state transitions and selected+hover interplay.

## Practical Conclusion
For the requested behavior (AutoCAD-like):
- On crosshair over entity: highlight immediately.
- On click: select entity + show corner/mid grips.

The current codebase has the infrastructure pieces, but they are not fully connected for this UX yet.
Main blockers are explicit shape-hover exclusion and missing unified hovered-entity state in the DXF render pipeline.
