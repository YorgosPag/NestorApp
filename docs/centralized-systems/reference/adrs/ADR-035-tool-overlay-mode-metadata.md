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
