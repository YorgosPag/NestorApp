/**
 * @fileoverview Phase Manager - Universal Entity Rendering Phase Control (Refactored)
 * @description Centralized logic for the 3-phase rendering system:
 * Phase 1: Preview (blue dashed, measurements, yellow dots)
 * Phase 2: Normal (white solid, authentic style)
 * Phase 3: Interactive (3a-Hover: white dashed, 3b-Selected: white solid)
 *
 * Also handles grip interaction states:
 * - Cold (blue): Normal grip state
 * - Warm (orange): Grip hovered
 * - Hot (red): Grip selected/dragging with real-time measurements
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 2.0.0 (Refactored - SRP compliant)
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 *
 * ARCHITECTURE NOTES:
 * This file has been refactored from 711 lines to ~200 lines by extracting:
 * - types.ts: Shared type definitions
 * - positioning/MeasurementPositioning.ts: Smart label positioning
 * - renderers/GripPhaseRenderer.ts: Grip visualization
 * - drag-measurements/: Entity-specific drag measurement renderers
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_PHASE_MANAGER = true;

// ============================================================================
// IMPORTS - Centralized Types & Modules
// ============================================================================

import type { Point2D, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { GripSettings } from '../../types/gripSettings';
import type {
  PhaseManagerOptions,
  PhaseRenderingState,
  ViewTransformConfig
} from './types';

// Centralized configuration
import { UI_COLORS } from '../../config/color-config';

// Style hooks
import { getLinePreviewStyleWithOverride } from '../../hooks/useLinePreviewStyle';
import { toolStyleStore } from '../../stores/ToolStyleStore';

// Delegated modules (SRP - Single Responsibility Principle)
import { GripPhaseRenderer } from './renderers/GripPhaseRenderer';
import { DragMeasurementFactory } from './drag-measurements';

// ============================================================================
// RE-EXPORTS (Backward Compatibility)
// ============================================================================

export type { GripInfo } from '../../rendering/types/Types';
export type {
  PhaseManagerOptions,
  PhaseRenderingState,
  RenderingPhase,
  GripTemperature,
  GripInteractionState,
  MeasurementData,
  MeasurementPosition,
  CanvasBounds
} from './types';

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * PhaseManager - Core Phase Control (Refactored)
 *
 * Responsibilities (SRP compliant):
 * - Phase determination based on entity state
 * - Phase-specific styling application
 * - Delegation to specialized renderers
 *
 * Delegated to separate modules:
 * - Grip rendering → GripPhaseRenderer
 * - Drag measurements → DragMeasurementFactory
 * - Positioning logic → MeasurementPositioning
 */
export class PhaseManager {
  private ctx: CanvasRenderingContext2D;
  private transform: ViewTransformConfig;
  private worldToScreen: (point: Point2D) => Point2D;
  private gripSettings?: GripSettings;

  // Delegated renderers (lazy initialization for performance)
  private gripRenderer?: GripPhaseRenderer;
  private dragMeasurementFactory?: DragMeasurementFactory;

  constructor(options: PhaseManagerOptions) {
    this.ctx = options.ctx;
    this.transform = options.transform;
    this.worldToScreen = options.worldToScreen;
  }

  // ==========================================================================
  // CORE PHASE METHODS
  // ==========================================================================

  /**
   * Main method to determine rendering phase for an entity
   *
   * @param entity - Entity to determine phase for
   * @param options - Render options (hover, selection, preview)
   * @returns Phase rendering state with context
   */
  determinePhase(entity: Entity, options: RenderOptions = {}): PhaseRenderingState {
    // Preview entities (from drawing tool or entity flag)
    if (options.preview || entity.preview === true) {
      return {
        phase: 'preview',
        isActive: true,
        priority: 1,
        context: { fromEntity: true, hasPreview: true }
      };
    }

    // Interactive states (hover/selection)
    if (options.hovered || options.selected) {
      return {
        phase: options.hovered ? 'preview' : 'normal',
        isActive: true,
        priority: options.selected ? 3 : 2,
        context: {
          fromEntity: true,
          hasPreview: options.hovered
        },
        gripState: this.getGripState(entity)
      };
    }

    // Default: Normal rendering
    return {
      phase: 'normal',
      isActive: true,
      priority: 0,
      context: { fromEntity: true }
    };
  }

  /**
   * Apply phase-specific styling to canvas context
   *
   * @param entity - Entity being styled
   * @param state - Current phase state
   */
  applyPhaseStyle(entity: Entity, state: PhaseRenderingState): void {
    // ALWAYS reset line dash first to prevent "sticking"
    this.ctx.setLineDash([]);

    switch (state.phase) {
      case 'preview':
        this.applyPreviewStyle(entity);
        break;

      case 'normal':
        this.applyNormalStyle(entity);
        break;

      case 'measurement':
        this.applyMeasurementStyle();
        break;
    }
  }

  // ==========================================================================
  // MEASUREMENT DISPLAY CONTROL
  // ==========================================================================

