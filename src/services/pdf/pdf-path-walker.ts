/**
 * Το **βάδισμα των εντολών σχεδίασης** μιας σελίδας PDF (ADR-941 §3): ποιες διαδρομές **ζωγραφίζονται**, σε συντεταγμένες
 * σελίδας (pt, μετά τον τρέχοντα πίνακα μετασχηματισμού). Ο ΕΝΑΣ αναγνώστης του `getOperatorList` για γεωμετρία: τον
 * χρησιμοποιούν η δομή σελίδας (ADR-923 §5.5.1, κανόνες πινάκων) και η εισαγωγή διανυσματικού PDF (ADR-941).
 *
 * 🔑 **Μόνο ό,τι ζωγραφίζεται.** Η ίδια διαδρομή μπορεί να κόβει (`clip` + `endPath`) αντί να ζωγραφίζει· τότε δεν είναι
 *   γεωμετρία (το πλαίσιο μιας φωτογραφίας δεν είναι όριο κελιού ούτε γραμμή σχεδίου).
 * 🔑 **Ο δρομέας ακολουθεί και τις καμπύλες:** μια ευθεία μετά από καμπύλη ξεκινά από το **τέλος της καμπύλης**.
 *   *(Το βάδισμα του ADR-923 το έγραφε στο σχόλιο αλλά δεν το έκανε: η ευθεία ξεκινούσε από το σημείο πριν την καμπύλη.)*
 *
 * Καθαρό: οι κωδικοί εντολών εγχέονται (`PdfPathOperators` ⊂ `pdfjs.OPS`), ώστε να ελέγχεται χωρίς pdf.js. Μορφή ορισμάτων
 * `constructPath` του pdf.js 4.x: `[υπο-εντολές, συντεταγμένες, minMax]`.
 *
 * @module services/pdf/pdf-path-walker
 */

/** Οι κωδικοί εντολών του pdf.js που χρειάζεται το βάδισμα. */
export type PdfPathOperators = Readonly<Record<
  | 'save' | 'restore' | 'transform' | 'constructPath' | 'moveTo' | 'lineTo' | 'curveTo' | 'curveTo2' | 'curveTo3' | 'closePath' | 'rectangle'
  | 'stroke' | 'closeStroke' | 'fill' | 'eoFill' | 'fillStroke' | 'eoFillStroke' | 'closeFillStroke' | 'closeEOFillStroke' | 'endPath'
  | 'paintFormXObjectBegin' | 'paintFormXObjectEnd',
  number
>>;

export type PdfPoint = readonly [number, number];
type Matrix = readonly [number, number, number, number, number, number];

export type PdfSegment =
  | { readonly kind: 'line'; readonly to: PdfPoint }
  | { readonly kind: 'curve'; readonly c1: PdfPoint; readonly c2: PdfPoint; readonly to: PdfPoint };

export type PdfSubpath =
  /** Εντολή `re`: οι τέσσερις γωνίες κατά σειρά, από `(x, y)` — η τρίτη είναι η απέναντι `(x + w, y + h)`. */
  | { readonly kind: 'rect'; readonly corners: readonly [PdfPoint, PdfPoint, PdfPoint, PdfPoint] }
  | { readonly kind: 'path'; readonly start: PdfPoint; readonly segments: readonly PdfSegment[]; readonly closed: boolean };

export interface PdfPaintedPath {
  readonly subpaths: readonly PdfSubpath[];
  readonly stroke: boolean;
  readonly fill: boolean;
  /** Η εντολή ζωγραφικής κλείνει τις υπο-διαδρομές (`s` · `b` · `b*`). */
  readonly closedByPaint: boolean;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const applied = (m: Matrix, x: number, y: number): PdfPoint => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

interface Paint {
  readonly stroke: boolean;
  readonly fill: boolean;
  readonly closes: boolean;
}

function paintTable(ops: PdfPathOperators): ReadonlyMap<number, Paint> {
  const paint = (stroke: boolean, fill: boolean, closes: boolean): Paint => ({ stroke, fill, closes });
  return new Map<number, Paint>([
    [ops.stroke, paint(true, false, false)], [ops.closeStroke, paint(true, false, true)],
    [ops.fill, paint(false, true, false)], [ops.eoFill, paint(false, true, false)],
    [ops.fillStroke, paint(true, true, false)], [ops.eoFillStroke, paint(true, true, false)],
    [ops.closeFillStroke, paint(true, true, true)], [ops.closeEOFillStroke, paint(true, true, true)],
  ]);
}

/** Ο συλλέκτης των υπο-διαδρομών ενός `constructPath`. */
class SubpathBuilder {
  readonly subpaths: PdfSubpath[] = [];
  private start: PdfPoint | null = null;
  private cursor: PdfPoint | null = null;
  private segments: PdfSegment[] = [];

  moveTo(point: PdfPoint): void {
    this.flush(false);
    this.start = point;
    this.cursor = point;
  }

