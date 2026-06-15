/**
 * ADR-458 — Beam-to-column **cutback** (Revit join-geometry, «η κολόνα νικάει»).
 *
 * Όταν ένα δοκάρι τέμνει μια κολόνα, ο πυρήνας του δοκαριού δεν πρέπει να μπαίνει
 * ΜΕΣΑ στο σώμα της κολόνας (διπλο-μετρημένος όγκος + βρώμικη γεωμετρία). Όπως οι
 * «μεγάλοι» (Revit «Join Geometry» με priority στήλες > δοκάρια): **η κολόνα νικάει,
 * το δοκάρι κόβεται στην παρειά της** (net volume — η επικάλυψη μετριέται ΜΙΑ φορά,
 * ανήκει στην κολόνα).
 *
 * **Αρχή — DERIVED, ΠΟΤΕ persisted:** τα structural params (width/depth/axis) είναι το
 * immutable SSoT· το trimmed outline υπολογίζεται on-the-fly από τα persisted params +
 * τα live column footprints (ίδια σύμβαση με τον σοβά ADR-449 + το foundation net-volume
 * ADR-441 Slice 4). Έτσι μετακίνηση/περιστροφή/διαγραφή κολόνας → re-derive, μηδέν stale
 * persisted γεωμετρία.
 *
 * Pure + unit-testable· καμία γνώση σκηνής/three.js/React. Ρέει σε 2Δ κάτοψη + 3Δ + BOQ
 * (ένα SSoT, τρεις consumers).
 *
 * SSoT reuse (N.0.2): `safeDifference` (robust polygon-clipping wrapper) + `multiPolygonArea`
 * (hole-correct net area). Τα column world footprints είναι **ήδη rotated/composite-baked**
 * (`computeColumnGeometry`) → λοξές/σύνθετες κολόνες δουλεύουν χωρίς ειδική μεταχείριση.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-458-beam-column-cutback.md
 * @see bim/geometry/foundation-grid-boq.ts — `foundationStripNetGeometry` (net-volume precedent)
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { Point3D } from '../types/bim-base';
import { safeDifference } from './shared/safe-polygon-boolean';
import { multiPolygonArea, pointInPolygon } from './shared/polygon-utils';
import type { Pt2 } from './shared/segment-polygon-coverage';

/** Σχετικό εμβαδικό όριο: αν αφαιρεθεί λιγότερο από αυτό → «μηδέν τομή» (identity). */
const AREA_EPS_REL = 1e-6;

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function bboxOf(pts: readonly Pt2[]): Bbox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** Polygon → polygon-clipping single-ring `Polygon` (outer ring only). */
function toClipPolygon(pts: readonly Pt2[]): Polygon {
  return [pts.map((p): Pair => [p.x, p.y])];
}

