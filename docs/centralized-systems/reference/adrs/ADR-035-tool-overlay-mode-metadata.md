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
