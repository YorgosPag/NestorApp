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
import { UI_COLORS } from '../../config/color-config';
import { hitTestLineSegments, createEdgeGrips } from './shared/line-utils';
// 🏢 ADR-557 follow-up: closed-polygon area+perimeter label SSoT (committed/preview/hover parity)
import { computePolygonAreaMetrics, paintPolygonAreaLabel } from './shared/measurement-label';
// ADR-561 — whole-polyline MOVE cross + rotation handle SSoT, shared with the
// interaction path (`computeDxfEntityGrips`) so render ≡ interaction.
import { getPolylineMoveRotateGrips, polylineMoveRotateStartIndex } from '../../systems/polyline/polyline-grips';
import { toMoveRotateGlyphGrips } from '../../bim/grips/move-rotate-glyph-grips';
// 🏢 ADR-510 Φ3: bulge (arc-segment) geometry SSoT
import { hasAnyBulge, expandPolyline, bulgeToPolyline } from './shared/geometry-bulge-utils';
// 🏢 ADR-510 Φ3d: wide / tapered polyline (per-segment width) geometry SSoT
import { hasAnyWidth, resolveSegmentWidth, buildSegmentWidthBand } from './shared/geometry-polyline-width';
import { drawVerticesPath } from './shared/geometry-rendering-utils';
// ADR-642 Φ2-B — full-canvas complex-linetype routing (embedded `──GAS──` text) SSoT seam.
import { strokeStyledEntityPolyline, type ComplexRoutableEntity } from './shared/complex-line-routing';
// 🏢 ADR-650 M3 — non-destructive smooth (fitted-curve) DISPLAY SSoT (raw vertices untouched).
import { getSmoothedDisplayPath, lodToleranceForScale } from './shared/geometry-smooth-display';

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

    const bulges = (entity as PolylineEntity).bulges;

    // 🏢 ADR-510 Φ3d: wide / tapered polyline → paint a SOLID filled band (per
    // segment, AutoCAD model). Takes priority over the hairline stroke paths
    // below; the band builder handles arc segments via the bulge SSoT.
    const pe = entity as PolylineEntity & { constantWidth?: number };
    if (pe.startWidths !== undefined || pe.endWidths !== undefined || pe.constantWidth !== undefined) {
      // eslint-disable-next-line no-console
      console.warn('[Φ3d] render sees width — id:', entity.id, 'startWidths:', JSON.stringify(pe.startWidths), 'hasAnyWidth:', hasAnyWidth(pe.startWidths, pe.endWidths, pe.constantWidth));
    }
    if (hasAnyWidth(pe.startWidths, pe.endWidths, pe.constantWidth)) {
      this.renderPolylineWidthBands(vertices, closed, bulges, pe.startWidths, pe.endWidths, pe.constantWidth);
      return;
    }

    // 🏢 ADR-510 Φ3: arc segments (bulge) → tessellate via the geometry SSoT and
    // stroke the resulting path. Canvas dash/linetype still applies along the arc.
    if (hasAnyBulge(bulges)) {
      const worldPath = expandPolyline(vertices, bulges, closed);
      const screenPath = worldPath.map(v => this.worldToScreen(v)); // expandPolyline already closed the loop
      const isOverlayEntity = ('isOverlayPreview' in entity && entity.isOverlayPreview === true);
      if (isOverlayEntity && closed && this.ctx.fillStyle !== UI_COLORS.TRANSPARENT) {
        this.drawPath(screenPath, false);
        this.ctx.fill();
      }
      // ADR-642 Φ2-B — route through the complex stroker when a `──GAS──` linetype is present
      // (text follows the tessellated arc path); else native stroke (zero regression).
      if (!strokeStyledEntityPolyline(this.ctx, screenPath, entity as ComplexRoutableEntity, this.transform.scale)) {
        this.drawPath(screenPath, false);
        this.ctx.stroke();
      }
      return;
    }

    // 🏢 ADR-650 M3 — non-destructive smooth (fitted-curve) DISPLAY. The control
    // vertices (entity.vertices) stay EXACT — we only stroke the cached Catmull-Rom
    // curve through them (AutoCAD spline-fit / Civil 3D contour smoothing). Priority
    // is below width/bulge (those keep their own exact geometry, handled above).
    const smooth = entity as unknown as { smoothDisplay?: boolean };
    if (smooth.smoothDisplay === true) {
      const tol = lodToleranceForScale(this.transform.scale);
      const worldPath = getSmoothedDisplayPath(entity.id, vertices, closed, tol);
      const smoothScreen = worldPath.map(v => this.worldToScreen(v));
      const isOverlayEntity = ('isOverlayPreview' in entity && entity.isOverlayPreview === true);
      if (isOverlayEntity && closed && this.ctx.fillStyle !== UI_COLORS.TRANSPARENT) {
        this.drawPath(smoothScreen, false); // curve already carries its closing vertex
        this.ctx.fill();
      }
      if (!strokeStyledEntityPolyline(this.ctx, smoothScreen, entity as ComplexRoutableEntity, this.transform.scale)) {
        this.drawPath(smoothScreen, false);
        this.ctx.stroke();
      }
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
      // 🔺 ΔΙΟΡΘΩΣΗ: Fill για overlay polylines μόνο - ΠΡΩΤΑ το fill, μετά το stroke
      const isOverlayEntity = ('isOverlayPreview' in entity && entity.isOverlayPreview === true);
      // 🔺 ΚΡΙΤΙΚΗ ΔΙΟΡΘΩΣΗ: fill() πρώτα, stroke() μετά για σωστό layering
      if (isOverlayEntity && closed && this.ctx.fillStyle !== UI_COLORS.TRANSPARENT) {
        this.drawPath(screenVertices, closed);
        this.ctx.fill();
      }
      // ADR-642 Φ2-B — route through the complex stroker when a `──GAS──` linetype is present
      // (text follows every segment incl. the closing edge); else native stroke (zero regression).
      if (!strokeStyledEntityPolyline(this.ctx, screenVertices, entity as ComplexRoutableEntity, this.transform.scale, closed)) {
        this.drawPath(screenVertices, closed);
        this.ctx.stroke();
      }
    }
  }

  /**
   * 🏢 ADR-510 Φ3d: render a wide / tapered polyline as a solid filled band.
   * Each segment is its own filled polygon (AutoCAD per-segment model) so tapers
   * and arcs are exact. A zero-width segment falls back to a hairline stroke of
   * its (possibly bulged) centreline. Fill colour = the resolved line colour.
   */
  private renderPolylineWidthBands(
    vertices: Point2D[],
    closed: boolean,
    bulges: number[] | undefined,
    startWidths: number[] | undefined,
    endWidths: number[] | undefined,
    constantWidth: number | undefined,
  ): void {
    const n = vertices.length;
    const segCount = closed ? n : n - 1;

    this.ctx.save();
    this.ctx.fillStyle = this.ctx.strokeStyle;
    for (let i = 0; i < segCount; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % n];
      const bulge = bulges?.[i] ?? 0;
      const { start, end } = resolveSegmentWidth(i, startWidths, endWidths, constantWidth);
      const band = buildSegmentWidthBand(a, b, bulge, start, end);
      if (band.length < 3) {
        // Zero-width segment → stroke the centreline (handles arcs via bulge SSoT).
        const center = bulgeToPolyline(a, b, bulge).map(v => this.worldToScreen(v));
        this.drawPath(center, false);
        this.ctx.stroke();
        continue;
      }
      const screenBand = band.map(v => this.worldToScreen(v));
      if (i === 0) {
        // eslint-disable-next-line no-console
        console.warn('[Φ3d] band seg0 — worldStart:', JSON.stringify(vertices[0]), 'width:', start, 'bandPts:', band.length, 'screen:', JSON.stringify(screenBand), 'fill:', this.ctx.fillStyle, 'alpha:', this.ctx.globalAlpha);
      }
      this.drawPath(screenBand, true);
      this.ctx.fill();
    }
    this.ctx.restore();
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
    
    // Giorgio 2026-07-08: αφαιρέθηκαν τα τόξα + μοίρες γωνιών (renderPolygonAngles) από την
    // προεπισκόπηση/μέτρηση πολυγράμμης & από το εργαλείο ΕΜΒΑΔΟΝ («δεν θέλω να εμφανίζονται»).
    // Κατά τη σχεδίαση φαίνονται μόνο οι γραμμές· στην ολοκλήρωση μένει το κείμενο εμβαδού/
    // περιμέτρου στο κέντρο της περιοχής (παρακάτω). Τα τόξα ορθογωνίου ζουν στον RectangleRenderer.

    // If closed polygon, show area and perimeter at centroid.
    // 🏢 ADR-557 follow-up: SSoT painter (`measurement-label.ts`) — ALWAYS renders
    // (measurement RESULT, not a gated preview-text overlay). Fixes the bug where the
    // committed measure-area entity's area text silently disappeared behind the "Κείμενο"
    // preview toggle, while preview mode (a separate, ungated draw path) still showed it.
    if (closed) {
      const metrics = computePolygonAreaMetrics(vertices, closed);
      paintPolygonAreaLabel(this.ctx, this.worldToScreen(metrics.centroid), metrics);
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

    // ADR-561 — render the SAME whole-polyline handles the interaction path emits
    // (`getPolylineMoveRotateGrips`): centre → 4-arrow MOVE glyph, rotation → curved
    // ROTATION glyph via the shared `gripGlyphShape` registry. Indices match the
    // interaction path (`polylineMoveRotateStartIndex`) so paint ≡ hit-test.
    const moveRotate = getPolylineMoveRotateGrips(
      entity.id, vertices, closed, polylineMoveRotateStartIndex(vertices.length, closed),
    );
    grips.push(...toMoveRotateGlyphGrips(moveRotate, 'polyline'));

    return grips;
  }





  // Helper methods to eliminate duplications - now using shared utility
  private drawPath(screenVertices: Point2D[], closed = false): void {
    drawVerticesPath(this.ctx, screenVertices, closed);
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