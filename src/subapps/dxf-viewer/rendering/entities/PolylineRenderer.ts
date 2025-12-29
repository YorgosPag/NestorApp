/**
 * Polyline Entity Renderer
 * Handles rendering of polyline entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { calculatePolygonArea, calculatePolygonCentroid } from './shared/geometry-utils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { UI_COLORS } from '../../config/color-config';
import { hitTestLineSegments, createEdgeGrips, calculatePerimeter } from './shared/line-utils';
import { drawVerticesPath } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class PolylineRenderer extends BaseEntityRenderer {

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return;

    // ✅ ENTERPRISE FIX: Safe type casting for entity-specific properties
    const polylineEntity = entity as any; // Enterprise safe casting for PolylineEntity properties
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
      // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
      renderStyledTextWithOverride(this.ctx, `Ε: ${area.toFixed(2)}`, screenCentroid.x, screenCentroid.y - 10);
      renderStyledTextWithOverride(this.ctx, `Περ: ${perimeter.toFixed(2)}`, screenCentroid.x, screenCentroid.y + 10);
      this.ctx.restore();
    }
  }
  
  private renderPolylineYellowDots(vertices: Point2D[]): void {
    // Use centralized vertex dots rendering
    this.renderVertexDots(vertices);
  }
  getGrips(entity: Entity): GripInfo[] {
    if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return [];

    const grips: GripInfo[] = [];
    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('vertices' in entity)) return [];
    const vertices = entity.vertices as Point2D[];
    
    if (!vertices) return grips;
    
    // Vertex grips
    vertices.forEach((vertex, index) => {
      grips.push({
        entityId: entity.id,
        gripType: 'vertex',
        gripIndex: index,
        position: vertex,
        state: 'cold'
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
    
    // Calculate vectors for the sides
    const side1 = { x: p2.x - p1.x, y: p2.y - p1.y }; // p1 -> p2
    const side2 = { x: p3.x - p2.x, y: p3.y - p2.y }; // p2 -> p3
    const side3 = { x: p4.x - p3.x, y: p4.y - p3.y }; // p3 -> p4
    const side4 = { x: p1.x - p4.x, y: p1.y - p4.y }; // p4 -> p1
    
    // Check if opposite sides are parallel and equal
    const tolerance = TOLERANCE_CONFIG.POLYLINE_PRECISION;
    const side1Length = Math.sqrt(side1.x * side1.x + side1.y * side1.y);
    const side3Length = Math.sqrt(side3.x * side3.x + side3.y * side3.y);
    const side2Length = Math.sqrt(side2.x * side2.x + side2.y * side2.y);
    const side4Length = Math.sqrt(side4.x * side4.x + side4.y * side4.y);
    
    // Opposite sides should be equal in length
    if (Math.abs(side1Length - side3Length) > tolerance || Math.abs(side2Length - side4Length) > tolerance) {
      return false;
    }
    
    // Adjacent sides should be perpendicular (dot product = 0)
    const dot1 = side1.x * side2.x + side1.y * side2.y; // side1 · side2
    const dot2 = side2.x * side3.x + side2.y * side3.y; // side2 · side3
    
    if (Math.abs(dot1) > tolerance || Math.abs(dot2) > tolerance) {
      return false;
    }
    
    return true;
  }
}