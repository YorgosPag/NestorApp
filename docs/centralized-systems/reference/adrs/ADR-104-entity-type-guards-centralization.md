# ADR-104: Entity Type Guards Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Entity Systems |
| **Canonical Location** | `types/entities.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `types/entities.ts` - 20 centralized type guards
- **Impact**: 100+ inline `entity.type === '...'` patterns → centralized type guards
- **Problem**: Scattered entity type checks across 35+ files with:
  - Duplicate type guard definitions in 2 files (MoveEntityCommand.ts: 8, CircleRenderer.ts: 1)
  - Inconsistent property validation (some with `'center' in entity`, some without)
  - Type narrowing issues requiring `as unknown as Entity` casting
- **Solution**: Migrate all inline checks to use centralized type guards from `types/entities.ts`
- **Type Guards Available**:
  ```typescript
  import {
    isLineEntity, isCircleEntity, isArcEntity, isEllipseEntity,
    isRectangleEntity, isRectEntity, isPolylineEntity, isLWPolylineEntity,
    isPointEntity, isTextEntity, isMTextEntity, isSplineEntity,
    isDimensionEntity, isBlockEntity, isAngleMeasurementEntity, isLeaderEntity,
    isHatchEntity, isXLineEntity, isRayEntity,
    type Entity
  } from '../../types/entities';
  ```
- **Pattern**:
  ```typescript
  // Before (inline - PROHIBITED)
  if (entity.type === 'circle' && 'center' in entity) { ... }

  // After (centralized - REQUIRED)
  if (isCircleEntity(entity as Entity)) {
    const circleEntity = entity as CircleEntity;
    // Use circleEntity.center, circleEntity.radius safely
  }
  ```
- **Files Migrated (Phase 1 - Duplicate Removal)**:
  - `core/commands/entity-commands/MoveEntityCommand.ts` - Removed 8 duplicate type guards
  - `rendering/entities/CircleRenderer.ts` - Removed 1 duplicate type guard
- **Files Migrated (Phase 2 - High Priority)**:
  - `systems/entity-creation/LevelSceneManagerAdapter.ts` - 9 replacements
  - `components/dxf-layout/CanvasSection.tsx` - 5 replacements
  - `rendering/entities/shared/entity-validation-utils.ts` - 5 replacements
  - `systems/selection/shared/selection-duplicate-utils.ts` - 4 replacements
  - `utils/geometry/GeometryUtils.ts` - 3 replacements
  - `snapping/engines/shared/snap-engine-utils.ts` - 2 replacements
  - `systems/phase-manager/PhaseManager.ts` - 2 replacements
  - `hooks/drawing/completeEntity.ts` - 1 replacement
  - `rendering/entities/shared/geometry-rendering-utils.ts` - 1 replacement
- **Files Migrated (Phase 3 - Rendering Entities)**:
  - `rendering/entities/LineRenderer.ts` - 3 replacements
  - `rendering/entities/CircleRenderer.ts` - 4 replacements (additional)
  - `rendering/entities/ArcRenderer.ts` - 3 replacements
  - `rendering/entities/EllipseRenderer.ts` - 3 replacements
  - `rendering/entities/RectangleRenderer.ts` - 4 replacements
  - `rendering/entities/PolylineRenderer.ts` - 4 replacements
  - `rendering/entities/PointRenderer.ts` - 3 replacements
  - `rendering/entities/TextRenderer.ts` - 3 replacements
  - `rendering/entities/SplineRenderer.ts` - 3 replacements
  - `rendering/entities/AngleMeasurementRenderer.ts` - 4 replacements
- **Benefits**:
  - Zero duplicate type guard definitions
  - Type-safe entity property access after guard
  - Single Source of Truth for entity type validation
  - Consistent type narrowing across codebase
  - Comment marker `// 🏢 ADR-104: Use centralized type guard` for traceability
- **Companion**: ADR-017 (Enterprise ID Generation), ADR-052 (DXF Export API Contract)
