/**
 * DXF HATCH BOUNDARY PATH PARSER — SSoT (ADR-507)
 *
 * Μετατρέπει τα boundary path data ενός HATCH σε flat πολύγωνα (`Point2D[][]`).
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ — δύο σφάλματα που έζησαν μαζί στον `convertHatch`:
 *
 * 1. **Ο κωδικός `93` έχει ΔΥΟ σημασίες**, και τις ξεχωρίζει ΜΟΝΟ το flag `92`:
 *    - `92 & 2` (**polyline** path) → `93` = πλήθος **ΚΟΡΥΦΩΝ**
 *    - αλλιώς (**edge-based** path) → `93` = πλήθος **ΑΚΜΩΝ**
 *    Ο παλιός κώδικας διάβαζε πάντα «κορυφές» και **δεν κοίταζε καθόλου το `92`**. Δούλευε
 *    **κατά τύχη** για path από σκέτες γραμμές (`72=1`), όπου κάθε ακμή δίνει ακριβώς ένα
 *    `10/20` ⇒ πλήθος ακμών == πλήθος κορυφών.
 *
 * 2. **Το `10/20` ΔΕΝ είναι πάντα κορυφή.** Σε ακμή τόξου (`72=2`) είναι το **ΚΕΝΤΡΟ** του
 *    τόξου — σημείο που συνήθως βρίσκεται **εκτός** του ορίου. Ο παλιός κώδικας το έσπρωχνε
 *    στο πολύγωνο ως κορυφή ⇒ όχι απλώς «κομμένη καμπύλη», αλλά **ξένη κορυφή** που
 *    παραμορφώνει το σχήμα και το clipping της γραμμοσκίασης.
 *
 * Καμία νέα γεωμετρία δεν γράφεται εδώ: η δειγματοληψία γίνεται αποκλειστικά από τα
 * υπάρχοντα SSoT — {@link expandPolyline} (bulges), {@link tessellateArcDegrees} (τόξα),
 * {@link tessellateEllipseArc} (ελλείψεις), {@link tessellateSplinePoints} (splines).
 *
 * @see AutoCAD DXF Reference — HATCH: boundary path data (codes 91/92/93/72/…)
 */

import type { Point2D } from '../rendering/types/Types';
import { expandPolyline } from '../rendering/entities/shared/geometry-bulge-utils';
import { tessellateArcDegrees } from '../rendering/entities/shared/geometry-arc-utils';
import {
  tessellateEllipseArc,
  ellipseArcSegments,
  type EllipseArcSpec,
} from '../rendering/entities/shared/geometry-ellipse-utils';
import { tessellateSplinePoints } from '../rendering/entities/shared/geometry-spline-utils';

/** Ordered DXF group-code pairs (τα boundary loops έχουν επαναλαμβανόμενα 10/20 — flat Record τα χάνει). */
export type DxfPairs = ReadonlyArray<readonly [string, string]>;

/** `92` bit 1 ⇒ το path είναι POLYLINE (αλλιώς: λίστα ακμών). */
const PATH_FLAG_POLYLINE = 2;

/** Ανάλυση δειγματοληψίας τόξου — 12° ανά τμήμα, ίδιο με το `expandPolyline` default. */
const ARC_MAX_SEG_DEG = 12;

/** Κωδικοί που ΤΕΡΜΑΤΙΖΟΥΝ ένα boundary path (νέο path ή η ενότητα seed points). */
const PATH_TERMINATORS = new Set(['92', '98']);

type EdgeType = '1' | '2' | '3' | '4';

/** Τιμή του πρώτου `code` στο διάστημα `[from, to)`, ή `undefined`. */
function firstValue(pairs: DxfPairs, from: number, to: number, code: string): string | undefined {
  for (let i = from; i < to; i += 1) if (pairs[i][0] === code) return pairs[i][1];
  return undefined;
}

