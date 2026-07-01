/**
 * Arc Entity Renderer
 * Handles rendering of arc entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
// 🏢 ADR-099: HoverManager import removed - ArcRenderer has no hover rendering
import {
  renderDotAtPoint,
  hitTestArcEntity
} from './shared';
// ADR-561 — arc grip SSoT (centre MOVE + start/end/mid + rotation handle), shared
// with the interaction path (`computeDxfEntityGrips`) so render ≡ interaction.
import { getArcGrips } from '../../systems/arc/arc-grips';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { validateArcEntity } from './shared/entity-validation-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addArcPath } from '../primitives/canvasPaths';
// 🏢 ADR-090: Centralized angle formatting · 🏢 ADR-462: display-unit SSoT for lengths
import { formatAngle } from './shared/distance-label-utils';
import { formatLengthForDisplay } from '../../config/display-length-format';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './shared/geometry-utils';
// 🏢 ADR-074: Centralized Point On Circle
import { pointOnCircle } from './shared/geometry-rendering-utils';
// 🏢 ADR-091: Centralized Text Label Offsets, ADR-124: Dot Radius
import { TEXT_LABEL_OFFSETS, RENDER_GEOMETRY } from '../../config/text-rendering-config';

export class ArcRenderer extends BaseEntityRenderer {
  // 🏢 ADR-165: Removed validateArc wrapper - use validateArcEntity directly

  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-165: Use centralized entity validation directly
    const arcData = validateArcEntity(entity);
    if (!arcData) return;

    // 🔺 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering - pass counterclockwise flag
      () => this.renderArcGeometry(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle, arcData.counterclockwise),
      // Measurements rendering
      () => this.renderArcMeasurements(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle),
      // Yellow dots rendering
      () => this.renderArcYellowDots(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle)
    );
  }

  private renderArcGeometry(center: Point2D, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean): void {
    // 🏢 ADR-165: Debug console.log removed for production cleanup

    // 🏢 ADR-067: Use centralized angle conversion
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);

    // 🏢 FIX (2026-01-31): Use direct arc drawing like CircleRenderer
    // Don't use drawCentralizedArc() which applies orange dashed style for angle indicators
    // The phase-based styling is already applied by renderWithPhases()
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;

    // 🎯 CRITICAL: Y-axis inversion fix!
    // World coords: Y+ is UP, angles are counterclockwise from East
    // Screen coords: Y+ is DOWN, angles are clockwise from East
    // Solution: Negate angles and flip direction to compensate for Y-inversion
    const screenStartRad = -startRad;
    const screenEndRad = -endRad;
    // Flip counterclockwise because of Y-axis inversion
    const screenCounterclockwise = !counterclockwise;

    // 🏢 ADR-165: Debug console.log removed for production cleanup

    // 🏢 ADR-058: Use centralized canvas primitives
    this.ctx.beginPath();
    addArcPath(this.ctx, screenCenter, screenRadius, screenStartRad, screenEndRad, screenCounterclockwise);
    this.ctx.stroke();
  }

  private renderArcMeasurements(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    const screenCenter = this.worldToScreen(center);
    
    // Calculate arc measurements
    const arcAngle = Math.abs(endAngle - startAngle);
    // 🏢 ADR-067: Use centralized angle conversion
    const arcLength = degToRad(arcAngle) * radius;
    
    this.ctx.save();
    this.applyCenterMeasurementTextStyle();
    // 🏢 ADR-090: Centralized number formatting
    // 🏢 ADR-091: Χρήση κεντρικοποιημένων text label offsets
    renderStyledTextWithOverride(this.ctx, `R: ${formatLengthForDisplay(radius)}`, screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER);
    renderStyledTextWithOverride(this.ctx, formatAngle(arcAngle, 1), screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.TWO_LINE);
    renderStyledTextWithOverride(this.ctx, `L: ${formatLengthForDisplay(arcLength)}`, screenCenter.x, screenCenter.y + TEXT_LABEL_OFFSETS.TWO_LINE);
    this.ctx.restore();
  }

  private renderArcYellowDots(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    // 🏢 ADR-124: Centralized dot radius
    const dotRadius = RENDER_GEOMETRY.DOT_RADIUS;

    // 🏢 ADR-067: Use centralized angle conversion
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);
    
    // Center dot
    renderDotAtPoint(this.ctx, this.worldToScreen, center, dotRadius);
    
    // Start point dot
    // 🏢 ADR-074: Use centralized pointOnCircle
    const startPoint = pointOnCircle(center, radius, startRad);
    const screenStartPoint = this.worldToScreen(startPoint);
    // ⚡ NUCLEAR: ARC ENDPOINT DOTS ELIMINATED
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-165: Use centralized entity validation directly
    const arcData = validateArcEntity(entity);
    if (!arcData) return [];

    const { center, radius, startAngle, endAngle } = arcData;

    // ADR-561 — render the SAME grips the interaction path emits (`computeDxfEntityGrips`
    // → `getArcGrips`), mapped to the render `GripInfo` shape (mirror `LineRenderer`). The
    // centre → 4-arrow MOVE glyph, the rotation handle → curved ROTATION glyph via the
    // shared `gripGlyphShape` registry; start/end/mid stay 'square'.
    return getArcGrips(entity.id, center, radius, startAngle, endAngle).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      entityId: g.entityId,
      type: g.type,
      gripIndex: g.gripIndex,
      position: g.position,
      isVisible: true,
      shape: gripGlyphShape(g.arcGripKind),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-165: Use centralized entity validation directly
    const arcData = validateArcEntity(entity);
    if (!arcData) return false;

    // Use centralized arc hit test
    return hitTestArcEntity(
      point,
      arcData.center,
      arcData.radius,
      arcData.startAngle,
      arcData.endAngle,
      tolerance,
      this.transform,
      arcData.counterclockwise
    );
  }

}