/** |εμβαδόν| ενός απλού polygon (shoelace, canvas units²). */
function ringArea(pts: readonly Pt2[]): number {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/**
 * Φιλτράρει & μετατρέπει τα column footprints σε cutters: μόνο όσα έχουν ≥3 κορυφές
 * ΚΑΙ bbox που επικαλύπτεται με του δοκαριού (cheap reject — η συντριπτική πλειονότητα
 * των κολωνών δεν αγγίζει το δοκάρι → zero-cost fast path).
 */
function collectCutters(beamBbox: Bbox, columnFootprints: readonly (readonly Pt2[])[]): Polygon[] {
  const cutters: Polygon[] = [];
  for (const fp of columnFootprints) {
    if (fp.length < 3) continue;
    if (!bboxOverlap(beamBbox, bboxOf(fp))) continue;
    cutters.push(toClipPolygon(fp));
  }
  return cutters;
}

/**
 * Κόβει το outline ενός δοκαριού στις παρειές των κολωνών που το τέμνουν (column wins).
 *
 * @returns
 *  - `null` → **καμία ουσιαστική τομή** (identity): ο caller χρησιμοποιεί το ΑΡΧΙΚΟ outline
 *    αυτούσιο (byte-for-byte, zero regression — μηδέν polygon-clipping round-trip).
 *  - `Pt2[][]` → τα **outer rings** των κομματιών που απομένουν (ένα κομμάτι = κοίλο
 *    polygon γωνιακής κοπής· ≥2 κομμάτια = κολόνα που χωρίζει το δοκάρι· `[]` = το δοκάρι
 *    καταναλώθηκε ολόκληρο μέσα στην κολόνα → δεν σχεδιάζεται).
 *
 * Σημ.: τα holes (κολόνα ΕΞ ΟΛΟΚΛΗΡΟΥ μέσα στο δοκάρι) απορρίπτονται από το rendered
 * outline (v1)· το **net area** (`computeBeamCutbackNetAreaM2`) τα μετράει σωστά μέσω
 * `multiPolygonArea`. Για τυπικά πλαίσια (κολόνα φαρδύτερη του δοκαριού) δεν προκύπτουν
 * holes. Hole-aware rendering = DEFER.
 */
export function computeBeamCutbackOutline(
  beamOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
): Pt2[][] | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const beamBbox = bboxOf(beamOutline);
  const cutters = collectCutters(beamBbox, columnFootprints);
  if (cutters.length === 0) return null;

  const diff = safeDifference(toClipPolygon(beamOutline), ...cutters);
  const beamArea = ringArea(beamOutline);
  const netArea = multiPolygonArea(diff);
  // Καμία (ή αμελητέα) αφαίρεση → identity. Πιάνει και bbox-overlap-χωρίς-γεωμετρική-τομή.
  if (beamArea <= 0 || netArea >= beamArea * (1 - AREA_EPS_REL)) return null;

  // Outer ring κάθε κομματιού (ring[0]). `[]` όταν το δοκάρι καταναλώθηκε ολόκληρο.
  return diff
    .filter((poly) => poly.length > 0 && poly[0].length >= 3)
    .map((poly) => poly[0].map((pr: Pair): Pt2 => ({ x: pr[0], y: pr[1] })));
}

/**
 * Καθαρό εμβαδόν κάτοψης (m²) του δοκαριού μετά την αφαίρεση των κολωνών (column wins).
 * Ο πολλαπλασιαστής `canvasToM2` = `((1/s) · 0.001)²` (canvas units² → m², ίδιος με το
 * foundation net). `null` → καμία τομή → ο caller κρατά το αρχικό `geometry.area`.
 *
 * Χρήση (B3 BOQ): `netVolumeM3 = netAreaM2 × depthMm × 0.001`.
 */
export function computeBeamCutbackNetAreaM2(
  beamOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
  canvasToM2: number,
): number | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const beamBbox = bboxOf(beamOutline);
  const cutters = collectCutters(beamBbox, columnFootprints);
  if (cutters.length === 0) return null;

  const diff = safeDifference(toClipPolygon(beamOutline), ...cutters);
  const beamArea = ringArea(beamOutline);
  const netArea = multiPolygonArea(diff);
  if (beamArea <= 0 || netArea >= beamArea * (1 - AREA_EPS_REL)) return null;
  return Math.max(0, netArea) * canvasToM2;
}

// ─── Axis-to-column contact (centerline) ────────────────────────────────────

/** Αριθμητικό όριο για μη-εκφυλισμένο t / non-parallel cross product. */
const AXIS_T_EPS = 1e-9;
/**
 * Μέγιστο t για επέκταση άκρου (anti-spurious-extend guard): t≤1.5 → ο άξονας
 * επεκτείνεται το πολύ κατά 50% του μήκους του για να φτάσει σε παρειά κολόνας.
 * Κολόνα που πλαισιώνει άκρο δοκαριού είναι πάντα πολύ πιο κοντά από αυτό.
 */
const AXIS_EXT_CAP = 1.5;

const lerp2 = (a: Pt2, b: Pt2, t: number): Pt2 => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

/**
 * Unclamped παράμετρος `t` κατά μήκος της ευθείας `a→b` (μπορεί <0 ή >1) όπου τέμνει
 * την ακμή `p→q` (κρατάμε μόνο 0≤u≤1, η τομή πέφτει πάνω στην ακμή)· `null` όταν
 * παράλληλες/collinear ή η τομή πέφτει εκτός ακμής.
 */
