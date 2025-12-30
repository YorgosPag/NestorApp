/**
 * ============================================================================
 * 🔄 SCENE TYPES - Enterprise Unified Re-Export
 * ============================================================================
 *
 * ✅ ENTERPRISE CENTRALIZATION: This file now re-exports from entities.ts
 * 🎯 Single Source of Truth: All entity types unified in /types/entities.ts
 * 📦 Backward Compatibility: All existing imports continue to work
 *
 * Previous implementation: Scene-specific entity definitions
 * New implementation: Centralized entity system with re-exports
 *
 * Migration completed: 2025-12-29
 * ============================================================================
 */

// ============================================================================
// 🔄 RE-EXPORTS FROM CENTRALIZED ENTITY SYSTEM
// ============================================================================

// ✅ ENTERPRISE FIX: Export EntityRenderer from rendering core
export type { IEntityRenderer as EntityRenderer } from '../rendering/core/EntityRenderer';

// Core entity types - now from unified source
export type {
  Entity,
  EntityType,
  BaseEntity,

  // Geometric entities
  LineEntity,
  PolylineEntity,
  CircleEntity,
  ArcEntity,
  RectangleEntity,
  PointEntity,
  TextEntity,
  DimensionEntity,
  BlockEntity,
  AngleMeasurementEntity,

  // Scene management
  AnySceneEntity,
  SceneLayer,
  SceneBounds,
  SceneModel,
  DxfImportResult,

  // Utility types
  EntityCollection,
  CreateEntityParams,
  UpdateEntityParams,
  EntityQuery,
  EntityValidationResult

} from './entities';

// ============================================================================
// 🔄 RE-EXPORT TYPE GUARDS
// ============================================================================

export {
  isLineEntity,
  isPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity,
  isPointEntity,
  isTextEntity,
  isDimensionEntity,
  isBlockEntity,
  isAngleMeasurementEntity
} from './entities';

// ============================================================================
// 🔄 RE-EXPORT UTILITY FUNCTIONS
// ============================================================================

export {
  generateEntityId,
  getEntityBounds
} from './entities';

// ============================================================================
// 🎯 LEGACY COMPATIBILITY NOTES
// ============================================================================
//
// All imports that previously used:
//   import { SceneEntity, AnySceneEntity } from './scene'
//
// Now automatically resolve to the unified entity system in entities.ts
// No code changes required - full backward compatibility maintained!
//
// ============================================================================