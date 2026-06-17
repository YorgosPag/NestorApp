/**
 * ADR-463 — 2Δ σχεδίαση οπλισμού θεμελίωσης (κάτοψη): shared pure-ctx helper.
 *
 * Mirror του `column-rebar-2d.ts`, kind-aware:
 *   - `pad`      → δι-διευθυντική κάτω σχάρα (γραμμές // X και // Y, inset cover).
 *   - `strip`    → εγκάρσιες ράβδοι (// πλάτος, βήμα κατά τον άξονα) + διαμήκεις
 *                  διανομής (// άξονας) + προαιρετικοί συνδετήρες (περίγραμμα inset).
 *   - `tie-beam` → διαμήκεις ράβδοι (// άξονας) + συνδετήρες (εγκάρσια ticks).
 *
 * Η γεωμετρία υπολογίζεται από τις γωνίες του footprint (canvas units, SSoT
 * `computeFoundationGeometry`) → ακολουθεί rotation/anchor/justification. Pure ctx,
 * ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ../structural/active-footing-reinforcement.ts
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { FoundationParams } from '../types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../structural/reinforcement/footing-reinforcement-types';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveActiveFootingReinforcementForParams } from '../structural/active-footing-reinforcement';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (ίδια σύμβαση με κολώνα — crimson).
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';
const MIN_LINE_PX = 0.6;

interface Vec {
  readonly x: number;
  readonly y: number;
}

function sub(a: Vec, b: Vec): Vec { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Vec, b: Vec): Vec { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a: Vec, k: number): Vec { return { x: a.x * k, y: a.y * k }; }
function len(a: Vec): number { return Math.hypot(a.x, a.y); }
function unit(a: Vec): Vec { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; }

/** Τοπικό πλαίσιο ορθογωνίου footprint: origin + 2 μοναδιαίοι άξονες + μήκη (canvas). */
interface RectFrame {
  readonly origin: Vec;
  readonly along: Vec;   // μοναδιαίος κατά μήκος (v0→v1)
  readonly across: Vec;  // μοναδιαίος εγκάρσια (v0→v3)
  readonly lenAlong: number;
  readonly lenAcross: number;
}

function rectFrame(verts: readonly { x: number; y: number }[]): RectFrame | null {
  if (verts.length < 4) return null;
  const along = sub(verts[1], verts[0]);
  const across = sub(verts[3], verts[0]);
  const lenAlong = len(along);
  const lenAcross = len(across);
  if (lenAlong <= 0 || lenAcross <= 0) return null;
  return { origin: verts[0], along: unit(along), across: unit(across), lenAlong, lenAcross };
}

