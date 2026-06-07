/**
 * ThermalSpaceRenderer — ADR-422 L0.
 *
 * 2D plan-view renderer για `ThermalSpaceEntity` (Revit Space tag). Reads
 * `entity.geometry` + `entity.params` (SSoT, populated by
 * `computeThermalSpaceGeometry()`) και draws:
 *   - closed polygon outline (dashed, analytical accent colour)
 *   - translucent analytical fill
 *   - centred space tag: name (αν υπάρχει) + εμβαδό (m²) + θερμοκρασία σχεδιασμού (°C)
 *
 * Η ετικέτα δείχνει ΑΡΙΘΜΗΤΙΚΕΣ τιμές + σύμβολα μονάδων (m²/°C) — όχι μεταφράσιμα
 * strings (N.11)· η ΧΡΗΣΗ χώρου (i18n) εμφανίζεται στο contextual tab.
 *
 * ADR-040 micro-leaf compliance: pure renderer με ZERO subscriptions σε
 * high-frequency stores. Grips ΔΕΝ υποστηρίζονται (το όριο είναι wall-bound,
 * επεξεργασία = επανατοποθέτηση — ADR-422 L0).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * @see ./FloorFinishRenderer (το area-renderer πρότυπο)
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isThermalSpaceEntity } from '../../types/entities';
import type { ThermalSpaceEntity } from '../types/thermal-space-types';
import { resolveThermalSpaceSetpointC } from '../thermal/thermal-space-use-catalog';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/** Analytical accent colour (teal) — Revit «Space» analytical overlay. */
const THERMAL_SPACE_COLOR = '#0d9488';
const TAG_FONT = '12px sans-serif';
const TAG_LINE_HEIGHT_PX = 14;

export class ThermalSpaceRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isThermalSpaceEntity(entity)) return;
    const ts = entity as ThermalSpaceEntity;
    if (!ts.params?.footprint) return;
    const verts = ts.params.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 1.5;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(verts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    // Translucent analytical fill.
    this.ctx.fillStyle = 'rgba(13, 148, 136, 0.12)';
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Dashed analytical outline.
    this.ctx.strokeStyle = THERMAL_SPACE_COLOR;
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([6, 4]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Space tag (centred on bbox).
    this.drawTag(ts);

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  /** Grips disabled — boundary is wall-bound (ADR-422 L0). */
  getGrips(_entity: EntityModel): GripInfo[] {
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isThermalSpaceEntity(entity)) return false;
    const ts = entity as ThermalSpaceEntity;
    const bb = ts.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) return false;
    return pointInPolygon(point, ts.params.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private drawPolygonPath(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 3) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: vertices[0].x, y: vertices[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = this.worldToScreen({ x: vertices[i].x, y: vertices[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
  }

  private drawTag(ts: ThermalSpaceEntity): void {
    const bb = ts.geometry?.bbox;
    if (!bb) return;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const c = this.worldToScreen({ x: cx, y: cy });

    const area = ts.geometry?.area ?? 0;
    const setpoint = resolveThermalSpaceSetpointC(ts.params);
    const lines: string[] = [];
    if (ts.params.name) lines.push(ts.params.name);
    lines.push(`${area.toFixed(1)} m²`);
    lines.push(`${setpoint}°C`);

    this.ctx.save();
    this.ctx.setLineDash([]);
    this.ctx.font = TAG_FONT;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = THERMAL_SPACE_COLOR;
    const totalH = (lines.length - 1) * TAG_LINE_HEIGHT_PX;
    const startY = c.y - totalH / 2;
    lines.forEach((line, i) => {
      this.ctx.fillText(line, c.x, startY + i * TAG_LINE_HEIGHT_PX);
    });
    this.ctx.restore();
  }
}
