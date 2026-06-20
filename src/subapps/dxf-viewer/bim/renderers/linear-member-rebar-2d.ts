/**
 * ADR-477 Slice 2 — 2Δ σχεδίαση οπλισμού **γραμμικού μέλους** (κάτοψη): SSoT core draw.
 *
 * ADR-505 — thin consumer: η γεωμετρία (paths σε world coords) παράγεται από το ΕΝΑ
 * SSoT `collectLinearMemberRebarPlanGeometry` (κοινό με τον DXF export collector)· εδώ
 * γίνεται μόνο το mapping world→screen + ctx stroke. Δέχεται έτοιμο `BeamRebarLayout`
 * (resolved από τον caller) → δεν ξανα-resolve-άρει· καταναλώνεται από:
 *   - `beam-rebar-2d.ts` (δοκός) — resolve μέσω beam suggester.
 *   - `footing-rebar-2d.ts` (συνδετήρια δοκός, ADR-477) — footing-resolved layout.
 *
 * ADR-040: pure draw, ZERO subscriptions.
 *
 * @see ../structural/reinforcement/linear-member-rebar-plan-geometry.ts — geometry SSoT
 * @see ./beam-rebar-2d.ts · ./footing-rebar-2d.ts — οι δύο thin callers
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  collectLinearMemberRebarPlanGeometry,
  type LinearMemberRebarPlanInput,
} from '../structural/reinforcement/linear-member-rebar-plan-geometry';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

/** Ελάχιστο πάχος γραμμής οπλισμού (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_LINE_PX = 0.6;

/** Είσοδος του 2Δ core (re-export του geometry-SSoT input — ίδιο shape). */
export type LinearMemberRebar2DInput = LinearMemberRebarPlanInput;

/**
 * Ζωγραφίζει τη διάταξη οπλισμού ενός γραμμικού μέλους στην κάτοψη. No-op αν ο
 * άξονας είναι εκφυλισμένος (<2 σημεία). `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawLinearMemberRebar2D(
  ctx: CanvasRenderingContext2D,
  input: LinearMemberRebar2DInput,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  const geo = collectLinearMemberRebarPlanGeometry(input);
  if (geo.paths.length === 0) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;

  for (const path of geo.paths) {
    const pts = path.points.map(worldToScreen);
    if (pts.length < 2) continue;
    ctx.lineWidth = Math.max(MIN_LINE_PX, path.diameterMm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}
