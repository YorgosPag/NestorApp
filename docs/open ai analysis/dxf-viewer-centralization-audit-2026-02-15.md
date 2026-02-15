# DXF Viewer Centralization Audit (SSoT)

Date: 2026-02-15
Scope: `src/subapps/dxf-viewer`
Goal: Verify if there are still non-centralized patterns, hardcoded values, and inline styles that should be centralized.

## Direct Answers

1. Υπάρχουν διάσπαρτα patterns που δεν είναι πλήρως κεντρικοποιημένα;
- YES

2. Υπάρχουν hardcoded τιμές / inline styles που πρέπει να μπουν σε κεντρικά συστήματα;
- YES

---

## Evidence: Non-centralized Patterns (YES)

### A) Dual event channels (`window CustomEvent` vs internal EventBus)
- Producers use `window.dispatchEvent(...)`:
  - `src/subapps/dxf-viewer/overlays/types.ts:185`
  - `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx:331`
- Consumers also exist on internal bus:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:905`
- EventBus only guarantees `emit -> window`, not inverse `window -> bus` subscription path:
  - `src/subapps/dxf-viewer/systems/events/EventBus.ts`

Impact:
- Not a single event SSoT. Behavior can diverge by channel.

### B) Dual pointer/crosshair update paths
- Canvas-based immediate pointer updates:
  - `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts:304`
- Container-based immediate pointer updates (second writer):
  - `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:309`
  - `src/subapps/dxf-viewer/hooks/canvas/useCanvasMouse.ts:319`
- Container handler mounted in main canvas stack:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1716`

Impact:
- Not one coordinate authority; possible crosshair-vs-click drift.

### C) Universal selection primary id used directly as overlay id in multiple places
- `selectedOverlayId={universalSelection.getPrimaryId()}`:
  - `src/subapps/dxf-viewer/components/dxf-layout/ToolbarSection.tsx:118`
  - `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:193`
- Overlay lookup using primary id without strict type gate:
  - `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:209`

Impact:
- Multi-entity selection model leaks into overlay-only UI paths (not strict SSoT by type).

### D) Overlay drawing logic split (legacy/disconnected hook + active path)
- `useOverlayDrawing` outputs destructured in `DxfViewerContent`:
  - `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:414`
- No further references to these outputs in file (disconnected path).
- Active draw path exists in `CanvasSection` with its own `draftPolygon` flow.

Impact:
- Architectural duplication / dead parallel pathway against single source principle.

---

## Evidence: Hardcoded / Inline (YES)

### A) Inline styles in production UI paths
- `style={{ height: calc(...) }}`:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:2097`
- Canvas overlays/components with direct style objects:
  - `src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas.tsx:290`
  - `src/subapps/dxf-viewer/canvas-v2/overlays/ZoomWindowOverlay.tsx:47`
  - `src/subapps/dxf-viewer/canvas-v2/overlays/SelectionMarqueeOverlay.tsx:48`
  - `src/subapps/dxf-viewer/canvas-v2/overlays/RulerCornerBox.tsx:263`
  - `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx:500`

### B) Hardcoded literal visual values in component runtime
- Preview defaults include direct literals:
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:2077` (`'#00FF00'`)
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:2078` (`lineWidth: 1`)
  - `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:2079` (`opacity: 0.9`)

Note:
- Many hardcoded constants do exist inside centralized config modules (e.g. `color-config.ts`, `settings/standards/aci.ts`).
- Those are acceptable as centralized SSoT for constants; the issue is runtime literals/inline styles outside these central systems.

---

## Final Verdict

- Non-centralized patterns remain: YES
- Hardcoded/inline that should be centralized remain: YES

The project has strong centralized foundations, but it is not yet fully SSoT-complete across runtime UI/event/coordinate paths.
