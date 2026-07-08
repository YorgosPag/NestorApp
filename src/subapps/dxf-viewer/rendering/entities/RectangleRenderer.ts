/**
 * Rectangle Entity Renderer
 * Handles rendering of rectangle entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { RectangleEntity, RectEntity, Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isRectangleEntity, isRectEntity } from '../../types/entities';
import { hitTestLineSegments, createEdgeGrips } from './shared/line-utils';
import { createVertexGrip } from './shared/grip-utils';
import { drawVerticesPath } from './shared/geometry-rendering-utils';
import { getRectangleVertices } from '../../systems/selection/utils';
// 🏢 ADR-557 follow-up: center measurement label SSoT (content + gated painter)
import { buildAreaPerimeterLabelLines, paintMeasurementText } from './shared/measurement-label';
// 🏢 ADR-091: Centralized Text Label Offsets
import { TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';

// 🏢 ENTERPRISE: Union type for rectangle entities
type RectangleEntityUnion = RectangleEntity | RectEntity;

export class RectangleRenderer extends BaseEntityRenderer {
  private getVertices(entity: EntityModel): Point2D[] | null {
    // 🏢 ENTERPRISE: Type-safe casting for rectangle entities
    return getRectangleVertices(entity as RectangleEntityUnion);
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isRectangleEntity(e) && !isRectEntity(e)) return;
    
    const vertices = this.getVertices(entity);
    if (!vertices) return;
    
    // Use universal 3-phase rendering template
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderRectangleGeometry(vertices, entity, options),
      // Measurements rendering
      () => this.renderRectangleMeasurements(vertices, entity, options),
      // Yellow dots rendering
      () => this.renderRectangleYellowDots(vertices)
    );
  }

  private renderRectangleGeometry(vertices: Point2D[], entity: EntityModel, options: RenderOptions): void {
    // 🔺 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες
    if (!this.shouldRenderLines(entity, options)) {
      return; // Δεν σχεδιάζουμε καθόλου γραμμές
    }

    const screenVertices = vertices.map(v => this.worldToScreen(v));

    // 🔺 Έλεγχος αν χρειάζεται split line για κάθε πλευρά
    if (this.shouldRenderSplitLine(entity, options)) {
      // Σχεδίασε κάθε πλευρά ξεχωριστά με split line
      for (let i = 0; i < screenVertices.length; i++) {
        const start = screenVertices[i];
        const end = screenVertices[(i + 1) % screenVertices.length];
        this.renderSplitLineWithGap(start, end, entity, options);
      }
    } else {
      // Κανονικό ορθογώνιο (solid lines) - use shared utility
      drawVerticesPath(this.ctx, screenVertices, true);
      this.ctx.stroke();
    }
  }

  private renderRectangleMeasurements(vertices: Point2D[], entity: EntityModel, options: RenderOptions): void {
    // Calculate rectangle dimensions
    const width = Math.abs(vertices[1].x - vertices[0].x);
    const height = Math.abs(vertices[2].y - vertices[1].y);
    const area = width * height;
    const perimeter = 2 * (width + height);
    
    this.ctx.save();
    
    // 🔺 ΚΕΝΤΡΙΚΕΣ ΜΕΤΡΗΣΕΙΣ (στο κέντρο)
    this.applyCenterMeasurementTextStyle();
    const centerX = (vertices[0].x + vertices[2].x) / 2;
    const centerY = (vertices[0].y + vertices[2].y) / 2;
    const screenCenter = this.worldToScreen({ x: centerX, y: centerY });
    // 🏢 ADR-557 follow-up: content via the SSoT builder (kills the `Ε:`/`Περ:` string
    // duplicate + removes hardcoded Greek literals), gated painter keeps preview behaviour.
    // 🏢 ADR-091: Χρήση κεντρικοποιημένων text label offsets
    const [areaLine, perimeterLine] = buildAreaPerimeterLabelLines({ area, perimeter });
    paintMeasurementText(this.ctx, areaLine, screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.TWO_LINE, { gate: true });
    paintMeasurementText(this.ctx, perimeterLine, screenCenter.x, screenCenter.y + TEXT_LABEL_OFFSETS.TWO_LINE, { gate: true });
    
    // 🔺 ΔΙΑΣΤΑΣΕΙΣ ΠΛΕΥΡΩΝ - Εσωτερικές στο ορθογώνιο (αρνητικό offset)
    
    // Top side (horizontal) - κείμενο ΚΑΤΩ από τη γραμμή (εσωτερικά)
    const topStart = vertices[0];
    const topEnd = vertices[1];
    const topScreenStart = this.worldToScreen(topStart);
    const topScreenEnd = this.worldToScreen(topEnd);
    this.renderDistanceTextPhaseAware(topStart, topEnd, topScreenStart, topScreenEnd, entity, options);
    
    // Bottom side (horizontal) - κείμενο ΠΑΝΩ από τη γραμμή (εσωτερικά)  
    const bottomStart = vertices[3];
    const bottomEnd = vertices[2];
    const bottomScreenStart = this.worldToScreen(bottomStart);
    const bottomScreenEnd = this.worldToScreen(bottomEnd);
    this.renderDistanceTextPhaseAware(bottomStart, bottomEnd, bottomScreenStart, bottomScreenEnd, entity, options);
    
    // Left side (vertical) - κείμενο ΔΕΞΙΑ από τη γραμμή (εσωτερικά)
    const leftStart = vertices[0];
    const leftEnd = vertices[3];
    const leftScreenStart = this.worldToScreen(leftStart);
    const leftScreenEnd = this.worldToScreen(leftEnd);
    this.renderDistanceTextPhaseAware(leftStart, leftEnd, leftScreenStart, leftScreenEnd, entity, options);
    
    // Right side (vertical) - κείμενο ΑΡΙΣΤΕΡΑ από τη γραμμή (εσωτερικά)
    const rightStart = vertices[1];
    const rightEnd = vertices[2];
    const rightScreenStart = this.worldToScreen(rightStart);
    const rightScreenEnd = this.worldToScreen(rightEnd);
    this.renderDistanceTextPhaseAware(rightStart, rightEnd, rightScreenStart, rightScreenEnd, entity, options);
    
    // 🔺 ΤΟΞΑ ΓΩΝΙΩΝ με 90° 
    this.renderCornerArcs(vertices);
    
    this.ctx.restore();
  }

  private renderCornerArcs(vertices: Point2D[]): void {
    
    this.ctx.save();
    // 🔺 Χρήση κεντρικοποιημένου στιλ τόξων
    this.applyArcStyle(); // Πορτοκαλί με διακεκομμένες γραμμές
    
    // Διακεκομμένες ορθές γωνίες σε όλες τις 4 γωνίες
    vertices.forEach((vertex, index) => {
      // Για κάθε γωνία, υπολογίζουμε τις κατευθύνσεις των 2 πλευρών
      const prevIndex = (index - 1 + vertices.length) % vertices.length;
      const nextIndex = (index + 1) % vertices.length;
      
      // 🔺 ΧΡΗΣΗ ΕΝΙΑΙΑΣ ΛΟΓΙΚΗΣ: Χρήση της κεντρικοποιημένης μεθόδου από BaseEntityRenderer
      const prevVertex = vertices[prevIndex];
      const nextVertex = vertices[nextIndex];
      const screenPrev = this.worldToScreen(prevVertex);
      const screenNext = this.worldToScreen(nextVertex);
      const screenVertex = this.worldToScreen(vertex);
      
      this.renderAngleAtVertex(prevVertex, vertex, nextVertex, screenPrev, screenVertex, screenNext);
    });
    
    this.ctx.restore();
  }



  private renderRectangleYellowDots(vertices: Point2D[]): void {
    // Use centralized vertex dots rendering  
    this.renderVertexDots(vertices);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isRectangleEntity(e) && !isRectEntity(e)) return [];
    
    const grips: GripInfo[] = [];
    const vertices = this.getVertices(entity);
    if (!vertices) return grips;
    
    // Corner grips
    vertices.forEach((vertex, index) => {
      grips.push(createVertexGrip(entity.id, vertex, index));
    });
    
    // Use shared utility for edge grips (closed rectangle)
    const edgeGrips = createEdgeGrips(entity.id, vertices, true, vertices.length);
    grips.push(...edgeGrips);
    
    return grips;
  }

  // ✅ ENTERPRISE FIX: Implement proper hitTest method with tolerance parameter
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isRectangleEntity(e) && !isRectEntity(e)) return false;

    const vertices = this.getVertices(entity);
    if (!vertices) return false;

    // Use hitTestLineSegments utility to test all rectangle edges (closed)
    return hitTestLineSegments(point, vertices, tolerance, true, this.worldToScreen.bind(this));
  }

}