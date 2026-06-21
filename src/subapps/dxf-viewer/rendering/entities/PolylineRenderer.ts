/**
 * Polyline Entity Renderer
 * Handles rendering of polyline entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { PolylineEntity, Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import { calculatePolygonArea, calculatePolygonCentroid } from './shared/geometry-utils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { UI_COLORS } from '../../config/color-config';
import { hitTestLineSegments, createEdgeGrips, calculatePerimeter } from './shared/line-utils';
// 🏢 ADR-510 Φ3: bulge (arc-segment) geometry SSoT
import { hasAnyBulge, expandPolyline } from './shared/geometry-bulge-utils';
// 🏢 ADR-070: Centralized Vector Magnitude
// 🏢 ADR-072: Centralized Dot Product
// 🏢 ADR-090: Centralized Point Vector Operations
import { drawVerticesPath, vectorMagnitude, dotProduct, subtractPoints } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-090: Centralized Number Formatting
// 🏢 ADR-462: display-unit SSoT — area + perimeter follow the status-bar unit selector
import { formatLengthForDisplay, formatAreaForDisplay } from '../../config/display-length-format';
// 🏢 ADR-091: Centralized Text Label Offsets
import { TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';

export class PolylineRenderer extends BaseEntityRenderer {

  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isPolylineEntity(e) && !isLWPolylineEntity(e)) return;

    // ✅ ENTERPRISE FIX: Safe type casting for entity-specific properties
    const polylineEntity = entity as PolylineEntity; // 🏢 ENTERPRISE: Type-safe casting
    const vertices = polylineEntity.vertices as Point2D[];
    const closed = polylineEntity.closed as boolean;
    
    if (!vertices || vertices.length < 2) return;
    
    // 🔺 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderPolylineGeometry(vertices, closed, entity, options),
      // Measurements rendering  
      () => this.renderPolylineMeasurements(vertices, closed, entity, options),
      // Yellow dots rendering
      () => this.renderPolylineYellowDots(vertices)
    );
  }

  private renderPolylineGeometry(vertices: Point2D[], closed: boolean, entity: EntityModel, options: RenderOptions): void {
    // 🔺 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες
    if (!this.shouldRenderLines(entity, options)) {
      return; // Δεν σχεδιάζουμε καθόλου γραμμές
    }

    // 🏢 ADR-510 Φ3: arc segments (bulge) → tessellate via the geometry SSoT and
    // stroke the resulting path. Canvas dash/linetype still applies along the arc.
    const bulges = (entity as PolylineEntity).bulges;
    if (hasAnyBulge(bulges)) {
      const worldPath = expandPolyline(vertices, bulges, closed);
      const screenPath = worldPath.map(v => this.worldToScreen(v));
      this.drawPath(screenPath, false); // expandPolyline already closed the loop
      const isOverlayEntity = ('isOverlayPreview' in entity && entity.isOverlayPreview === true);
      if (isOverlayEntity && closed && this.ctx.fillStyle !== UI_COLORS.TRANSPARENT) {
        this.ctx.fill();
      }
      this.ctx.stroke();
      return;
    }

    const screenVertices = vertices.map(v => this.worldToScreen(v));

    // 🔺 Έλεγχος αν χρειάζεται split line για κάθε τμήμα
    if (this.shouldRenderSplitLine(entity, options)) {
      // Σχεδίασε κάθε τμήμα ξεχωριστά με split line
      for (let i = 0; i < vertices.length - 1; i++) {
        const start = screenVertices[i];
        const end = screenVertices[i + 1];
        this.renderSplitLineWithGap(start, end, entity, options);
      }

      // Αν είναι κλειστή, σχεδίασε και το τελευταίο τμήμα
      if (closed && vertices.length > 2) {
        const start = screenVertices[screenVertices.length - 1];
        const end = screenVertices[0];
        this.renderSplitLineWithGap(start, end, entity, options);
      }
    } else {
      // Κανονικό polyline (solid lines)
      this.drawPath(screenVertices, closed);
      
      // 🔺 ΔΙΟΡΘΩΣΗ: Fill για overlay polylines μόνο - ΠΡΩΤΑ το fill, μετά το stroke
      const isOverlayEntity = ('isOverlayPreview' in entity && entity.isOverlayPreview === true);
      
      // 🔺 ΚΡΙΤΙΚΗ ΔΙΟΡΘΩΣΗ: fill() πρώτα, stroke() μετά για σωστό layering
      if (isOverlayEntity && closed && this.ctx.fillStyle !== UI_COLORS.TRANSPARENT) {
        this.ctx.fill();
        this.ctx.stroke();
      } else {
        this.ctx.stroke();
      }
    }
  }

  private renderPolylineMeasurements(vertices: Point2D[], closed: boolean, entity: EntityModel, options: RenderOptions): void {
    const screenVertices = vertices.map(v => this.worldToScreen(v));
    
    // Render edge distances for each segment
    for (let i = 0; i < vertices.length - 1; i++) {
      const start = vertices[i];
      const end = vertices[i + 1];
      const screenStart = screenVertices[i];
      const screenEnd = screenVertices[i + 1];
      
      this.renderDistanceTextPhaseAware(start, end, screenStart, screenEnd, entity, options);
    }
    
    // If closed, render distance for closing segment
    if (closed && vertices.length > 2) {
      const start = vertices[vertices.length - 1];
      const end = vertices[0];
      const screenStart = screenVertices[vertices.length - 1];
      const screenEnd = screenVertices[0];
      
      this.renderDistanceTextPhaseAware(start, end, screenStart, screenEnd, entity, options);
    }
    
    // 🔺 Προσθήκη τόξων γωνιών κατά τη φάση προεπισκόπησης
    this.renderPolygonAngles(vertices, screenVertices, closed);
    
    // If closed polygon, show area and perimeter at centroid
    if (closed) {
      const area = calculatePolygonArea(vertices);
      const perimeter = calculatePerimeter(vertices, closed);
      const centroid = calculatePolygonCentroid(vertices);
      const screenCentroid = this.worldToScreen(centroid);
      
      this.ctx.save();
      this.applyCenterMeasurementTextStyle();
      // 🏢 ADR-091: Χρήση κεντρικοποιημένων text label offsets
      renderStyledTextWithOverride(this.ctx, `Ε: ${formatAreaForDisplay(area)}`, screenCentroid.x, screenCentroid.y - TEXT_LABEL_OFFSETS.TWO_LINE);
      renderStyledTextWithOverride(this.ctx, `Περ: ${formatLengthForDisplay(perimeter)}`, screenCentroid.x, screenCentroid.y + TEXT_LABEL_OFFSETS.TWO_LINE);
      this.ctx.restore();
    }
  }
  
  private renderPolylineYellowDots(vertices: Point2D[]): void {
    // Use centralized vertex dots rendering
    this.renderVertexDots(vertices);
  }
  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isPolylineEntity(e) && !isLWPolylineEntity(e)) return [];

    const grips: GripInfo[] = [];
    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('vertices' in entity)) return [];
    const vertices = entity.vertices as Point2D[];
    
    if (!vertices) return grips;
    
    // Vertex grips
    vertices.forEach((vertex, index) => {
      grips.push({
        id: `${entity.id}-vertex-${index}`,
        entityId: entity.id,
        type: 'vertex',
        gripIndex: index,
        position: vertex,
        isVisible: true
      });
    });
    
    // Use shared utility for edge grips
    const closed = ('closed' in entity) ? entity.closed as boolean : false;
    const edgeGrips = createEdgeGrips(entity.id, vertices, closed, vertices.length);
    grips.push(...edgeGrips);
    
    return grips;
  }





  /**
   * 🔺 Νέα μέθοδος για τόξα γωνιών στη φάση προεπισκόπησης - κεντρικοποιημένη
   */
  private renderPolygonAngles(worldVertices: Point2D[], screenVertices: Point2D[], closed: boolean): void {
    if (worldVertices.length < 3) return;
    
    // Check if this is a rectangle - skip angle rendering for rectangles (they use RectangleRenderer)
    const isRectangle = this.isRectangleShape(worldVertices);
    if (isRectangle) return;
    
    // Draw angle arcs and labels (starting from the second vertex)
    for (let i = 1; i < worldVertices.length - 1; i++) {
      const prevVertex = worldVertices[i - 1];
      const currentVertex = worldVertices[i];
      const nextVertex = worldVertices[i + 1];
      
      const prevScreen = screenVertices[i - 1];
      const currentScreen = screenVertices[i];
      const nextScreen = screenVertices[i + 1];
      
      this.renderAngleAtVertex(prevVertex, currentVertex, nextVertex, prevScreen, currentScreen, nextScreen);
    }
    
    // If closed, draw angles for first and last vertices
    if (closed && worldVertices.length >= 3) {
      // First vertex angle (last -> first -> second)
      const lastVertex = worldVertices[worldVertices.length - 1];
      const firstVertex = worldVertices[0];
      const secondVertex = worldVertices[1];
      
      const lastScreen = screenVertices[screenVertices.length - 1];
      const firstScreen = screenVertices[0];
      const secondScreen = screenVertices[1];
      
      this.renderAngleAtVertex(lastVertex, firstVertex, secondVertex, lastScreen, firstScreen, secondScreen);
      
      // Last vertex angle (second-to-last -> last -> first)
      if (worldVertices.length > 3) {
        const secondToLastVertex = worldVertices[worldVertices.length - 2];
        const lastVertexAgain = worldVertices[worldVertices.length - 1];
        const firstVertexAgain = worldVertices[0];
        
        const secondToLastScreen = screenVertices[screenVertices.length - 2];
        const lastScreenAgain = screenVertices[screenVertices.length - 1];
        const firstScreenAgain = screenVertices[0];
        
        this.renderAngleAtVertex(secondToLastVertex, lastVertexAgain, firstVertexAgain, secondToLastScreen, lastScreenAgain, firstScreenAgain);
      }
    }
  }




  // Helper methods to eliminate duplications - now using shared utility
  private drawPath(screenVertices: Point2D[], closed = false): void {
    drawVerticesPath(this.ctx, screenVertices, closed);
  }

  private isRectangleShape(vertices: Point2D[]): boolean {
    // A rectangle must have exactly 4 vertices
    if (vertices.length !== 4) return false;
    
    // Check if vertices form a rectangle by verifying:
    // 1. Opposite sides are parallel and equal
    // 2. Adjacent sides are perpendicular
    const [p1, p2, p3, p4] = vertices;
    
    // 🏢 ADR-090: Use centralized point subtraction for side vectors
    const side1 = subtractPoints(p2, p1); // p1 -> p2
    const side2 = subtractPoints(p3, p2); // p2 -> p3
    const side3 = subtractPoints(p4, p3); // p3 -> p4
    const side4 = subtractPoints(p1, p4); // p4 -> p1
    
    // Check if opposite sides are parallel and equal
    const tolerance = TOLERANCE_CONFIG.POLYLINE_PRECISION;
    // 🏢 ADR-070: Use centralized vector magnitude
    const side1Length = vectorMagnitude(side1);
    const side3Length = vectorMagnitude(side3);
    const side2Length = vectorMagnitude(side2);
    const side4Length = vectorMagnitude(side4);
    
    // Opposite sides should be equal in length
    if (Math.abs(side1Length - side3Length) > tolerance || Math.abs(side2Length - side4Length) > tolerance) {
      return false;
    }
    
    // Adjacent sides should be perpendicular (dot product = 0)
    // 🏢 ADR-072: Use centralized dot product
    const dot1 = dotProduct(side1, side2); // side1 · side2
    const dot2 = dotProduct(side2, side3); // side2 · side3
    
    if (Math.abs(dot1) > tolerance || Math.abs(dot2) > tolerance) {
      return false;
    }
    
    return true;
  }

  // ✅ ENTERPRISE FIX: Implement abstract hitTest method
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isPolylineEntity(e) && !isLWPolylineEntity(e)) return false;

    // 🏢 ENTERPRISE: Type-safe casting for entity-specific properties
    const polylineEntity = entity as PolylineEntity;
    const vertices = polylineEntity.vertices;
    const closed = polylineEntity.closed ?? false;

    if (!vertices || vertices.length < 2) return false;

    // 🏢 ADR-510 Φ3: hit-test against tessellated arc segments when bulges exist
    // (an arc can bow far outside its chord, so chord-only testing would miss it).
    const bulges = polylineEntity.bulges;
    if (hasAnyBulge(bulges)) {
      const expanded = expandPolyline(vertices, bulges, closed);
      return hitTestLineSegments(point, expanded, tolerance, false, this.worldToScreen.bind(this));
    }

    // Use hitTestLineSegments utility to test all line segments
    return hitTestLineSegments(point, vertices, tolerance, closed, this.worldToScreen.bind(this));
  }
}