/** Αριθμητική ανάγνωση του πρώτου `code` στο διάστημα, με fallback. */
function firstNumber(pairs: DxfPairs, from: number, to: number, code: string, fallback: number): number {
  const raw = firstValue(pairs, from, to, code);
  if (raw === undefined) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Όλα τα `(xCode, yCode)` ζεύγη σημείων στο διάστημα, με τη σειρά τους. */
function collectPoints(pairs: DxfPairs, from: number, to: number, xCode: string, yCode: string): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = from; i < to - 1; i += 1) {
    if (pairs[i][0] !== xCode || pairs[i + 1][0] !== yCode) continue;
    const x = parseFloat(pairs[i][1]);
    const y = parseFloat(pairs[i + 1][1]);
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    i += 1;
  }
  return pts;
}

/** Ανοχή για «η γωνία σάρωσης είναι πλήρης στροφή» (μοίρες). */
const FULL_TURN_EPS = 1e-6;

/**
 * Πλήρης κύκλος ως όριο — **η συνηθέστερη περίπτωση** στο πραγματικό αρχείο (`50=0, 51=360`).
 *
 * ⚠️ ΔΕΝ περνάει από μία κλήση του {@link tessellateArcDegrees}: εκείνο κανονικοποιεί το
 * σάρωμα στο `[0, 2π)`, οπότε `360° → 0°` ⇒ **μηδενικό sweep** ⇒ όλα τα σημεία ταυτίζονται
 * ⇒ το path καταρρέει σε ένα σημείο και απορρίπτεται. Το σπάμε σε **δύο ημικύκλια** μέσω
 * του ΙΔΙΟΥ SSoT — καμία νέα τριγωνομετρία εδώ.
 */
function sampleFullCircle(center: Point2D, radius: number): Point2D[] {
  const half = Math.max(2, Math.ceil(180 / ARC_MAX_SEG_DEG));
  const first = tessellateArcDegrees({ center, radius, startAngle: 0, endAngle: 180 }, half);
  const second = tessellateArcDegrees({ center, radius, startAngle: 180, endAngle: 360 }, half);
  // `slice(1, -1)`: κόψε τη διπλή κορυφή στις 180° και το κλείσιμο στις 360° (≡ 0°).
  return [...first, ...second.slice(1, -1)];
}

/** Ακμή τόξου (`72=2`): `10/20` κέντρο · `40` ακτίνα · `50/51` γωνίες (μοίρες) · `73` CCW. */
function sampleArcEdge(pairs: DxfPairs, from: number, to: number): Point2D[] {
  const [center] = collectPoints(pairs, from, to, '10', '20');
  const radius = firstNumber(pairs, from, to, '40', 0);
  if (!center || !(radius > 0)) return [];

  const startAngle = firstNumber(pairs, from, to, '50', 0);
  const endAngle = firstNumber(pairs, from, to, '51', 360);
  const sweepDeg = Math.abs(endAngle - startAngle);
  if (sweepDeg >= 360 - FULL_TURN_EPS || sweepDeg < FULL_TURN_EPS) {
    return sampleFullCircle(center, radius);
  }

  // ⚠️ ΑΝΤΙΣΤΡΟΦΗ ΣΚΟΠΙΜΗ: το `counterclockwise` του SSoT είναι σημασιολογία **ΟΘΟΝΗΣ**
  // (κάνει swap επειδή ο `ArcRenderer` ζωγραφίζει με Y-flip). Το `73` του DXF είναι φορά
  // σε **WORLD**. Εδώ παράγουμε world γεωμετρία ⇒ περνάμε το ΑΝΤΙΣΤΡΟΦΟ flag, αλλιώς το
  // τόξο διατρέχει τη ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ πλευρά και το όριο βγαίνει καθρέφτης.
  const ccwWorld = firstValue(pairs, from, to, '73') !== '0';
  const segments = Math.max(2, Math.ceil(sweepDeg / ARC_MAX_SEG_DEG));
  return tessellateArcDegrees(
    { center, radius, startAngle, endAngle, counterclockwise: !ccwWorld },
    segments,
  );
}

