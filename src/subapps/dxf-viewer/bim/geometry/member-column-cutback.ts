/**
 * ADR-458 — Structural **member ↔ column cutback** (Revit «Join Geometry», «η κολόνα
 * νικάει»). Generic pure SSoT: όταν ένα δομικό μέλος (δοκάρι Ή τοίχος) τέμνει κολόνα, ο
 * πυρήνας του μέλους δεν πρέπει να μπαίνει ΜΕΣΑ στο σώμα της κολόνας (διπλο-μετρημένος
 * όγκος + βρώμικη γεωμετρία). Όπως οι «μεγάλοι»: **η κολόνα νικάει, το μέλος κόβεται
 * στην παρειά της** (net volume — η επικάλυψη μετριέται ΜΙΑ φορά, ανήκει στην κολόνα).
 *
 * **Αρχή — DERIVED, ΠΟΤΕ persisted:** τα structural params (width/thickness/axis) είναι
 * το immutable SSoT· το trimmed outline + το net area υπολογίζονται on-the-fly από τα
 * persisted params + τα live column footprints. Έτσι μετακίνηση/περιστροφή/διαγραφή
 * κολόνας → re-derive, μηδέν stale persisted γεωμετρία.
 *
 * Pure + unit-testable· καμία γνώση σκηνής/three.js/React. Ρέει σε 2Δ κάτοψη + 3Δ + BOQ
 * (ένα SSoT, πολλοί consumers). Τα column world footprints είναι **ήδη rotated/composite-
 * baked** (`computeColumnGeometry`) → λοξές/σύνθετες κολόνες δουλεύουν χωρίς ειδική
 * μεταχείριση.
 *
 * SSoT reuse (N.0.2): `safeDifference` (robust polygon-clipping wrapper) + `multiPolygonArea`
 * (hole-correct net area).
 *
 * @see bim/geometry/beam-column-cutback.ts — beam-specific axis/framing helpers + aliases
 * @see docs/centralized-systems/reference/adrs/ADR-458-beam-column-cutback.md
 */

import type { Pair, Polygon } from 'polygon-clipping';
import { safeDifference } from './shared/safe-polygon-boolean';
import { multiPolygonArea } from './shared/polygon-utils';
import type { Pt2 } from './shared/segment-polygon-coverage';

/** Σχετικό εμβαδικό όριο: αν αφαιρεθεί λιγότερο από αυτό → «μηδέν τομή» (identity). */
export const AREA_EPS_REL = 1e-6;

export interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function bboxOf(pts: readonly Pt2[]): Bbox {
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

export function bboxOverlap(a: Bbox, b: Bbox): boolean {
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
 * ΚΑΙ bbox που επικαλύπτεται με του μέλους (cheap reject — η συντριπτική πλειονότητα
 * των κολωνών δεν αγγίζει το μέλος → zero-cost fast path).
 */
function collectCutters(memberBbox: Bbox, columnFootprints: readonly (readonly Pt2[])[]): Polygon[] {
  const cutters: Polygon[] = [];
  for (const fp of columnFootprints) {
    if (fp.length < 3) continue;
    if (!bboxOverlap(memberBbox, bboxOf(fp))) continue;
    cutters.push(toClipPolygon(fp));
  }
  return cutters;
}

/**
 * Κόβει το outline ενός δομικού μέλους στις παρειές των κολωνών που το τέμνουν (column wins).
 *
 * @returns
 *  - `null` → **καμία ουσιαστική τομή** (identity): ο caller χρησιμοποιεί το ΑΡΧΙΚΟ outline
 *    αυτούσιο (byte-for-byte, zero regression — μηδέν polygon-clipping round-trip).
 *  - `Pt2[][]` → τα **outer rings** των κομματιών που απομένουν (ένα κομμάτι = κοίλο
 *    polygon γωνιακής κοπής· ≥2 κομμάτια = κολόνα που χωρίζει το μέλος· `[]` = το μέλος
 *    καταναλώθηκε ολόκληρο μέσα στην κολόνα → δεν σχεδιάζεται).
 *
 * Σημ.: τα holes (κολόνα ΕΞ ΟΛΟΚΛΗΡΟΥ μέσα στο μέλος) απορρίπτονται από το rendered
 * outline (v1)· το **net area** (`computeMemberCutbackNetAreaM2`) τα μετράει σωστά μέσω
 * `multiPolygonArea`. Hole-aware rendering = DEFER.
 */
export function computeMemberCutbackOutline(
  memberOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
): Pt2[][] | null {
  if (memberOutline.length < 3 || columnFootprints.length === 0) return null;
  const memberBbox = bboxOf(memberOutline);
  const cutters = collectCutters(memberBbox, columnFootprints);
  if (cutters.length === 0) return null;

  const diff = safeDifference(toClipPolygon(memberOutline), ...cutters);
  const grossArea = ringArea(memberOutline);
  const netArea = multiPolygonArea(diff);
  // Καμία (ή αμελητέα) αφαίρεση → identity. Πιάνει και bbox-overlap-χωρίς-γεωμετρική-τομή.
  if (grossArea <= 0 || netArea >= grossArea * (1 - AREA_EPS_REL)) return null;

  // Outer ring κάθε κομματιού (ring[0]). `[]` όταν το μέλος καταναλώθηκε ολόκληρο.
  return diff
    .filter((poly) => poly.length > 0 && poly[0].length >= 3)
    .map((poly) => poly[0].map((pr: Pair): Pt2 => ({ x: pr[0], y: pr[1] })));
}

/**
 * Καθαρό εμβαδόν κάτοψης (m²) του μέλους μετά την αφαίρεση των κολωνών (column wins).
 * Ο πολλαπλασιαστής `canvasToM2` = `((1/s) · 0.001)²` (canvas units² → m²).
 * `null` → καμία τομή → ο caller κρατά το αρχικό `geometry.area`.
 *
 * Χρήση (BOQ): `netVolumeM3 = netAreaM2 × depthMm × 0.001`.
 */
export function computeMemberCutbackNetAreaM2(
  memberOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
  canvasToM2: number,
): number | null {
  if (memberOutline.length < 3 || columnFootprints.length === 0) return null;
  const memberBbox = bboxOf(memberOutline);
  const cutters = collectCutters(memberBbox, columnFootprints);
  if (cutters.length === 0) return null;

  const diff = safeDifference(toClipPolygon(memberOutline), ...cutters);
  const grossArea = ringArea(memberOutline);
  const netArea = multiPolygonArea(diff);
  if (grossArea <= 0 || netArea >= grossArea * (1 - AREA_EPS_REL)) return null;
  return Math.max(0, netArea) * canvasToM2;
}

/**
 * Λόγος διατήρησης πλάτους κάτοψης (net/gross ∈ (0,1]) του μέλους μετά την αφαίρεση των
 * κολωνών. **Unit-independent** (canvas²/canvas²) → ο caller τον εφαρμόζει σε ΟΠΟΙΑΔΗΠΟΤΕ
 * derived ποσότητα (π.χ. face area/volume τοίχου μετά τα openings) χωρίς μετατροπή μονάδων
 * — συνθέτει καθαρά με προϋπάρχοντα net (openings/attached profiles).
 *
 * @returns
 *  - `null` → καμία ουσιαστική τομή (identity — ο caller κρατά gross αυτούσιο).
 *  - `number` ∈ (0,1] → κλάσμα του footprint που ΑΠΟΜΕΝΕΙ (1 = ανέγγιχτο, 0 = πλήρης κατανάλωση).
 */
export function computeMemberCutbackRetentionRatio(
  memberOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
): number | null {
  if (memberOutline.length < 3 || columnFootprints.length === 0) return null;
  const memberBbox = bboxOf(memberOutline);
  const cutters = collectCutters(memberBbox, columnFootprints);
  if (cutters.length === 0) return null;

  const diff = safeDifference(toClipPolygon(memberOutline), ...cutters);
  const grossArea = ringArea(memberOutline);
  const netArea = multiPolygonArea(diff);
  if (grossArea <= 0 || netArea >= grossArea * (1 - AREA_EPS_REL)) return null;
  return Math.max(0, Math.min(1, netArea / grossArea));
}
