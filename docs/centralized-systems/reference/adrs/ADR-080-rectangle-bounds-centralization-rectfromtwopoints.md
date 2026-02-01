# ADR-080: Rectangle Bounds Centralization (rectFromTwoPoints)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `rectFromTwoPoints()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `rectFromTwoPoints()`, `RectBounds` from `geometry-rendering-utils.ts`
- **Impact**: 10+ inline bounding box calculations → 1 function
- **Problem**: Duplicate `Math.min(p1.x, p2.x)` / `Math.abs(p2.x - p1.x)` patterns scattered across files
- **Solution**: Centralized `rectFromTwoPoints(p1, p2): RectBounds` function
- **Mathematical Formula**:
  - `x = Math.min(p1.x, p2.x)`
  - `y = Math.min(p1.y, p2.y)`
  - `width = Math.abs(p2.x - p1.x)`
  - `height = Math.abs(p2.y - p1.y)`
- **Interface**:
  ```typescript
  interface RectBounds { x: number; y: number; width: number; height: number; }
  ```
- **Files Migrated**:
  - `PreviewRenderer.ts` - Rectangle preview bounds (1 pattern)
  - `ZoomWindowOverlay.tsx` - Zoom window rectangle (1 pattern)
  - `SelectionMarqueeOverlay.tsx` - Selection marquee rectangle (1 pattern)
  - `SelectionRenderer.ts` - Selection box rendering (1 pattern)
  - `useZoomWindow.ts` - Zoom window state updates (2 patterns)
  - `ghost-entity-renderer.ts` - Ghost rectangle & simplified bounds (2 patterns)
- **Usage Examples**:
  ```typescript
  const { x, y, width, height } = rectFromTwoPoints(corner1, corner2);
  ctx.strokeRect(x, y, width, height);

  const { x: left, y: top, width, height } = rectFromTwoPoints(startPoint, currentPoint);
  ```
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate bounding box calculations
  - Consistent x/y (top-left) + width/height output
  - Type-safe RectBounds interface
  - Destructuring support with rename (`x: left`)
- **Companion**: ADR-065 (Distance), ADR-073 (Midpoint), ADR-074 (Point On Circle)
