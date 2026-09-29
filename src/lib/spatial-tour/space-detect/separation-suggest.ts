/**
 * @fileoverview **ΠΟΥ ΧΩΡΙΖΕΤΑΙ ΕΝΑΣ ΕΝΙΑΙΟΣ ΧΩΡΟΣ** — πρόταση νοητής γραμμής στο **στενότερο σημείο** ανάμεσα σε δύο
 * σημεία λήψης (ADR-884 §12 Δ8.2, «όπως το Revit»). Καθαρό.
 * @module lib/spatial-tour/space-detect/separation-suggest
 *
 * 🔑 **Στενότερο σημείο = λαιμός της maximin διαδρομής**: από όλες τις διαδρομές Α→Β μέσα στον χώρο, εκείνη που κρατά
 * τη **μεγαλύτερη ελάχιστη απόσταση από τοίχο** (πρώτα απλώνεται όπου ο χώρος είναι φαρδύς). Το pixel όπου η διαδρομή
 * αναγκάζεται να στενέψει περισσότερο είναι το άνοιγμα σαλονιού↔κουζίνας. Υπολογισμός: pixel ταξινομημένα κατά
 * απόσταση από τοίχο (φθίνουσα), ενώνονται με union-find· το pixel που **πρώτο** ενώνει Α και Β είναι ο λαιμός.
 * 🔑 **Η γραμμή**: η **συντομότερη** από τις δύο χορδές του χώρου που περνούν από τον λαιμό, κατά τον κυρίαρχο άξονα ή
 * κάθετα σε αυτόν (ορθογώνια — οι κατόψεις είναι ορθογώνιες). 🔒 Επαληθεύεται: με τη γραμμή ως τοίχο, το Β **δεν**
 * πρέπει να φτάνεται από το Α· αλλιώς καμία πρόταση (ποτέ γραμμή που δεν χωρίζει).
 */

import type { PixelPoint } from '@/lib/geometry/scale-calibration';
import { squaredDistanceTransform } from '@/lib/geometry/raster/distance-transform';
import { floodFillMask, forEachNeighbour, NEIGHBOURS_4, NEIGHBOURS_8 } from '@/lib/geometry/raster/flood-fill';
import { rasterizeSegment } from '@/lib/geometry/raster/raster-segment';

import { complement } from './space-region';
import type { SeparationSegment } from './space-detect-types';

/** Βήμα βαδίσματος της χορδής (pixel). */
const CHORD_STEP_PX = 0.5;
/** Πυκνότητα υποψήφιων κέντρων χορδής γύρω από τον λαιμό (pixel). */
const CANDIDATE_STRIDE_PX = 2;
/** Πόσες από τις συντομότερες χορδές ελέγχονται με flood fill («χωρίζει;») πριν τα παρατήσουμε. */
const MAX_VALIDATIONS = 12;

function findRoot(parent: Int32Array, i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root];
  while (parent[i] !== root) { const next = parent[i]; parent[i] = root; i = next; }
  return root;
}

/** Pixel του χώρου σε φθίνουσα απόσταση από τοίχο (ταξινόμηση κουβάδων — ακέραιο μέρος της απόστασης). */
function orderByClearance(region: Uint8Array, clearance2: Float64Array): Int32Array {
  let maxBucket = 0;
  for (let i = 0; i < region.length; i++) {
    if (region[i] === 1) maxBucket = Math.max(maxBucket, Math.floor(Math.sqrt(clearance2[i])));
  }
  const counts = new Int32Array(maxBucket + 2);
  for (let i = 0; i < region.length; i++) {
    if (region[i] === 1) counts[maxBucket - Math.floor(Math.sqrt(clearance2[i])) + 1]++;
  }
  for (let b = 1; b < counts.length; b++) counts[b] += counts[b - 1];
  const order = new Int32Array(counts[counts.length - 1]);
  for (let i = 0; i < region.length; i++) {
    if (region[i] === 1) order[counts[maxBucket - Math.floor(Math.sqrt(clearance2[i]))]++] = i;
  }
  return order;
}

/**
 * Ανάβαση της κλίσης: από το `start` στον γείτονα (8) με τη **μεγαλύτερη** απόσταση από τοίχο, όσο αυτή αυξάνει
 * γνήσια ⇒ ένα σημείο της **κορυφογραμμής** (medial axis) του δωματίου. Ένα σημείο λήψης 25 cm από τον τοίχο
 * κάθεται σε στενή ζώνη που ΔΕΝ είναι λαιμός· η κορυφογραμμή του δωματίου του, είναι η αληθινή του θέση στον χώρο.
 * (Μετρημένο: με σταθερό δίσκο 0,5 m γύρω από το σημείο, ο «λαιμός» έβγαινε ακόμη δίπλα του.)
 */
function climbToRidge(clearance2: Float64Array, region: Uint8Array, cols: number, rows: number, start: number): number {
  let current = start;
  for (;;) {
    let best = current;
    forEachNeighbour(current, cols, rows, NEIGHBOURS_8, (n) => {
      if (region[n] === 1 && clearance2[n] > clearance2[best]) best = n;
    });
    if (best === current) return current;
    current = best;
  }
}

/**
 * Ο λαιμός της maximin διαδρομής ανάμεσα στις **κορυφογραμμές** του Α και του Β, με την απόστασή του από τοίχο
 * (pixel) — ή `null` αν δεν ενώνονται καθόλου μέσα στον χώρο. ⚠️ Το pixel είναι **κοντά** στο στενότερο σημείο, όχι
 * πάνω του (ταξινόμηση ανά ακέραιο pixel: μετρημένο 10 cm έξω από το πάχος του μεσότοιχου) — γι' αυτό ο καλών ψάχνει
 * χορδές σε **δίσκο** γύρω του.
 */
