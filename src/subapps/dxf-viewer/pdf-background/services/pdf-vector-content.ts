/**
 * ADR-941 Φ1 — το **διανυσματικό περιεχόμενο** μιας σελίδας PDF (γραμμές, πολυγραμμές, κείμενα), όπως είναι στο αρχείο, σε
 * **φυσικά px του υποβάθρου** (viewport του pdf.js στην κλίμακα απόδοσης του provider: αρχή πάνω-αριστερά, Y κάτω).
 *
 * 🔑 Ένας αναγνώστης εντολών: `walkPaintedPaths` (`services/pdf/pdf-path-walker`), ο ίδιος με τη δομή σελίδας του ADR-923.
 * 🔑 Τα px είναι το ΙΔΙΟ σύστημα με την εικόνα του υποβάθρου, άρα η σκηνή τα παίρνει **μόνο** από το `rasterPixelToScene`
 *   (ADR-929 Δ3) — η εισαγωγή κάθεται ακριβώς πάνω στην εικόνα, με κάθε βαθμονόμηση.
 * 🔑 Κείμενο = τρία σημεία (αρχή γραμμής βάσης · ένα «ύψος γραμματοσειράς» κατά μήκος της · ένα κάθετα πάνω), όχι γωνία και
 *   ύψος: ο καταναλωτής τα περνά από τον ίδιο πίνακα, οπότε αναστροφή Y και περιστροφή υποβάθρου μπαίνουν χωρίς πρόσημα.
 * ⚠️ Φ1: μόνο διαδρομές με **πινελιά**· τα γεμίσματα μετριούνται (`skippedFills`) και περιμένουν τη Φ1.1 (ADR-941 Δ6).
 *
 * @module subapps/dxf-viewer/pdf-background/services/pdf-vector-content
 */

import { walkPaintedPaths, type PdfPathOperators, type PdfPoint, type PdfSubpath } from '@/services/pdf/pdf-path-walker';

export type PxPoint = readonly [number, number];

export interface PdfVectorPolyline {
  readonly points: readonly PxPoint[];
  readonly closed: boolean;
}

export interface PdfVectorText {
  readonly text: string;
  /** Αρχή της γραμμής βάσης. */
  readonly origin: PxPoint;
  /** `origin` + ένα ύψος γραμματοσειράς **κατά μήκος** της γραμμής βάσης (κατεύθυνση ανάγνωσης). */
  readonly along: PxPoint;
  /** `origin` + ένα ύψος γραμματοσειράς **κάθετα πάνω** (ύψος χαρακτήρα). */
  readonly up: PxPoint;
}

export interface PdfVectorContent {
  readonly polylines: readonly PdfVectorPolyline[];
  readonly texts: readonly PdfVectorText[];
  /** Διαδρομές μόνο με γέμισμα — δεν εισάγονται στη Φ1, μετριούνται ώστε να λέγονται. */
  readonly skippedFills: number;
}

/** Ό,τι χρειάζεται από μια σελίδα του pdf.js. */
export interface VectorSourcePage {
  getOperatorList(): Promise<{ readonly fnArray: readonly number[]; readonly argsArray: readonly (readonly unknown[] | null)[] }>;
  getTextContent(): Promise<{ readonly items: readonly unknown[] }>;
  getViewport(options: { scale: number }): { convertToViewportPoint(x: number, y: number): number[] };
}

/** Ανοχή χορδής της ισοπέδωσης Bézier (pt σελίδας). */
const CURVE_TOLERANCE_PT = 0.25;
const MAX_CURVE_STEPS = 64;

