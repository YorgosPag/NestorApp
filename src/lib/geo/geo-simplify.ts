/**
 * @fileoverview **ΑΠΛΟΠΟΙΗΣΗ ΔΑΚΤΥΛΙΟΥ ΜΕ ΕΓΓΥΗΜΕΝΗ ΜΕΓΙΣΤΗ ΑΠΟΚΛΙΣΗ** — Douglas–Peucker σε μέτρα.
 * @related ADR-883 (όρια διοικητικών περιοχών στον χάρτη) · `geo-local-frame.ts` · `geo-ring.ts`
 * @module lib/geo/geo-simplify
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ DOUGLAS–PEUCKER ΚΑΙ ΟΧΙ VISVALINGAM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο Visvalingam δίνει **ομορφότερο** σχήμα σε ισχυρή απλοποίηση, αλλά το κριτήριό του
 * είναι **εμβαδόν τριγώνου** — δεν υπόσχεται τίποτα για το *«πόσο μακριά από το αληθινό
 * σύνορο μπορεί να πέσει η απλοποιημένη γραμμή;»*. Ο Douglas–Peucker το υπόσχεται **εξ
 * ορισμού**: κάθε κορυφή που αφαιρείται απέχει **≤ ανοχή** από το τμήμα που την
 * αντικαθιστά.
 *
 * Αυτή η υπόσχεση είναι **ολόκληρος ο λόγος ύπαρξης** του module: ο κριτής «είναι η
 * αγγελία μέσα στον δήμο;» *(`geo-area.ts`)* πρέπει να ξέρει **πόσο θολό** είναι το
 * σύνορο που κρατά, ώστε μια αγγελία πιο κοντά στο σύνορο από την ανοχή να δηλωθεί
 * **«ίσως»** και όχι «μέσα» ή «έξω» με ψεύτικη σιγουριά.
 *
 * ⚠️ **Το mapshaper (MPL-2.0) δεν επιτρέπεται** *(N.5)* — και δεν χρειάζεται: ο
 * αλγόριθμος είναι λίγες γραμμές πάνω στον **υπάρχοντα** SSoT τοπικής προβολής.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 Η ΕΓΓΥΗΣΗ ΚΡΑΤΑ ΚΑΙ ΣΕ ΜΕΓΑΛΑ ΣΧΗΜΑΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η ισαπέχουσα προβολή κλιμακώνει τον άξονα x με `cos(πλάτους)`. Μια περιφέρεια
 * εκτείνεται ~3° πλάτους, άρα η κλίμακα διαφέρει ~5% από άκρη σε άκρη. Για να μην
 * **υποτιμηθεί** ποτέ η απόκλιση, η αρχή των αξόνων μπαίνει στο πλάτος με τη
 * **μεγαλύτερη** κλίμακα (το πιο κοντινό στον ισημερινό): κάθε μετρημένη απόσταση είναι
 * τότε **≥** της αληθινής ⇒ «μετρημένο ≤ ανοχή» συνεπάγεται «αληθινό ≤ ανοχή».
 *
 * **Layering**: καθαρό φύλλο — καμία εξάρτηση από React, DOM ή δίκτυο. Το τρέχει ο
 * γεννήτορας `scripts/build-admin-boundaries.ts` με `tsx`.
 */

import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import { distanceToLocalSegment, toLocalMetres, type LocalPoint } from './geo-local-frame';

/**
 * Η αρχή των αξόνων που **δεν υποτιμά ποτέ** απόσταση — δες την κεφαλίδα.
 *
 * Το πλάτος με τη μικρότερη απόλυτη τιμή έχει το μεγαλύτερο `cos` ⇒ τη μεγαλύτερη
 * κλίμακα x. Το μήκος είναι αδιάφορο για την κλίμακα· παίρνουμε της πρώτης κορυφής.
 */
function conservativeOrigin(ring: GeoOutline): GeoPoint {
  let lat = ring[0].lat;
  for (const point of ring) {
    if (Math.abs(point.lat) < Math.abs(lat)) lat = point.lat;
  }
  return { lat, lng: ring[0].lng };
}

/**
 * Σημαδεύει ποιες κορυφές του διαστήματος `[first, last]` μένουν — επαναληπτικά, με
 * στοίβα, ώστε μια ακτογραμμή 100.000 κορυφών να μην εξαντλήσει τη στοίβα κλήσεων.
 */
function markChain(
  points: readonly LocalPoint[],
  first: number,
  last: number,
  toleranceM: number,
  keep: boolean[],
): void {
  const stack: [number, number][] = [[first, last]];

  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = toleranceM;

    for (let i = start + 1; i < end; i++) {
      const distance = distanceToLocalSegment(points[i], points[start], points[end % points.length]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = i;
      }
    }

    if (farthest === -1) continue;
    keep[farthest] = true;
    stack.push([start, farthest], [farthest, end]);
  }
}

/** Η κορυφή που απέχει **περισσότερο** από την πρώτη — το δεύτερο σταθερό σημείο του δακτυλίου. */
function farthestFromFirst(points: readonly LocalPoint[]): number {
  let index = 0;
  let best = -1;
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (distance > best) {
      best = distance;
      index = i;
    }
  }
  return index;
}

/**
 * **Απλοποιεί ΑΝΟΙΧΤΟ δακτύλιο** (χωρίς επαναλαμβανόμενη τελευταία κορυφή, όπως τον δίνει
 * το `geoJsonRings`) ώστε **καμία** αφαιρεμένη κορυφή να μην απέχει πάνω από `toleranceM`
 * από το απλοποιημένο σύνορο.
 *
 * 🔑 **Κλειστός δακτύλιος = δύο αλυσίδες**: ο Douglas–Peucker ορίζεται σε **γραμμή** με
 * δύο άκρα. Σε δακτύλιο κρατάμε δύο σταθερά σημεία — την πρώτη κορυφή και την πιο
 * μακρινή της — και απλοποιούμε τις δύο αλυσίδες ανάμεσά τους. Αλλιώς ένα τμήμα από την
 * πρώτη κορυφή στον εαυτό της θα είχε μηδενικό μήκος και κάθε απόσταση θα μετριόταν ως
 * απόσταση **σημείου**, όχι τμήματος.
 *
 * @returns ο απλοποιημένος δακτύλιος, ή `null` όταν μένουν **< 3** κορυφές — δηλαδή το
 *   σχήμα είναι μικρότερο από την ανοχή και **δεν είναι πια σχήμα** (νησίδα 5 m σε
 *   ανοχή 20 m). Ο καλών αποφασίζει τι σημαίνει αυτό· εδώ δεν μαντεύουμε.
 */
export function simplifyGeoRing(ring: GeoOutline, toleranceM: number): GeoOutline | null {
  if (ring.length < 3) return null;
  if (!(toleranceM > 0)) return ring;

  const points = toLocalMetres(ring, conservativeOrigin(ring));
  const pivot = farthestFromFirst(points);
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true;
  keep[pivot] = true;

  markChain(points, 0, pivot, toleranceM, keep);
  // Η δεύτερη αλυσίδα κλείνει τον κύκλο: `ring.length` αντιστοιχεί ξανά στην κορυφή 0.
  markChain(points, pivot, ring.length, toleranceM, keep);

  const simplified = ring.filter((_, index) => keep[index]);
  return simplified.length >= 3 ? simplified : null;
}
