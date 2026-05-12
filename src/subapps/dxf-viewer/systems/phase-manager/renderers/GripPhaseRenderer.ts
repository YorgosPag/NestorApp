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
  Entity
} from '../types';
import type { GripSettings, GripRenderConfig } from '../../../rendering/grips/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Union type for preview grip points (can be Point2D or PreviewGripPoint) */
type PreviewGripPointInput = Point2D | PreviewGripPoint;
import { getGripPreviewStyleWithOverride } from '../../../hooks/useGripPreviewStyle';

// 🏢 ADR-048: Unified Grip Rendering System
import { UnifiedGripRenderer } from '../../../rendering/grips';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
// 🏢 ADR-048: Grip size multipliers moved to UnifiedGripRenderer system
// (See: rendering/grips/constants.ts)

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
  private gripRenderer: UnifiedGripRenderer;
  private identityRenderer: UnifiedGripRenderer; // screen-space renderer, reused per frame

  constructor(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Point2D) => Point2D
  ) {
    this.ctx = ctx;
    this.worldToScreen = worldToScreen;
    this.gripRenderer = new UnifiedGripRenderer(ctx, worldToScreen);
    this.identityRenderer = new UnifiedGripRenderer(ctx, (p: Point2D) => p);
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
   * 🎯 ADR-047: Supports custom colors for special grips (e.g., close indicator)
   */
  private renderPreviewGripPoints(
    previewGrips: PreviewGripPointInput[],
    state: PhaseRenderingState
  ): void {
    const style = getGripPreviewStyleWithOverride();
    const cachedSettings: Partial<GripSettings> = {
      colors: style.colors,
      gripSize: style.gripSize,
      dpiScale: 1.0,
    };
    for (let i = 0; i < previewGrips.length; i++) {
      const gripPoint = previewGrips[i];
      const point2D = this.extractPoint2DFromGripPoint(gripPoint);
      const screenPos = this.worldToScreen(point2D);
      const customColor = ('color' in gripPoint && gripPoint.color) ? gripPoint.color : undefined;
      const gripType = ('type' in gripPoint && gripPoint.type) ? gripPoint.type : undefined;
      this.drawGrip(screenPos, 'cold', state, gripType, customColor, cachedSettings);
    }
  }

  /**
   * Render standard grips from GripInfo array — batched by temperature group.
   * One ctx.save()/restore() per (temperature × shape) group instead of per grip.
   */
  private renderStandardGrips(
    entity: Entity,
    grips: GripInfo[],
    state: PhaseRenderingState
  ): void {
    if (grips.length === 0) return;
    const style = getGripPreviewStyleWithOverride();
    const settings: Partial<GripSettings> = {
      colors: style.colors,
      gripSize: style.gripSize,
      dpiScale: 1.0,
    };
    const gripConfigs: GripRenderConfig[] = grips.map((grip, i) => ({
      position: grip.position,
      type: ((grip.type ?? 'vertex') as GripRenderConfig['type']),
      temperature: this.getGripTemperature(entity.id, grip.gripIndex ?? i, state),
      shape: 'square' as const,
    }));
    this.gripRenderer.renderGripSetBatched(gripConfigs, settings);
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
   * 🏢 ADR-048: Now uses UnifiedGripRenderer
   *
   * @param position - Screen position for the grip (ALREADY in screen coordinates!)
   * @param temperature - Current temperature state (cold/warm/hot)
   * @param state - Phase rendering state for style lookup
   * @param gripType - Optional type identifier (vertex/edge)
   * @param customColor - 🎯 ADR-047: Optional custom color override (e.g., '#00ff00' for close indicator)
   */
  private drawGrip(
    position: Point2D,
    temperature: GripTemperature,
    state: PhaseRenderingState,
    gripType: string | undefined,
    customColor?: string,
    cachedSettings?: Partial<GripSettings>
  ): void {
    const settings = cachedSettings ?? (() => {
      const style = getGripPreviewStyleWithOverride();
      return { colors: style.colors, gripSize: style.gripSize, dpiScale: 1.0 };
    })();
    this.identityRenderer.renderGrip(
      {
        position,
        type: (gripType || 'vertex') as 'vertex' | 'edge' | 'midpoint' | 'center' | 'corner' | 'close',
        temperature,
        customColor,
      },
      settings
    );
  }

  // 🏢 ADR-048: calculateGripSize() and getGripFillColor() removed
  // These are now handled by UnifiedGripRenderer's GripSizeCalculator and GripColorManager
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
// 🏢 ADR-048: GRIP_SIZE_MULTIPLIERS moved to UnifiedGripRenderer system
// Import from: import { GRIP_SIZE_MULTIPLIERS } from '../../../rendering/grips';