function bottleneckPixel(
  region: Uint8Array, cols: number, rows: number, a: number, b: number,
): { readonly index: number; readonly clearancePx: number } | null {
  const clearance2 = squaredDistanceTransform(complement(region), cols, rows);
  const ridgeA = climbToRidge(clearance2, region, cols, rows, a);
  const ridgeB = climbToRidge(clearance2, region, cols, rows, b);
  const parent = new Int32Array(region.length).fill(-1);
  for (const i of orderByClearance(region, clearance2)) {
    parent[i] = i;
    forEachNeighbour(i, cols, rows, NEIGHBOURS_4, (n) => {
      if (parent[n] >= 0) parent[findRoot(parent, n)] = findRoot(parent, i);
    });
    if (parent[ridgeA] >= 0 && parent[ridgeB] >= 0 && findRoot(parent, ridgeA) === findRoot(parent, ridgeB)) {
      return { index: i, clearancePx: Math.sqrt(clearance2[i]) };
    }
  }
  return null;
}

/** Βαδίζει από το `from` κατά `(dx, dy)` ώσπου να βγει από τον χώρο· επιστρέφει το τελευταίο σημείο **μέσα**. */
function marchToEdge(region: Uint8Array, cols: number, rows: number, from: PixelPoint, dx: number, dy: number): PixelPoint {
  let x = from.x, y = from.y;
  for (;;) {
    const nx = x + dx * CHORD_STEP_PX, ny = y + dy * CHORD_STEP_PX;
    const c = Math.floor(nx), r = Math.floor(ny);
    if (c < 0 || c >= cols || r < 0 || r >= rows || region[r * cols + c] !== 1) return { x, y };
    x = nx; y = ny;
  }
}

/** Χορδή του χώρου από το `centre` κατά τη γωνία `angle`, προεκτεταμένη μισό pixel σε κάθε άκρη (μέσα στον τοίχο). */
function chordThrough(region: Uint8Array, cols: number, rows: number, centre: PixelPoint, angle: number): SeparationSegment {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const a = marchToEdge(region, cols, rows, centre, dx, dy);
  const b = marchToEdge(region, cols, rows, centre, -dx, -dy);
  return {
    a: { x: a.x + dx * CHORD_STEP_PX, y: a.y + dy * CHORD_STEP_PX },
    b: { x: b.x - dx * CHORD_STEP_PX, y: b.y - dy * CHORD_STEP_PX },
  };
}

const segmentLength = (s: SeparationSegment): number => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);

/** Χωρίζει πράγματι η γραμμή το Α από το Β μέσα στον χώρο; */
function separates(region: Uint8Array, cols: number, rows: number, line: SeparationSegment, a: number, b: number): boolean {
  const cut = Uint8Array.from(region);
  rasterizeSegment(cut, cols, rows, line.a, line.b, 1, 0);
  const reach = floodFillMask(cut, cols, rows, a % cols, Math.floor(a / cols), { connectivity: 4 });
  return reach[b] !== 1;
}

/**
 * Πρόταση νοητής γραμμής ανάμεσα στα pixel `a` και `b` του ίδιου χώρου, ορθογώνια ως προς τον `axis` (rad). `null`
 * όταν δεν υπάρχει λαιμός ή καμία χορδή δεν χωρίζει.
 */
export function suggestSeparation(
  region: Uint8Array, cols: number, rows: number, a: number, b: number, axis: number,
): { readonly segment: SeparationSegment; readonly widthPx: number } | null {
  const neck = bottleneckPixel(region, cols, rows, a, b);
  if (neck === null) return null;
  const chords = chordsAround(region, cols, rows, neck.index, Math.max(neck.clearancePx, 2), axis);
  const segment = chords.slice(0, MAX_VALIDATIONS).find((chord) => separates(region, cols, rows, chord, a, b));
  return segment ? { segment, widthPx: segmentLength(segment) } : null;
}

/**
 * Όλες οι ορθογώνιες χορδές (κατά τον άξονα και κάθετα) από pixel σε δίσκο ακτίνας `radiusPx` γύρω από τον λαιμό,
 * από τη συντομότερη. Η σωστή χορδή στο άνοιγμα έχει μήκος ≈ 2 × απόσταση από τοίχο· μία πλάι του, μέσα στο
 * δωμάτιο, διασχίζει όλο το δωμάτιο.
 */
function chordsAround(
  region: Uint8Array, cols: number, rows: number, neck: number, radiusPx: number, axis: number,
): SeparationSegment[] {
  const nc = neck % cols, nr = (neck - nc) / cols;
  const reach = Math.ceil(radiusPx);
  const chords: SeparationSegment[] = [];
  for (let r = nr - reach; r <= nr + reach; r += CANDIDATE_STRIDE_PX) {
    for (let c = nc - reach; c <= nc + reach; c += CANDIDATE_STRIDE_PX) {
      if (c < 0 || c >= cols || r < 0 || r >= rows || region[r * cols + c] !== 1) continue;
      if ((c - nc) ** 2 + (r - nr) ** 2 > radiusPx * radiusPx) continue;
      const centre = { x: c + 0.5, y: r + 0.5 };
      for (const angle of [axis, axis + Math.PI / 2]) chords.push(chordThrough(region, cols, rows, centre, angle));
    }
  }
  return chords.sort((p, q) => segmentLength(p) - segmentLength(q));
}
