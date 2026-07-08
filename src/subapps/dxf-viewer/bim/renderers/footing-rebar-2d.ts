/**
 * ADR-463 — 2Δ σχεδίαση οπλισμού θεμελίωσης (κάτοψη): shared pure-ctx helper.
 *
 * ADR-505 — thin consumer: η γεωμετρία (paths σε world coords, kind-aware: pad / strip /
 * tie-beam) παράγεται από το ΕΝΑ SSoT `collectFootingRebarPlanGeometry` (κοινό με τον DXF
 * export collector)· εδώ γίνεται μόνο το mapping world→screen + ctx stroke. Ο tie-beam
 * περνά μέσα από τον ΙΔΙΟ linear-member core (ADR-477) → EC8 κρίσιμες ζώνες.
 *
 * Pure ctx, ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/reinforcement/footing-rebar-plan-geometry.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { FoundationParams } from '../types/foundation-types';
import { collectFootingRebarPlanGeometry } from '../structural/reinforcement/footing-rebar-plan-geometry';
import { drawRebarPlanGeometry } from './draw-rebar-plan-geometry';

/**
 * Ζωγραφίζει τον οπλισμό ενός θεμελιακού στοιχείου στην κάτοψη. No-op αν δεν έχει
 * ορισμένο οπλισμό ή εκφυλισμένη γεωμετρία. `pxPerMm` = scene-units-per-mm × scale.
 *
 * ADR-505 — thin consumer: geometry SSoT `collectFootingRebarPlanGeometry` → κοινός
 * draw loop `drawRebarPlanGeometry`.
 */
export function drawFootingRebar2D(
  ctx: CanvasRenderingContext2D,
  p: FoundationParams,
  pxPerMm: number,
  worldToScreen: (q: Point2D) => Point2D,
): void {
  const geo = collectFootingRebarPlanGeometry(p);
  if (!geo) return;
  drawRebarPlanGeometry(ctx, geo, pxPerMm, worldToScreen);
}
