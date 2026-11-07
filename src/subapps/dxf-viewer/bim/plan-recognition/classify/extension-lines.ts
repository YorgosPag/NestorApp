/**
 * ADR-929 Φ5.4 — **γραμμές επέκτασης**: τα λεπτά κάθετα τμήματα που φέρνουν το μετρούμενο σημείο ως τη γραμμή διάστασης.
 *
 * Μια γραμμή επέκτασης `E` για το σημείο `p` μιας υποψήφιας διάστασης `D`:
 * - είναι **κάθετη** στη `D` και **λεπτή** (όχι παχύτερη από την τυπική πινελιά επί `EXT_MAX_WIDTH`)·
 * - το `p` πέφτει **πάνω** στην ευθεία της, μέσα στην έκτασή της·
 * - **περνά λίγο πέρα** από τη `D` (η μικρή πλευρά ≤ `max(0,35·|E|, 1,5·ύψος κειμένου)`), ενώ η μεγάλη πλευρά πάει προς
 *   το αντικείμενο·
 * - το **μακρινό** της άκρο (προς το αντικείμενο) είναι **ελεύθερο**: σταματά λίγο πριν από αυτό, χωρίς κάθετη πινελιά.
 *
 * 🔑 **Γιατί το ελεύθερο άκρο.** Μια παρειά τοίχου σε γωνία L ή κόμβο Τ μοιάζει με γραμμή επέκτασης στο άκρο της `D`.
 * Όμως τελειώνει σε **άλλον τοίχο** (κάθετη πινελιά), ενώ η γραμμή επέκτασης τελειώνει στο κενό. Αυτό τις ξεχωρίζει.
 *
 * 🔑 **ADR-929 Φ5.5 — άκρα ΚΑΙ ενδιάμεσα σημεία.** Η συνεχής γραμμή μιας αλυσίδας είναι **ένα** τμήμα της Φ2 πάνω σε
 * πολλές διαστάσεις (§6.7)· οι ενδιάμεσες επεκτάσεις της την **τέμνουν**, δεν την τερματίζουν. Ελέγχονται με το **ίδιο**
 * κριτήριο στο σημείο τομής. ⚠️ Ο παράγοντας βαθμού (`ends`) μετρά **μόνο τα άκρα**, όπως πριν: το `dimensionScore` δεν
 * αλλάζει· τα ενδιάμεσα δίνουν μόνο **άγκυρες** για το δέσιμο (`anchors`) και τον ρόλο `extension-line`.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/extension-lines
 */

import type { PlanePoint } from '@/lib/geometry/homography';
import { inkFractionAlong, type InkMask } from '@/lib/geometry/raster/ink-probe';
import type { PlanExtensionAnchor } from '../plan-recognition-types';
import { localOf, sinBetween, type FramedSegment } from './segment-frame';

export interface ExtensionScale {
  readonly strokePx: number;
  readonly textPx: number;
}

/** Για κάθε υποψήφια διάσταση: πόσα **άκρα** της (0–2) έχουν γραμμή επέκτασης, ποιες, και οι άγκυρές τους. */
export interface ExtensionMatch {
  readonly ends: number;
  /** Όλες οι επεκτάσεις της: στα άκρα **και** στα ενδιάμεσα σημεία. */
  readonly extensionIds: readonly string[];
  /** Μία ανά επέκταση, με το πόδι της (το ελεύθερο άκρο). */
  readonly anchors: readonly PlanExtensionAnchor[];
}

/** Κάθετα: |sin| ≥ cos 5°. */
const PERPENDICULAR_MIN_SIN = Math.cos((5 * Math.PI) / 180);
const EXT_MAX_WIDTH = 1.6;
const SHORT_SIDE_FRACTION = 0.35;
const SHORT_SIDE_TEXT_HEIGHTS = 1.5;
/** Στο ελεύθερο άκρο, κάθετο μελάνι κάτω από αυτό το ποσοστό. */
const FREE_END_MAX_INK = 0.5;

/** Το ελεύθερο άκρο: καμία κάθετη πινελιά που να το διασχίζει (γωνία/κόμβος τοίχου θα είχε). */
function isFreeEnd(m: InkMask, e: FramedSegment, which: 'start' | 'end', sc: ExtensionScale): boolean {
  const p = which === 'start' ? e.a : e.b;
  const reach = 2 * sc.strokePx + 0.3 * sc.textPx;
  const side = Math.max(inkFractionAlong(m, p, e.n, sc.strokePx, reach), inkFractionAlong(m, p, { x: -e.n.x, y: -e.n.y }, sc.strokePx, reach));
  return side < FREE_END_MAX_INK;
}

