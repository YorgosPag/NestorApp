/**
 * FloorFinishRenderer — ADR-419.
 *
 * 2D plan-view renderer για `FloorFinishEntity`. Reads `entity.geometry` +
 * `entity.params` (populated by `computeFloorFinishGeometry()` — SSoT) και draws:
 *   - closed polygon outline (stroke per-material colour)
 *   - translucent fill per material (~20% opacity)
 *   - hatch pattern clipped by polygon: wood/tile/dot/solid
 *
 * ADR-040 micro-leaf compliance: pure renderer με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isFloorFinishEntity } from '../../types/entities';
import type { FloorFinishEntity } from '../types/floor-finish-types';
import {
  polygonBboxHitTest,
  paintPolygonHoverHalo,
  tracePolygonScreenPath,
  mapBimGrips,
} from './bim-polygon-render';
import { paintClippedAreaHatch, type AreaHatchMotif } from './shared/canvas-hatch-fill';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { getFloorFinishGrips } from '../floor-finishes/floor-finish-grips';
import {
  getFloorFinishColor,
  getFloorFinishHatchType,
} from '../floor-finishes/floor-finish-material-catalog';
import { hexToRgba } from '../utils/bim-vg-fill-tint';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import { applyLiveStroke } from './shared/live-stroke';

/** Μοτίβο ανά οικογένεια υλικού: ξύλο παράλληλες · πλακάκι κάνναβος · μοκέτα πλέγμα τελειών ακτίνας 1,5 px. */
const HATCH_MOTIF: Readonly<Record<'wood' | 'tile' | 'dot', AreaHatchMotif>> = {
  wood: 'lines',
  tile: 'grid',
  dot:  { dotRadiusPx: 1.5 },
};

/** World-space spacing (mm) for each hatch family. */
const HATCH_SPACING_MM = {
  wood: 150,
  tile: 300,
  dot:  200,
  solid: 0,
} as const;

export class FloorFinishRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFloorFinishEntity(entity)) return;
    const ff = entity as FloorFinishEntity;
    if (!ff.params?.footprint) return;
    const verts = ff.params.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo.
    paintPolygonHoverHalo(
      this.ctx,
      (p) => this.worldToScreen(p),
      verts,
      phaseState.phase === 'highlighted',
      RENDER_LINE_WIDTHS.BIM_FINISH_BOUNDARY,
    );

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    const color = getFloorFinishColor(ff.params.materialId);
    const hatch = getFloorFinishHatchType(ff.params.materialId);

    // Translucent fill (22% opacity) — reuse `hexToRgba` SSoT (ADR-375· N.0.2 boy-scout,
    // αφαίρεση inline hex parse· κοινό με WallCoveringRenderer ADR-511).
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(hexToRgba(color, 0.22) ?? color);
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), verts);
    this.ctx.fill();

    // Hatch pattern clipped inside polygon.
    if (hatch !== 'solid' && ff.geometry?.bbox) {
      this.drawHatch(ff, hatch);
    }

    // Outline stroke.
    // ADR-909 Γ2.6α — οθόνη ⇒ αυτούσια· print pass ⇒ μελάνι πολιτικής + δάπεδο πάχους.
    applyLiveStroke(this.ctx, color, RENDER_LINE_WIDTHS.BIM_FINISH_BOUNDARY);
    this.ctx.setLineDash([4, 4]);
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), verts);
    this.ctx.stroke();

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isFloorFinishEntity(entity)) return [];
    return mapBimGrips(getFloorFinishGrips(entity as FloorFinishEntity));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFloorFinishEntity(entity)) return false;
    const ff = entity as FloorFinishEntity;
    const bb = ff.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, ff.params.footprint.vertices, point, tolerance);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private drawHatch(
    ff: FloorFinishEntity,
    hatch: 'wood' | 'tile' | 'dot',
  ): void {
    // ADR-909 Γ2.6α · Γ2.6β — clip + μελάνι (ρωτά την πολιτική εκτύπωσης) + μοτίβο ζουν ΜΙΑ φορά στο
    // `canvas-hatch-fill`· εδώ μόνο το mapping υλικού → μοτίβο + βήμα.
    paintClippedAreaHatch(
      this.ctx, (p) => this.worldToScreen(p), ff.params.footprint.vertices, ff.geometry!.bbox,
      HATCH_SPACING_MM[hatch], HATCH_MOTIF[hatch],
    );
  }
}
