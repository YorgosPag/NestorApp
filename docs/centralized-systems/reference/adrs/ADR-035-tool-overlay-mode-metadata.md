# ADR-035: Tool Overlay Mode Metadata

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Tools & Keyboard |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Property**: `preservesOverlayMode: boolean` in `ToolInfo`
- **Helper**: `preservesOverlayMode(tool: ToolType)`

---

## Changelog

### 2026-02-13 — Fix: useEffect clearing draft polygon during draw mode

| Field | Value |
|-------|-------|
| **Bug** | Draft polygon was being cleared while actively drawing in overlay draw mode |
| **Root Cause** | `CanvasSection.tsx` had a `useEffect` (line ~637) that reset the draft polygon whenever `activeTool === 'select'`, but draw mode keeps `activeTool` as `'select'` while `overlayMode` is `'draw'` — so the effect was firing during active drawing and wiping the in-progress polygon |
| **Fix** | Added `overlayMode !== 'draw'` guard to the useEffect condition, preventing the draft polygon reset when the user is actively drawing |
| **File** | `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |
| **Lesson** | Any effect that resets overlay state based on `activeTool` must also check `overlayMode` to avoid interfering with draw mode, since draw mode operates with `activeTool === 'select'` |

### 2026-02-13 — Fix: Overlay draw mode clicks not working

| Field | Value |
|-------|-------|
| **Bug** | Clicking on the canvas in overlay draw mode did nothing |
| **Root Cause** | `CanvasSection.tsx` line 1240 had condition `overlayMode === 'draw' && activeTool !== 'select'` which was always false because clicking the "Draw" button only changes `overlayMode`, not `activeTool` (which remains `'select'`) |
| **Fix** | Removed the `activeTool !== 'select'` guard from the condition |
| **File** | `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |
| **Lesson** | `overlayMode` and `activeTool` are independent state axes; guard conditions must not assume one implies the other |

### 2026-02-13 — Fix: Layering toolbar toggle affecting layer visibility

| Field | Value |
|-------|-------|
| **Bug** | Clicking the "Επίπεδα" (Layering) toolbar button toggled BOTH the overlay drawing toolbar AND the `showLayers` state, causing colored overlay polygons to disappear when the user closed the toolbar |
| **Root Cause** | The layering tool toggle in `EnhancedDXFToolbar.tsx` and `MobileToolbarLayout.tsx` was calling both `setActiveTool('layering')` AND `onAction('toggle-layers')`, mixing two independent concerns: toolbar open/close vs. layer canvas visibility |
| **Fix** | Removed `onAction('toggle-layers')` from the layering tool toggle. Now the button only toggles `activeTool` between `'layering'` and `'select'`, keeping toolbar UI and layer visibility as independent state axes |
| **Files** | `src/subapps/dxf-viewer/components/ui/toolbar/EnhancedDXFToolbar.tsx`, `src/subapps/dxf-viewer/components/ui/mobile/MobileToolbarLayout.tsx` |
| **Lesson** | Toolbar button interactions must respect the principle of "independent state axes" — `activeTool` controls which toolbar is visible, while layer visibility should be controlled by separate state. Avoid bundling multiple state mutations into a single UI action. |

### 2026-02-13 — Fix: Move tool not working on overlays

