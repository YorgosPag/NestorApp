/**
 * ADR-941 Φ2β (Δ17 · Δ19) — τα **σχεδιασμένα γραφικά** μιας διάστασης του PDF: γραμμή διάστασης, οι δύο απολήξεις και οι
 * βοηθητικές, βρεμένα **από το κείμενο προς τα έξω** (Lin & Ting: πρώτα η τιμή, μετά η γραμμή της, μετά οι απολήξεις). Καθαρό.
 *
 * 🔑 **Η ευθεία της διάστασης** = τμήματα παράλληλα με την ανάγνωση, λίγα em από το κέντρο του κειμένου. Πάνω της, οι
 *   **σταθμοί** (άκρα τμημάτων και διασταυρώσεις) εξετάζονται από το κείμενο προς τα έξω· η **πρώτη** απόληξη σε κάθε
 *   πλευρά είναι η δική του — έτσι η αλυσίδα διαστάσεων στην ίδια ευθεία δεν μπερδεύεται.
 * 🔑 **Απόδειξη = δύο απολήξεις της βιβλιοθήκης στην ίδια ευθεία + μια γραμμένη τιμή ανάμεσα.** Χωρίς και τα τρία, τίποτα
 *   (ΤΕΣΤ1: σκέτο κείμενο ⇒ η Φ2α όπως πριν).
 * 🔑 **Βοηθητική** = κάθετη στην ευθεία, περνά από τη μύτη, με **ελεύθερο** μακρινό άκρο (ADR-929 Φ5.4: η παρειά τοίχου σε
 *   γωνία τελειώνει σε άλλη γραμμή, η βοηθητική στο κενό).
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-dimension-graphics
 */