  segment(segment: PdfSegment): void {
    if (this.cursor === null) this.moveTo(segment.to); // σκέτο lineTo χωρίς moveTo: ξεκινά εκεί (ανεκτικό, όπως το pdf.js)
    else this.segments.push(segment);
    this.cursor = segment.to;
  }

  closePath(): void {
    const start = this.start;
    this.flush(true);
    this.start = start;
    this.cursor = start;
  }

  rectangle(corners: readonly [PdfPoint, PdfPoint, PdfPoint, PdfPoint]): void {
    this.flush(false);
    this.subpaths.push({ kind: 'rect', corners });
    this.start = corners[0];
    this.cursor = corners[0];
  }

  /** Κλείνει την τρέχουσα υπο-διαδρομή (αν έχει τουλάχιστον ένα τμήμα) και αρχίζει νέα. */
  flush(closed: boolean): void {
    if (this.start !== null && this.segments.length > 0) {
      this.subpaths.push({ kind: 'path', start: this.start, segments: this.segments, closed });
    }
    this.segments = [];
    this.start = null;
    this.cursor = null;
  }

  current(): PdfPoint | null {
    return this.cursor;
  }
}

/** Οι υπο-διαδρομές ενός `constructPath`, σε συντεταγμένες σελίδας. */
export function pathSubpaths(ops: PdfPathOperators, [subOps, coords]: readonly unknown[], matrix: Matrix): PdfSubpath[] {
  const values = coords as ArrayLike<number>;
  const builder = new SubpathBuilder();
  const point = (at: number): PdfPoint => applied(matrix, values[at], values[at + 1]);
  let at = 0;
  for (const op of subOps as readonly number[]) {
    if (op === ops.moveTo) { builder.moveTo(point(at)); at += 2; }
    else if (op === ops.lineTo) { builder.segment({ kind: 'line', to: point(at) }); at += 2; }
    else if (op === ops.curveTo) { builder.segment({ kind: 'curve', c1: point(at), c2: point(at + 2), to: point(at + 4) }); at += 6; }
    else if (op === ops.curveTo2) { // `v`: το πρώτο σημείο ελέγχου είναι ο δρομέας
      const c1 = builder.current() ?? point(at);
      builder.segment({ kind: 'curve', c1, c2: point(at), to: point(at + 2) });
      at += 4;
    } else if (op === ops.curveTo3) { // `y`: το δεύτερο σημείο ελέγχου είναι το τέλος
      const to = point(at + 2);
      builder.segment({ kind: 'curve', c1: point(at), c2: to, to });
      at += 4;
    } else if (op === ops.closePath) builder.closePath();
    else if (op === ops.rectangle) { builder.rectangle(rectangleCorners(matrix, values, at)); at += 4; }
  }
  builder.flush(false);
  return builder.subpaths;
}

function rectangleCorners(matrix: Matrix, values: ArrayLike<number>, at: number): [PdfPoint, PdfPoint, PdfPoint, PdfPoint] {
  const [x, y, width, height] = [values[at], values[at + 1], values[at + 2], values[at + 3]];
  return [applied(matrix, x, y), applied(matrix, x + width, y), applied(matrix, x + width, y + height), applied(matrix, x, y + height)];
}

function formMatrix(args: readonly unknown[] | null): Matrix {
  const matrix = args?.[0];
  return Array.isArray(matrix) && matrix.length === 6 ? (matrix as unknown as Matrix) : IDENTITY;
}

/** Οι διαδρομές που **ζωγραφίζονται** στη σελίδα, με τη σειρά της ζωγραφικής. */
export function walkPaintedPaths(
  ops: PdfPathOperators, fnArray: readonly number[], argsArray: readonly (readonly unknown[] | null)[],
): PdfPaintedPath[] {
  const paints = paintTable(ops);
  const painted: PdfPaintedPath[] = [];
  const stack: Matrix[] = [];
  let matrix = IDENTITY;
  let pending: PdfSubpath[] = [];
  fnArray.forEach((fn, index) => {
    const args = argsArray[index];
    const paint = paints.get(fn);
    if (fn === ops.save) stack.push(matrix);
    else if (fn === ops.restore) matrix = stack.pop() ?? matrix;
    else if (fn === ops.transform) matrix = multiply(matrix, args as unknown as Matrix);
    else if (fn === ops.paintFormXObjectBegin) { stack.push(matrix); matrix = multiply(matrix, formMatrix(args)); }
    else if (fn === ops.paintFormXObjectEnd) matrix = stack.pop() ?? matrix;
    else if (fn === ops.constructPath && args) pending.push(...pathSubpaths(ops, args, matrix));
    else if (paint) {
      if (pending.length > 0) painted.push({ subpaths: pending, stroke: paint.stroke, fill: paint.fill, closedByPaint: paint.closes });
      pending = [];
    } else if (fn === ops.endPath) pending = [];
  });
  return painted;
}
