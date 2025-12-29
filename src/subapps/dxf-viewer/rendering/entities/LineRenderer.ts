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
import { calculateDistance } from './shared/geometry-rendering-utils';

export class LineRenderer extends BaseEntityRenderer {
  render(entity: Entity, options: RenderOptions = {}): void {
    if (entity.type !== 'line') return;

    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('start' in entity) || !('end' in entity)) return;
    const start = entity.start as Point2D;
    const end = entity.end as Point2D;

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
    const dotRadius = 4;
    
    // ⚡ NUCLEAR: LINE ENDPOINT DOTS ELIMINATED
  }

  getGrips(entity: Entity): GripInfo[] {
    if (entity.type !== 'line') return [];

    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('start' in entity) || !('end' in entity)) return [];
    const start = entity.start as Point2D;
    const end = entity.end as Point2D;

    if (!start || !end) return [];
    
    const grips: GripInfo[] = [];
    
    // Start point grip
    grips.push({
      entityId: entity.id,
      gripType: 'vertex',
      gripIndex: 0,
      position: start,
      state: 'cold'
    });
    
    // End point grip
    grips.push({
      entityId: entity.id,
      gripType: 'vertex',
      gripIndex: 1,
      position: end,
      state: 'cold'
    });
    
    // Use shared utility for edge grip
    const edgeGrips = createEdgeGrips(entity.id, [start, end], false, 2);
    grips.push(...edgeGrips);
    
    return grips;
  }



  private renderSplitLineWithMeasurement(screenStart: Point2D, screenEnd: Point2D, worldStart: Point2D, worldEnd: Point2D): void {
    this.ctx.save();
    
    // Use shared utility for split line rendering
    const { midpoint } = renderSplitLine(this.ctx, screenStart, screenEnd, 30);
    
    // Calculate perpendicular direction for markers
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      const perpX = -dy / length; // Perpendicular X
      const perpY = dx / length;  // Perpendicular Y
      
      // Draw perpendicular markers at start and end with centralized color
      const markerSize = 8;
      this.ctx.save();
      this.applyDimensionTextStyle(); // Use centralized fuchsia color
      this.ctx.strokeStyle = this.ctx.fillStyle; // Use same color as text
      this.renderPerpendicularMarker(screenStart, perpX, perpY, markerSize);
      this.renderPerpendicularMarker(screenEnd, perpX, perpY, markerSize);
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
    const textGap = Math.max(20, Math.min(60, 30 * this.transform.scale)); // Scale gap with zoom
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


}