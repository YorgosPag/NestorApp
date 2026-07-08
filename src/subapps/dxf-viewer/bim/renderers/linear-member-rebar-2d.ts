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
import { drawRebarPlanGeometry } from './draw-rebar-plan-geometry';

/** Είσοδος του 2Δ core (re-export του geometry-SSoT input — ίδιο shape). */
export type LinearMemberRebar2DInput = LinearMemberRebarPlanInput;

/**
 * Ζωγραφίζει τη διάταξη οπλισμού ενός γραμμικού μέλους στην κάτοψη. No-op αν ο
 * άξονας είναι εκφυλισμένος (<2 σημεία). `pxPerMm` = scene-units-per-mm × scale.
 *
 * ADR-505 — thin consumer: geometry SSoT `collectLinearMemberRebarPlanGeometry` →
 * κοινός draw loop `drawRebarPlanGeometry` (μόνο paths — το γραμμικό μέλος δεν έχει dots).
 */
export function drawLinearMemberRebar2D(
  ctx: CanvasRenderingContext2D,
  input: LinearMemberRebar2DInput,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  const geo = collectLinearMemberRebarPlanGeometry(input);
  if (geo.paths.length === 0) return;
  drawRebarPlanGeometry(ctx, geo, pxPerMm, worldToScreen);
}