import type { PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { PDF_VECTOR_DIMENSION_GRAPHICS_LIMITS as LIMITS, PDF_VECTOR_DIMENSION_LIMITS } from '../../config/tolerance-config';
import { arrowheadAt, type ArrowheadScene, type PdfArrowhead } from './pdf-vector-arrowheads';
import {
  add, alongOf, cross, distance, distanceToSegment, dot, intervalOn, isOnLine, negate, offsetFrom, sub, unit, type PdfSegment,
} from './pdf-vector-segments';
import type { TextFrame } from './pdf-vector-text-frame';

/** Τα σχεδιασμένα γραφικά μιας διάστασης. */
export interface PdfDimensionGraphic {
  readonly textIndex: number;
  /** Οι δύο μύτες, με τη σειρά της ανάγνωσης του κειμένου (αρχή → τέλος). */
  readonly apexes: readonly [PxPoint, PxPoint];
  /** Τα μπλοκ των απολήξεων, με την ίδια σειρά. */
  readonly arrowheads: readonly [string, string];
  /** Η μοναδιαία διεύθυνση της γραμμής διάστασης (= της ανάγνωσης). */
  readonly dir: PxPoint;
  /** Πόσο απέχει το κείμενο από τη γραμμή, σε em (για την αμφισημία). */
  readonly offsetEm: number;
  /** Όλα τα τμήματα των γραφικών: απολήξεις, γραμμή διάστασης, βοηθητικές. */
  readonly segmentIds: readonly number[];
}

export interface DimensionTextRef {
  readonly textIndex: number;
  readonly frame: TextFrame;
}

export interface DimensionGraphicsScene extends ArrowheadScene {
  readonly segments: readonly PdfSegment[];
}

interface Axis {
  readonly origin: PxPoint;
  readonly dir: PxPoint;
  readonly offsetEm: number;
}

interface SideHit {
  readonly t: number;
  readonly arrowhead: PdfArrowhead;
}

const isParallel = (s: PdfSegment, dir: PxPoint): boolean => {
  const u = unit(sub(s.b, s.a));
  return u !== null && Math.abs(cross(u, dir)) <= PDF_VECTOR_DIMENSION_LIMITS.PARALLEL_SIN;
};

const isPerpendicular = (s: PdfSegment, dir: PxPoint): boolean => {
  const u = unit(sub(s.b, s.a));
  return u !== null && Math.abs(dot(u, dir)) <= PDF_VECTOR_DIMENSION_LIMITS.PARALLEL_SIN;
};

/** Οι ευθείες παράλληλες με το κείμενο, λίγα em μακριά του, από την κοντινότερη (ομαδοποιημένες ανά μετατόπιση). */
function axesOf(frame: TextFrame, segments: readonly PdfSegment[]): Axis[] {
  const tol = LIMITS.ON_LINE_EM * frame.em;
  const normal: PxPoint = [-frame.dir[1], frame.dir[0]];
  const offsets = segments
    .filter((s) => isParallel(s, frame.dir))
    .map((s) => -offsetFrom(s.a, frame.centre, frame.dir))
    .filter((o) => Math.abs(o) <= LIMITS.TEXT_MAX_OFFSET_EM * frame.em)
    .sort((x, y) => Math.abs(x) - Math.abs(y));
  const unique: number[] = [];
  for (const o of offsets) if (!unique.some((u) => Math.abs(u - o) <= tol)) unique.push(o);
  // offsetFrom(c, foot, dir) = o ⇒ foot = c − normal·o
  return unique.map((o) => ({ origin: add(frame.centre, normal, -o), dir: frame.dir, offsetEm: Math.abs(o) / frame.em }));
}

/** Οι σταθμοί της ευθείας (παράμετρος κατά μήκος): άκρα των τμημάτων της και διασταυρώσεις άλλων τμημάτων. */
function stationsOf(axis: Axis, segments: readonly PdfSegment[], tol: number): number[] {
  const out: number[] = [];
  for (const s of segments) {
    if (isOnLine(s, axis.origin, axis.dir, tol)) {
      out.push(...intervalOn(s, axis.origin, axis.dir));
      continue;
    }
    const oa = offsetFrom(s.a, axis.origin, axis.dir);
    const ob = offsetFrom(s.b, axis.origin, axis.dir);
    if (oa * ob > 0 || oa === ob) continue; // δεν τέμνει την ευθεία
    const hit = add(s.a, sub(s.b, s.a), oa / (oa - ob));
    out.push(alongOf(hit, axis.origin, axis.dir));
  }
  return out;
}

/** Η πρώτη απόληξη στην πλευρά `sign` (−1 αρχή, +1 τέλος), από το κείμενο προς τα έξω. */
function sideHit(axis: Axis, sign: 1 | -1, stations: readonly number[], frame: TextFrame, scene: ArrowheadScene): SideHit | null {
  const tol = LIMITS.ON_LINE_EM * frame.em;
  const ordered = [...new Set(stations.filter((t) => sign * t > 0).map((t) => +t.toFixed(6)))].sort((x, y) => sign * (x - y));
  const outward: PxPoint = sign > 0 ? axis.dir : negate(axis.dir);
  let previous = Number.NaN;
  for (const t of ordered) {
    if (Math.abs(t - previous) <= tol) continue;
    previous = t;
    const apex = add(axis.origin, axis.dir, t);
    // Βέλη μέσα (μύτη έξω) · ή έξω από τις βοηθητικές (μύτη προς το κείμενο).
    const arrowhead = arrowheadAt(apex, outward, scene, frame.em) ?? arrowheadAt(apex, negate(outward), scene, frame.em);
    if (arrowhead) return { t, arrowhead };
  }
  return null;
}

/** Τα τμήματα της γραμμής διάστασης: πάνω στην ευθεία, μέσα στο άνοιγμα (με περιθώριο μιας εμβέλειας απόληξης). */
function dimLineSegments(axis: Axis, t1: number, t2: number, segments: readonly PdfSegment[], frame: TextFrame): number[] {
  const tol = LIMITS.ON_LINE_EM * frame.em;
  const margin = LIMITS.ARROW_REACH_EM * frame.em;
  return segments.filter((s) => {
    if (!isOnLine(s, axis.origin, axis.dir, tol)) return false;
    const [a, b] = intervalOn(s, axis.origin, axis.dir);
    return a >= t1 - margin && b <= t2 + margin && b > t1 && a < t2;
  }).map((s) => s.id);
}

/** Οι βοηθητικές στη μύτη: κάθετες, περνούν από αυτήν, με ελεύθερο το μακρινό τους άκρο. */
function extensionSegments(apex: PxPoint, axis: Axis, frame: TextFrame, scene: DimensionGraphicsScene, taken: ReadonlySet<number>): number[] {
  const tol = LIMITS.ON_LINE_EM * frame.em;
  return scene.grid.near(apex, LIMITS.EXTENSION_TOUCH_EM * frame.em).filter((s) => {
    if (taken.has(s.id) || !isPerpendicular(s, axis.dir)) return false;
    const u = unit(sub(s.b, s.a));
    if (!u || Math.abs(offsetFrom(apex, s.a, u)) > tol) return false;
    const far = distance(apex, s.a) >= distance(apex, s.b) ? s.a : s.b;
    return scene.grid.near(far, tol).every((o) => o.id === s.id || taken.has(o.id) || distanceToSegment(far, o) > tol);
  }).map((s) => s.id);
}

/** Τα γραφικά του κειμένου πάνω σε μία ευθεία, ή `null`. */
function graphicOnAxis(ref: DimensionTextRef, axis: Axis, scene: DimensionGraphicsScene): PdfDimensionGraphic | null {
  const tol = LIMITS.ON_LINE_EM * ref.frame.em;
  const stations = stationsOf(axis, scene.segments, tol);
  const start = sideHit(axis, -1, stations, ref.frame, scene);
  const end = start ? sideHit(axis, 1, stations, ref.frame, scene) : null;
  if (!start || !end) return null;
  const apexes: [PxPoint, PxPoint] = [start.arrowhead.apex, end.arrowhead.apex];
  const taken = new Set<number>([
    ...start.arrowhead.segmentIds, ...end.arrowhead.segmentIds,
    ...dimLineSegments(axis, start.t, end.t, scene.segments, ref.frame),
  ]);
  for (const apex of apexes) for (const id of extensionSegments(apex, axis, ref.frame, scene, taken)) taken.add(id);
  return {
    textIndex: ref.textIndex,
    apexes,
    arrowheads: [start.arrowhead.blockName, end.arrowhead.blockName],
    dir: axis.dir,
    offsetEm: axis.offsetEm,
    segmentIds: [...taken].sort((x, y) => x - y),
  };
}

const pairKey = (g: PdfDimensionGraphic): string => g.apexes.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).sort().join('|');

