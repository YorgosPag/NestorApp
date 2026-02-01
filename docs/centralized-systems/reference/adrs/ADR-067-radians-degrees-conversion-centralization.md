# ADR-067: Radians/Degrees Conversion Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `degToRad()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `degToRad()`, `radToDeg()` from `geometry-utils.ts`
- **Constants**: `DEGREES_TO_RADIANS`, `RADIANS_TO_DEGREES`
- **Impact**: 15+ inline `Math.PI / 180` calculations → centralized functions
- **Files Migrated**:
  - `ArcRenderer.ts` - Arc angle conversions (4 locations)
  - `EllipseRenderer.ts` - Rotation angle conversion
  - `BaseEntityRenderer.ts` - Angle arc degrees display
  - `TextRenderer.ts` - Text rotation
  - `geometry-rendering-utils.ts` - Rendering transform rotation
  - `useDynamicInputHandler.ts` - Coordinate input angles
  - `useDynamicInputMultiPoint.ts` - Segment angle display
  - `AISnappingEngine.ts` - Prediction angles
  - `BaseDragMeasurementRenderer.ts` - Drag angle calculation
  - `ArcDragMeasurement.ts` - Arc grip angle (replaced local constant)
  - `useUnifiedDrawing.tsx` - Measure-angle tool
  - `PdfBackgroundCanvas.tsx` - PDF rotation transform
  - `dxf-entity-converters.ts` - DXF dimension text rotation
  - `line-utils.ts` - Arc hit test angle
  - `angle-calculation.ts` - Interior angle calculation
  - `constraints/config.ts` - Re-exports from centralized source
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline `Math.PI / 180` or `180 / Math.PI` calculations
  - Consistent, tested conversion functions
  - Constants available for performance-critical code
  - Removed 2 duplicate constant definitions
- **Companion**: ADR-065 (Distance), ADR-066 (Angle)
