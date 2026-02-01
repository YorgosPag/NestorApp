# ADR-132: Coordinate Validation Centralization (isValidPoint/isValidPointStrict)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `isValidPoint()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Canonical**: `isValidPoint()`, `isValidPointStrict()` from `rendering/entities/shared/entity-validation-utils.ts`
- **Problem**: Scattered coordinate validation patterns across codebase:
  - `vertex.x !== undefined && vertex.y !== undefined` (4 occurrences)
  - `isFinite(entity.start.x) && isFinite(entity.start.y)` (6 occurrences)
- **Solution**: Centralized type guard functions:
  - `isValidPoint(point)`: Type predicate for basic coordinate validation (undefined, null, NaN)
  - `isValidPointStrict(point)`: Extends isValidPoint with Infinity check for bounds calculations
- **Files Migrated**:
  - `utils/dxf-converter-helpers.ts` - 2 undefined checks → `isValidPoint()`
  - `systems/zoom/utils/bounds.ts` - 10 patterns → `isValidPoint()` and `isValidPointStrict()`
- **API**:
  - `isValidPoint(point: unknown): point is Point2D` - Checks null, undefined, NaN
  - `isValidPointStrict(point: unknown): point is Point2D` - Also checks Infinity
- **Use Cases**:
  - `isValidPoint()`: Vertex parsing, entity normalization
  - `isValidPointStrict()`: Bounds calculations where Infinity invalidates results
- **Benefits**:
  - Type narrowing with TypeScript type predicates
  - Consistent validation across codebase
  - Single source of truth for coordinate validation rules
  - Existing `isValidPoint()` was unused - now activated
- **Pattern**: Single Source of Truth (SSOT) + Type Predicates
- **Companion**: ADR-114 (Bounding Box), ADR-089 (Point-In-Bounds)
