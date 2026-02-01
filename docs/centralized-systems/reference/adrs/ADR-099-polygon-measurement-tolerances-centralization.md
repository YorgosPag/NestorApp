# ADR-099: Polygon & Measurement Tolerances Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Drawing System |
| **Canonical Location** | `POLYGON_TOLERANCES` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `POLYGON_TOLERANCES`, `MEASUREMENT_OFFSETS` from `config/tolerance-config.ts`
- **Decision**: Centralize polygon close detection and measurement positioning tolerances
- **Problem**: 5 hardcoded tolerance/offset constants in 3 files with duplicate values:
  - `CLOSE_THRESHOLD = 20` in `CanvasSection.tsx`
  - `CLOSE_TOLERANCE = 20` in `useDrawingHandlers.ts` (DUPLICATE VALUE!)
  - `EDGE_TOLERANCE = 15` in `CanvasSection.tsx`
  - `GRIP_OFFSET = 20` in `MeasurementPositioning.ts`
  - `TOP_EDGE_OFFSET = 60` in `MeasurementPositioning.ts`
- **Solution**: Extend existing `tolerance-config.ts` with 2 new sections
- **API**:
  - `POLYGON_TOLERANCES.CLOSE_DETECTION` (20) - Polygon auto-close threshold
  - `POLYGON_TOLERANCES.EDGE_DETECTION` (15) - Edge midpoint detection
  - `MEASUREMENT_OFFSETS.GRIP` (20) - Grip to label distance
  - `MEASUREMENT_OFFSETS.TOP_EDGE` (60) - Top edge adjustment
- **Files Changed**:
  - `config/tolerance-config.ts` - Added new sections (+40 lines)
  - `components/dxf-layout/CanvasSection.tsx` - 2 replacements
  - `hooks/drawing/useDrawingHandlers.ts` - 1 replacement
  - `systems/phase-manager/positioning/MeasurementPositioning.ts` - 2 replacements
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Eliminates duplicate `CLOSE_THRESHOLD` and `CLOSE_TOLERANCE` (same value in 2 files)
  - Single place to modify polygon detection sensitivity
  - Consistent measurement label positioning
- **Companion**: ADR-079 (GEOMETRY_PRECISION), ADR-095 (Snap Tolerance)
