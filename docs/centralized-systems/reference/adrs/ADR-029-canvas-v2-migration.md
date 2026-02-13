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

### 2026-02-13 — Fix: LayerRenderer TDZ crash (Layer Canvas rendered nothing)

| Field | Value |
|-------|-------|
| **Bug** | Layer Canvas rendered nothing; production error: `"Failed to render Layer canvas: ReferenceError: Cannot access 'p' before initialization"` |
| **Root Cause** | `LayerRenderer.ts` lines 224-234 assigned `this.viewport = actualViewport` before the `const actualViewport` declaration, causing a Temporal Dead Zone (TDZ) ReferenceError at runtime (minified as variable `'p'`) |
| **Fix** | Moved `const actualViewport` declaration before its first usage |
| **File** | `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts` |
| **Lesson** | `const`/`let` declarations are hoisted but not initialized; referencing them before their lexical position causes TDZ ReferenceError. Always declare before use. |
