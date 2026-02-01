# ADR-066: Angle Calculation Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `calculateAngle()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `calculateAngle()` from `geometry-rendering-utils.ts`
- **Impact**: 9+ inline `Math.atan2(dy, dx)` implementations → 1 function
- **Files Migrated**:
  - `ArcDragMeasurement.ts` - Arc grip angle calculation
  - `AngleMeasurementRenderer.ts` - Angle measurement arc/text
  - `distance-label-utils.ts` - Label rotation angles
  - `text-labeling-utils.ts` - Edge text positioning
  - `TangentSnapEngine.ts` - Tangent point calculations (bug fix!)
  - `PreviewRenderer.ts` - Angle preview arc
  - `BaseDragMeasurementRenderer.ts` - Base class angle method
  - `ghost-entity-renderer.ts` - Arrow head angle
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate angle calculations
  - Consistent API: `calculateAngle(from: Point2D, to: Point2D): number`
  - Fixed undefined dx/dy bug in TangentSnapEngine
  - Returns radians (multiply by `180/Math.PI` for degrees)
- **Companion**: ADR-065 (Distance Calculation)