function lineEdgeT(a: Pt2, b: Pt2, p: Point3D, q: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ex = q.x - p.x;
  const ey = q.y - p.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < AXIS_T_EPS) return null;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const u = (apx * dy - apy * dx) / denom; // κατά μήκος ακμής
  if (u < -AXIS_T_EPS || u > 1 + AXIS_T_EPS) return null;
  return (apx * ey - apy * ex) / denom; // κατά μήκος άξονα (unclamped)
}

/** Όλα τα crossings (unclamped t) της ευθείας `a→b` με τις ακμές ΟΛΩΝ των cutters. */
function allLineCrossings(a: Pt2, b: Pt2, cutters: readonly (readonly Point3D[])[]): number[] {
  const ts: number[] = [];
  for (const poly of cutters) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const t = lineEdgeT(a, b, poly[i], poly[(i + 1) % n]);
      if (t !== null) ts.push(t);
    }
  }
  return ts;
}

/**
 * Νέα παράμετρος `t` του άκρου `b` (t=1) ώστε ο άξονας `a→b` να καταλήγει στην παρειά
 * της κολόνας που πλαισιώνει αυτό το άκρο. `null` → καμία προσαρμογή.
 *  - `b` ΜΕΣΑ σε κολόνα → pull-back στην εσωτερική παρειά (μεγαλύτερο crossing με t<1).
 *  - `b` έξω, κολόνα πιο πέρα → extend στην κοντινή παρειά (μικρότερο crossing με t>1,
 *    εντός `AXIS_EXT_CAP`).
 */
function contactT(a: Pt2, b: Pt2, cutters: readonly (readonly Point3D[])[]): number | null {
  const ts = allLineCrossings(a, b, cutters);
  if (ts.length === 0) return null;
  const bInside = cutters.some((poly) => pointInPolygon(b, poly));
  if (bInside) {
    let best = -Infinity;
    for (const t of ts) if (t < 1 - AXIS_T_EPS && t > best) best = t;
    return best > -Infinity ? best : null;
  }
  let best = Infinity;
  for (const t of ts) if (t > 1 + AXIS_T_EPS && t < best) best = t;
  return best <= AXIS_EXT_CAP ? best : null;
}

/**
 * Προσαρμόζει τα άκρα του straight-beam centerline ώστε όποιο πλαισιώνεται από κολόνα να
 * καταλήγει ΑΚΡΙΒΩΣ στην παρειά της (σημείο επαφής δοκαριού-κολόνας, Revit location-line).
 *
 * DERIVED — ίδια column footprints με το cutback outline· τα footprints είναι ήδη
 * world-rotated/composite-baked (`computeColumnGeometry`) → λοξά/περιστραμμένα δοκάρια
 * δουλεύουν χωρίς ειδική μεταχείριση. Cheap reject: μόνο κολόνες με bbox που επικαλύπτει
 * το beam outline. Split (κολόνα στη ΜΕΣΗ → 2 ελεύθερα άκρα) → κανένα crossing κοντά σε
 * άκρο → identity (DEFER axis-split).
 *
 * @returns `[newStart, newEnd]` ή `null` (καμία προσαρμογή → ο caller κρατά τον αρχικό άξονα).
 */
export function computeBeamAxisToColumnContact(
  axisStart: Pt2,
  axisEnd: Pt2,
  beamOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Point3D[])[],
): [Pt2, Pt2] | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const beamBbox = bboxOf(beamOutline);
  const cutters = columnFootprints.filter((fp) => fp.length >= 3 && bboxOverlap(beamBbox, bboxOf(fp)));
  if (cutters.length === 0) return null;

  // Άκρο end (t=1): a=start,b=end. Άκρο start: συμμετρικά με a=end,b=start.
  const tEnd = contactT(axisStart, axisEnd, cutters);
  const tStart = contactT(axisEnd, axisStart, cutters);
  if (tEnd === null && tStart === null) return null;

  return [
    tStart !== null ? lerp2(axisEnd, axisStart, tStart) : axisStart,
    tEnd !== null ? lerp2(axisStart, axisEnd, tEnd) : axisEnd,
  ];
}
