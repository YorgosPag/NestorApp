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
import { MIDPOINT_SIZE_FACTOR, EDGE_GRIP_SIZE_MULTIPLIERS } from './constants';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateMidpoint } from '../entities/shared/geometry-rendering-utils';
// 🏢 ADR-107: Centralized UI Size Defaults
import { UI_SIZE_DEFAULTS, RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';

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
   * Render a single grip point (world coordinates — transforms internally)
   *
   * @param config - Grip render configuration
   * @param settings - Optional grip settings (can be partial)
   */
  renderGrip(config: GripRenderConfig, settings?: Partial<GripSettings>, temperatureOverride?: GripTemperature): void {
    const screenPos = this.worldToScreen(config.position);
    this._renderGripCore(screenPos, config, settings, temperatureOverride);
  }

  /**
   * Core grip render — takes pre-computed screen position.
   * Used internally and by layer-polygon-renderer (screen coords already computed).
   */
  private _renderGripCore(
    screenPos: GripRenderConfig['position'],
    config: Omit<GripRenderConfig, 'position'>,
    settings?: Partial<GripSettings>,
    temperatureOverride?: GripTemperature
  ): void {
    // Step 1: Detect/use temperature
    const temperature = temperatureOverride ?? config.temperature ??
      (config.entityId !== undefined && config.gripIndex !== undefined
        ? this.interactionDetector.detectTemperature(
            config.entityId,
            config.gripIndex,
            undefined
          )
        : 'cold');

    // Step 2: Calculate size
    const baseSize = settings?.gripSize || UI_SIZE_DEFAULTS.GRIP_SIZE;
    const dpiScale = settings?.dpiScale || 1.0;
    const size = this.sizeCalculator.calculateSize(
      baseSize,
      temperature,
      dpiScale,
      config.sizeMultiplier
    );

    // Step 3: Get colors
    const fillColor = this.colorManager.getColor(
      temperature,
      config.type,
      config.customColor,
      settings
    );
    const outlineColor = this.colorManager.getOutlineColor(settings);

    // Step 4: Render shape
    const shape = config.shape || 'square';
    this.shapeRenderer.renderShape(
      this.ctx,
      screenPos,
      size,
      shape,
      fillColor,
      outlineColor,
      1
    );

    // Step 5: Overlay rings (polygon-specific indicators)
    if (config.showCloseRing) {
      this.shapeRenderer.renderSquareRing(
        this.ctx, screenPos, size + 6, fillColor, RENDER_LINE_WIDTHS.NORMAL
      );
    } else if (config.showSelectionRing) {
      this.shapeRenderer.renderSquareRing(
        this.ctx, screenPos, size + 4, fillColor, RENDER_LINE_WIDTHS.NORMAL
      );
    }
  }

  /**
   * Render a polygon edge-midpoint diamond grip at a pre-computed screen position.
   * Handles cold/warm/hot states, colors, and warm+hot outer diamond ring.
   * Uses Sistema A sizing convention (0.6× base, EDGE multipliers).
   *
   * @param screenPos - Screen position of the midpoint
   * @param gripState - Temperature state
   * @param settings - Grip settings (null treated as defaults)
   */
  renderEdgeMidpointGrip(
    screenPos: GripRenderConfig['position'],
    gripState: 'cold' | 'warm' | 'hot',
    settings?: Partial<GripSettings> | null
  ): void {
    const safeSettings = settings ?? undefined;
    const dpiScale = safeSettings?.dpiScale ?? 1.0;
    const baseHalf = ((safeSettings?.gripSize ?? UI_SIZE_DEFAULTS.GRIP_SIZE) * 0.6) * dpiScale;
    const key = gripState.toUpperCase() as 'COLD' | 'WARM' | 'HOT';
    const halfSize = Math.round(baseHalf * EDGE_GRIP_SIZE_MULTIPLIERS[key]);
    const fillColor = this.colorManager.getColor(gripState, 'edge', undefined, safeSettings);
    const outlineColor = gripState !== 'cold'
      ? fillColor
      : this.colorManager.getOutlineColor(safeSettings);
    const lineWidth = gripState !== 'cold'
      ? RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE
      : RENDER_LINE_WIDTHS.GRIP_OUTLINE;

    // Diamond: halfSize * 2 = full span (addDiamondPath uses full-span convention)
    this.shapeRenderer.renderShape(
      this.ctx, screenPos, halfSize * 2, 'diamond', fillColor, outlineColor, lineWidth
    );

    if (gripState !== 'cold') {
      this.shapeRenderer.renderDiamondRing(
        this.ctx, screenPos, halfSize + 4, fillColor, RENDER_LINE_WIDTHS.NORMAL
      );
    }
  }

  /**
   * Render an outer square ring at a screen position.
   * Used for close/selection indicators when the caller manages position.
   */
  renderSquareRing(
    screenPos: GripRenderConfig['position'],
    outerSize: number,
    color: string,
    lineWidth = RENDER_LINE_WIDTHS.NORMAL
  ): void {
    this.shapeRenderer.renderSquareRing(this.ctx, screenPos, outerSize, color, lineWidth);
  }

  /**
   * Batch-optimized grip set rendering.
   * Groups grips by (temperature × shape × customColor) and renders each group
   * with a single ctx.save()/restore() — O(groups) vs O(n) canvas state changes.
   *
   * Precondition: grips must have `temperature` pre-resolved (no interaction state lookup).
   * Falls back to per-grip rendering for non-square shapes.
   */
  renderGripSetBatched(
    grips: GripRenderConfig[],
    settings?: Partial<GripSettings>
  ): void {
    if (grips.length === 0) return;
    const baseSize = settings?.gripSize ?? UI_SIZE_DEFAULTS.GRIP_SIZE;
    const dpiScale = settings?.dpiScale ?? 1.0;

    type BatchGroup = { positions: Point2D[]; config: GripRenderConfig };
    const groups = new Map<string, BatchGroup>();

    for (const grip of grips) {
      const temperature = grip.temperature ?? 'cold';
      const shape = grip.shape ?? 'square';
      const key = `${temperature}\0${shape}\0${grip.customColor ?? ''}`;
      let g = groups.get(key);
      if (!g) {
        g = { positions: [], config: grip };
        groups.set(key, g);
      }
      g.positions.push(this.worldToScreen(grip.position));
    }

    for (const { positions, config } of groups.values()) {
      const temperature = config.temperature ?? 'cold';
      const shape = config.shape ?? 'square';
      const size = this.sizeCalculator.calculateSize(baseSize, temperature, dpiScale, config.sizeMultiplier);
      const fillColor = this.colorManager.getColor(temperature, config.type, config.customColor, settings);
      const outlineColor = this.colorManager.getOutlineColor(settings);

      if (shape === 'square') {
        this.shapeRenderer.renderSquareGripsBatch(this.ctx, positions, size, fillColor, outlineColor);
      } else {
        for (const pos of positions) {
          this.shapeRenderer.renderShape(this.ctx, pos, size, shape, fillColor, outlineColor, 1);
        }
      }
    }
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

      const screenPos = this.worldToScreen(grip.position);
      this._renderGripCore(screenPos, grip, settings, temperature);
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
    const baseSize = config.size || settings?.gripSize || UI_SIZE_DEFAULTS.GRIP_SIZE;
    const midpointSize = Math.round(baseSize * MIDPOINT_SIZE_FACTOR);

    // Render midpoint between each pair of vertices
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      // 🏢 ADR-073: Use centralized midpoint calculation
      const midpoint = calculateMidpoint(current, next);

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