/**
 * Ακμή έλλειψης (`72=3`): `10/20` κέντρο · `11/21` άκρο μεγάλου ημιάξονα **ως προς το κέντρο**
 * (⇒ δίνει ΚΑΙ το μήκος ΚΑΙ τη στροφή) · `40` λόγος μικρού/μεγάλου · `50/51` γωνίες (μοίρες).
 */
function sampleEllipseEdge(pairs: DxfPairs, from: number, to: number): Point2D[] {
  const pts = collectPoints(pairs, from, to, '10', '20');
  const majorEnd = collectPoints(pairs, from, to, '11', '21')[0];
  const center = pts[0];
  if (!center || !majorEnd) return [];

  const majorAxis = Math.hypot(majorEnd.x, majorEnd.y);
  if (!(majorAxis > 0)) return [];
  const ratio = firstNumber(pairs, from, to, '40', 1);
  const rotation = (Math.atan2(majorEnd.y, majorEnd.x) * 180) / Math.PI;
  const startParam = (firstNumber(pairs, from, to, '50', 0) * Math.PI) / 180;
  const endParam = (firstNumber(pairs, from, to, '51', 360) * Math.PI) / 180;

  const spec: EllipseArcSpec = {
    center,
    majorAxis,
    minorAxis: majorAxis * Math.abs(ratio),
    rotation,
    startParam,
    endParam,
  };
  return tessellateEllipseArc(spec, ellipseArcSegments(startParam, endParam));
}

/**
 * Ακμή spline (`72=4`): τα `10/20` **μέσα στην ακμή** είναι τα control points (τα fit points
 * είναι `11/21`, γι' αυτό δεν τα μπερδεύουμε). `73` = rational, `74` = periodic/closed.
 */
function sampleSplineEdge(pairs: DxfPairs, from: number, to: number): Point2D[] {
  const controlPoints = collectPoints(pairs, from, to, '10', '20');
  if (controlPoints.length < 2) return [];
  const closed = firstValue(pairs, from, to, '74') === '1';
  return tessellateSplinePoints(controlPoints, closed);
}

/** Δειγματοληψία μίας ακμής ανάλογα με τον τύπο της (`72`). */
function sampleEdge(edgeType: EdgeType, pairs: DxfPairs, from: number, to: number): Point2D[] {
  switch (edgeType) {
    // Γραμμή: `10/20` αρχή, `11/21` τέλος. Κρατάμε ΚΑΙ τα δύο — το τέλος της τελευταίας
    // ακμής είναι κορυφή που κανένα επόμενο `10/20` δεν θα δώσει (ανοιχτά paths).
    case '1': return [...collectPoints(pairs, from, to, '10', '20'), ...collectPoints(pairs, from, to, '11', '21')];
    case '2': return sampleArcEdge(pairs, from, to);
    case '3': return sampleEllipseEdge(pairs, from, to);
    case '4': return sampleSplineEdge(pairs, from, to);
    default: return [];
  }
}

/** Θέση του τέλους του τρέχοντος path (πρώτος terminator μετά το `from`). */
function findPathEnd(pairs: DxfPairs, from: number): number {
  for (let i = from; i < pairs.length; i += 1) if (PATH_TERMINATORS.has(pairs[i][0])) return i;
  return pairs.length;
}

/** POLYLINE path: `72` has-bulge · `73` closed · `93` πλήθος ΚΟΡΥΦΩΝ · `10/20` [+ `42` bulge]. */
function parsePolylinePath(pairs: DxfPairs, from: number, to: number): Point2D[] {
  const vertices = collectPoints(pairs, from, to, '10', '20');
  if (vertices.length < 2) return [];
  const closed = firstValue(pairs, from, to, '73') === '1';
  const hasBulge = firstValue(pairs, from, to, '72') === '1';
  if (!hasBulge) return vertices;

  // Τα `42` είναι index-aligned με τις κορυφές· όσα λείπουν = ευθύγραμμα τμήματα.
  const bulges: number[] = [];
  for (let i = from; i < to; i += 1) {
    if (pairs[i][0] === '42') bulges.push(parseFloat(pairs[i][1]) || 0);
  }
  while (bulges.length < vertices.length) bulges.push(0);
  return expandPolyline(vertices, bulges, closed, ARC_MAX_SEG_DEG);
}

