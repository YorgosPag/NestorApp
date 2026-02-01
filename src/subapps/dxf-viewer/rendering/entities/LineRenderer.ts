/**
 * LineRenderer - Line Entity Renderer
 *
 * @description
 * Renders line entities με 3-phase system (geometry → measurements → endpoint dots).
 * Υποστηρίζει ISO 128 line types, AutoCAD ACI colors, split lines, hover effects.
 *
 * @features
 * - 📐 ISO 128 line types (Solid, Dashed, Dotted, DashDot, Center)
 * - 🎨 AutoCAD ACI color system
 * - 🔍 Hover detection με tolerance
 * - 📏 Measurement rendering (distance text με split line)
 * - 🟡 Endpoint dots για start/end points
 * - ✅ 3-phase rendering (geometry → measurements → dots)
 *
 * @rendering_phases
 * 1. **Geometry Phase** - Line rendering (solid/dashed/split)
 * 2. **Measurements Phase** - Distance text με gap
 * 3. **Endpoint Dots Phase** - Yellow/Green dots στα endpoints
 *
 * @line_types
 * - `solid` - Continuous line (ISO 128)
 * - `dashed` - Dashed line [10, 5] pattern
 * - `dotted` - Dotted line [2, 3] pattern
 * - `dashdot` - Dash-dot line [10, 5, 2, 5] pattern
 * - `center` - Center line [20, 5, 2, 5] pattern
 *
 * @usage
 * ```tsx
 * const renderer = new LineRenderer(ctx, renderContext);
 * renderer.render(lineEntity, {
 *   isMeasurement: false,
 *   showMeasurements: true,
 *   isHovered: false
 * });
 * ```
 *
 * @see {@link docs/LINE_DRAWING_SYSTEM.md} - Complete line drawing documentation
 * @see {@link docs/settings-system/08-LINE_DRAWING_INTEGRATION.md} - Settings integration
 * @see {@link rendering/entities/BaseEntityRenderer.ts} - Base renderer
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { HoverManager } from '../../utils/hover';
import { pointToLineDistance } from './shared/geometry-utils';
import { hitTestLineSegments, createEdgeGrips, renderSplitLine, renderLineWithTextCheck } from './shared/line-utils';
import { createVertexGrip } from './shared/grip-utils';
// 🏢 ADR-065: Centralized Distance & Vector Operations, ADR-124: Centralized Text Gap
import { calculateDistance, getPerpendicularUnitVector, calculateTextGap } from './shared/geometry-rendering-utils';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isLineEntity, type Entity } from '../../types/entities';
// 🏢 ADR-124: Centralized Dot Radius
import { RENDER_GEOMETRY } from '../../config/text-rendering-config';
// 🏢 ADR-150: Centralized Arrow/Marker Size
import { OVERLAY_DIMENSIONS } from '../../utils/hover/config';

export class LineRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guard
    if (!isLineEntity(entity as Entity)) return;

    // Use type guard for safe property access
    if (!('start' in entity) || !('end' in entity)) return;
    const lineEntity = entity as EntityModel & { start: Point2D; end: Point2D };
    const start = lineEntity.start;
    const end = lineEntity.end;

    if (!start || !end) return;

    // 🔺 ΌΛΑ τα lines χρησιμοποιούν το 3-phase system
    // Measurement flag affects μόνο το styling, όχι τη λογική
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering - για measurements κάνε split line όταν εμφανίζονται measurements
      () => this.renderLineGeometry(start, end, entity, options),
      // Measurements rendering  
      () => this.renderLineMeasurements(start, end, entity, options),
      // Yellow dots rendering (ή πράσινα για measurements)
      () => this.renderLineEndpointDots(start, end, entity)
    );
  }

  private renderLineGeometry(start: Point2D, end: Point2D, entity: EntityModel, options: RenderOptions): void {
    // 🔺 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες
    if (!this.shouldRenderLines(entity, options)) {
      return; // Δεν σχεδιάζουμε καθόλου γραμμή
    }

    const screenStart = this.worldToScreen(start);
    const screenEnd = this.worldToScreen(end);

    // 🔺 Χρήση κεντρικοποιημένης λογικής για split line
    if (this.shouldRenderSplitLine(entity, options)) {
      // Όλες οι οντότητες κατά την προεπισκόπηση με showEdgeDistances → split line
      this.renderSplitLineWithGap(screenStart, screenEnd, entity, options);
    } else {
      // Normal solid line
      this.ctx.beginPath();
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
      this.ctx.stroke();
    }
  }


  private renderLineMeasurements(start: Point2D, end: Point2D, entity: EntityModel, options: RenderOptions): void {
    const screenStart = this.worldToScreen(start);
    const screenEnd = this.worldToScreen(end);
    
    // 🔺 Χρήση κεντρικοποιημένης phase-aware μεθόδου (inline για preview, offset για measurements)
    this.renderDistanceTextPhaseAware(start, end, screenStart, screenEnd, entity, options);
  }

  private renderLineEndpointDots(start: Point2D, end: Point2D, entity: EntityModel): void {
    const screenStart = this.worldToScreen(start);
    const screenEnd = this.worldToScreen(end);

    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    // 🏢 ADR-124: Centralized dot radius
    const dotRadius = RENDER_GEOMETRY.DOT_RADIUS;

    // ⚡ NUCLEAR: LINE ENDPOINT DOTS ELIMINATED
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guard
    if (!isLineEntity(entity as Entity)) return [];

    // Use type guard for safe property access
    if (!('start' in entity) || !('end' in entity)) return [];
    const lineEntity = entity as EntityModel & { start: Point2D; end: Point2D };
    const start = lineEntity.start;
    const end = lineEntity.end;

    if (!start || !end) return [];
    
    const grips: GripInfo[] = [];
    
    // Start point grip
    grips.push(createVertexGrip(lineEntity.id, start, 0));

    // End point grip
    grips.push(createVertexGrip(lineEntity.id, end, 1));
    
    // Use shared utility for edge grip
    const edgeGrips = createEdgeGrips(lineEntity.id, [start, end], false, 2);
    grips.push(...edgeGrips);
    
    return grips;
  }



  private renderSplitLineWithMeasurement(screenStart: Point2D, screenEnd: Point2D, worldStart: Point2D, worldEnd: Point2D): void {
    this.ctx.save();

    // Use shared utility for split line rendering
    const { midpoint } = renderSplitLine(this.ctx, screenStart, screenEnd, 30);

    // 🏢 ADR-065: Use centralized distance calculation
    const length = calculateDistance(screenStart, screenEnd);

    if (length > 0) {
      // 🏢 ADR-065: Use centralized perpendicular unit vector calculation
      const perp = getPerpendicularUnitVector(screenStart, screenEnd);

      // Draw perpendicular markers at start and end with centralized color
      // 🏢 ADR-150: Centralized marker size from OVERLAY_DIMENSIONS
      const markerSize = OVERLAY_DIMENSIONS.ARROW_HEAD;
      this.ctx.save();
      this.applyDimensionTextStyle(); // Use centralized fuchsia color
      this.ctx.strokeStyle = this.ctx.fillStyle; // Use same color as text
      this.renderPerpendicularMarker(screenStart, perp.x, perp.y, markerSize);
      this.renderPerpendicularMarker(screenEnd, perp.x, perp.y, markerSize);
      this.ctx.restore();
    }
    
    // Calculate and display distance at midpoint using shared utility
    const worldDistance = calculateDistance(worldStart, worldEnd);
    
    this.renderDistanceLabel(midpoint.x, midpoint.y, worldDistance, screenStart, screenEnd);
    
    this.ctx.restore();
  }

  private renderPerpendicularMarker(point: Point2D, perpX: number, perpY: number, size: number): void {
    const halfSize = size / 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(
      point.x + perpX * halfSize,
      point.y + perpY * halfSize
    );
    this.ctx.lineTo(
      point.x - perpX * halfSize,
      point.y - perpY * halfSize
    );
    this.ctx.stroke();
  }

  private renderPreviewLineWithDistance(screenStart: Point2D, screenEnd: Point2D, worldStart: Point2D, worldEnd: Point2D): void {
    // Use shared utility for split line rendering
    // 🏢 ADR-124: Centralized text gap calculation
    const textGap = calculateTextGap(this.transform.scale);
    const { midpoint } = renderSplitLine(this.ctx, screenStart, screenEnd, textGap);
    
    // Calculate and display distance at midpoint using shared utility
    const worldDistance = calculateDistance(worldStart, worldEnd);
    
    this.renderDistanceLabel(midpoint.x, midpoint.y, worldDistance, screenStart, screenEnd);
  }

  private renderDistanceLabel(x: number, y: number, distance: number, screenStart: Point2D, screenEnd: Point2D): void {
    // 🔺 DEPRECATED - Use centralized method instead
    const worldStart = this.screenToWorld(screenStart);
    const worldEnd = this.screenToWorld(screenEnd);
    this.renderDistanceTextCentralized(worldStart, worldEnd, screenStart, screenEnd);
  }

  // ✅ ENTERPRISE FIX: Implement abstract hitTest method
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-102: Use centralized type guard
    if (!isLineEntity(entity as Entity)) return false;

    // Use type guard for safe property access
    if (!('start' in entity) || !('end' in entity)) return false;
    const lineEntity = entity as EntityModel & { start: Point2D; end: Point2D };

    const distance = pointToLineDistance(point, lineEntity.start, lineEntity.end);
    return distance <= tolerance;
  }

}