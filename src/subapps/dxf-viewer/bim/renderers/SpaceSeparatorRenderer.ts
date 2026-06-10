/**
 * SpaceSeparatorRenderer — ADR-437.
 *
 * 2D plan-view renderer για `SpaceSeparatorEntity` (Revit Room/Space Separation
 * Line). Reads `entity.params.start/end` (SSoT) και draws μια **λεπτή διακεκομμένη
 * βιολετί** γραμμή (Revit room separator = violet)· ΧΩΡΙΣ fill (γραμμή χωρίς
 * εσωτερικό).
 *
 * ADR-040 micro-leaf compliance: pure renderer με ZERO subscriptions σε
 * high-frequency stores. Grips ΔΕΝ υποστηρίζονται στο v1 (επεξεργασία =
 * επανατοποθέτηση)· η επιλογή σηματοδοτείται με explicit selection halo —
 * fork του διορθωμένου `ThermalSpaceRenderer` (το οποίο επίσης δεν έχει grips).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 * @see ./ThermalSpaceRenderer (το L0 renderer πρότυπο — selection-highlight pattern)
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isSpaceSeparatorEntity } from '../../types/entities';
import type { SpaceSeparatorEntity } from '../types/space-separator-types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/** Room-separator accent colour (violet) — Revit «Room/Space Separation Line». */
const SPACE_SEPARATOR_COLOR = '#9333ea';

export class SpaceSeparatorRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isSpaceSeparatorEntity(entity)) return;
    const ss = entity as SpaceSeparatorEntity;
    const start = ss.params?.start;
    const end = ss.params?.end;
    if (!start || !end) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo (only when NOT selected — PhaseManager collapses selected→'normal').
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 1.5;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawLinePath(start, end);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Selection emphasis (solid accent halo). No grips in v1 (ADR-437 D-F), so
    // selection MUST be signalled by this highlight — reuses the same «selected»
    // SSoT as thermal-space (HOVER_HIGHLIGHT.ENTITY.glowColor).
    if (options.selected) {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 2;
      this.ctx.globalAlpha = 0.9;
      this.ctx.setLineDash([]);
      this.drawLinePath(start, end);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    // Thin dashed violet boundary line.
    this.ctx.strokeStyle = SPACE_SEPARATOR_COLOR;
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([8, 5]);
    this.drawLinePath(start, end);
    this.ctx.stroke();

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /** Grips disabled in v1 (ADR-437 D-F) — edit = delete + redraw. */
  getGrips(_entity: EntityModel): GripInfo[] {
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isSpaceSeparatorEntity(entity)) return false;
    const ss = entity as SpaceSeparatorEntity;
    const start = ss.params?.start;
    const end = ss.params?.end;
    if (!start || !end) return false;
    // Point-to-segment distance band — a thin line needs a tolerance corridor.
    return pointToLineDistance(point, start, end) <= tolerance;
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private drawLinePath(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): void {
    const a = this.worldToScreen({ x: start.x, y: start.y });
    const b = this.worldToScreen({ x: end.x, y: end.y });
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
  }
}
