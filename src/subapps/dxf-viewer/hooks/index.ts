/**
 * @module hooks
 * @description Centralized hooks exports for DXF Viewer
 */

// ============================================================================
// EXTRACTED HOOKS (from EnterpriseDxfSettingsProvider)
// ============================================================================

// Line Settings Hooks - Centralized Factory (ADR-044)
export {
  useLineSettingsByMode,
  type LineSettingsMode,
  type UseLineSettingsReturn,
} from './useLineSettingsByMode';

// Line Settings Hooks - Legacy Wrappers (backward compatible)
export { useLineDraftSettings } from './useLineDraftSettings';
export { useLineHoverSettings } from './useLineHoverSettings';
export { useLineSelectionSettings } from './useLineSelectionSettings';
export { useLineCompletionSettings } from './useLineCompletionSettings';

// Text Settings Hooks
export { useTextDraftSettings } from './useTextDraftSettings';

// Grip Settings Hooks
export { useGripDraftSettings } from './useGripDraftSettings';

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): Movement & Selection Hooks
// Phase 1 & 2 of HYBRID_LAYER_MOVEMENT_ARCHITECTURE
// ============================================================================

// Entity Movement Hook (Phase 1)
export { useMoveEntities, useMoveEntity, type UseMoveEntitiesReturn, type MoveOptions } from './useMoveEntities';

// Enhanced Selection Hook (Phase 2)
export { useEnhancedSelection, useSelectAll, type UseEnhancedSelectionReturn } from './useEnhancedSelection';

// Entity Drag Hook (Phase 3)
export { useEntityDrag, useDragEntities, type UseEntityDragOptions, type UseEntityDragReturn } from './useEntityDrag';

// Unified Movement Operations Hook (Phase 3)
export {
  useMovementOperations,
  useMoveOperations,
  NUDGE_CONFIG,
  type NudgeDirection,
  type NudgeModifier,
  type UseMovementOperationsOptions,
  type UseMovementOperationsReturn,
} from './useMovementOperations';

// Grip Movement Hook (Phase 4)
export {
  useGripMovement,
  useGripDrag,
  GRIP_CONFIG,
  type GripType,
  type GripInfo,
  type GripDragState,
  type UseGripMovementOptions,
  type UseGripMovementReturn,
} from './useGripMovement';
