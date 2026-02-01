# ADR-079: Geometric Epsilon/Precision Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `GEOMETRY_PRECISION` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `GEOMETRY_PRECISION`, `AXIS_DETECTION`, `MOVEMENT_DETECTION`, `VECTOR_PRECISION`, `ENTITY_LIMITS` from `tolerance-config.ts`
- **Impact**: 25 inline epsilon/precision values (1e-10, 1e-6, 1e-3, 0.001, 0.01) → 5 centralized constant objects
- **Problem**: Inconsistent precision values scattered across 16 files
- **Solution**: Extended tolerance-config.ts with semantic precision categories
- **Constant Categories**:
  - `GEOMETRY_PRECISION`: Ultra-high precision for intersections (1e-10), vertex duplicates (1e-6), point matching (0.001)
  - `AXIS_DETECTION`: Zero/axis proximity (0.001), grid major line detection
  - `MOVEMENT_DETECTION`: Min movement (0.001), zoom change (0.001), zoom preset match (0.01)
  - `VECTOR_PRECISION`: Min magnitude for safe division (0.001)
  - `ENTITY_LIMITS`: Min entity size (0.001), constraint tolerance (0.001)
- **Files Migrated**:
  - `GeometricCalculations.ts` - Line/circle intersection thresholds (3 patterns)
  - `geometry-utils.ts` - Collinear points check (1 pattern)
  - `GeometryUtils.ts` - EPS constant, vertex duplicate (2 patterns)
  - `region-operations.ts` - Region epsilon (1 pattern)
  - `GridSnapEngine.ts` - Major grid detection (2 patterns)
  - `rulers-grid/utils.ts` - Zero threshold (4 patterns)
  - `CenterSnapEngine.ts` - Duplicate center (1 pattern)
  - `AISnappingEngine.ts` - History point match (1 pattern)
  - `useUnifiedDrawing.tsx` - Projection point (2 patterns)
  - `useDynamicInputMultiPoint.ts` - Vector magnitude (2 patterns)
  - `ZoomControls.tsx` - Zoom change detection (1 pattern)
  - `CanvasSection.tsx` - Movement detection (1 pattern)
  - `RulerCornerBox.tsx` - Zoom preset matching (2 patterns)
  - `entity-creation/config.ts` - Min entity size (1 pattern)
  - `constraints/config.ts` - Global tolerance (1 pattern)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero inline precision values (except tolerance-config.ts)
  - Semantic constant naming (DENOMINATOR_ZERO vs magic number)
  - Single point of change for precision tuning
  - Consistent calculation accuracy across systems
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-034 (Geometry Centralization)
