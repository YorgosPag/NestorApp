# ADR-087: Snap Engine Configuration Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `SNAP_SEARCH_RADIUS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `SNAP_SEARCH_RADIUS`, `SNAP_RADIUS_MULTIPLIERS`, `SNAP_GRID_DISTANCES`, `SNAP_GEOMETRY` from `tolerance-config.ts`
- **Impact**: 8 magic numbers across 4 snap engines → 4 centralized constant objects
- **Problem**: Inconsistent snap engine constants:
  - `OrthoSnapEngine`: `200` (search radius), `radius * 2`, `Math.sqrt(2)`
  - `ParallelSnapEngine`: `radius * 3` (why 3x?), `[0, 50, 100, 150]`
  - `PerpendicularSnapEngine`: `radius * 2`
  - `ExtensionSnapEngine`: `radius * 2`, `[25, 50, 100, 200, 300]`
- **Solution**: Extended tolerance-config.ts with snap engine configuration
- **Constant Categories**:
  - `SNAP_SEARCH_RADIUS.REFERENCE_POINT`: 200 (Ortho reference point search)
  - `SNAP_RADIUS_MULTIPLIERS.STANDARD`: 2 (Ortho, Perpendicular, Extension)
  - `SNAP_RADIUS_MULTIPLIERS.EXTENDED`: 3 (Parallel - needs wider search)
  - `SNAP_GRID_DISTANCES.PARALLEL`: [0, 50, 100, 150]
  - `SNAP_GRID_DISTANCES.EXTENSION`: [25, 50, 100, 200, 300]
  - `SNAP_GEOMETRY.SQRT_2`: Math.sqrt(2) (diagonal calculations)
  - `SNAP_GEOMETRY.INV_SQRT_2`: 1/√2 ≈ 0.7071 (efficient division)
- **Files Migrated**:
  - `OrthoSnapEngine.ts` - 3 patterns migrated
  - `ParallelSnapEngine.ts` - 2 patterns migrated
  - `PerpendicularSnapEngine.ts` - 1 pattern migrated
  - `ExtensionSnapEngine.ts` - 2 patterns migrated
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers in snap engines
  - Documented reason for 3x vs 2x multiplier
  - Single point of change for snap configuration
  - Consistent snap behavior across engines
- **Companion**: ADR-079 (Geometric Precision), ADR-034 (Geometry Centralization)
