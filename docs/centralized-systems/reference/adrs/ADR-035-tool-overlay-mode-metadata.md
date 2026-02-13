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
