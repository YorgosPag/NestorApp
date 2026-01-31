/**
 * Centralized Hover Manager - Main Entry Point
 *
 * 🏢 ENTERPRISE (2026-01-31):
 * Shape hover renderers (Circle, Rectangle, Arc, Ellipse) were disabled stubs
 * and have been removed as dead code. If hover rendering is needed for these
 * entity types in the future, implement proper handlers.
 *
 * SUPPORTED ENTITY TYPES:
 * - line: Distance measurements on hover
 * - polyline/lwpolyline: Distance + angles + area on hover
 * - text/mtext: Text hover effects
 * - spline: Spline hover effects
 * - angle-measurement: Angle display on hover
 *
 * UNSUPPORTED (no hover rendering):
 * - circle, rectangle/rect, arc, ellipse
 *
 * @see ADR-099: Rendering Systems Centralization
 */

import { renderLineHover } from './line-renderer';
import { renderPolylineHover } from './polyline-renderer';
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
      // 🏢 ENTERPRISE (2026-01-31): Shape hover rendering not implemented
      // These entity types currently have no hover effects
      case 'circle':
      case 'rectangle':
      case 'rect':
      case 'arc':
      case 'ellipse':
        // No hover rendering for shapes - silently skip
        break;
      default:
        // Only warn for truly unknown entity types
        if (!['circle', 'rectangle', 'rect', 'arc', 'ellipse'].includes(entity.type)) {
          console.warn('[HoverManager] No hover handler for entity type:', entity.type);
        }
    }
  }
}

// Export all configuration and utilities for advanced usage
export * from './config';
export * from './types';