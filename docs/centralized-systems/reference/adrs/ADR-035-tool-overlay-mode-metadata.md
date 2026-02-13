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

### 2026-02-13 — Fix: Overlay draw mode clicks not working

| Field | Value |
|-------|-------|
| **Bug** | Clicking on the canvas in overlay draw mode did nothing |
| **Root Cause** | `CanvasSection.tsx` line 1240 had condition `overlayMode === 'draw' && activeTool !== 'select'` which was always false because clicking the "Draw" button only changes `overlayMode`, not `activeTool` (which remains `'select'`) |
| **Fix** | Removed the `activeTool !== 'select'` guard from the condition |
| **File** | `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |
| **Lesson** | `overlayMode` and `activeTool` are independent state axes; guard conditions must not assume one implies the other |
