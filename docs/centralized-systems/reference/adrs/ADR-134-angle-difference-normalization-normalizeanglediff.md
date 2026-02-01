# ADR-134: Angle Difference Normalization (normalizeAngleDiff)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `rendering/entities/shared/geometry-utils.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: 4 scattered `while (angleDiff > Math.PI) angleDiff -= TAU` patterns across 3 files with inconsistent boundary conditions (`<` vs `<=`)
- **Decision**: Centralize angle difference normalization to single function `normalizeAngleDiff()`
- **Canonical Location**: `rendering/entities/shared/geometry-utils.ts` → `normalizeAngleDiff()`
- **Mathematical Range**: (-π, π]
  - Result > 0: counterclockwise direction
  - Result < 0: clockwise direction
- **Pattern Fixed**: Standardized boundary condition to `<= -Math.PI` (mathematically correct for (-π, π] range)
- **Files Updated**:
  - `rendering/entities/shared/geometry-utils.ts` - Function added + internal refactor (`arcFromCenterStartEnd`)
  - `rendering/entities/AngleMeasurementRenderer.ts` - 1 occurrence replaced
  - `utils/angle-calculation.ts` - 2 occurrences replaced (`calculateAngleForArc`, `calculateAngleBisector`)
- **API**:
  ```typescript
  export function normalizeAngleDiff(angleDiff: number): number;
  // Returns normalized angle in range (-π, π]
  ```
- **Example**:
  ```typescript
  normalizeAngleDiff(3 * Math.PI)   // → π
  normalizeAngleDiff(-3 * Math.PI)  // → -π → then +TAU = π
  normalizeAngleDiff(Math.PI / 2)   // → π/2 (unchanged)
  ```
- **Use Cases**: Arc direction detection, angle measurement, arc drawing tools, sweep angle calculation
- **Companion ADRs**: ADR-068 (Angle Normalization [0, 2π)), ADR-077 (TAU Constant)
