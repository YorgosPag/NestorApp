/**
 * Wall reinforcement layout — boundary elements + distributed web (ADR-460 Slice 2).
 *
 * Τοίχωμα (shear-wall ή επίμηκες Γ/Τ/Π/σύνθετο, EC8 §5.4.3.4 + §5.5): συγκεντρωμένος
 * οπλισμός στις **κρυφοκολώνες** (boundary elements στα δύο άκρα κατά τον άξονα μήκους)
 * + **κατανεμημένος οπλισμός κορμού** (κατακόρυφες ράβδοι στις δύο παρειές). Παράγει το
 * ΙΔΙΟ `ColumnRebarLayout`: το κύριο `stirrupPathMm` = περιμετρικό στεφάνι όλου του
 * τοιχώματος· τα `extraStirrupPathsMm` = τα δύο boundary hoops. Οι κατακόρυφες ράβδοι
 * (boundary + web) μπαίνουν όλες στο `longitudinalBarsMm`. LOCAL mm (centroid-centered).
 *
 * Η γεωμετρία βασίζεται στο bbox + `wallAxis` του inset περιγράμματος (ορθογωνικό
 * μοντέλο — ακριβές για shear-wall/επίμηκες ορθογώνιο· προσέγγιση στα άκρα Γ/Τ/Π).
 * Pure.
 *
 * @see ./column-section-outline.ts
 * @see ./column-rebar-layout.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnReinforcement, WallReinforcementIntent } from './column-reinforcement-types';
import {
  buildRoundedStirrupPath,
  closedPolylineLengthMm,
  STIRRUP_BEND_ARC_SEGMENTS,
  STIRRUP_BEND_CL_FACTOR,
  type ColumnRebarLayout,
} from './column-rebar-layout';
import { insetOutlineMm } from './column-perimeter-layout';
import type { ColumnReinforcementSection } from './column-section-outline';

/** (u κατά τον άξονα μήκους, v εγκάρσια) → LOCAL XY με βάση τον `axis` (μοναδιαίο). */
function uvToXY(u: number, v: number, axis: Point2D): Point2D {
  const px = -axis.y; // perp (CCW)
  const py = axis.x;
  return { x: axis.x * u + px * v, y: axis.y * u + py * v };
}

/** Default οπλισμός τοιχώματος όταν λείπει το `r.wall` (παράγωγο από longitudinal/stirrups). */
function deriveWallIntent(r: ColumnReinforcement): WallReinforcementIntent {
  return {
    boundary: { diameterMm: r.longitudinal.diameterMm, count: Math.max(4, r.longitudinal.count) },
    boundaryTieSpacingMm: r.stirrups.spacingCriticalMm ?? r.stirrups.spacingMm,
    webVertical: { ...r.stirrups, spacingMm: Math.max(150, r.stirrups.spacingMm) },
    webHorizontal: { ...r.stirrups },
  };
}

/** Κατακόρυφες ράβδοι μιας κρυφοκολώνας: `count` σε 2 παρειές (v=±Tbar) κατά μήκος `lc`. */
function boundaryBars(endSignU: number, innerHalfLen: number, lcBar: number, tBar: number, count: number, axis: Point2D): Point2D[] {
  const uEnd = endSignU * innerHalfLen;
  const uStart = endSignU * (innerHalfLen - lcBar);
  const cols = Math.max(1, Math.ceil(count / 2));
  const bars: Point2D[] = [];
  let placed = 0;
  for (let c = 0; c < cols && placed < count; c++) {
    const t = cols === 1 ? 0 : c / (cols - 1);
    const u = uStart + (uEnd - uStart) * t;
    bars.push(uvToXY(u, tBar, axis)); placed++;
    if (placed < count) { bars.push(uvToXY(u, -tBar, axis)); placed++; }
  }
  return bars;
}

/** Κατανεμημένες κατακόρυφες κορμού στις 2 παρειές μεταξύ των κρυφοκολωνών. */
function webBars(innerHalfLen: number, lcBar: number, tBar: number, spacingMm: number, axis: Point2D): Point2D[] {
  const webHalf = Math.max(0, innerHalfLen - lcBar);
  const span = 2 * webHalf;
  if (span <= 0 || spacingMm <= 0) return [];
  const n = Math.max(0, Math.floor(span / spacingMm) - 1); // interior μόνο (άκρα = boundary)
  const bars: Point2D[] = [];
  for (let i = 1; i <= n; i++) {
    const u = -webHalf + (span * i) / (n + 1);
    bars.push(uvToXY(u, tBar, axis), uvToXY(u, -tBar, axis));
  }
  return bars;
}

