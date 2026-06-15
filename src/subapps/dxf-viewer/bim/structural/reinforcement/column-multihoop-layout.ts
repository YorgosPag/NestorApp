/**
 * Multi-hoop rebar layout — **επικαλυπτόμενοι ορθογώνιοι συνδετήρες ανά σκέλος**
 * (ADR-460 — follow-up 6, η σωστή μέθοδος όπλισης Γ/Τ/Π/Ι).
 *
 * Παίρνει τα ορθογώνια σκέλη (`decomposeColumnSectionRects`) και χτίζει **έναν κλειστό
 * ορθογώνιο συνδετήρα ανά σκέλος** (Revit/Tekla standard): μέσα σε κάθε ορθογώνιο οι
 * ράβδοι είναι ευθυγραμμισμένες → η **ΥΠΑΡΧΟΥΣΑ ορθογωνική μηχανή** (rounded stirrup +
 * γωνιακός γάντζος 135° + cross-ties αντικριστών ράβδων) δουλεύει τέλεια (μηδέν κοίλη
 * γωνία, μηδέν ζιγκ-ζαγκ). Τα στεφάνια **επικαλύπτονται** στη ζώνη συμβολής (τα σκέλη
 * επικαλύπτονται εκ κατασκευής στο decomposition).
 *
 * Συγχώνευση σε ΕΝΑ `ColumnRebarLayout`: 1ο σκέλος → `stirrupPathMm` (κύριο)· υπόλοιπα →
 * `extraStirrupPathsMm` (οι renderers ήδη τα ζωγραφίζουν, όπως τα boundary hoops του
 * τοιχώματος)· ράβδοι ενωμένες & dedup στις συμβολές· cross-ties ως `crossTieAnchorsMm`
 * (ίδιο anchors→S-tie μονοπάτι με wall/perimeter → μηδέν νέο plumbing σε 2Δ/3Δ/ποσότητες).
 *
 * LOCAL mm (centroid-centered). Pure.
 *
 * @see ./column-rect-decomposition.ts
 * @see ./column-rebar-layout.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnReinforcement } from './column-reinforcement-types';
import type { SectionRectMm } from './column-rect-decomposition';
import {
  buildRoundedStirrupPath,
  buildStirrupHookEndsMm,
  closedPolylineLengthMm,
  distributeBarsAlongPolygon,
  stirrupCenterlinePerimeterMm,
  STIRRUP_BEND_ARC_SEGMENTS,
  STIRRUP_BEND_CL_FACTOR,
  type ColumnRebarLayout,
} from './column-rebar-layout';
import { buildRectCrossTieAnchors } from './column-cross-ties';

/** Ελάχιστος αριθμός ράβδων ανά σκέλος (4 γωνίες — δομική απαίτηση). */
const MIN_BARS_PER_RECT = 4;

/** Διάταξη οπλισμού ενός μεμονωμένου σκέλους (rect-local + μετατοπισμένο). */
interface RectLayout {
  readonly pathMm: Point2D[];
  readonly ringMm: Point2D[];
  readonly cornerRadiusMm: number;
  readonly hookEndsMm: Point2D[][];
  readonly barsMm: Point2D[];
  readonly anchorsMm: { a: Point2D; b: Point2D }[];
  readonly centerlineLengthMm: number;
}

/** Μετατόπιση πολυγραμμής κατά (dx,dy). */
function shift(pts: readonly Point2D[], dx: number, dy: number): Point2D[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Κατανομή `total` ράβδων στα σκέλη ανάλογα με την περίμετρο (largest-remainder, min 4). */
function apportionBars(rects: readonly SectionRectMm[], total: number): number[] {
  const perim = rects.map((r) => 2 * (r.width + r.depth));
  const sum = perim.reduce((a, p) => a + p, 0) || 1;
  const exact = perim.map((p) => (total * p) / sum);
  const counts = exact.map((v) => Math.floor(v));
  let rem = total - counts.reduce((a, v) => a + v, 0);
  const order = exact.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (let k = 0; k < order.length && rem > 0; k++, rem--) counts[order[k].i]++;
  return counts.map((c) => Math.max(MIN_BARS_PER_RECT, c));
}

/** Διάταξη οπλισμού ενός ορθογώνιου σκέλους (μετατοπισμένη στο κέντρο του σκέλους). */
function buildRectLayout(r: ColumnReinforcement, rect: SectionRectMm, count: number): RectLayout | null {
  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);
  const halfWs = Math.max(0, rect.width / 2 - (cover + dbw / 2));
  const halfDs = Math.max(0, rect.depth / 2 - (cover + dbw / 2));
  if (halfWs <= 0 || halfDs <= 0) return null;

  const ring: Point2D[] = [
    { x: -halfWs, y: -halfDs }, { x: halfWs, y: -halfDs }, { x: halfWs, y: halfDs }, { x: -halfWs, y: halfDs },
  ];
  const halfWb = Math.max(0, rect.width / 2 - (cover + dbw + dbL / 2));
  const halfDb = Math.max(0, rect.depth / 2 - (cover + dbw + dbL / 2));
  const barCorners: Point2D[] = [
    { x: -halfWb, y: -halfDb }, { x: halfWb, y: -halfDb }, { x: halfWb, y: halfDb }, { x: -halfWb, y: halfDb },
  ];
  const bars = distributeBarsAlongPolygon(barCorners, Math.max(MIN_BARS_PER_RECT, Math.floor(count)));
  const cornerRadiusMm = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, halfWs, halfDs);
  const hookBar = bars.length > 0 ? bars[0] : ring[0];

  return {
    pathMm: shift(buildRoundedStirrupPath(ring, cornerRadiusMm, STIRRUP_BEND_ARC_SEGMENTS), rect.cx, rect.cy),
    ringMm: shift(ring, rect.cx, rect.cy),
    cornerRadiusMm,
    hookEndsMm: buildStirrupHookEndsMm(ring, hookBar, { x: 0, y: 0 }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS).map((e) => shift(e, rect.cx, rect.cy)),
    barsMm: shift(bars, rect.cx, rect.cy),
    anchorsMm: buildRectCrossTieAnchors(bars, halfWb, halfDb).map(({ a, b }) => ({ a: { x: a.x + rect.cx, y: a.y + rect.cy }, b: { x: b.x + rect.cx, y: b.y + rect.cy } })),
    centerlineLengthMm: stirrupCenterlinePerimeterMm(r, rect.width, rect.depth),
  };
}

