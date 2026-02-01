# ADR-068: Angle Normalization Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `normalizeAngleRad()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `normalizeAngleRad()`, `normalizeAngleDeg()` from `geometry-utils.ts`
- **Impact**: 7+ inline angle normalization implementations → 2 functions
- **Files Migrated**:
  - `geometry-utils.ts` - `arcFrom3Points()` + `isAngleBetween()` internal normalizations
  - `line-utils.ts` - `hitTestArcEntity()` angle/startAngle/endAngle normalization
  - `angle-calculation.ts` - `calculateAngleData()` positive angle conversion
  - `useUnifiedDrawing.tsx` - `measure-angle` tool angle conversion
  - `constraints/utils.ts` - `AngleUtils.normalizeAngle` delegates to canonical
  - `pdf-background/types/pdf.types.ts` - `normalizeRotation()` now delegates to `normalizeAngleDeg` (2026-02-01)
- **Pattern**: Single Source of Truth (SSOT)
- **Algorithm**: `modulo + if` (more efficient than while loops for extreme values)
- **Benefits**:
  - Zero duplicate angle normalization code
  - Consistent output ranges: radians [0, 2π), degrees [0, 360)
  - Handles extreme values (multiple wraps) efficiently
  - Type-safe APIs with JSDoc examples
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-067 (Deg↔Rad Conversion)
