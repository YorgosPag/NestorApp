# ADR-072: Dot Product Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `dotProduct()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `dotProduct()` from `geometry-rendering-utils.ts`
- **Impact**: 9+ inline `v1.x * v2.x + v1.y * v2.y` implementations → 1 function
- **Difference from ADR-070**:
  - `vectorMagnitude(v)`: Length of **1 vector** → `Math.sqrt(v.x² + v.y²)`
  - `dotProduct(v1, v2)`: Inner product of **2 vectors** → `v1.x * v2.x + v1.y * v2.y`
- **Files Migrated**:
  - `PolylineRenderer.ts` - Rectangle perpendicularity check (2 patterns)
  - `geometry-utils.ts` - `angleBetweenPoints()` vector angle calculation
  - `useDynamicInputMultiPoint.ts` - Angle calculation between segments (2 patterns)
  - `useUnifiedDrawing.tsx` - Measure-angle tool angle calculation
  - `angle-calculation.ts` - `calculateAngleData()` angle between vectors
- **Files NOT Migrated (special cases)**:
  - `geometry-utils.ts:62` - Uses normalized direction (not Point2D vectors)
  - `geometry-utils.ts:97` - Uses raw dx/dy components (not Point2D)
  - `HitTester.ts:624` - Uses abbreviated vars A,B,C,D (not Point2D structure)
  - `BaseEntityRenderer.ts:686` - Uses cos/sin values directly (not Point2D)
- **Pattern**: Single Source of Truth (SSOT)
- **Mathematical Properties**:
  - `v1 · v2 = |v1| * |v2| * cos(θ)`
  - If `dot = 0`, vectors are perpendicular
  - If `dot > 0`, angle < 90°
  - If `dot < 0`, angle > 90°
- **Benefits**:
  - Zero duplicate dot product calculations
  - Consistent API: `dotProduct(v1: Point2D, v2: Point2D): number`
  - Clear distinction from magnitude/distance calculations
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-070 (Magnitude), ADR-066 (Angle)
