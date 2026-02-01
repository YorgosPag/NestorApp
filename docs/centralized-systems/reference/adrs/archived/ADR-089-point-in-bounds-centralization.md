# ADR-089: Point-In-Bounds Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `SpatialUtils.pointInBounds()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `SpatialUtils.pointInBounds()`, `SpatialUtils.pointInRect()` from `core/spatial/SpatialUtils.ts`
- **Impact**: 4 duplicate point-in-bounds implementations → 2 centralized functions
- **Problem**: Scattered point-in-bounds checking patterns:
  - `snap-engine-utils.ts:134` - Inline `point.x >= minX && point.x <= maxX && ...`
  - `UniversalMarqueeSelection.ts:408-409` - Inline vertex check against rectBounds
  - `SpatialUtils.ts:68` - Existing static method (UNUSED!)
  - `ISpatialIndex.ts:312` - Duplicate in namespace (DEAD CODE)
- **Two Bounds Formats**:
  - **SpatialBounds**: `{ minX, maxX, minY, maxY }` → Spatial indexing systems
  - **MinMax Point2D**: `{ min: Point2D, max: Point2D }` → Selection/rendering
- **Solution**: Two canonical functions for different formats:
  - `SpatialUtils.pointInBounds(point, bounds)` - For SpatialBounds format
  - `SpatialUtils.pointInRect(point, rect)` - For { min, max } Point2D format
- **Files Migrated**:
  - `snapping/engines/shared/snap-engine-utils.ts` - Uses `SpatialUtils.pointInBounds()`
  - `systems/selection/UniversalMarqueeSelection.ts` - Uses `SpatialUtils.pointInRect()`
  - `core/spatial/ISpatialIndex.ts` - Re-exports from SpatialUtils class (removed duplicate namespace)
  - `systems/zoom/utils/calculations.ts` - Wrapper delegates to `SpatialUtils.pointInRect()` (2026-02-01)
  - `systems/selection/shared/selection-duplicate-utils.ts` - Wrapper delegates to `SpatialUtils.pointInBounds()` (2026-02-01)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate point-in-bounds implementations
  - Support for both bounds formats (SpatialBounds and { min, max })
  - Type-safe Point2D interface
  - ISpatialIndex namespace now delegates to SpatialUtils class
- **Companion**: ADR-034 (Geometry Centralization), ADR-079 (Geometric Precision)
