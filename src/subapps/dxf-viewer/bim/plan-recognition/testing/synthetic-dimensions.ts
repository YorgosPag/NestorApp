/**
 * Συνθετικές **διαστάσεις** για τα δείγματα κάτοψης (ADR-929 Φ5.4): γραμμή διάστασης, γραμμές επέκτασης, απολήξεις
 * (βέλος · πλάγια παύλα · κουκκίδα · καμία) και ο αριθμός, είτε **διακόπτοντας** τη γραμμή είτε **πάνω** της.
 *
 * 🔑 **Μεγέθη σε mm χαρτιού × κλίμακα σχεδίου**, όπως σχεδιάζονται (ύψος κειμένου 2,5 mm, βέλος 3 mm, κενό επέκτασης
 * 1,5 mm), ώστε το δείγμα να έχει τις αναλογίες ενός πραγματικού σχεδίου σε κάθε ανάλυση.
 * 🔑 **Αριθμοί από πινελιές (επτά τμήματα)**, όχι γραμματοσειρά: ντετερμινιστικό σε κάθε μηχάνημα, και δίνει ό,τι
 * βλέπει ο ανιχνευτής σε σάρωση (συνιστώσες μεγέθους χαρακτήρα).
 * 🔑 **Η αλήθεια βγαίνει από τα ίδια πρωτογενή σχήματα** που ζωγραφίζονται ({@link SyntheticDimensionTruth}).
 *
 * ⚠️ Μόνο για tests και σενάρια μέτρησης (`testing/`).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/synthetic-dimensions
 */

import type { Point2D } from '../../../rendering/types/Types';

export type SyntheticTerminator = 'arrow' | 'tick' | 'dot' | 'none';

/** Μία διάσταση σε mm κάτοψης: μετρά από το `from` ως το `to`, με τη γραμμή της μετατοπισμένη κατά `offsetMm`. */
export interface SyntheticDimension {
  readonly from: Point2D;
  readonly to: Point2D;
  /** Προσημασμένη κάθετη μετατόπιση (θετική = αριστερά της φοράς `from → to`). */
  readonly offsetMm: number;
  readonly terminator: SyntheticTerminator;
  /** Ψηφία και τελεία («3.50»). */
  readonly label: string;
  readonly text: 'interrupt' | 'above';
}

/** Ευθύγραμμο τμήμα αλήθειας σε mm κάτοψης. */
export interface TruthSegment {
  readonly a: Point2D;
  readonly b: Point2D;
}

export interface SyntheticDimensionTruth {
  readonly dimensionLines: readonly TruthSegment[];
  readonly extensionLines: readonly TruthSegment[];
}

/** Τα πρωτογενή σχήματα του μελανιού, σε mm κάτοψης. */
type Shape =
  | { readonly kind: 'capsule'; readonly a: Point2D; readonly b: Point2D; readonly r: number }
  | { readonly kind: 'triangle'; readonly p: readonly [Point2D, Point2D, Point2D] }
  | { readonly kind: 'disc'; readonly c: Point2D; readonly r: number };

export interface DimensionInk {
  readonly shapes: readonly Shape[];
  readonly truth: SyntheticDimensionTruth;
  /** Σημεία που πρέπει να χωρέσουν στην εικόνα. */
  readonly extent: readonly Point2D[];
}

/** Μεγέθη σε mm **χαρτιού** (ISO 129 / συνήθης πρακτική αρχιτεκτονικών σχεδίων). */
const PAPER = {
  textHeight: 2.5,
  arrowLength: 3,
  arrowHalfWidth: 0.9,
  tickHalf: 1.25,
  dotRadius: 0.6,
  extensionGap: 1.5,
  extensionOvershoot: 1.5,
  textClearance: 0.8,
  interruptPad: 0.8,
} as const;

/** Επτά τμήματα (a b c d e f g) σε μονάδες κουτιού χαρακτήρα 0,6 × 1. */
const SEGMENTS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  a: [0, 1, 0.6, 1], b: [0.6, 0.5, 0.6, 1], c: [0.6, 0, 0.6, 0.5], d: [0, 0, 0.6, 0],
  e: [0, 0, 0, 0.5], f: [0, 0.5, 0, 1], g: [0, 0.5, 0.6, 0.5],
};
const DIGITS: Readonly<Record<string, string>> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};
const CHAR_WIDTH = 0.6;
const DOT_WIDTH = 0.3;
const CHAR_SPACING = 0.3;

const add = (p: Point2D, v: Point2D, t: number): Point2D => ({ x: p.x + v.x * t, y: p.y + v.y * t });

/** Το πλάτος του κειμένου σε ύψη χαρακτήρα. */
function labelWidth(label: string): number {
  return [...label].reduce((w, ch, i) => w + (ch === '.' ? DOT_WIDTH : CHAR_WIDTH) + (i > 0 ? CHAR_SPACING : 0), 0);
}

