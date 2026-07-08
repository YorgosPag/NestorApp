/**
 * ADR-456/460 Slice — 2Δ σχεδίαση οπλισμού κολώνας (κάτοψη): shared pure-ctx helper.
 *
 * ADR-505 — thin consumer: η γεωμετρία (paths/dots σε world coords) παράγεται από το
 * ΕΝΑ SSoT `collectColumnRebarPlanGeometry` (κοινό με τον DXF export collector)· εδώ
 * γίνεται μόνο το mapping world→screen + ctx stroke/fill. Έτσι μία πηγή γεωμετρίας →
 * canvas draw + DXF export (μηδέν διπλή διάσχιση layout).
 *
 * Πεδίο (ADR-460): ΟΛΟΙ οι τύποι διατομής με ορισμένο `reinforcement`. Pure ctx,
 * ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/reinforcement/column-rebar-plan-geometry.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-460-multi-shape-column-reinforcement.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import { collectColumnRebarPlanGeometry } from '../structural/reinforcement/column-rebar-plan-geometry';
import { drawRebarPlanGeometry } from './draw-rebar-plan-geometry';

/**
 * Ζωγραφίζει τον οπλισμό μιας κολώνας στην κάτοψη (κάθε σχήμα). No-op αν δεν έχει
 * ορισμένο οπλισμό ή εκφυλισμένη διατομή. `pxPerMm` = scene-units-per-mm × scale.
 *
 * ADR-491 — `columnId` (προαιρετικό): όταν δίνεται (committed overlay path) ο οπλισμός
 * γίνεται **FEM-aware** μέσω `…ForEntity` (πρόβολος → wL²/2 στη στήριξη, engaged-gated).
 * Απών (ghost drag preview) → `…ForParams` (e₀). Η επιλογή γίνεται στο geometry SSoT.
 *
 * ADR-505 — thin consumer: geometry SSoT `collectColumnRebarPlanGeometry` →
 * κοινός draw loop `drawRebarPlanGeometry` (paths στεφανιών + dots διαμήκων ράβδων).
 */
export function drawColumnRebar2D(
  ctx: CanvasRenderingContext2D,
  p: ColumnParams,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
  columnId?: string,
): void {
  const geo = collectColumnRebarPlanGeometry(p, columnId);
  if (!geo) return;
  drawRebarPlanGeometry(ctx, geo, pxPerMm, worldToScreen);
}
