/**
 * ADR-505 — 2Δ σχεδίαση οπλισμού (κάτοψη): ΕΝΑΣ shared ctx draw loop (SSoT).
 *
 * Πρώην τα `column/footing/slab/linear-member-rebar-2d.ts` επαναλάμβαναν verbatim
 * τον ίδιο βρόχο πάνω στο κοινό `RebarPlanGeometry` (save → strokeStyle=REBAR_COLOR →
 * paths stroke + dots fill → restore). Η γεωμετρία ήδη ζει σε ΕΝΑ SSoT ανά μέλος
 * (`collect{X}RebarPlanGeometry`)· εδώ ενοποιείται και η **σχεδίαση** ώστε μία πηγή
 * geometry → ΕΝΑΣ draw loop. Οι 4 renderers γίνονται thin: resolve geo → αυτό.
 *
 * Ενσωματώνει, χωρίς αλλαγή συμπεριφοράς, τις τρεις ανά-μέλος αποκλίσεις:
 *   - **dots** (μόνο η κολώνα εκπέμπει· τα υπόλοιπα `dots: []` → no-op),
 *   - **dashed** άνω σχάρα πλάκας (`path.dashed`· αλλού undefined → συμπαγές),
 *   - **closed** διαδρομή (συνδετήρας/περίγραμμα· οι σχάρες `closed: false` → no-op).
 *
 * Pure ctx, ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached
 * normal-state pass μέσω των thin renderers).
 *
 * @see ../structural/reinforcement/rebar-plan-geometry-types.ts — geometry contract
 * @see ./column-rebar-2d.ts · ./footing-rebar-2d.ts · ./slab-rebar-2d.ts · ./linear-member-rebar-2d.ts
 * @see docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { RebarPlanGeometry } from '../structural/reinforcement/rebar-plan-geometry-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (μελετητική σύμβαση — crimson).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

/** Ελάχιστο πάχος γραμμής (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_LINE_PX = 0.6;
/** Ελάχιστη ακτίνα κουκκίδας ράβδου (px). */
const MIN_BAR_RADIUS_PX = 0.8;
/** Dash pattern άνω σχάρας πλάκας (Revit «top mark»). */
const TOP_MESH_DASH: readonly number[] = [6, 4];

/**
 * Ζωγραφίζει τη γεωμετρία οπλισμού ενός μέλους στην κάτοψη. No-op για κενές
 * διαδρομές/κουκκίδες. `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawRebarPlanGeometry(
  ctx: CanvasRenderingContext2D,
  geo: RebarPlanGeometry,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  ctx.save();
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  // ── Στεφάνια / συνδετήρια / γάντζοι / διαμήκεις-γραμμές / σχάρες (ως paths) ──
  for (const path of geo.paths) {
    const pts = path.points.map(worldToScreen);
    if (pts.length < 2) continue;
    ctx.setLineDash(path.dashed ? [...TOP_MESH_DASH] : []);
    ctx.lineWidth = Math.max(MIN_LINE_PX, path.diameterMm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }

  // ── Διαμήκεις ράβδες κολώνας (γεμάτες κουκκίδες· κενό για τα υπόλοιπα μέλη) ──
  for (const dot of geo.dots) {
    const c = worldToScreen(dot.center);
    const radius = Math.max(MIN_BAR_RADIUS_PX, (dot.diameterMm / 2) * pxPerMm);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
