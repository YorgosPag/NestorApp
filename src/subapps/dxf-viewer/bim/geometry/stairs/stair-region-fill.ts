/**
 * ADR-619 v2 — «Σκάλα από περιοχή»: ΣΕΙΡΙΑΚΟ γέμισμα walkline με πατήματα + πλατύσκαλα.
 *
 * Παίρνει τη ΣΥΝΕΧΗ walkline (ευθείες = κλάδοι, τόξα = στροφές) και «γεμίζει» τη
 * σκάλα Revit-style, ΣΕΙΡΙΑΚΑ από τη βάση:
 *   - `line` segment (κλάδος)  → πατήματα σταθερού `going` (z ανεβαίνει `rise`/πάτημα).
 *   - `arc` segment (στροφή)   → ΕΠΙΠΕΔΟ πλατύσκαλο (z σταθερό — μηδέν rise στο τόξο).
 *   - Το leftover ενός κλάδου (< going, πριν τη στροφή) → μικρό επίπεδο πλατύσκαλο.
 * Σταματά μόλις τοποθετηθούν ΟΛΑ τα `nGoings` πατήματα (το υπόλοιπο μήκος διαδρόμου
 * μένει αχρησιμοποίητο — η σκάλα έφτασε τον πάνω όροφο). Έτσι τα πατήματα ΑΠΛΩΝΟΝΤΑΙ
 * σε πολλούς κλάδους (αντί να στριμώχνονται στον 1ο) και οι στροφές γίνονται πλατύσκαλα.
 *
 * Το αποτέλεσμα είναι `Point3D[]` με ΡΗΤΟ z ανά σημείο (μεικτά z: ανοδικά πατήματα +
 * επίπεδα πλατύσκαλα). Καταναλώνεται από το sketch variant με `preserveZ` ώστε το
 * `computeSketch` να ΜΗΝ επιβάλει uniform rise — το `computeWalklineStair` διαβάζει το
 * z από κάθε σημείο (SSoT `buildWalklineTreads`, γρ. `z = walkline[i].z`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 * @see ./stair-geometry-generators.ts (buildWalklineTreads — z ανά σημείο)
 */

import type { Point3D } from '../../../rendering/types/Types';
import {
  type WalklineSegment,
  pointOnWalklineSegment,
  walklineSegmentLength,
} from './stair-region-walkline';

/** Άθροισμα μηκών ΜΟΝΟ των ευθύγραμμων τμημάτων (κλάδοι) — τα τόξα δεν φέρουν πατήματα. */
export function flightLength(segments: readonly WalklineSegment[]): number {
  let total = 0;
  for (const s of segments) if (s.type === 'line') total += walklineSegmentLength(s);
  return total;
}

/**
 * Κατανέμει ΑΚΡΙΒΩΣ `total` πατήματα στους κλάδους μήκους `lengths` (largest-remainder,
 * ανάλογα με το μήκος· άθροισμα == total). Χρήση στη ΣΥΜΠΙΕΣΜΕΝΗ περίπτωση (κλάδοι πιο
 * κοντοί απ' όσο χρειάζεται) ώστε ΚΑΘΕ ρίχτι να τοποθετηθεί (η σκάλα φτάνει τον όροφο).
 */
function distributeTreads(lengths: readonly number[], total: number): number[] {
  const sum = lengths.reduce((a, b) => a + b, 0);
  if (sum <= 0 || lengths.length === 0) return lengths.map(() => 0);
  const raw = lengths.map((l) => (l / sum) * total);
  const base = raw.map((r) => Math.floor(r));
  let remaining = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) base[order[k].i] += 1;
  return base;
}

/**
 * Χτίζει τη σειριακά-γεμισμένη διαδρομή (πατήματα στους κλάδους, πλατύσκαλα στις
 * στροφές). Επιστρέφει `Point3D[]` (μήκους = τοποθετημένα βήματα + 1) με ρητό z.
 *
 * @param segments  συνεχής walkline (line/arc) από τη βάση προς κορυφή
 * @param going     βήμα πατήματος (scene units)
 * @param rise      ύψος ρίχτι ανά πάτημα (scene units)
 * @param nGoings   συνολικά πατήματα προς τοποθέτηση (από ύψος ορόφου)
 * @param baseZ     z βάσης
 */
export function buildSerialFillWalklinePath(
  segments: readonly WalklineSegment[],
  going: number,
  rise: number,
  nGoings: number,
  baseZ: number,
): Point3D[] {
  const eps = Math.max(1e-6, going * 1e-6);
  const path: Point3D[] = [];
  if (segments.length === 0 || nGoings <= 0) return path;

  const start = pointOnWalklineSegment(segments[0], 0);
  path.push({ x: start.x, y: start.y, z: baseZ });

  // Μήκη ανά segment (0 στα τόξα). Χωρητικότητα κλάδων σε πατήματα σταθερού `going`.
  const segLens = segments.map((s) => (s.type === 'line' ? walklineSegmentLength(s) : 0));
  const capacity = segLens.reduce((a, l) => a + Math.floor(l / going + eps), 0);
  // ΣΥΜΠΙΕΣΜΕΝΟ: οι κλάδοι δεν χωρούν όλα τα πατήματα με going 280 → ακριβής κατανομή
  // ανά κλάδο (κάθε ρίχτι τοποθετείται, φτάνει ο όροφος). Αλλιώς: σταθερό going, το
  // πλεόνασμα κάθε κλάδου γίνεται πλατύσκαλο, σειριακά από τη βάση.
  const compressed = capacity < nGoings;
  const perFlight = compressed ? distributeTreads(segLens, nGoings) : null;

  let z = baseZ;
  let placed = 0;

  for (let si = 0; si < segments.length; si++) {
    if (placed >= nGoings) break; // όλα τα ρίχτια μπήκαν → σταμάτα (η σκάλα έφτασε πάνω)
    const seg = segments[si];
    const segLen = segLens[si] || walklineSegmentLength(seg);
    if (segLen <= eps) continue;

    if (seg.type === 'line') {
      const target = compressed ? (perFlight?.[si] ?? 0) : nGoings - placed;
      const goingHere = compressed && target > 0 ? segLen / target : going;
      let local = 0;
      let here = 0;
      while (placed < nGoings && here < target && local + goingHere <= segLen + eps) {
        local += goingHere;
        z += rise;
        placed += 1;
        here += 1;
        const p = pointOnWalklineSegment(seg, Math.min(local, segLen));
        path.push({ x: p.x, y: p.y, z });
      }
      // Leftover κλάδου (πριν την επόμενη στροφή) → επίπεδο πλατύσκαλο (bridge, σταθερό z).
      if (placed < nGoings && local < segLen - eps) {
        const p = pointOnWalklineSegment(seg, segLen);
        path.push({ x: p.x, y: p.y, z });
      }
    } else {
      // Τόξο = ΕΠΙΠΕΔΟ πλατύσκαλο: δείγματα σε σταθερό z (ακολουθούν την καμπύλη).
      const samples = Math.max(1, Math.round(segLen / going));
      for (let k = 1; k <= samples; k++) {
        const p = pointOnWalklineSegment(seg, (segLen * k) / samples);
        path.push({ x: p.x, y: p.y, z });
      }
    }
  }
  return path;
}