/** EDGE-BASED path: `93` πλήθος ΑΚΜΩΝ · ανά ακμή `72` = τύπος + τα δεδομένα του τύπου. */
function parseEdgePath(pairs: DxfPairs, from: number, to: number, edgeCount: number): Point2D[] {
  // Θέσεις όλων των `72` (κάθε ένα ανοίγει μία ακμή) — το όριο κάθε ακμής είναι το επόμενο `72`.
  const edgeStarts: number[] = [];
  for (let i = from; i < to && edgeStarts.length < edgeCount; i += 1) {
    if (pairs[i][0] === '72') edgeStarts.push(i);
  }

  const out: Point2D[] = [];
  for (let e = 0; e < edgeStarts.length; e += 1) {
    const start = edgeStarts[e];
    const end = e + 1 < edgeStarts.length ? edgeStarts[e + 1] : to;
    const edgeType = pairs[start][1].trim() as EdgeType;
    for (const pt of sampleEdge(edgeType, pairs, start, end)) {
      // Οι διαδοχικές ακμές μοιράζονται κορυφή — μην τη γράψεις δύο φορές.
      const prev = out[out.length - 1];
      if (prev && prev.x === pt.x && prev.y === pt.y) continue;
      out.push(pt);
    }
  }
  return out;
}

/**
 * Διαβάζει ΟΛΑ τα boundary paths ενός HATCH ξεκινώντας από τη θέση του κωδικού `91`.
 *
 * @param pairs      Ordered group-code pairs της οντότητας
 * @param path91Index Θέση του `91` (πλήθος ορίων) μέσα στα `pairs`
 * @returns Flat πολύγωνα σε world coords· paths με < 3 κορυφές απορρίπτονται
 */
export function parseHatchBoundaryPaths(pairs: DxfPairs, path91Index: number): Point2D[][] {
  const nPaths = parseInt(pairs[path91Index]?.[1] ?? '0', 10) || 0;
  const boundaryPaths: Point2D[][] = [];
  let k = path91Index + 1;

  for (let p = 0; p < nPaths && k < pairs.length; p += 1) {
    while (k < pairs.length && pairs[k][0] !== '92') k += 1; // αρχή path
    if (k >= pairs.length) break;

    const flag = parseInt(pairs[k][1], 10) || 0;
    const pathEnd = findPathEnd(pairs, k + 1);

    // `93` = ΚΟΡΥΦΕΣ αν polyline, ΑΚΜΕΣ αλλιώς. Η διάκριση γίνεται ΜΟΝΟ από το `92`.
    const count = Math.trunc(firstNumber(pairs, k + 1, pathEnd, '93', 0));
    const verts = (flag & PATH_FLAG_POLYLINE)
      ? parsePolylinePath(pairs, k + 1, pathEnd)
      : parseEdgePath(pairs, k + 1, pathEnd, count);

    // Το συμβόλαιο του `boundaryPaths` σε όλο το repo είναι **IMPLICIT CLOSING**: ένα τρίγωνο
    // είναι 3 κορυφές, όχι 4. Οι ακμές δίνουν ρητά το τελικό σημείο (`11/21`), οπότε κόβουμε
    // την επανάληψη — αλλιώς κάθε καταναλωτής θα έβλεπε μια μηδενικού μήκους πλευρά.
    if (verts.length >= 2) {
      const first = verts[0];
      const last = verts[verts.length - 1];
      if (first.x === last.x && first.y === last.y) verts.pop();
    }

    if (verts.length >= 3) boundaryPaths.push(verts);
    k = pathEnd;
  }

  return boundaryPaths;
}
