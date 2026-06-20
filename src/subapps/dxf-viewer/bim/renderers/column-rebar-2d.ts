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
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (μελετητική σύμβαση — κόκκινο/crimson).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

/** Ελάχιστο πάχος γραμμής στεφανιού (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_STIRRUP_LINE_PX = 0.6;
/** Ελάχιστη ακτίνα κουκκίδας ράβδου (px). */
const MIN_BAR_RADIUS_PX = 0.8;

/**
 * Ζωγραφίζει τον οπλισμό μιας κολώνας στην κάτοψη (κάθε σχήμα). No-op αν δεν έχει
 * ορισμένο οπλισμό ή εκφυλισμένη διατομή. `pxPerMm` = scene-units-per-mm × scale.
 *
 * ADR-491 — `columnId` (προαιρετικό): όταν δίνεται (committed overlay path) ο οπλισμός
 * γίνεται **FEM-aware** μέσω `…ForEntity` (πρόβολος → wL²/2 στη στήριξη, engaged-gated).
 * Απών (ghost drag preview) → `…ForParams` (e₀). Η επιλογή γίνεται στο geometry SSoT.
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

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  // ── Στεφάνια / συνδετήρια / γάντζοι (όλα ως paths, πάχος ∝ διάμετρος συνδετήρα) ──
  for (const path of geo.paths) {
    const pts = path.points.map(worldToScreen);
    if (pts.length < 2) continue;
    ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, path.diameterMm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }

  // ── Διαμήκεις ράβδες (γεμάτες κουκκίδες) ──
  for (const dot of geo.dots) {
    const c = worldToScreen(dot.center);
    const radius = Math.max(MIN_BAR_RADIUS_PX, (dot.diameterMm / 2) * pxPerMm);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