  /**
   * Determine if measurements should be rendered for current state
   */
  shouldRenderMeasurements(state: PhaseRenderingState, entity?: Entity): boolean {
    // Measurement entities always show measurements
    if (entity && this.isMeasurementEntity(entity)) {
      return true;
    }

    // Show during preview, measurement phase, or dragging
    return (
      state.phase === 'preview' ||
      state.phase === 'measurement' ||
      state.gripState?.dragginGrip !== undefined
    );
  }

  /**
   * Determine if preview dots should be rendered
   */
  shouldRenderYellowDots(state: PhaseRenderingState, entity?: Entity): boolean {
    // Measurement entities always show dots
    if (entity && this.isMeasurementEntity(entity)) {
      return true;
    }

    // Only during preview phase for normal entities
    return state.phase === 'preview';
  }

  /**
   * Get preview dot color (centralized - single source of truth)
   */
  getPreviewDotColor(_entity?: Entity): string {
    return UI_COLORS.YELLOW;
  }

  // ==========================================================================
  // DELEGATED RENDERING (SRP - Single Responsibility)
  // ==========================================================================

  /**
   * Render grips - delegates to GripPhaseRenderer
   */
  renderPhaseGrips(entity: Entity, grips: GripInfo[], state: PhaseRenderingState): void {
    const renderer = this.getGripRenderer();
    renderer.renderPhaseGrips(entity, grips, state);
  }

  /**
   * Render drag measurements - delegates to DragMeasurementFactory
   */
  renderDragMeasurements(entity: Entity, draggedGripIndex: number, currentPosition: Point2D): void {
    const factory = this.getDragMeasurementFactory();
    factory.renderDragMeasurements(entity, draggedGripIndex, currentPosition);
  }

  // ==========================================================================
  // CONFIGURATION METHODS
  // ==========================================================================

  /**
   * Update transform (called when viewport changes)
   */
  updateTransform(transform: ViewTransformConfig): void {
    this.transform = transform;
  }

  /**
   * Set grip settings for dynamic color rendering
   */
  setGripSettings(settings: GripSettings): void {
    this.gripSettings = settings;
  }

  // ==========================================================================
  // PRIVATE METHODS - Phase Styling
  // ==========================================================================

  /**
   * Apply preview phase styling
   */
  private applyPreviewStyle(entity: Entity): void {
    const isOverlayEntity = entity.isOverlayPreview === true;

    if (isOverlayEntity) {
      const toolStyle = toolStyleStore.get();
      this.ctx.strokeStyle = toolStyle.strokeColor || UI_COLORS.SUCCESS_GREEN;
      this.ctx.fillStyle = toolStyle.fillColor || UI_COLORS.SEMI_TRANSPARENT_RED;
      this.ctx.lineWidth = toolStyle.lineWidth || 2;
      this.ctx.setLineDash([5, 5]);
    } else {
      const previewStyle = getLinePreviewStyleWithOverride();
      this.ctx.strokeStyle = previewStyle.strokeColor;
      this.ctx.lineWidth = previewStyle.lineWidth;
      this.ctx.globalAlpha = previewStyle.opacity;
      this.ctx.setLineDash(previewStyle.lineDash);
    }
  }

  /**
   * Apply normal phase styling
   */
  private applyNormalStyle(entity: Entity): void {
    const generalStyle = getLinePreviewStyleWithOverride();

    if (generalStyle.enabled) {
      this.ctx.lineWidth = generalStyle.lineWidth;
      this.ctx.setLineDash([]);
      // ✅ ENTERPRISE FIX: Use entity.color if available, fallback to generalStyle
      // This enables DXF entities to display their original AutoCAD colors (ACI)
      this.ctx.strokeStyle = entity.color || generalStyle.strokeColor;
      this.ctx.globalAlpha = generalStyle.opacity;
    } else {
      this.ctx.globalAlpha = 0;
    }
  }

  /**
   * Apply measurement phase styling
   */
  private applyMeasurementStyle(): void {
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = UI_COLORS.WHITE;
  }

  // ==========================================================================
  // PRIVATE METHODS - Entity Classification
  // ==========================================================================

  /**
   * Check if entity is a measurement entity
   */
  private isMeasurementEntity(entity: Entity): boolean {
    return (
      entity.measurement === true ||
      entity.type === 'angle-measurement' ||
      entity.type === 'dimension'
    );
  }

  /**
   * Get current grip state (placeholder for grip interaction system)
   */
  private getGripState(_entity: Entity): PhaseRenderingState['gripState'] {
    // TODO: Connect to actual grip interaction system
    return undefined;
  }

  // ==========================================================================
  // PRIVATE METHODS - Lazy Initialization
  // ==========================================================================

  /**
   * Get or create grip renderer (lazy initialization)
   */
  private getGripRenderer(): GripPhaseRenderer {
    if (!this.gripRenderer) {
      this.gripRenderer = new GripPhaseRenderer(this.ctx, this.worldToScreen);
    }
    return this.gripRenderer;
  }

  /**
   * Get or create drag measurement factory (lazy initialization)
   */
  private getDragMeasurementFactory(): DragMeasurementFactory {
    if (!this.dragMeasurementFactory) {
      this.dragMeasurementFactory = new DragMeasurementFactory(
        this.ctx,
        this.worldToScreen
      );
    }
    return this.dragMeasurementFactory;
  }
}
