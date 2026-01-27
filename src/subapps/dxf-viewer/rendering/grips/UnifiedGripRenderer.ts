/**
 * @fileoverview Unified Grip Renderer - Main Orchestrator (Facade Pattern)
 * @description Single entry point for all grip rendering operations
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 * @pattern Facade Pattern - Unified interface to complex subsystem
 */

import type { Point2D } from '../types/Types';
import type {
  GripRenderConfig,
  GripInteractionState,
  MidpointGripConfig,
  GripSettings,
  GripTemperature,
} from './types';
import { GripSizeCalculator } from './GripSizeCalculator';
import { GripColorManager } from './GripColorManager';
import { GripInteractionDetector } from './GripInteractionDetector';
import { GripShapeRenderer } from './GripShapeRenderer';
import { MIDPOINT_SIZE_FACTOR } from './constants';

// ============================================================================
// UNIFIED GRIP RENDERER CLASS (MAIN ORCHESTRATOR)
// ============================================================================

/**
 * Unified Grip Renderer - Enterprise Facade Pattern
 *
 * Single entry point for all grip rendering operations.
 * Orchestrates 4 specialized components:
 * - GripSizeCalculator: Size calculation with multipliers
 * - GripColorManager: Color mapping logic
 * - GripInteractionDetector: Interaction state detection
 * - GripShapeRenderer: Shape rendering
 *
 * @example
 * ```typescript
 * // Create renderer
 * const renderer = new UnifiedGripRenderer(ctx, worldToScreen);
 *
 * // Render single grip
 * renderer.renderGrip({
 *   position: { x: 10, y: 20 },
 *   type: 'vertex',
 *   entityId: 'line-1',
 *   gripIndex: 0
 * }, settings);
 *
 * // Render grip set with interaction
 * renderer.renderGripSet(gripConfigs, interactionState, settings);
 *
 * // Render midpoints
 * renderer.renderMidpoints(vertices, { enabled: true }, settings);
 * ```
 */
export class UnifiedGripRenderer {
  private ctx: CanvasRenderingContext2D;
  private worldToScreen: (point: Point2D) => Point2D;

  // Specialized components (Composition Pattern)
  private sizeCalculator: GripSizeCalculator;
  private colorManager: GripColorManager;
  private interactionDetector: GripInteractionDetector;
  private shapeRenderer: GripShapeRenderer;

  /**
   * Constructor
   *
   * @param ctx - Canvas rendering context
   * @param worldToScreen - Coordinate transformation function
   */
  constructor(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Point2D) => Point2D
  ) {
    this.ctx = ctx;
    this.worldToScreen = worldToScreen;

    // Initialize specialized components
    this.sizeCalculator = new GripSizeCalculator();
    this.colorManager = new GripColorManager();
    this.interactionDetector = new GripInteractionDetector();
    this.shapeRenderer = new GripShapeRenderer();
  }

  // ==========================================================================
  // PUBLIC API - Main Rendering Methods
  // ==========================================================================

  /**
   * Render a single grip point
   *
   * @param config - Grip render configuration
   * @param settings - Optional grip settings (can be partial)
   */
  renderGrip(config: GripRenderConfig, settings?: Partial<GripSettings>): void {
    // Step 1: Transform to screen coordinates
    const screenPos = this.worldToScreen(config.position);

    // Step 2: Detect/use temperature
    const temperature = config.temperature ||
      (config.entityId !== undefined && config.gripIndex !== undefined
        ? this.interactionDetector.detectTemperature(
            config.entityId,
            config.gripIndex,
            undefined
          )
        : 'cold');

    // Step 3: Calculate size
    const baseSize = settings?.gripSize || 8;
    const dpiScale = settings?.dpiScale || 1.0;
    const size = this.sizeCalculator.calculateSize(
      baseSize,
      temperature,
      dpiScale,
      config.sizeMultiplier
    );

    // Step 4: Get colors
    const fillColor = this.colorManager.getColor(
      temperature,
      config.type,
      config.customColor,
      settings
    );
    const outlineColor = this.colorManager.getOutlineColor(settings);

    // Step 5: Render shape
    const shape = config.shape || 'square';
    this.shapeRenderer.renderShape(
      this.ctx,
      screenPos,
      size,
      shape,
      fillColor,
      outlineColor,
      1 // Outline width
    );
  }

  /**
   * Render a set of grips (e.g., all vertices of an entity)
   *
   * @param grips - Array of grip configurations
   * @param interactionState - Optional current interaction state
   * @param settings - Optional grip settings (can be partial)
   */
  renderGripSet(
    grips: GripRenderConfig[],
    interactionState?: GripInteractionState,
    settings?: Partial<GripSettings>
  ): void {
    for (const grip of grips) {
      // Auto-detect temperature if not provided
      let temperature: GripTemperature = grip.temperature || 'cold';

      if (!grip.temperature && interactionState &&
          grip.entityId !== undefined && grip.gripIndex !== undefined) {
        temperature = this.interactionDetector.detectTemperature(
          grip.entityId,
          grip.gripIndex,
          interactionState
        );
      }

      // Render grip with detected temperature
      this.renderGrip(
        {
          ...grip,
          temperature,
        },
        settings
      );
    }
  }

  /**
   * Render midpoint grips between vertices
   *
   * @param vertices - Array of vertex positions (world coordinates)
   * @param config - Midpoint grip configuration
   * @param settings - Optional grip settings (can be partial)
   */
  renderMidpoints(
    vertices: Point2D[],
    config: MidpointGripConfig,
    settings?: Partial<GripSettings>
  ): void {
    // Skip if disabled or insufficient vertices
    if (!config.enabled || vertices.length < 2) {
      return;
    }

    // Calculate midpoint grip size
    const baseSize = config.size || settings?.gripSize || 8;
    const midpointSize = Math.round(baseSize * MIDPOINT_SIZE_FACTOR);

    // Render midpoint between each pair of vertices
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      // Calculate midpoint position
      const midpoint: Point2D = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      };

      // Render midpoint grip
      this.renderGrip(
        {
          position: midpoint,
          type: 'midpoint',
          customColor: config.color,
          shape: config.shape || 'square',
          sizeMultiplier: MIDPOINT_SIZE_FACTOR,
        },
        settings
      );
    }
  }
}

// ============================================================================
// FACTORY FUNCTION (Convenience)
// ============================================================================

/**
 * Factory function for creating UnifiedGripRenderer
 * Convenience function for easier instantiation
 *
 * @param ctx - Canvas rendering context
 * @param worldToScreen - Coordinate transformation function
 * @returns New UnifiedGripRenderer instance
 *
 * @example
 * ```typescript
 * const renderer = createGripRenderer(ctx, worldToScreen);
 * ```
 */
export function createGripRenderer(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Point2D) => Point2D
): UnifiedGripRenderer {
  return new UnifiedGripRenderer(ctx, worldToScreen);
}
