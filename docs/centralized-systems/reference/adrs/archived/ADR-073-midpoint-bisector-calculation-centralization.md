# ADR-073: Midpoint/Bisector Calculation Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**:
  - `calculateMidpoint()` from `geometry-rendering-utils.ts`
  - `bisectorAngle()` from `geometry-utils.ts`
  - `SpatialUtils.boundsCenter()` from `SpatialUtils.ts`
- **Impact**: 55+ inline `(a + b) / 2` implementations → 3 centralized functions
- **Categories**:
  - **Point Midpoints**: `(p1.x + p2.x) / 2, (p1.y + p2.y) / 2` → `calculateMidpoint(p1, p2)`
  - **Bisector Angles**: `(angle1 + angle2) / 2` → `bisectorAngle(angle1, angle2)`
  - **Bounds Centers**: `(minX + maxX) / 2` → `SpatialUtils.boundsCenter(bounds)`
- **Files Migrated (Point Midpoints)**:
  - `line-utils.ts` - Edge grip midpoints, gap calculations (4 patterns)
  - `phase-text-utils.ts` - Distance text positioning (2 patterns)
  - `BaseEntityRenderer.ts` - Distance text positioning (2 patterns)
  - `text-labeling-utils.ts` - Edge text positioning (1 pattern)
  - `entity-conversion.ts` - Overlay edge midpoints (1 pattern)
  - `LayerRenderer.ts` - Edge grip midpoints (1 pattern)
  - `SplineRenderer.ts` - Bezier midpoints (1 pattern)
  - `UnifiedGripRenderer.ts` - Midpoint grips (1 pattern)
- **Files Migrated (Bisector Angles)**:
  - `AngleMeasurementRenderer.ts` - Angle label positioning (1 pattern)
  - `BaseEntityRenderer.ts` - Corner arc label (1 pattern)
  - `PreviewRenderer.ts` - Angle preview text (1 pattern)
- **Re-export**: `geometry-utils.ts` re-exports `calculateMidpoint` for convenience
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `calculateMidpoint(p1: Point2D, p2: Point2D): Point2D`
  - `bisectorAngle(angle1: number, angle2: number): number`
  - `SpatialUtils.boundsCenter(bounds: SpatialBounds): Point2D`
- **Benefits**:
  - Zero duplicate midpoint/bisector calculations
  - Consistent, type-safe Point2D interface
  - Clear semantic separation (points vs angles vs bounds)
  - Companion to distance/angle calculations
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-070 (Magnitude)