/** Ορθογώνιο boundary hoop (4 κορυφές, στρογγυλεμένο) σε ζώνη άκρου. */
function boundaryHoop(endSignU: number, halfLen: number, lc: number, tStir: number, dbw: number, axis: Point2D): Point2D[] {
  const uOuter = endSignU * halfLen;
  const uInner = endSignU * (halfLen - lc);
  const corners = [
    uvToXY(uInner, -tStir, axis),
    uvToXY(uOuter, -tStir, axis),
    uvToXY(uOuter, tStir, axis),
    uvToXY(uInner, tStir, axis),
  ];
  const minEdge = Math.min(lc, 2 * tStir);
  return buildRoundedStirrupPath(corners, Math.min(STIRRUP_BEND_CL_FACTOR * dbw, minEdge / 2), STIRRUP_BEND_ARC_SEGMENTS);
}

/**
 * Διάταξη οπλισμού τοιχώματος. Επιστρέφει `null` αν το inset καταρρέει ή η διατομή
 * είναι εκφυλισμένη.
 */
export function buildWallLayout(
  r: ColumnReinforcement,
  section: ColumnReinforcementSection,
): ColumnRebarLayout | null {
  const axis = section.wallAxis ?? { x: 1, y: 0 };
  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);
  const wall = r.wall ?? deriveWallIntent(r);

  const lw = section.maxDimensionMm; // μήκος τοιχώματος
  const bw = section.minThicknessMm; // πάχος
  const stirInset = cover + dbw / 2;
  const barInset = cover + dbw + dbL / 2;
  const halfLenStir = lw / 2 - stirInset;
  const halfLenBar = lw / 2 - barInset;
  const tStir = Math.max(0, bw / 2 - stirInset);
  const tBar = Math.max(0, bw / 2 - barInset);
  if (halfLenStir <= 0 || tStir <= 0) return null;

  // EC8 §5.4.3.4.2(6): lc ≥ max(0.15·lw, 1.5·bw)· clamp ≤ 40% του μήκους.
  const lc = Math.min(Math.max(0.15 * lw, 1.5 * bw), 0.4 * lw);
  const lcBar = Math.min(lc, 2 * halfLenBar);

  const web = webBars(halfLenBar, lcBar, tBar, wall.webVertical.spacingMm, axis);
  const longitudinalBarsMm: Point2D[] = [
    ...boundaryBars(+1, halfLenBar, lcBar, tBar, wall.boundary.count, axis),
    ...boundaryBars(-1, halfLenBar, lcBar, tBar, wall.boundary.count, axis),
    ...web,
  ];
  // Web cross-ties: το `webBars` βάζει διαδοχικά (+παρειά, −παρειά) ανά θέση u → ζεύγη.
  const crossTieAnchorsMm: { a: Point2D; b: Point2D }[] = [];
  for (let i = 0; i + 1 < web.length; i += 2) {
    crossTieAnchorsMm.push({ a: web[i], b: web[i + 1] });
  }

  // Κύριο περιμετρικό στεφάνι = inset outline (rounded). Fallback σε bbox rect.
  const ring = insetOutlineMm(section.outlineMm, stirInset);
  const stirrupRingMm = ring && ring.length >= 3
    ? ring
    : [uvToXY(-halfLenStir, -tStir, axis), uvToXY(halfLenStir, -tStir, axis), uvToXY(halfLenStir, tStir, axis), uvToXY(-halfLenStir, tStir, axis)];
  const stirrupCornerRadiusMm = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, tStir);
  const stirrupPathMm = buildRoundedStirrupPath(stirrupRingMm, stirrupCornerRadiusMm, STIRRUP_BEND_ARC_SEGMENTS);

  const extraStirrupPathsMm = [
    boundaryHoop(+1, halfLenStir, lc, tStir, dbw, axis),
    boundaryHoop(-1, halfLenStir, lc, tStir, dbw, axis),
  ];

  return {
    longitudinalBarsMm,
    stirrupRingMm,
    stirrupPathMm,
    stirrupCornerRadiusMm,
    stirrupHookEndsMm: [],
    barDiameterMm: dbL,
    stirrupDiameterMm: dbw,
    stirrupCenterlineLengthMm: closedPolylineLengthMm(stirrupPathMm),
    extraStirrupPathsMm,
    crossTieAnchorsMm,
  };
}
