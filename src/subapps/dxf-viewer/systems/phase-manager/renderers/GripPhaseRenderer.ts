/**
 * @fileoverview Grip Phase Renderer - Enterprise Grip Visualization
 * @description Centralized rendering logic for grip points during different phases
 * Handles cold/warm/hot temperature states with CAD-standard visual feedback
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D, GripInfo } from '../../../rendering/types/Types';
import type { PreviewGripPoint } from '../../../types/entities';
import type {
  PhaseRenderingState,
  GripTemperature,
  GripIdentifier,
  Entity
} from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Union type for preview grip points (can be Point2D or PreviewGripPoint) */
type PreviewGripPointInput = Point2D | PreviewGripPoint;
import { UI_COLORS } from '../../../config/color-config';
import { getGripPreviewStyleWithOverride } from '../../../hooks/useGripPreviewStyle';
import { renderSquareGrip } from '../../../rendering/entities/shared/geometry-rendering-utils';

// ============================================================================
// CONFIGURATION CONSTANTS (Centralized - NO hardcoded values in logic)
// ============================================================================

/** Size multiplier for hot (active/dragging) grips */
const HOT_GRIP_SIZE_MULTIPLIER = 1.5;

/** Size multiplier for warm (hovered) grips */
const WARM_GRIP_SIZE_MULTIPLIER = 1.25;

/** Size multiplier for cold (normal) grips */
const COLD_GRIP_SIZE_MULTIPLIER = 1.0;

// ============================================================================
// GRIP PHASE RENDERER CLASS
// ============================================================================

/**
 * Enterprise Grip Phase Renderer
 * Handles all grip visualization during different rendering phases
 *
 * @example
 * const renderer = new GripPhaseRenderer(ctx, worldToScreen);
 * renderer.renderPhaseGrips(entity, grips, phaseState);
 */
export class GripPhaseRenderer {
  private ctx: CanvasRenderingContext2D;
  private worldToScreen: (point: Point2D) => Point2D;

