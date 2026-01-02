/**
 * @fileoverview Drag Measurements Module - Factory & Exports
 * @description Centralized entry point for entity-specific drag measurement renderers
 * Uses Factory pattern to create appropriate renderer based on entity type
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, EntityType } from '../../../types/entities';
import type { DragMeasurementContext } from '../types';
import { getCanvasBounds } from '../positioning/MeasurementPositioning';

// Entity-specific renderers
import { LineDragMeasurement } from './LineDragMeasurement';
import { CircleDragMeasurement } from './CircleDragMeasurement';
import { RectangleDragMeasurement } from './RectangleDragMeasurement';
import { ArcDragMeasurement } from './ArcDragMeasurement';
import { PolylineDragMeasurement } from './PolylineDragMeasurement';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Entity types that support drag measurements */
type SupportedEntityType = 'line' | 'circle' | 'rectangle' | 'arc' | 'polyline';

/** Map of entity types to their renderer classes */
type RendererMap = {
  [K in SupportedEntityType]: new (context: DragMeasurementContext) => BaseDragMeasurementRenderer;
};

// ============================================================================
// RENDERER REGISTRY
// ============================================================================

/**
 * Registry mapping entity types to their measurement renderers
 * Add new entity types here when implementing their drag measurements
 */
const RENDERER_REGISTRY: RendererMap = {
  line: LineDragMeasurement,
  circle: CircleDragMeasurement,
  rectangle: RectangleDragMeasurement,
  arc: ArcDragMeasurement,
  polyline: PolylineDragMeasurement
};

/**
 * Check if an entity type has a drag measurement renderer
 */
function isSupportedEntityType(type: EntityType): type is SupportedEntityType {
  return type in RENDERER_REGISTRY;
}

// ============================================================================
// FACTORY CLASS
// ============================================================================

/**
 * Factory for creating and managing drag measurement renderers
 * Maintains renderer instances for performance (singleton per entity type)
 */
export class DragMeasurementFactory {
  private context: DragMeasurementContext;
  private rendererCache: Map<SupportedEntityType, BaseDragMeasurementRenderer>;

  constructor(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (point: Point2D) => Point2D
  ) {
    this.context = {
      ctx,
      worldToScreen,
      canvasBounds: getCanvasBounds(ctx)
    };
    this.rendererCache = new Map();
  }

  /**
   * Render drag measurements for an entity
   * Automatically selects the appropriate renderer based on entity type
   *
   * @param entity - Entity being modified
   * @param gripIndex - Index of grip being dragged
   * @param currentPosition - Current cursor position in world coordinates
   */
  renderDragMeasurements(
    entity: Entity,
    gripIndex: number,
    currentPosition: Point2D
  ): void {
    if (!isSupportedEntityType(entity.type)) {
      // Entity type doesn't support drag measurements
      return;
    }

    const renderer = this.getRenderer(entity.type);
    if (!renderer) return;

    // Type-safe rendering based on entity type
    this.dispatchRender(entity, renderer, gripIndex, currentPosition);
  }

  /**
   * Update canvas bounds (call when canvas resizes)
   */
  updateCanvasBounds(): void {
    this.context.canvasBounds = getCanvasBounds(this.context.ctx);

    // Update all cached renderers
    this.rendererCache.forEach(renderer => {
      renderer.updateCanvasBounds(this.context.canvasBounds);
    });
  }

  /**
   * Clear renderer cache (useful for memory management)
   */
  clearCache(): void {
    this.rendererCache.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Get or create renderer for entity type (singleton pattern)
   */
  private getRenderer(type: SupportedEntityType): BaseDragMeasurementRenderer | undefined {
    // Return cached renderer if available
    let renderer = this.rendererCache.get(type);

    if (!renderer) {
      const RendererClass = RENDERER_REGISTRY[type];
      if (RendererClass) {
        renderer = new RendererClass(this.context);
        this.rendererCache.set(type, renderer);
      }
    }

    return renderer;
  }

  /**
   * Dispatch render call to appropriate typed renderer
   * Uses type narrowing for type-safe entity access
   */
  private dispatchRender(
    entity: Entity,
    renderer: BaseDragMeasurementRenderer,
    gripIndex: number,
    currentPosition: Point2D
  ): void {
    // Type-safe dispatch based on entity type
    switch (entity.type) {
      case 'line':
        (renderer as LineDragMeasurement).render(entity, gripIndex, currentPosition);
        break;
      case 'circle':
        (renderer as CircleDragMeasurement).render(entity, gripIndex, currentPosition);
        break;
      case 'rectangle':
        (renderer as RectangleDragMeasurement).render(entity, gripIndex, currentPosition);
        break;
      case 'arc':
        (renderer as ArcDragMeasurement).render(entity, gripIndex, currentPosition);
        break;
      case 'polyline':
        (renderer as PolylineDragMeasurement).render(entity, gripIndex, currentPosition);
        break;
    }
  }
}

// ============================================================================
// CONVENIENCE FACTORY FUNCTION
// ============================================================================

/**
 * Create a new DragMeasurementFactory instance
 *
 * @param ctx - Canvas 2D rendering context
 * @param worldToScreen - Coordinate transformation function
 * @returns Configured factory instance
 *
 * @example
 * const factory = createDragMeasurementFactory(ctx, worldToScreen);
 * factory.renderDragMeasurements(entity, gripIndex, mousePosition);
 */
export function createDragMeasurementFactory(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (point: Point2D) => Point2D
): DragMeasurementFactory {
  return new DragMeasurementFactory(ctx, worldToScreen);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';
export { LineDragMeasurement } from './LineDragMeasurement';
export { CircleDragMeasurement } from './CircleDragMeasurement';
export { RectangleDragMeasurement } from './RectangleDragMeasurement';
export { ArcDragMeasurement } from './ArcDragMeasurement';
export { PolylineDragMeasurement } from './PolylineDragMeasurement';

// ============================================================================
// SUPPORTED TYPES EXPORT
// ============================================================================

export const SUPPORTED_DRAG_MEASUREMENT_TYPES: readonly SupportedEntityType[] = [
  'line',
  'circle',
  'rectangle',
  'arc',
  'polyline'
] as const;
