# ADR-008: CSS→Canvas Coordinate Contract

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Formula**: `(e.clientX - rect.left) * (canvas.width / rect.width)`
- **Pattern**: Industry Standard (AutoCAD/Figma/Blender)
