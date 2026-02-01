/**
 * @fileoverview Unified Grip Rendering System - Public API
 * @description Single entry point for all grip rendering functionality
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  GripType,
  GripTemperature,
  GripShape,
  GripRenderConfig,
  GripInteractionState,
  MidpointGripConfig,
  GripSettings,
} from './types';

// ============================================================================
// CONSTANT EXPORTS
// ============================================================================

export {
  GRIP_SIZE_MULTIPLIERS,
  EDGE_GRIP_SIZE_MULTIPLIERS,
  DEFAULT_GRIP_COLORS,
  MIDPOINT_SIZE_FACTOR,
  EDGE_GRIP_COLOR,
  MIN_GRIP_SIZE,
  MAX_GRIP_SIZE,
} from './constants';

// ============================================================================
// CLASS EXPORTS (Phase 2 Complete)
// ============================================================================

export { GripSizeCalculator } from './GripSizeCalculator';
export { GripColorManager } from './GripColorManager';
export { GripInteractionDetector } from './GripInteractionDetector';
export { GripShapeRenderer } from './GripShapeRenderer';
export { UnifiedGripRenderer } from './UnifiedGripRenderer';

// ============================================================================
// FACTORY FUNCTIONS (Phase 2 Complete)
// ============================================================================

export { createGripRenderer } from './UnifiedGripRenderer';
