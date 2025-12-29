/**
 * Centralized Hover Manager - Main Entry Point
 * Replaces the monolithic HoverManager with focused, smaller modules
 */

import { renderLineHover } from './line-renderer';
import { renderPolylineHover } from './polyline-renderer';
import { renderCircleHover, renderRectangleHover, renderArcHover, renderEllipseHover } from './shape-renderers';
import { renderTextHover, renderSplineHover, renderAngleMeasurementHover } from './text-spline-renderers';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, RenderOptions } from './types';

export class HoverManager {
  /**
   * Main entry point for centralized hover rendering
   * Replaces individual renderer hover methods
   */
  static renderHover(
    entity: Entity,
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
      case 'lwpolyline': // ✅ ENTERPRISE: AutoCAD standard lightweight polyline support
        renderPolylineHover(context);
        break;
      case 'circle':
        renderCircleHover(context);
        break;
      case 'rectangle':
      case 'rect': // ✅ ENTERPRISE: Alternative rectangle entity naming convention
        renderRectangleHover(context);
        break;
      case 'arc':
        renderArcHover(context);
        break;
      case 'ellipse': // ✅ ENTERPRISE: AutoCAD ellipse entity support
        renderEllipseHover(context);
        break;
      case 'text':
        renderTextHover(context);
        break;
      case 'mtext': // ✅ ENTERPRISE: AutoCAD multiline text entity support
        renderTextHover(context); // Use existing text renderer for multiline text
        break;
      case 'spline': // ✅ ENTERPRISE: AutoCAD spline curve entity support
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