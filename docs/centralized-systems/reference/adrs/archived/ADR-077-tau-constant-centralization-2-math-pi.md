# ADR-077: TAU Constant Centralization (2 * Math.PI)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `TAU` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TAU` from `rendering/primitives/canvasPaths.ts`
- **Re-export**: `TAU` also available from `rendering/entities/shared/geometry-utils.ts`
- **Impact**: 42 inline `Math.PI * 2` / `2 * Math.PI` patterns → 1 constant
- **Files Migrated** (16 files):
  - `canvasPaths.ts` - Canonical source (line 222)
  - `geometry-utils.ts` - Re-exports TAU, removed duplicate private const
  - `OverlayPass.ts` - Grips & snap circles (3 usages)
  - `EntityPass.ts` - Circle entity (1 usage)
  - `BackgroundPass.ts` - Origin marker (1 usage)
  - `BaseEntityRenderer.ts` - Angle arc calculations (4 usages)
  - `AngleMeasurementRenderer.ts` - Angle normalization (2 usages)
  - `CircleRenderer.ts` - Circumference calc (2 usages)
  - `PreviewRenderer.ts` - Circle preview (1 usage)
  - `LayerRenderer.ts` - Grid dots (1 usage)
  - `NearSnapEngine.ts` - Point on circle (2 usages)
  - `angle-calculation.ts` - Angle calculations (5 usages)
  - `OriginMarkersDebugOverlay.ts` - Debug circle (1 usage)
  - `CursorSnapAlignmentDebugOverlay.ts` - Debug snap point (1 usage)
  - `CalibrationGridRenderer.ts` - Calibration grid (1 usage)
  - `CircleDragMeasurement.ts` - Circumference calc (1 usage)
- **Pattern**: Single Source of Truth (SSOT)
- **API**: `export const TAU = Math.PI * 2;`
- **Benefits**:
  - Zero inline full-circle angle patterns
  - Mathematical clarity (τ = 2π is the "true" circle constant)
  - Single point of change if precision adjustments needed
  - Consistent naming across codebase
- **Companion**: ADR-058 (Canvas Drawing Primitives), ADR-103 (Angular Constants)