/** Στρώνει ένα ευθύγραμμο τμήμα (canvas units → screen). */
function strokeSeg(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  a: Vec,
  b: Vec,
): void {
  const pa = worldToScreen(a);
  const pb = worldToScreen(b);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

/**
 * Ράβδοι παράλληλες στον `along`, με μήκος `lenAlong − 2·cover`, κατανεμημένες κατά
 * `across` με βήμα `spacing` (canvas units), inset cover και στις δύο διευθύνσεις.
 */
function strokeBars(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  spacingCanvas: number,
  coverCanvas: number,
): void {
  const usableAcross = f.lenAcross - 2 * coverCanvas;
  if (usableAcross < 0 || spacingCanvas <= 0) return;
  const n = Math.max(1, Math.floor(usableAcross / spacingCanvas) + 1);
  const a0 = coverCanvas;
  const a1 = f.lenAlong - coverCanvas;
  for (let i = 0; i < n; i++) {
    const across = coverCanvas + (n === 1 ? usableAcross / 2 : (i * usableAcross) / (n - 1));
    const base = add(f.origin, scale(f.across, across));
    strokeSeg(ctx, worldToScreen, add(base, scale(f.along, a0)), add(base, scale(f.along, a1)));
  }
}

/** Περίγραμμα ορθογωνίου inset κατά cover (συνδετήρας/περίμετρος). */
function strokeInsetRect(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  coverCanvas: number,
): void {
  const x0 = coverCanvas, x1 = f.lenAlong - coverCanvas;
  const y0 = coverCanvas, y1 = f.lenAcross - coverCanvas;
  if (x1 <= x0 || y1 <= y0) return;
  const at = (a: number, c: number): Vec => add(f.origin, add(scale(f.along, a), scale(f.across, c)));
  const corners = [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)];
  ctx.beginPath();
  const p0 = worldToScreen(corners[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < corners.length; i++) {
    const p = worldToScreen(corners[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
}

function lineWidthFor(diameterMm: number, pxPerMm: number): number {
  return Math.max(MIN_LINE_PX, diameterMm * pxPerMm);
}

function drawPad(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  r: PadReinforcement,
  s: number,
  pxPerMm: number,
): void {
  const cover = r.coverMm * s;
  // bottomMeshX: ράβδοι // along (width), βήμα κατά across (length).
  ctx.lineWidth = lineWidthFor(r.bottomMeshX.diameterMm, pxPerMm);
  strokeBars(ctx, worldToScreen, f, r.bottomMeshX.spacingMm * s, cover);
  // bottomMeshY: ράβδοι // across (length), βήμα κατά along — εναλλαγή frame αξόνων.
  const fSwapped: RectFrame = {
    origin: f.origin, along: f.across, across: f.along,
    lenAlong: f.lenAcross, lenAcross: f.lenAlong,
  };
  ctx.lineWidth = lineWidthFor(r.bottomMeshY.diameterMm, pxPerMm);
  strokeBars(ctx, worldToScreen, fSwapped, r.bottomMeshY.spacingMm * s, cover);
}

function drawStrip(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  r: StripReinforcement,
  s: number,
  pxPerMm: number,
): void {
  const cover = r.coverMm * s;
  // Εγκάρσιες: ράβδοι // across (πλάτος), βήμα κατά along (άξονας).
  const fTrans: RectFrame = {
    origin: f.origin, along: f.across, across: f.along,
    lenAlong: f.lenAcross, lenAcross: f.lenAlong,
  };
  ctx.lineWidth = lineWidthFor(r.transverse.diameterMm, pxPerMm);
  strokeBars(ctx, worldToScreen, fTrans, r.transverse.spacingMm * s, cover);
  // Διαμήκεις διανομής: count ράβδοι // along, κατανεμημένες κατά across.
  ctx.lineWidth = lineWidthFor(r.longitudinal.diameterMm, pxPerMm);
  strokeDistributed(ctx, worldToScreen, f, r.longitudinal.count, cover);
  if (r.stirrups) {
    ctx.lineWidth = lineWidthFor(r.stirrups.diameterMm, pxPerMm);
    strokeInsetRect(ctx, worldToScreen, f, cover);
  }
}

function drawTieBeam(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  r: TieBeamReinforcement,
  s: number,
  pxPerMm: number,
): void {
  const cover = r.coverMm * s;
  // Διαμήκεις (κάτω+άνω σε κάτοψη συμπίπτουν): bottom.count ράβδοι // άξονα.
  ctx.lineWidth = lineWidthFor(r.bottom.diameterMm, pxPerMm);
  strokeDistributed(ctx, worldToScreen, f, r.bottom.count, cover);
  // Συνδετήρες: εγκάρσια ticks (// across) με βήμα κατά τον άξονα + περίγραμμα inset.
  ctx.lineWidth = lineWidthFor(r.stirrups.diameterMm, pxPerMm);
  const fStirrup: RectFrame = {
    origin: f.origin, along: f.across, across: f.along,
    lenAlong: f.lenAcross, lenAcross: f.lenAlong,
  };
  strokeBars(ctx, worldToScreen, fStirrup, r.stirrups.spacingMm * s, cover);
}

/** `count` ράβδοι // along, ισοκατανεμημένες κατά across (inset cover). */
function strokeDistributed(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  f: RectFrame,
  count: number,
  coverCanvas: number,
): void {
  if (count <= 0) return;
  const usableAcross = Math.max(0, f.lenAcross - 2 * coverCanvas);
  const a0 = coverCanvas, a1 = f.lenAlong - coverCanvas;
  for (let i = 0; i < count; i++) {
    const across = coverCanvas + (count === 1 ? usableAcross / 2 : (i * usableAcross) / (count - 1));
    const base = add(f.origin, scale(f.across, across));
    strokeSeg(ctx, worldToScreen, add(base, scale(f.along, a0)), add(base, scale(f.along, a1)));
  }
}

/**
 * Ζωγραφίζει τον οπλισμό ενός θεμελιακού στοιχείου στην κάτοψη. No-op αν δεν έχει
 * ορισμένο οπλισμό ή εκφυλισμένη γεωμετρία. `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawFootingRebar2D(
  ctx: CanvasRenderingContext2D,
  p: FoundationParams,
  pxPerMm: number,
  worldToScreen: (q: Point2D) => Point2D,
): void {
  const r = resolveActiveFootingReinforcementForParams(p);
  if (!r) return;
  const f = rectFrame(computeFoundationGeometry(p).footprint.vertices);
  if (!f) return;
  const s = mmToSceneUnits(p.sceneUnits ?? 'mm');
  if (s <= 0) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  if (p.kind === 'pad' && r.kind === 'pad') drawPad(ctx, worldToScreen, f, r, s, pxPerMm);
  else if (p.kind === 'strip' && r.kind === 'strip') drawStrip(ctx, worldToScreen, f, r, s, pxPerMm);
  else if (p.kind === 'tie-beam' && r.kind === 'tie-beam') drawTieBeam(ctx, worldToScreen, f, r, s, pxPerMm);

  ctx.restore();
}