/** Δύο κείμενα διεκδικούν τα ίδια γραφικά: το κοντινότερο, αλλιώς (ισοπαλία) κανένα — ποτέ μαντεψιά. */
function resolveClaims(graphics: readonly PdfDimensionGraphic[]): PdfDimensionGraphic[] {
  const groups = new Map<string, PdfDimensionGraphic[]>();
  for (const g of graphics) groups.set(pairKey(g), [...(groups.get(pairKey(g)) ?? []), g]);
  return [...groups.values()].flatMap((group) => {
    const sorted = [...group].sort((a, b) => a.offsetEm - b.offsetEm);
    if (sorted.length === 1) return sorted;
    const [first, second] = sorted;
    const ambiguous = second.offsetEm - first.offsetEm <= LIMITS.TEXT_AMBIGUITY_REL * Math.max(second.offsetEm, 1e-9);
    return ambiguous ? [] : [first];
  });
}

/** Τα σχεδιασμένα γραφικά κάθε γραμμένης τιμής (όσες έχουν), το πολύ ένα ανά κείμενο. */
export function detectDimensionGraphics(texts: readonly DimensionTextRef[], scene: DimensionGraphicsScene): PdfDimensionGraphic[] {
  const found = texts.flatMap((ref) => {
    for (const axis of axesOf(ref.frame, scene.segments)) {
      const graphic = graphicOnAxis(ref, axis, scene);
      if (graphic) return [graphic];
    }
    return [];
  });
  return resolveClaims(found).sort((a, b) => a.textIndex - b.textIndex);
}
