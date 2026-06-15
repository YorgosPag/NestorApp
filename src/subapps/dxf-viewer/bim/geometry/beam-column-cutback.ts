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
import { safeDifference } from './shared/safe-polygon-boolean';
import { multiPolygonArea } from './shared/polygon-utils';
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