/** Είναι η `e` γραμμή επέκτασης για το σημείο `p` της `d`; Αν ναι, το πόδι της (το ελεύθερο άκρο)· αλλιώς `null`. */
function extensionFootAt(m: InkMask, d: FramedSegment, e: FramedSegment, p: PlanePoint, sc: ExtensionScale): 'start' | 'end' | null {
  if (e === d || sinBetween(d, e) < PERPENDICULAR_MIN_SIN || e.width > EXT_MAX_WIDTH * sc.strokePx) return null;
  const { t, d: off } = localOf(e, p);
  const tol = e.width / 2 + 1.5;
  if (Math.abs(off) > tol || t < -tol || t > e.length + tol) return null;
  const towardStart = Math.max(0, t);
  const towardEnd = Math.max(0, e.length - t);
  const short = Math.min(towardStart, towardEnd);
  if (short > Math.max(SHORT_SIDE_FRACTION * e.length, SHORT_SIDE_TEXT_HEIGHTS * sc.textPx)) return null;
  const foot = towardStart >= towardEnd ? 'start' : 'end';
  return isFreeEnd(m, e, foot, sc) ? foot : null;
}

/** Το σημείο όπου η ευθεία της `e` τέμνει το **εσωτερικό** της `d` (όχι τα άκρα της, που ελέγχονται χωριστά), ή `null`. */
function interiorCrossing(d: FramedSegment, e: FramedSegment, endTolPx: number): PlanePoint | null {
  const pa = localOf(d, e.a);
  const pb = localOf(d, e.b);
  if (pa.d === pb.d) return null;
  const t = pa.t + ((pb.t - pa.t) * pa.d) / (pa.d - pb.d);
  if (t <= endTolPx || t >= d.length - endTolPx) return null;
  return { x: d.a.x + t * d.u.x, y: d.a.y + t * d.u.y };
}

/** Οι επεκτάσεις **ενός** σημείου της `d`, ως άγκυρες. */
function anchorsAt(m: InkMask, d: FramedSegment, p: PlanePoint, strokes: readonly FramedSegment[], sc: ExtensionScale): PlanExtensionAnchor[] {
  return strokes.flatMap((e) => {
    const foot = extensionFootAt(m, d, e, p, sc);
    return foot === null ? [] : [{ extensionId: e.id, foot }];
  });
}

/** Οι επεκτάσεις που **τέμνουν** το εσωτερικό της `d` (ενδιάμεσα σημεία αλυσίδας). */
function interiorAnchors(m: InkMask, d: FramedSegment, strokes: readonly FramedSegment[], sc: ExtensionScale): PlanExtensionAnchor[] {
  const endTol = sc.strokePx;
  return strokes.flatMap((e) => {
    if (e === d || sinBetween(d, e) < PERPENDICULAR_MIN_SIN) return [];
    const p = interiorCrossing(d, e, endTol);
    const foot = p === null ? null : extensionFootAt(m, d, e, p, sc);
    return foot === null ? [] : [{ extensionId: e.id, foot }];
  });
}

/** Μία άγκυρα ανά επέκταση (η ίδια μπορεί να βρεθεί και στο άκρο και ως τομή). */
function uniqueAnchors(anchors: readonly PlanExtensionAnchor[]): PlanExtensionAnchor[] {
  const byId = new Map<string, PlanExtensionAnchor>();
  for (const a of anchors) if (!byId.has(a.extensionId)) byId.set(a.extensionId, a);
  return [...byId.values()];
}

/** Οι γραμμές επέκτασης κάθε υποψήφιας διάστασης (`candidates`), ανάμεσα σε όλα τα τμήματα-πινελιές. */
export function extensionMatches(
  m: InkMask, candidates: readonly FramedSegment[], all: readonly FramedSegment[], sc: ExtensionScale,
): Map<string, ExtensionMatch> {
  const strokes = all.filter((s) => s.style === 'stroke');
  const out = new Map<string, ExtensionMatch>();
  for (const d of candidates) {
    const atEnds = [d.a, d.b].map((p) => anchorsAt(m, d, p, strokes, sc));
    const anchors = uniqueAnchors([...atEnds.flat(), ...interiorAnchors(m, d, strokes, sc)]);
    out.set(d.id, {
      ends: atEnds.filter((hits) => hits.length > 0).length,
      extensionIds: anchors.map((a) => a.extensionId),
      anchors,
    });
  }
  return out;
}