| Field | Value |
|-------|-------|
| **Bug** | Selecting an overlay and switching to the Move tool had no effect — clicking the overlay with the move tool active did nothing |
| **Root Cause** | DxfCanvas (z-10) intercepts ALL pointer events before they reach LayerCanvas (z-0). The `handleOverlayClick` function (which handles move tool initiation) was only reachable through LayerCanvas's `onPointerUp`, which is gated to `activeTool === 'layering'`. The `handleCanvasClick` path (DxfCanvas click route) had no overlay hit-testing for the 'move' tool. |
| **Fix** | Added point-in-polygon hit-test in `handleCanvasClick` for `activeTool === 'move'`: iterates over `currentOverlays`, tests if `worldPoint` is inside each polygon using `isPointInPolygon()`, and calls `handleOverlayClick()` on match to initiate body drag. |
| **File** | `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |
| **Lesson** | Due to z-index stacking (DxfCanvas z-10 > LayerCanvas z-0), any overlay interaction that previously relied on LayerCanvas mouse handlers MUST be duplicated in the DxfCanvas click path (`handleCanvasClick`). This is a fundamental architectural constraint of the dual-canvas system. |

### 2026-02-13 — Fix: Layering tool permanently locked after overlay selection

| Field | Value |
|-------|-------|
| **Bug** | After selecting an overlay from the left panel ("Επίπεδα Έργου"), the "Επίπεδα" toolbar button became permanently active — clicking any other tool had no effect, always reverting to layering |
| **Root Cause** | `DxfViewerContent.tsx` had a `useEffect` (line ~846) that auto-activated the layering tool when an overlay was selected. It included `activeTool` in its dependency array, creating a feedback loop: user changes tool → effect fires → `primarySelectedId` still set + `activeTool !== 'layering'` → forces back to 'layering'. Only 'select' was excluded. |
| **Fix** | Added a `prevPrimarySelectedIdRef` to track the previous selection. The effect now only auto-switches to 'layering' when a **new** overlay is selected (`primarySelectedId !== prevRef.current`), not on every `activeTool` change. Users can now freely switch tools after selecting an overlay. |
| **File** | `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` |
| **Lesson** | Effects that auto-switch `activeTool` based on selection state must NOT include `activeTool` as a trigger for re-execution — this creates feedback loops. Use a ref to detect actual selection *changes* and only react to those. |

### 2026-02-13 — Fix: Move tool drag flow (3 sub-fixes)

| Field | Value |
|-------|-------|
| **Bug** | Move tool on overlays: (a) second click re-initiated drag instead of ending it, (b) no visual drag preview during movement, (c) overlay deselected during drag |
| **Root Cause (a)** | `handleCanvasClick` entered move tool hit-test on every click, including the second click meant to end the drag — this re-set `draggingOverlayBody` instead of letting `handleContainerMouseUp` finish the move |
| **Root Cause (b)** | Drag preview position was only updated in LayerCanvas.onMouseMove (line 1802), which never fires because DxfCanvas (z-10) intercepts all pointer events |
| **Root Cause (c)** | The deselection block at the end of `handleCanvasClick` cleared overlay selection during an active drag |
| **Fix (a)** | Added `!draggingOverlayBody` guard to the move tool hit-test, and early return when `draggingOverlayBody` is set |
| **Fix (b)** | Added drag preview update logic to `handleContainerMouseMove` (useCanvasMouse.ts) — the container div's mousemove handler is the only one that reliably fires |
| **Fix (c)** | Added early return in handleCanvasClick when `activeTool === 'move' && draggingOverlayBody` |
| **Files** | `CanvasSection.tsx`, `useCanvasMouse.ts` |
| **Lesson** | The dual-canvas architecture means ALL mouse interaction must go through the container div handlers or DxfCanvas handlers (never LayerCanvas). Any drag-related state updates in LayerCanvas.onMouseMove must be duplicated in the container's mousemove handler. |

### 2026-02-13 — Feature: Entity selection with Select tool

| Field | Value |
|-------|-------|
| **Feature** | Click on drawn entities (lines, circles, rectangles, polylines, arcs) with the Select tool to select them — selected entities are highlighted with a dashed rectangle |
| **Implementation** | Added point-proximity hit-testing in `handleCanvasClick` for `activeTool === 'select'`, using the same tolerance as Circle-TTT. Selection state stored in `selectedEntityIds` and passed to DxfCanvas via `renderOptions.selectedEntityIds`. DxfRenderer already had rendering support for `selectedEntityIds`. |
| **Entity types** | Line, Polyline, LWPolyline, Circle, Arc, Rectangle, Rect |
| **File** | `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |

### 2026-02-13 — Fix: AutoCAD-style Window/Crossing marquee selection not working

| Field | Value |
|-------|-------|
| **Bug** | Window Selection (blue, left-to-right) and Crossing Selection (green, right-to-left) marquee boxes did not appear when dragging on the canvas — no visual feedback and no entities/overlays selected |
| **Root Cause** | DxfCanvas (z-10) intercepts ALL pointer events but did NOT forward marquee-related props (`colorLayers`, `onLayerSelected`, `onMultiLayerSelected`, `onEntitiesSelected`, `canvasRef`, `isGripDragging`) to its internal `useCentralizedMouseHandlers` instance. The existing marquee code in `useCentralizedMouseHandlers` was fully functional but only wired up for LayerCanvas (z-0), which never receives events due to z-index stacking. Additionally, the marquee guard required `colorLayers.length > 0`, blocking entity-only selection. |
| **Fix** | (1) Added `onLayerSelected`, `onMultiLayerSelected`, `onEntitiesSelected`, `isGripDragging` props to `DxfCanvasProps` interface. (2) Destructured and forwarded all marquee props to `useCentralizedMouseHandlers` in DxfCanvas, including `colorLayers` and `canvasRef`. (3) In `useCentralizedMouseHandlers`, added `onEntitiesSelected` callback prop and routed `breakdown.entityIds` to it separately from layer/overlay IDs. (4) Removed `colorLayers.length > 0` guard so marquee works for entities even without overlays. (5) In CanvasSection, passed `handleOverlayClick`, `handleMultiOverlayClick`, `setSelectedEntityIds`, and grip-drag state to DxfCanvas. |
| **Files** | `DxfCanvas.tsx`, `CanvasSection.tsx`, `useCentralizedMouseHandlers.ts` |
| **Lesson** | The dual-canvas z-index architecture (DxfCanvas z-10 > LayerCanvas z-0) means ALL interactive features must be wired through DxfCanvas. Any mouse handler feature in `useCentralizedMouseHandlers` that works on LayerCanvas must also have its props forwarded from DxfCanvas. This is the same pattern as the move tool fix (earlier in this changelog). |
