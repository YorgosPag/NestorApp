# ADR-065: Distance & Vector Operations Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical Functions** (from `geometry-rendering-utils.ts`):
  - `calculateDistance(p1, p2)` - Distance between two points
  - `normalizeVector(v)` - Normalize vector to unit length
  - `getUnitVector(from, to)` - Unit vector from point to point
  - `getPerpendicularUnitVector(from, to)` - Perpendicular unit vector (90° CCW)
- **Impact**:
  - Distance: 42+ inline implementations → 1 function
  - Vector normalization: 7 inline patterns → 3 functions
- **Files Migrated**:
  - **Distance**: 38 files across snapping, rendering, hooks, utils
  - **Vector**: line-utils.ts, line-rendering-utils.ts, constraints/utils.ts, ParallelSnapEngine.ts, text-labeling-utils.ts, LineRenderer.ts, BaseEntityRenderer.ts
- **2026-02-01 Migration** (6 additional files):
  - `utils/geometry/GeometryUtils.ts` - nearPoint() function
  - `rendering/entities/PointRenderer.ts` - hitTest() method
  - `rendering/entities/EllipseRenderer.ts` - hitTest() method
  - `snapping/engines/shared/snap-engine-utils.ts` - sortCandidatesByDistance()
  - `systems/constraints/useConstraintApplication.ts` - validatePoint()
  - `rendering/entities/shared/geometry-utils.ts` - circleBestFit() fallback
- **Pattern**: Single Source of Truth (SSOT)
- **Eliminated Patterns**:
  - `unitX = dx / length; unitY = dy / length;` → `getUnitVector()`
  - `perpX = -dy / length; perpY = dx / length;` → `getPerpendicularUnitVector()`
  - `Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2)` → `calculateDistance(p, q)`
  - `Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))` → `calculateDistance()`
- **Benefits**:
  - Zero duplicate distance/vector calculations
  - Consistent math (no typos in normalization)
  - Easy maintenance and optimization
  - Type-safe Point2D interface