/** Τα σχήματα του κειμένου, κεντραρισμένου στο `centre`, με «πάνω» το `up` και φορά ανάγνωσης το `along`. */
function labelShapes(label: string, centre: Point2D, along: Point2D, up: Point2D, h: number, r: number): Shape[] {
  const shapes: Shape[] = [];
  let x = -labelWidth(label) / 2;
  const at = (lx: number, ly: number): Point2D => add(add(centre, along, (x + lx) * h), up, (ly - 0.5) * h);
  for (const ch of label) {
    if (ch === '.') {
      shapes.push({ kind: 'disc', c: at(DOT_WIDTH / 2, 0.05), r: Math.max(r * 1.4, 0.08 * h) });
      x += DOT_WIDTH + CHAR_SPACING;
      continue;
    }
    for (const seg of DIGITS[ch] ?? '') {
      const [x0, y0, x1, y1] = SEGMENTS[seg];
      shapes.push({ kind: 'capsule', a: at(x0, y0), b: at(x1, y1), r });
    }
    x += CHAR_WIDTH + CHAR_SPACING;
  }
  return shapes;
}

function terminatorShapes(end: Point2D, out: Point2D, nrm: Point2D, kind: SyntheticTerminator, k: number, r: number): Shape[] {
  if (kind === 'arrow') {
    const base = add(end, out, -PAPER.arrowLength * k);
    return [{ kind: 'triangle', p: [end, add(base, nrm, PAPER.arrowHalfWidth * k), add(base, nrm, -PAPER.arrowHalfWidth * k)] }];
  }
  if (kind === 'tick') {
    const dg = { x: (out.x + nrm.x) / Math.SQRT2, y: (out.y + nrm.y) / Math.SQRT2 };
    return [{ kind: 'capsule', a: add(end, dg, -PAPER.tickHalf * k), b: add(end, dg, PAPER.tickHalf * k), r }];
  }
  return kind === 'dot' ? [{ kind: 'disc', c: end, r: Math.max(PAPER.dotRadius * k, 1.6 * r) }] : [];
}

/** Ό,τι ζωγραφίζει μία διάσταση, και η αλήθεια της. `k` = mm κάτοψης ανά mm χαρτιού, `r` = μισή πινελιά (mm κάτοψης). */
function oneDimension(dim: SyntheticDimension, k: number, r: number): DimensionInk {
  const len = Math.hypot(dim.to.x - dim.from.x, dim.to.y - dim.from.y) || 1;
  const d = { x: (dim.to.x - dim.from.x) / len, y: (dim.to.y - dim.from.y) / len };
  const nrm = { x: -d.y, y: d.x };
  const side = dim.offsetMm >= 0 ? 1 : -1;
  const away = { x: nrm.x * side, y: nrm.y * side };
  const A = add(dim.from, nrm, dim.offsetMm);
  const B = add(dim.to, nrm, dim.offsetMm);
  const h = PAPER.textHeight * k;
  const mid = add(A, d, len / 2);
  const halfGap = (labelWidth(dim.label) * h) / 2 + PAPER.interruptPad * k;
  const lines: TruthSegment[] = dim.text === 'interrupt'
    ? [{ a: A, b: add(mid, d, -halfGap) }, { a: add(mid, d, halfGap), b: B }]
    : [{ a: A, b: B }];
  const extensions: TruthSegment[] = [dim.from, dim.to].map((p) => ({
    a: add(p, away, PAPER.extensionGap * k), b: add(add(p, nrm, dim.offsetMm), away, PAPER.extensionOvershoot * k),
  }));
  const textCentre = dim.text === 'interrupt' ? mid : add(mid, away, h / 2 + PAPER.textClearance * k);
  const shapes: Shape[] = [
    ...[...lines, ...extensions].map((s): Shape => ({ kind: 'capsule', a: s.a, b: s.b, r })),
    ...terminatorShapes(A, { x: -d.x, y: -d.y }, nrm, dim.terminator, k, r),
    ...terminatorShapes(B, d, nrm, dim.terminator, k, r),
    ...labelShapes(dim.label, textCentre, d, away, h, r),
  ];
  const extent = [A, B, ...extensions.flatMap((s) => [s.a, s.b]), add(textCentre, away, h)];
  return { shapes, truth: { dimensionLines: lines, extensionLines: extensions }, extent };
}

/** Όλες οι διαστάσεις ενός δείγματος. */
export function dimensionInk(dims: readonly SyntheticDimension[], paperScale: number, halfStrokeMm: number): DimensionInk {
  const parts = dims.map((dim) => oneDimension(dim, paperScale, halfStrokeMm));
  return {
    shapes: parts.flatMap((p) => p.shapes),
    truth: {
      dimensionLines: parts.flatMap((p) => p.truth.dimensionLines),
      extensionLines: parts.flatMap((p) => p.truth.extensionLines),
    },
    extent: parts.flatMap((p) => p.extent),
  };
}

function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function insideTriangle(p: Point2D, [a, b, c]: readonly [Point2D, Point2D, Point2D]): boolean {
  const s = (u: Point2D, v: Point2D) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Μελάνι διάστασης σε αυτό το σημείο (mm κάτοψης); */
export function isDimensionInk(ink: DimensionInk, p: Point2D): boolean {
  return ink.shapes.some((s) => (
    s.kind === 'capsule' ? distToSegment(p, s.a, s.b) <= s.r
      : s.kind === 'disc' ? Math.hypot(p.x - s.c.x, p.y - s.c.y) <= s.r
        : insideTriangle(p, s.p)
  ));
}
