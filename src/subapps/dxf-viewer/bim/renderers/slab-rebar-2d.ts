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
import { drawRebarPlanGeometry } from './draw-rebar-plan-geometry';

/**
 * Ζωγραφίζει τον οπλισμό μιας πλάκας στην κάτοψη. No-op αν δεν έχει ορισμένο
 * `structuralReinforcement` ή εκφυλισμένη γεωμετρία. `pxPerMm` = scene-units-per-mm × scale.
 *
 * ADR-505 — thin consumer: geometry SSoT `collectSlabRebarPlanGeometry` → κοινός draw
 * loop `drawRebarPlanGeometry`. Η άνω σχάρα κωδικοποιείται ως `path.dashed` (Revit «top
 * mark») στο geometry SSoT → ο κοινός loop τη ζωγραφίζει διακεκομμένη.
 */
export function drawSlabRebar2D(
  ctx: CanvasRenderingContext2D,
  slab: SlabEntity,
  pxPerMm: number,
  worldToScreen: (q: Point2D) => Point2D,
): void {
  const geo = collectSlabRebarPlanGeometry(slab);
  if (!geo) return;
  drawRebarPlanGeometry(ctx, geo, pxPerMm, worldToScreen);
}
