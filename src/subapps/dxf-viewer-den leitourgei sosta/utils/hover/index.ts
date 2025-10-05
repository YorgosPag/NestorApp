/**
 * Centralized Hover Manager - Main Entry Point
 * Replaces the monolithic HoverManager with focused, smaller modules
 */

import { renderLineHover } from './line-renderer';
import { renderPolylineHover } from './polyline-renderer';
import { renderCircleHover, renderRectangleHover, renderArcHover, renderEllipseHover } from './shape-renderers';
import { renderTextHover, renderSplineHover, renderAngleMeasurementHover } from './text-spline-renderers';
import type { Point2D } from '../../rendering/types/Types';
import type { EntityModel, RenderOptions } from './types';

export class HoverManager {
  /**
   * Main entry point for centralized hover rendering
   * Replaces individual renderer hover methods
   */
  static renderHover(
    entity: EntityModel, 
    ctx: CanvasRenderingContext2D, 
    options: RenderOptions,
    worldToScreen: (p: Point2D) => Point2D
  ): void {
    if (!options.hovered && !options.selected) return;

    const context = { entity, ctx, worldToScreen, options };

    switch (entity.type) {
      case 'line':
        renderLineHover(context);
        break;
      case 'polyline':
      case 'lwpolyline':
        renderPolylineHover(context);
        break;
      case 'circle':
        renderCircleHover(context);
        break;
      case 'rectangle':
      case 'rect':
        renderRectangleHover(context);
        break;
      case 'arc':
        renderArcHover(context);
        break;
      case 'ellipse':
        renderEllipseHover(context);
        break;
      case 'text':
      case 'mtext':
        renderTextHover(context);
        break;
      case 'spline':
        renderSplineHover(context);
        break;
      case 'angle-measurement':
        renderAngleMeasurementHover(context);
        break;
      default:
        console.warn('[HoverManager] No hover handler for entity type:', entity.type);
    }
  }
}

// Export all configuration and utilities for advanced usage
export * from './config';
export * from './types';