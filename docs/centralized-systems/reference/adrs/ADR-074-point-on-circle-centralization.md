# ADR-074: Point On Circle Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `pointOnCircle()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `pointOnCircle()` from `geometry-rendering-utils.ts`
- **Impact**: 13 inline `center.x + radius * Math.cos(angle)` implementations → 1 function
- **Difference from other ADRs**:
  - `calculateDistance(p1, p2)`: Distance between **2 Point2D**
  - `vectorMagnitude(v)`: Length of **1 vector**
  - `dotProduct(v1, v2)`: Inner product of **2 vectors**
  - `pointOnCircle(center, radius, angle)`: **Polar → Cartesian** conversion
- **Files Migrated**:
  - `ArcRenderer.ts` - Arc start/end/mid points for rendering and grips (4 patterns)
  - `GeometricCalculations.ts` - Arc endpoints and midpoints for snapping (4 patterns)
  - `NodeSnapEngine.ts` - Arc start/end snap points (2 patterns)
  - `GeometryUtils.ts` - Arc tessellation for export (1 pattern)
- **Mathematical Formula**:
  - `x = center.x + radius * cos(angle)`
  - `y = center.y + radius * sin(angle)`
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate polar-to-cartesian conversions
  - Consistent API: `pointOnCircle(center: Point2D, radius: number, angle: number): Point2D`
  - Angle in radians (0 = right, π/2 = up, π = left, 3π/2 = down)
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-070 (Magnitude), ADR-072 (Dot Product)
