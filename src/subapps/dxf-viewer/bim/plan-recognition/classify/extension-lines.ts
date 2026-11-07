/**
 * ADR-929 Φ5.4 — **γραμμές επέκτασης**: τα λεπτά κάθετα τμήματα που φέρνουν το μετρούμενο σημείο ως τη γραμμή διάστασης.
 *
 * Μια γραμμή επέκτασης `E` για το άκρο `p` μιας υποψήφιας διάστασης `D`:
 * - είναι **κάθετη** στη `D` και **λεπτή** (όχι παχύτερη από την τυπική πινελιά επί `EXT_MAX_WIDTH`)·
 * - το `p` πέφτει **πάνω** στην ευθεία της, μέσα στην έκτασή της·
 * - **περνά λίγο πέρα** από τη `D` (η μικρή πλευρά ≤ `max(0,35·|E|, 1,5·ύψος κειμένου)`), ενώ η μεγάλη πλευρά πάει προς
 *   το αντικείμενο·
 * - το **μακρινό** της άκρο (προς το αντικείμενο) είναι **ελεύθερο**: σταματά λίγο πριν από αυτό, χωρίς κάθετη πινελιά.
 *
 * 🔑 **Γιατί το ελεύθερο άκρο.** Μια παρειά τοίχου σε γωνία L ή κόμβο Τ μοιάζει με γραμμή επέκτασης στο άκρο της `D`.
 * Όμως τελειώνει σε **άλλον τοίχο** (κάθετη πινελιά), ενώ η γραμμή επέκτασης τελειώνει στο κενό. Αυτό τις ξεχωρίζει.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/extension-lines
 */

import { inkFractionAlong, type InkMask } from '@/lib/geometry/raster/ink-probe';
import { localOf, sinBetween, type FramedSegment } from './segment-frame';

export interface ExtensionScale {
  readonly strokePx: number;
  readonly textPx: number;
}

/** Για κάθε υποψήφια διάσταση: πόσα άκρα της (0–2) έχουν γραμμή επέκτασης, και ποιες. */
export interface ExtensionMatch {
  readonly ends: number;
  readonly extensionIds: readonly string[];
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

/** Είναι η `e` γραμμή επέκτασης για το σημείο `p` της `d`; */
function extendsAt(m: InkMask, d: FramedSegment, e: FramedSegment, p: { x: number; y: number }, sc: ExtensionScale): boolean {
  if (e === d || sinBetween(d, e) < PERPENDICULAR_MIN_SIN || e.width > EXT_MAX_WIDTH * sc.strokePx) return false;
  const { t, d: off } = localOf(e, p);
  const tol = e.width / 2 + 1.5;
  if (Math.abs(off) > tol || t < -tol || t > e.length + tol) return false;
  const towardStart = Math.max(0, t);
  const towardEnd = Math.max(0, e.length - t);
  const short = Math.min(towardStart, towardEnd);
  if (short > Math.max(SHORT_SIDE_FRACTION * e.length, SHORT_SIDE_TEXT_HEIGHTS * sc.textPx)) return false;
  return isFreeEnd(m, e, towardStart >= towardEnd ? 'start' : 'end', sc);
}

/** Οι γραμμές επέκτασης κάθε υποψήφιας διάστασης (`candidates`), ανάμεσα σε όλα τα τμήματα-πινελιές. */
export function extensionMatches(
  m: InkMask, candidates: readonly FramedSegment[], all: readonly FramedSegment[], sc: ExtensionScale,
): Map<string, ExtensionMatch> {
  const strokes = all.filter((s) => s.style === 'stroke');
  const out = new Map<string, ExtensionMatch>();
  for (const d of candidates) {
    const ids: string[] = [];
    let ends = 0;
    for (const p of [d.a, d.b]) {
      const hits = strokes.filter((e) => extendsAt(m, d, e, p, sc));
      if (hits.length > 0) ends++;
      ids.push(...hits.map((e) => e.id));
    }
    out.set(d.id, { ends, extensionIds: [...new Set(ids)] });
  }
  return out;
}