/** Ένωση ράβδων με dedup κοντινών (≈ ίδια θέση στη ζώνη συμβολής), ανοχή `tol` mm. */
function mergeBars(groups: readonly Point2D[][], tol: number): Point2D[] {
  const out: Point2D[] = [];
  for (const group of groups) {
    for (const b of group) {
      if (!out.some((o) => Math.hypot(o.x - b.x, o.y - b.y) <= tol)) out.push(b);
    }
  }
  return out;
}

/** Πλησιέστερη ράβδος εντός `tol` (snap άκρου anchor σε ΠΡΑΓΜΑΤΙΚΗ ράβδο). */
function snapToBar(p: Point2D, bars: readonly Point2D[], tol: number): Point2D | null {
  let best: Point2D | null = null;
  let bestD = tol;
  for (const b of bars) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d <= bestD) { bestD = d; best = b; }
  }
  return best;
}

/** Canonical κλειδί ζεύγους (order-agnostic) για dedup ties. */
function pairKey(a: Point2D, b: Point2D): string {
  const q = (v: number): number => Math.round(v * 10) / 10;
  const p1 = `${q(a.x)},${q(a.y)}`;
  const p2 = `${q(b.x)},${q(b.y)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

/** Snap κάθε άκρο anchor σε πραγματική ράβδο + dedup (ποτέ γάντζος στο κενό). */
function reconcileAnchors(
  groups: readonly { a: Point2D; b: Point2D }[][],
  bars: readonly Point2D[],
  tol: number,
): { a: Point2D; b: Point2D }[] {
  const out: { a: Point2D; b: Point2D }[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const { a, b } of group) {
      const sa = snapToBar(a, bars, tol);
      const sb = snapToBar(b, bars, tol);
      if (!sa || !sb) continue;
      const key = pairKey(sa, sb);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: sa, b: sb });
    }
  }
  return out;
}

/**
 * Διάταξη οπλισμού **πολλαπλών επικαλυπτόμενων ορθογώνιων στεφανιών** (Γ/Τ/Π/Ι). Επιστρέφει
 * `null` αν κανένα σκέλος δεν δίνει έγκυρο στεφάνι (διατομή πολύ μικρή για το cover).
 */
export function buildMultiHoopLayout(
  r: ColumnReinforcement,
  rects: readonly SectionRectMm[],
): ColumnRebarLayout | null {
  if (rects.length === 0) return null;
  const counts = apportionBars(rects, Math.max(0, Math.floor(r.longitudinal.count)));
  const legs = rects.map((rect, i) => buildRectLayout(r, rect, counts[i])).filter((l): l is RectLayout => l !== null);
  if (legs.length === 0) return null;

  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const tol = Math.max(2, dbL);
  const main = legs[0];
  const longitudinalBarsMm = mergeBars(legs.map((l) => l.barsMm), tol);
  const crossTieAnchorsMm = reconcileAnchors(legs.map((l) => l.anchorsMm), longitudinalBarsMm, tol);

  return {
    longitudinalBarsMm,
    stirrupRingMm: main.ringMm,
    stirrupPathMm: main.pathMm,
    stirrupCornerRadiusMm: main.cornerRadiusMm,
    stirrupHookEndsMm: main.hookEndsMm,
    barDiameterMm: dbL,
    stirrupDiameterMm: Math.max(0, r.stirrups.diameterMm),
    stirrupCenterlineLengthMm: main.centerlineLengthMm,
    extraStirrupPathsMm: legs.slice(1).map((l) => l.pathMm),
    ...(crossTieAnchorsMm.length > 0 ? { crossTieAnchorsMm } : {}),
  };
}