  constructor(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Point2D) => Point2D
  ) {
    this.ctx = ctx;
    this.worldToScreen = worldToScreen;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Render grips with phase-appropriate colors and styles
   * Respects preview visibility flags and uses dynamic grip styling
   *
   * @param entity - Entity whose grips are being rendered
   * @param grips - Array of grip information
   * @param state - Current phase rendering state
   */
  renderPhaseGrips(
    entity: Entity,
    grips: GripInfo[],
    state: PhaseRenderingState
  ): void {
    // Preview phase: Only show grips if explicitly enabled
    if (state.phase === 'preview' && !entity.showPreviewGrips) {
      return;
    }

    // For preview entities with custom grip points, use those instead
    if (state.phase === 'preview' && entity.previewGripPoints) {
      this.renderPreviewGripPoints(entity.previewGripPoints, state);
      return;
    }

    // Standard grip rendering
    this.renderStandardGrips(entity, grips, state);
  }

  /**
   * Get appropriate grip color based on interaction state
   *
   * @param entityId - ID of the entity owning the grip
   * @param gripIndex - Index of the grip within the entity
   * @param state - Current phase rendering state
   * @returns Temperature state for the grip
   */
  getGripTemperature(
    entityId: string,
    gripIndex: number,
    state: PhaseRenderingState
  ): GripTemperature {
    const gripState = state.gripState;

    if (!gripState) return 'cold';

    // Hot (red) - Active/dragging grip
    if (
      gripState.dragginGrip?.entityId === entityId &&
      gripState.dragginGrip?.gripIndex === gripIndex
    ) {
      return 'hot';
    }

    // Warm (orange) - Hovered grip
    if (
      gripState.hoveredGrip?.entityId === entityId &&
      gripState.hoveredGrip?.gripIndex === gripIndex
    ) {
      return 'warm';
    }

    // Cold (blue) - Normal grip
    return 'cold';
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Render preview-specific grip points
   * Used when entity has custom previewGripPoints defined
   * Handles both Point2D and PreviewGripPoint types
   */
  private renderPreviewGripPoints(
    previewGrips: PreviewGripPointInput[],
    state: PhaseRenderingState
  ): void {
    for (let i = 0; i < previewGrips.length; i++) {
      const gripPoint = previewGrips[i];
      const point2D = this.extractPoint2DFromGripPoint(gripPoint);
      const screenPos = this.worldToScreen(point2D);

      // Preview grips use cold color from settings
      this.drawGrip(screenPos, 'cold', state, undefined);
    }
  }

  /**
   * Render standard grips from GripInfo array
   */
  private renderStandardGrips(
    entity: Entity,
    grips: GripInfo[],
    state: PhaseRenderingState
  ): void {
    for (let i = 0; i < grips.length; i++) {
      const grip = grips[i];
      const screenPos = this.worldToScreen(grip.position);

      // Determine grip temperature based on interaction state
      const temperature = this.getGripTemperature(entity.id, i, state);

      this.drawGrip(screenPos, temperature, state, grip.type);
    }
  }

  /**
   * Extract Point2D from grip point (handles both Point2D and PreviewGripPoint)
   * PreviewGripPoint has a 'position' property containing the Point2D
   * Plain Point2D has direct x, y properties
   *
   * @param gripPoint - Either a Point2D or PreviewGripPoint
   * @returns Extracted Point2D coordinates
   */
  private extractPoint2DFromGripPoint(gripPoint: PreviewGripPointInput): Point2D {
    // Check if it's a PreviewGripPoint (has 'position' property)
    if ('position' in gripPoint && gripPoint.position) {
      return {
        x: gripPoint.position.x,
        y: gripPoint.position.y
      };
    }

    // It's a plain Point2D (has direct x, y properties)
    if ('x' in gripPoint && 'y' in gripPoint) {
      return {
        x: gripPoint.x,
        y: gripPoint.y
      };
    }

    // Fallback for edge cases - return origin
    return { x: 0, y: 0 };
  }

  /**
   * Draw a single grip with appropriate styling
   *
   * @param position - Screen position for the grip
   * @param temperature - Current temperature state (cold/warm/hot)
   * @param state - Phase rendering state for style lookup
   * @param gripType - Optional type identifier (vertex/edge)
   */
  private drawGrip(
    position: Point2D,
    temperature: GripTemperature,
    state: PhaseRenderingState,
    gripType: string | undefined
  ): void {
    // Get grip style from centralized hook (respects override settings)
    const gripStyle = getGripPreviewStyleWithOverride();
    const baseSize = gripStyle.gripSize;

    // Calculate size based on temperature
    const size = this.calculateGripSize(baseSize, temperature);

    // Get fill color based on temperature and grip type
    const fillColor = this.getGripFillColor(temperature, gripType, gripStyle.colors);

    // Render using centralized rendering utility
    renderSquareGrip(this.ctx, position, size, fillColor);
  }

  /**
   * Calculate grip size based on temperature state
   */
  private calculateGripSize(baseSize: number, temperature: GripTemperature): number {
    switch (temperature) {
      case 'hot':
        return Math.round(baseSize * HOT_GRIP_SIZE_MULTIPLIER);
      case 'warm':
        return Math.round(baseSize * WARM_GRIP_SIZE_MULTIPLIER);
      case 'cold':
      default:
        return Math.round(baseSize * COLD_GRIP_SIZE_MULTIPLIER);
    }
  }

  /**
   * Get fill color for grip based on temperature and type
   */
  private getGripFillColor(
    temperature: GripTemperature,
    gripType: string | undefined,
    colors: { cold: string; warm: string; hot: string }
  ): string {
    // Edge/midpoint grips use specific colors
    if (gripType === 'edge') {
      switch (temperature) {
        case 'hot':
          return colors.hot;
        case 'warm':
          return colors.warm;
        case 'cold':
        default:
          return UI_COLORS.SUCCESS_BRIGHT; // Green for edge grips (special case)
      }
    }

    // Vertex grips use standard temperature colors
    switch (temperature) {
      case 'hot':
        return colors.hot;
      case 'warm':
        return colors.warm;
      case 'cold':
      default:
        return colors.cold;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS (Module-level exports for external use)
// ============================================================================

/**
 * Create a GripPhaseRenderer instance
 * Factory function for easier instantiation
 */
export function createGripPhaseRenderer(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Point2D) => Point2D
): GripPhaseRenderer {
  return new GripPhaseRenderer(ctx, worldToScreen);
}

// ============================================================================
// CONFIGURATION EXPORTS
// ============================================================================

export const GRIP_SIZE_MULTIPLIERS = {
  HOT: HOT_GRIP_SIZE_MULTIPLIER,
  WARM: WARM_GRIP_SIZE_MULTIPLIER,
  COLD: COLD_GRIP_SIZE_MULTIPLIER
} as const;
