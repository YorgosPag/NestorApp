# ADR-029: Canvas V2 Migration

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `canvas-v2/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `canvas-v2/` (ONLY active system)
- **Deprecated**: `_canvas_LEGACY/` (excluded from TypeScript)
- **API**: `DxfCanvasRef` (4 methods vs V1's 11 methods)

---

## Changelog

### 2026-02-13 — Fix: DxfCanvas opaque background blocking LayerCanvas (z-index stacking)

| Field | Value |
|-------|-------|
| **Bug** | LayerCanvas (z-0) was completely invisible because DxfCanvas (z-10) had an opaque black CSS background (`#000000`) that blocked everything beneath it |
| **Root Cause** | DxfCanvas canvas element had `backgroundColor: CANVAS_THEME.DXF_CANVAS` (solid black), making the higher z-index canvas fully opaque and hiding LayerCanvas underneath |
| **Fix** | Moved the background color from the DxfCanvas `<canvas>` element to the CanvasSection container div (`bg-[var(--canvas-background-dxf)]`), and set DxfCanvas canvas background to `'transparent'` so lower z-index canvases are visible through it |
| **Files** | `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx`, `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` |
| **Lesson** | In a multi-canvas stacking architecture, only the lowest container should carry an opaque background; all overlay canvases must be transparent to allow composited rendering |

### 2026-02-13 — Fix: LayerRenderer TDZ crash (Layer Canvas rendered nothing)

| Field | Value |
|-------|-------|
| **Bug** | Layer Canvas rendered nothing; production error: `"Failed to render Layer canvas: ReferenceError: Cannot access 'p' before initialization"` |
| **Root Cause** | `LayerRenderer.ts` lines 224-234 assigned `this.viewport = actualViewport` before the `const actualViewport` declaration, causing a Temporal Dead Zone (TDZ) ReferenceError at runtime (minified as variable `'p'`) |
| **Fix** | Moved `const actualViewport` declaration before its first usage |
| **File** | `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts` |
| **Lesson** | `const`/`let` declarations are hoisted but not initialized; referencing them before their lexical position causes TDZ ReferenceError. Always declare before use. |
