/**
 * ADR-456/460 Slice — 2Δ σχεδίαση οπλισμού κολώνας (κάτοψη): shared pure-ctx helper.
 *
 * Διαμήκεις ράβδες = γεμάτες κουκκίδες (Ø-scaled) στις θέσεις που δίνει το geometry
 * SSoT (dispatcher `resolveColumnRebarLayout` — **οποιοδήποτε σχήμα**)· στεφάνι =
 * κλειστή polyline με **στρογγυλεμένες γωνίες** (`stirrupPathMm`) + γωνιακά γαντζάκια
 * 135°· τοίχωμα → επιπλέον boundary hoops (`extraStirrupPathsMm`). Οι θέσεις (LOCAL
 * mm) μεταφέρονται σε world μέσω του ΙΔΙΟΥ `columnLocalMmToWorld` με το footprint →
 * ακολουθούν rotation/anchor.
 *
 * Πεδίο (ADR-460): ΟΛΟΙ οι τύποι διατομής με ορισμένο `reinforcement`. Pure ctx,
 * ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/reinforcement/column-rebar-layout-resolve.ts
 * @see docs/centralized-systems/reference/adrs/ADR-460-multi-shape-column-reinforcement.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import { columnLocalMmToWorld } from '../geometry/column-geometry';
import {
  resolveColumnRebarLayout,
  resolveColumnCrossTies,
} from '../structural/reinforcement/column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../structural/reinforcement/column-section-outline';
import { resolveActiveColumnReinforcementForParams } from '../structural/active-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from '../structural/reinforcement/column-reinforcement-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (μελετητική σύμβαση — κόκκινο/crimson).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';
/** Ελάχιστο πάχος γραμμής στεφανιού (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_STIRRUP_LINE_PX = 0.6;
/** Ελάχιστη ακτίνα κουκκίδας ράβδου (px). */
const MIN_BAR_RADIUS_PX = 0.8;

/** Στρώνει μια polyline (local mm → world → screen). `closed` κλείνει last→first. */
function strokePath(
  ctx: CanvasRenderingContext2D,
  p: ColumnParams,
  localMm: readonly Point2D[],
  worldToScreen: (q: Point2D) => Point2D,
  closed: boolean,
): void {
  if (localMm.length < 2) return;
  const pts = columnLocalMmToWorld(p, localMm).map(worldToScreen);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}

/**
 * Ζωγραφίζει τον οπλισμό μιας κολώνας στην κάτοψη (κάθε σχήμα). No-op αν δεν έχει
 * ορισμένο οπλισμό ή εκφυλισμένη διατομή. `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawColumnRebar2D(
  ctx: CanvasRenderingContext2D,
  p: ColumnParams,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  // ADR-456/460 (Giorgio 2026-06-16) — auto-mode ⇒ φρέσκο design από την τρέχουσα γεωμετρία
  // (real-time στο resize)· manual ⇒ stored. ΕΝΑ SSoT (resolveActiveColumnReinforcement).
  const r = resolveActiveColumnReinforcementForParams(p);
  if (!r) return;
  const section = resolveColumnReinforcementSection(p);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;
  const stirrupLineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';

  // ── Στεφάνι + επιπλέον στεφάνια (boundary τοιχώματος / σκέλη multihoop) — ΙΔΙΟ path με 3Δ ──
  ctx.lineWidth = stirrupLineWidth;
  strokePath(ctx, p, layout.stirrupPathMm, worldToScreen, true);
  const extraHoops = layout.extraStirrupPathsMm ?? [];
  for (let i = 0; i < extraHoops.length; i++) {
    strokePath(ctx, p, extraHoops[i], worldToScreen, true);
    // Γάντζος 135° ανά σκέλος-στεφάνι (multihoop)· wall boundary hoops → absent (αμετάβλητο).
    if (hooked && layout.extraStirrupHookEndsMm?.[i]) {
      for (const end of layout.extraStirrupHookEndsMm[i]) strokePath(ctx, p, end, worldToScreen, false);
    }
  }
  // Γάντζος 135° κύριου στεφανιού μόνο στον τύπο `closed-hooked`. ΔΥΟ άκρα (precomputed SSoT).
  if (hooked) {
    for (const end of layout.stirrupHookEndsMm) strokePath(ctx, p, end, worldToScreen, false);
  }

  // ── Εσωτερικά συνδετήρια (cross-ties / διαμάντι / web S-ties) — shape-aware ──
  for (const tie of resolveColumnCrossTies(layout, section, r)) {
    ctx.lineWidth = stirrupLineWidth;
    strokePath(ctx, p, tie.pathMm, worldToScreen, tie.closed);
    if (!hooked) continue;
    for (const end of tie.hookEndsMm) strokePath(ctx, p, end, worldToScreen, false);
  }

  // ── Διαμήκεις ράβδες (γεμάτες κουκκίδες) ──
  const bars = columnLocalMmToWorld(p, layout.longitudinalBarsMm).map(worldToScreen);
  const radius = Math.max(MIN_BAR_RADIUS_PX, (layout.barDiameterMm / 2) * pxPerMm);
  for (const b of bars) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
