# ADR-070: Vector Magnitude Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `vectorMagnitude()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `vectorMagnitude()` from `geometry-rendering-utils.ts`
- **Impact**: 15+ inline `Math.sqrt(v.x * v.x + v.y * v.y)` implementations → 1 function
- **Difference from ADR-065**:
  - `calculateDistance(p1, p2)`: Distance between **2 Point2D** → `Math.sqrt((p2.x-p1.x)² + (p2.y-p1.y)²)`
  - `vectorMagnitude(v)`: Length of **1 vector** → `Math.sqrt(v.x² + v.y²)`
- **Files Migrated**:
  - `PolylineRenderer.ts` - Rectangle detection (4 side lengths)
  - `BaseEntityRenderer.ts` - Angle arc rendering (prevLength, nextLength, bisectorLength, centerLength)
  - `geometry-utils.ts` - `angleBetweenPoints()` vector magnitudes (mag1, mag2)
  - `useDynamicInputMultiPoint.ts` - Angle calculation between segments (4 magnitudes)
  - `constraints/utils.ts` - Polar coordinate distance
- **Bonus Fix**: `useGripMovement.ts` now uses `calculateDistance()` instead of inline calc
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate vector magnitude calculations
  - Consistent API: `vectorMagnitude(vector: Point2D): number`
  - Clear distinction from distance calculation
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance Calculation), ADR-066 (Angle Calculation)
