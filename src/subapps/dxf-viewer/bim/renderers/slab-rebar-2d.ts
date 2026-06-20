/**
 * ADR-476 — 2Δ σχεδίαση οπλισμού πλάκας (κάτοψη): shared pure-ctx helper.
 *
 * ADR-505 — thin consumer: η γεωμετρία (σχάρες σε world coords, clip-αρισμένες στο
 * outline) παράγεται από το ΕΝΑ SSoT `collectSlabRebarPlanGeometry` (κοινό με τον DXF
 * export collector)· εδώ γίνεται μόνο το mapping world→screen + ctx stroke. Σύμβαση
 * κάτοψης: κάτω σχάρα → συμπαγείς γραμμές· άνω σχάρα → διακεκομμένες (`dashed`).
 *
 * Χρώμα από το ΕΝΑ SSoT (`rebar-catalog`, crimson). Pure ctx, ZERO subscriptions
 * (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/reinforcement/slab-rebar-plan-geometry.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';
import { collectSlabRebarPlanGeometry } from '../structural/reinforcement/slab-rebar-plan-geometry';
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

const MIN_LINE_PX = 0.6;
/** Dash pattern άνω σχάρας (Revit «top mark»). */
const TOP_MESH_DASH: readonly number[] = [6, 4];

/**
 * Ζωγραφίζει τον οπλισμό μιας πλάκας στην κάτοψη. No-op αν δεν έχει ορισμένο
 * `structuralReinforcement` ή εκφυλισμένη γεωμετρία. `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawSlabRebar2D(
  ctx: CanvasRenderingContext2D,
  slab: SlabEntity,
  pxPerMm: number,
  worldToScreen: (q: Point2D) => Point2D,
): void {
  const geo = collectSlabRebarPlanGeometry(slab);
  if (!geo) return;

  ctx.save();
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  for (const path of geo.paths) {
    const pts = path.points.map(worldToScreen);
    if (pts.length < 2) continue;
    ctx.setLineDash(path.dashed ? [...TOP_MESH_DASH] : []);
    ctx.lineWidth = Math.max(MIN_LINE_PX, path.diameterMm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  ctx.restore();
}
