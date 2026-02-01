# ADR-078: Vector Angle & Angle Between Vectors Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `vectorAngle()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `vectorAngle()`, `angleBetweenVectors()` from `geometry-rendering-utils.ts`
- **Impact**: 20 inline `Math.atan2()` implementations → 2 functions + existing `calculateAngle()`
- **Difference from ADR-066**:
  - `calculateAngle(from, to)`: Angle from point A **to point B** → `atan2(to.y - from.y, to.x - from.x)`
  - `vectorAngle(v)`: Angle of a **single vector** from origin → `atan2(v.y, v.x)`
  - `angleBetweenVectors(v1, v2)`: **Signed angle** between 2 vectors → `atan2(cross, dot)`
- **Files Migrated**:
  - `BaseEntityRenderer.ts` - Distance text angle, angle arc unit vectors (4 patterns)
  - `constraints/utils.ts` - `angleBetweenPoints()`, `cartesianToPolar()` (2 patterns)
  - `useUnifiedDrawing.tsx` - Measure-angle tool calculation (1 pattern)
  - `dxf-entity-converters.ts` - Dimension text rotation (1 pattern)
- **Files NOT Migrated (centralized functions)**:
  - `geometry-utils.ts` - Already centralized functions (`angleFromHorizontal`, `arcFrom3Points`, `arcFromCenterStartEnd`)
  - `angle-calculation.ts` - Already centralized functions (`calculateAngleData`, `getArcAngles`)
  - `line-utils.ts` - Uses existing centralized functions
- **Pattern**: Single Source of Truth (SSOT)
- **Mathematical Properties**:
  - `vectorAngle(v)`: Range [-π, π] radians from positive X-axis
  - `angleBetweenVectors(v1, v2)`: Positive = v2 CCW from v1, Negative = v2 CW from v1
- **Benefits**:
  - Zero duplicate atan2 angle calculations
  - Clear semantic separation (point→point vs vector vs vector→vector)
  - Consistent, type-safe Point2D interface
  - Cross/dot product properly encapsulated
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-072 (Dot Product), ADR-073 (Bisector)
