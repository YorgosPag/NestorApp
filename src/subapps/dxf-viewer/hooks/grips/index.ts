/**
 * 🏢 ENTERPRISE: Grips Hooks Index
 *
 * @description Centralized exports for all grip-related hooks
 * @see ADR-183: Unified Grip System
 */

// === ADR-183: Unified Grip System (CANONICAL) ===
export { useUnifiedGripInteraction } from './useUnifiedGripInteraction';
export type {
  UseUnifiedGripInteractionParams,
  UseUnifiedGripInteractionReturn,
  DxfProjection,
  OverlayProjection,
} from './useUnifiedGripInteraction';

// === Unified types ===
export type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  UnifiedGripState,
  GripTemperature,
  GripSource,
  UnifiedGripType,
} from './unified-grip-types';

// === Registry + hit-testing ===
export { useGripRegistry, computeOverlayGrips } from './grip-registry';
export { findNearestGrip } from './grip-hit-testing';

// === Commit adapters ===
export {
  commitDxfGripDrag,
  commitOverlayVertexDrag,
  commitOverlayEdgeMidpointDrag,
  commitOverlayBodyDrag,
  createSceneManagerAdapter,
} from './grip-commit-adapters';
export type { DxfCommitDeps, OverlayCommitDeps } from './grip-commit-adapters';

// === Legacy (deprecated — ADR-183) ===
/** @deprecated Use useUnifiedGripInteraction instead */
export { useGripSystem } from './useGripSystem';
export type {
  UseGripSystemReturn,
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  GripHoverThrottle,
} from './useGripSystem';
