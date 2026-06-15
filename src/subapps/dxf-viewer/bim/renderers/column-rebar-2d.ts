/**
 * ADR-456 Slice 3 — 2Δ σχεδίαση οπλισμού κολώνας (κάτοψη): shared pure-ctx helper.
 *
 * Διαμήκεις ράβδες = γεμάτες κουκκίδες (Ø-scaled) στις θέσεις που δίνει το geometry
 * SSoT (`computeColumnRebarLayout`)· στεφάνι = κλειστή polyline με **στρογγυλεμένες
 * γωνίες** (`stirrupPathMm`, EC2 ακτίνα κάμψης· πάχος = Ø συνδετήρα) που αγκαλιάζουν
 * τη γωνιακή ράβδο + γωνιακά γαντζάκια 135°. Οι θέσεις (LOCAL mm) μεταφέρονται σε
 * world μέσω του ΙΔΙΟΥ `columnLocalMmToWorld` με το footprint → ακολουθούν
 * rotation/anchor της κολώνας.
 *
 * Πεδίο: ορθογωνική κολώνα με ορισμένο `reinforcement`. Pure ctx, ZERO
 * subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/reinforcement/column-rebar-layout.ts
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import { columnLocalMmToWorld } from '../geometry/column-geometry';
import { computeColumnRebarLayout } from '../structural/reinforcement/column-rebar-layout';
import { buildColumnCrossTies } from '../structural/reinforcement/column-cross-ties';
import { DEFAULT_STIRRUP_TYPE } from '../structural/reinforcement/column-reinforcement-types';

/** Χρώμα οπλισμού (μελετητική σύμβαση — κόκκινο/crimson, αντίθεση με το δομικό μπλε). */
const REBAR_COLOR = '#c0392b';
/** Ελάχιστο πάχος γραμμής στεφανιού (px) ώστε να φαίνεται σε μικρό zoom. */
const MIN_STIRRUP_LINE_PX = 0.6;
/** Ελάχιστη ακτίνα κουκκίδας ράβδου (px). */
const MIN_BAR_RADIUS_PX = 0.8;

/**
 * Ζωγραφίζει τον οπλισμό μιας κολώνας στην κάτοψη. No-op αν δεν είναι ορθογωνική ή
 * δεν έχει ορισμένο οπλισμό. `pxPerMm` = scene-units-per-mm × transform.scale.
 */
export function drawColumnRebar2D(
  ctx: CanvasRenderingContext2D,
  p: ColumnParams,
  pxPerMm: number,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  if (p.kind !== 'rectangular') return;
  const r = p.reinforcement;
  if (!r) return;
  const layout = computeColumnRebarLayout(r, p.width, p.depth);
  if (!layout) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  // ── Στεφάνι (κλειστή polyline με στρογγυλεμένες γωνίες — αγκαλιάζει τις γωνιακές
  //    ράβδες, EC2 ακτίνα κάμψης· ΙΔΙΟ `stirrupPathMm` με το 3Δ → SSoT) ──
  const path = columnLocalMmToWorld(p, layout.stirrupPathMm).map(worldToScreen);
  if (path.length >= 4) {
    ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.closePath();
    ctx.stroke();
    // Γάντζος 135° μόνο στον τύπο `closed-hooked` (welded/spiral: καθαρό περίγραμμα).
    // ΔΥΟ άκρα (precomputed SSoT) — τόξο κάμψης + διαγώνια ουρά προς τον πυρήνα.
    if ((r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked') {
      for (const end of layout.stirrupHookEndsMm) {
        if (end.length < 2) continue;
        const pts = columnLocalMmToWorld(p, end).map(worldToScreen);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
  }

  // ── Εσωτερικά συνδετήρια (cross-ties / διαμάντι) — EC8· ίδιο πάχος/χρώμα με
  //    το στεφάνι, ΙΔΙΑ θέση με το 3Δ (geometry-is-SSoT) ──
  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';
  const crossTies = buildColumnCrossTies(layout.longitudinalBarsMm, layout.stirrupDiameterMm, layout.barDiameterMm, r.crossTiePattern);
  for (const tie of crossTies) {
    const tp = columnLocalMmToWorld(p, tie.pathMm).map(worldToScreen);
    if (tp.length >= 2) {
      ctx.lineWidth = Math.max(MIN_STIRRUP_LINE_PX, layout.stirrupDiameterMm * pxPerMm);
      ctx.beginPath();
      ctx.moveTo(tp[0].x, tp[0].y);
      for (let i = 1; i < tp.length; i++) ctx.lineTo(tp[i].x, tp[i].y);
      if (tie.closed) ctx.closePath();
      ctx.stroke();
    }
    if (!hooked) continue;
    for (const end of tie.hookEndsMm) {
      if (end.length < 2) continue;
      const pts = columnLocalMmToWorld(p, end).map(worldToScreen);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
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