const lerp = (a: PdfPoint, b: PdfPoint, t: number): PdfPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a: PdfPoint, b: PdfPoint): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Η Bézier `from → to` ως σημεία (χωρίς το `from`), με βήματα ανάλογα του μήκους του πολυγώνου ελέγχου. */
export function flattenCubic(from: PdfPoint, c1: PdfPoint, c2: PdfPoint, to: PdfPoint): PdfPoint[] {
  const hull = distance(from, c1) + distance(c1, c2) + distance(c2, to);
  const steps = Math.min(MAX_CURVE_STEPS, Math.max(1, Math.ceil(Math.sqrt(hull / CURVE_TOLERANCE_PT))));
  const points: PdfPoint[] = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const a = lerp(lerp(from, c1, t), lerp(c1, c2, t), t);
    const b = lerp(lerp(c1, c2, t), lerp(c2, to, t), t);
    points.push(lerp(a, b, t));
  }
  points.push(to); // το τέλος ΑΚΡΙΒΩΣ (όχι μέσω αριθμητικής), ώστε η επόμενη ευθεία να συνεχίζει χωρίς κενό
  return points;
}

function subpathPoints(subpath: PdfSubpath): { points: PdfPoint[]; closed: boolean } {
  if (subpath.kind === 'rect') return { points: [...subpath.corners], closed: true };
  const points: PdfPoint[] = [subpath.start];
  for (const segment of subpath.segments) {
    const from = points[points.length - 1];
    if (segment.kind === 'line') points.push(segment.to);
    else points.push(...flattenCubic(from, segment.c1, segment.c2, segment.to));
  }
  return { points, closed: subpath.closed };
}

/** Οι πολυγραμμές των διαδρομών με πινελιά, σε px (`toPx`), και πόσες διαδρομές είχαν μόνο γέμισμα. */
export function strokedPolylines(
  ops: PdfPathOperators, fnArray: readonly number[], argsArray: readonly (readonly unknown[] | null)[], toPx: (p: PdfPoint) => PxPoint,
): { polylines: PdfVectorPolyline[]; skippedFills: number } {
  const polylines: PdfVectorPolyline[] = [];
  let skippedFills = 0;
  for (const path of walkPaintedPaths(ops, fnArray, argsArray)) {
    if (!path.stroke) { skippedFills += 1; continue; }
    for (const subpath of path.subpaths) {
      const { points, closed } = subpathPoints(subpath);
      if (points.length >= 2) polylines.push({ points: points.map(toPx), closed: closed || path.closedByPaint });
    }
  }
  return { polylines, skippedFills };
}

interface PdfjsTextItem {
  readonly str: string;
  readonly transform: readonly number[];
}

const isTextItem = (item: unknown): item is PdfjsTextItem =>
  typeof item === 'object' && item !== null && typeof (item as { str?: unknown }).str === 'string'
  && Array.isArray((item as { transform?: unknown }).transform) && (item as { transform: unknown[] }).transform.length === 6;

/** Τα κείμενα της σελίδας (κενά/λευκά έξω), με τα τρία σημεία τους σε px. */
export function pageTexts(items: readonly unknown[], toPx: (p: PdfPoint) => PxPoint): PdfVectorText[] {
  return items.filter(isTextItem).flatMap((item) => {
    const text = item.str.trim();
    if (text.length === 0) return [];
    const [a, b, c, d, e, f] = item.transform;
    return [{ text, origin: toPx([e, f]), along: toPx([e + a, f + b]), up: toPx([e + c, f + d]) }];
  });
}

/** Το περιεχόμενο μιας ανοιγμένης σελίδας, σε px της απόδοσης `scale` (η κλίμακα του provider). */
export async function readVectorContent(page: VectorSourcePage, ops: PdfPathOperators, scale: number): Promise<PdfVectorContent> {
  const viewport = page.getViewport({ scale });
  const toPx = ([x, y]: PdfPoint): PxPoint => {
    const [px, py] = viewport.convertToViewportPoint(x, y);
    return [px, py];
  };
  const { fnArray, argsArray } = await page.getOperatorList();
  const { polylines, skippedFills } = strokedPolylines(ops, fnArray, argsArray, toPx);
  const { items } = await page.getTextContent();
  return { polylines, texts: pageTexts(items, toPx), skippedFills };
}
