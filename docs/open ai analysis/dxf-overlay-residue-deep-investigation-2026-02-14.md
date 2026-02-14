# DXF Viewer Deep Investigation Report: Overlay Residue on Bottom Zoom

Date: 2026-02-14
Author: Codex (Plan-mode style investigation)
Scope: `src/subapps/dxf-viewer` render pipeline (DXF canvas, Layer canvas, bounds cache, resize orchestration, unified RAF scheduler)

## 1. Executive Summary
The visual residue ("ghost strips" / leftover colored fragments at the bottom while zooming) is a canvas clearing mismatch issue.

Primary root cause:
- Clear pass may run with cached/stale canvas bounds.
- Draw pass may run with fresh bounds in the same interaction window.
- When viewport changes (especially near bottom where ruler/toolbar offsets are active), a non-cleared strip remains and looks like overlay residue.

Confidence: High.

## 2. User-Observed Symptom
Symptom reported:
- Colored overlay polygons leave residual artifacts when zooming near the bottom side of the canvas.

This matches a classic partial-clear artifact (old pixels remain where the clear area is smaller than the effective draw area).

## 3. Evidence (Code-Level)
### 3.1 Bounds cache TTL allows stale dimensions
- `src/subapps/dxf-viewer/services/CanvasBoundsService.ts:46`
  - `MAX_AGE_MS: 5000`
- `src/subapps/dxf-viewer/services/CanvasBoundsService.ts:156`
  - Cache hit path returns bounds while still under TTL.

Implication:
- For up to 5 seconds, `getBounds()` can return geometry not aligned with the latest canvas layout changes if no invalidation event has occurred yet.

### 3.2 `CanvasUtils.clearCanvas()` uses cached bounds (`getBounds`) for clear area
- `src/subapps/dxf-viewer/rendering/canvas/utils/CanvasUtils.ts:84`
  - `const rect = canvasBoundsService.getBounds(canvas)`
- `src/subapps/dxf-viewer/rendering/canvas/utils/CanvasUtils.ts:92`
  - `ctx.clearRect(0, 0, logicalWidth, logicalHeight)`

Implication:
- If cached rect is stale, clear area can be smaller/shifted relative to current render target.

### 3.3 Renderer comments already document the exact root cause
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:76-78`
  - Explicit comment: stale clear/draw mismatch causes residual strips.
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:226-228`
  - Same explicit root-cause note.

### 3.4 LayerRenderer changed to fresh-bounds clear
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:228`
  - `const canvasRect = canvasBoundsService.refreshBounds(this.canvas)`
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:241`
  - `this.ctx.clearRect(0, 0, canvasRect.width, canvasRect.height)`

This is the correct mitigation because clear and draw share the same fresh geometry in that frame.

### 3.5 DxfRenderer still clears via CanvasUtils after refresh
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:78`
  - `refreshBounds(this.canvas)` is called first
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts:82`
  - `CanvasUtils.clearCanvas(...)`

Risk note:
- This currently relies on cache being fresh from the immediately previous call.
- It is likely safe in this path, but less explicit/robust than LayerRenderer’s direct clear with `canvasRect`.

## 4. Why It Shows Stronger Near Bottom Side
Bottom side combines:
- Ruler margins/height and toolbar-induced layout changes.
- Dynamic viewport transitions via container-driven resize (`CanvasSection`).
- Multiple canvases (Layer + DXF + overlays) composited with synchronized RAF logic.

If one canvas clears with stale logical dimensions while another renders with fresh viewport, artifacts become most visible in boundary zones (typically bottom/right strips).

## 5. Deep System Review (Race/Resize/Scheduler)
### 5.1 Viewport source-of-truth is container-first (good)
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasResize.ts:103-107`
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasResize.ts:120-123`

The system intentionally avoids dual ResizeObserver races when `viewportProp` is present.

### 5.2 UnifiedFrameScheduler is not the primary fault
- `src/subapps/dxf-viewer/rendering/core/UnifiedFrameScheduler.ts`
  - Dirty-flag orchestration and synchronized canvas rendering are present.

No direct evidence that scheduler ordering itself creates residue.
The dominant issue is clear-area geometry mismatch.

### 5.3 Additional supporting evidence of prior race hardening
- `DxfCanvas.tsx` / `LayerCanvas.tsx` maintain `transformRef`, `resolvedViewportRef`, and `isDirtyRef` to avoid stale closure issues.
- This reduces many frame races but does not by itself solve stale-bounds clear behavior unless clear and draw share same fresh bounds.

## 6. Current Status Assessment
Local source indicates remediation was introduced:
- LayerRenderer uses fresh bounds + direct clearRect.
- DxfRenderer has explicit root-cause comments and pre-refresh step.

If issue is still visible on deployed app, likely explanations:
1. Deployed build predates latest fix.
2. Another canvas path still clears with stale geometry under specific flow.
3. A UI overlay canvas (or preview path) performs clear with different dimension basis under certain interactions.

## 7. Hardening Recommendations
1. Standardize clear strategy in all active renderers:
- Always compute one fresh rect at frame start (`refreshBounds`).
- Use that exact rect for both clear and viewport-dependent draw in same frame.

2. Refactor `CanvasUtils.clearCanvas` contract:
- Option A: accept explicit `width/height` to avoid internal bounds fetch.
- Option B: accept a pre-fetched rect.

3. Reduce bounds cache TTL for interactive canvases (or bypass cache inside render loop):
- Current `MAX_AGE_MS=5000` is aggressive for dynamic CAD viewport operations.

4. Add regression guard:
- Visual test: rapid zoom in/out at bottom edge, with toolbar/ruler toggles.
- Assert no residual non-transparent pixels in invalidation bands.

## 8. Verification Checklist (Post-Fix)
- Zoom in/out repeatedly near bottom ruler area.
- Toggle side/floating panels while zooming.
- Switch tools (`layering`, `select`, `pan`) and repeat zoom.
- Validate at DPR 1.0, 1.25, 1.5, 2.0.
- Validate on both canvases enabled and with one hidden.

Expected result:
- No persistent pixel residue after each frame.

## 9. Final Conclusion
The residue is a rendering invalidation issue, specifically partial clear caused by stale/cached bounds being used in the clear phase while drawing uses fresher geometry.

The codebase already contains targeted fixes and explicit comments acknowledging this root cause. Remaining production artifacts are most likely deployment-version lag or incomplete normalization of clear semantics across all canvas paths.
