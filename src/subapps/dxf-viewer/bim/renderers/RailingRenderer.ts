/**
 * RailingRenderer — ADR-407.
 *
 * 2D plan-view renderer for `RailingEntity`. Reads `entity.geometry`
 * (populated by `computeRailingGeometry()` — SSoT) via the `buildRailingSymbol`
 * SSoT and draws the architectural plan convention for a railing:
 *   - the path centreline stroke
 *   - the post plan footprints (rotated squares / circles)
 *   - the balusters as small dots
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isRailingEntity } from '../../types/entities';
import type { RailingEntity } from '../types/railing-types';
import { buildRailingSymbol, balusterDotRadiusMm } from '../railings/railing-symbol';
import { mmToSceneUnits } from '../../utils/scene-units';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

// ADR-445 — κιγκλίδωμα = ψυχρό steel-grey (#607080), ευθυγραμμισμένο με
// BIM_CATEGORY_LINE_COLORS.railing. Fallback του resolver για το stroke.
/** Railing palette — metal guardrail (cool steel-grey projection). */
const RAILING_STROKE = '#607080';
const RAILING_POST_FILL = 'rgba(96, 112, 128, 0.30)';
const RAILING_BALUSTER_FILL = 'rgba(96, 112, 128, 0.65)';
const MIN_BALUSTER_DOT_PX = 1.5;

export class RailingRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isRailingEntity(entity)) return;
    const railing = entity as RailingEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'railing' → architectural via DISCIPLINE_BY_CATEGORY.
    const layer = railing.layerId ? getLayer(railing.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'railing', layerId: railing.layerId, discipline: railing.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!railing.geometry || !railing.params) return;
    const symbol = buildRailingSymbol(railing.params, railing.geometry);
    if (symbol.pathStroke.length < 2) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.strokePolyline(symbol.pathStroke);
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    this.ctx.setLineDash([]);

    // Path centreline.
    this.ctx.strokeStyle = RAILING_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.strokePolyline(symbol.pathStroke);

    // Post plan footprints (rotated squares / circles).
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(RAILING_POST_FILL);
    for (const mark of symbol.postMarks) {
      if (mark.length < 3) continue;
      this.drawClosedPath(mark);
      this.ctx.fill();
      this.ctx.stroke();
    }

    // Balusters as small dots.
    const s = mmToSceneUnits(railing.params.sceneUnits ?? 'mm');
    const dotWorldRadius = balusterDotRadiusMm(railing.params.type.balusterPlacement.pattern.profile) * s;
    const dotScreenRadius = Math.max(MIN_BALUSTER_DOT_PX, dotWorldRadius * this.transform.scale);
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(RAILING_BALUSTER_FILL);
    for (const c of symbol.balusterMarks) {
      const p = this.worldToScreen({ x: c.x, y: c.y });
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, dotScreenRadius, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isRailingEntity(entity)) return [];
    const railing = entity as RailingEntity;
    const path = railing.geometry?.resolvedPath ?? [];
    return path.map((p, i) => ({
      id: `${railing.id}-grip-${i}`,
      position: { x: p.x, y: p.y },
      type: 'vertex' as const,
      entityId: railing.id,
      isVisible: true,
      gripIndex: i,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isRailingEntity(entity)) return false;
    const railing = entity as RailingEntity;
    const bb = railing.geometry?.bbox;
    const path = railing.geometry?.resolvedPath;
    if (!bb || !path || path.length < 2) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    for (let i = 1; i < path.length; i++) {
      if (distanceToSegment(point, path[i - 1], path[i]) <= tolerance) return true;
    }
    return false;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private strokePolyline(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 2) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: vertices[0].x, y: vertices[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = this.worldToScreen({ x: vertices[i].x, y: vertices[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }

  private drawClosedPath(vertices: ReadonlyArray<{ x: number; y: number }>): void {
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
}

/** Perpendicular distance from `p` to segment a→b (world units). */
function distanceToSegment(
  p: Point2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
