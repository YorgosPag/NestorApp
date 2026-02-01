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
