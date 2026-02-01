# ADR-064: Shape Primitives Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `rendering/primitives/canvasPaths.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `rendering/primitives/canvasPaths.ts` (extends ADR-058)
- **Decision**: Centralize all shape path functions (square, diamond, cross, triangle, X)
- **API**: `addSquarePath()`, `addDiamondPath()`, `addCrossPath()`, `addTrianglePath()`, `addXPath()`
- **Problem**: Duplicate shape rendering code across 3 files (~100 lines)
- **Solution**: Single Source of Truth in canvasPaths.ts
- **Files Migrated**:
  - GripShapeRenderer.ts - uses `addDiamondPath()`
  - CursorRenderer.ts - uses `addSquarePath()`, `addDiamondPath()`, `addCrossPath()`
  - SnapRenderer.ts - uses all 5 shape primitives
- **Result**: 6 shape types centralized, zero duplicate path code
