/**
 * Η **δομή μιας σελίδας PDF** (ADR-923 §5.5.1): οι ζωγραφισμένες γραμμές και οι πίνακες των ετικετών, όπως τα περιέχει το αρχείο.
 * Δέχεται ανοιγμένη σελίδα, γι' αυτό δεν φορτώνει pdf.js: το συμβόλαιο φόρτωσης ζει στο `pdf-rasterize.service.ts`.
 *
 * Μετράνε μόνο οι διαδρομές που **ζωγραφίζονται**: η ίδια εντολή `re` κόβει και το πλαίσιο μιας φωτογραφίας (`clip`), και αυτό δεν
 * είναι όριο κελιού.
 * @module services/pdf/pdf-page-structure
 */

export interface PageStructureRule {
  readonly axis: 'h' | 'v';
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

export interface PageStructureTagTable {
  readonly rows: readonly (readonly string[])[];
}

export interface PdfPageStructure {
  readonly rules: readonly PageStructureRule[];
  readonly tagTables: readonly PageStructureTagTable[];
  /**
   * Πόσες εντολές της σελίδας **γράφουν κείμενο** (`Tj` · `TJ` · `'` · `"`). Μάρτυρας ανεξάρτητος από το `getTextContent`: σελίδα με
   * τέτοιες εντολές και άδειο κείμενο σημαίνει ότι **η ανάγνωση έχασε** το κείμενο, όχι ότι δεν υπάρχει (ADR-923 §5.5.1 Ε8).
   */
  readonly textOperations: number;
}

/** Οι κωδικοί εντολών του pdf.js που χρειάζονται εδώ. */
export type PdfjsOperators = Readonly<Record<
  | 'save' | 'restore' | 'transform' | 'constructPath' | 'moveTo' | 'lineTo' | 'curveTo' | 'curveTo2' | 'curveTo3' | 'closePath' | 'rectangle'
  | 'stroke' | 'closeStroke' | 'fill' | 'eoFill' | 'fillStroke' | 'eoFillStroke' | 'closeFillStroke' | 'closeEOFillStroke' | 'endPath'
  | 'paintFormXObjectBegin' | 'paintFormXObjectEnd'
  | 'showText' | 'showSpacedText' | 'nextLineShowText' | 'nextLineSetSpacingShowText',
  number
>>;

interface StructureViewport {
  readonly width: number;
  readonly height: number;
  convertToViewportPoint(x: number, y: number): [number, number];
}

interface StructNode {
  readonly role?: string;
  readonly type?: string;
  readonly id?: string;
  readonly children?: readonly StructNode[];
}

interface MarkedTextItem {
  readonly type?: string;
  readonly id?: string;
  readonly str?: string;
}

export interface StructurePage {
  getOperatorList(): Promise<{ readonly fnArray: readonly number[]; readonly argsArray: readonly (readonly unknown[] | null)[] }>;
  getStructTree(): Promise<StructNode | null>;
  getTextContent(options: { readonly includeMarkedContent: true }): Promise<{ readonly items: readonly MarkedTextItem[] }>;
}

type Matrix = readonly [number, number, number, number, number, number];
type Point = readonly [number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
/** ≈ 3 pt: λεπτό γεμισμένο ορθογώνιο είναι γραμμή, όχι κουτί. */
const THIN = 0.004;
/** Πλάγια κατά τόσο είναι ακόμη η ίδια οριζόντια ή κάθετη. */
const STRAIGHT = 0.001;
/** Μικρότερη γραμμή είναι στολίδι ή σημάδι, όχι όριο. */
const MIN_LENGTH = 0.003;

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const applied = (m: Matrix, x: number, y: number): Point => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

type Fraction = (point: Point) => Point;

const fractionOf = (viewport: StructureViewport): Fraction => ([x, y]) => {
  const [left, top] = viewport.convertToViewportPoint(x, y);
  return [left / viewport.width, top / viewport.height];
};

function ruleOf([x1, y1]: Point, [x2, y2]: Point): PageStructureRule | null {
  const horizontal = Math.abs(y1 - y2) <= STRAIGHT && Math.abs(x1 - x2) >= MIN_LENGTH;
  const vertical = Math.abs(x1 - x2) <= STRAIGHT && Math.abs(y1 - y2) >= MIN_LENGTH;
  if (horizontal) return { axis: 'h', at: (y1 + y2) / 2, from: Math.min(x1, x2), to: Math.max(x1, x2) };
  if (vertical) return { axis: 'v', at: (x1 + x2) / 2, from: Math.min(y1, y2), to: Math.max(y1, y2) };
  return null;
}

/** Ορθογώνιο: λεπτό ⇒ μία γραμμή, αλλιώς οι τέσσερις πλευρές του. */
function rectangleEdges([x1, y1]: Point, [x2, y2]: Point): PageStructureRule[] {
  const middleX = (x1 + x2) / 2;
  const middleY = (y1 + y2) / 2;
  if (Math.abs(y1 - y2) <= THIN) return [ruleOf([x1, middleY], [x2, middleY])].flatMap((rule) => rule ?? []);
  if (Math.abs(x1 - x2) <= THIN) return [ruleOf([middleX, y1], [middleX, y2])].flatMap((rule) => rule ?? []);
  return [ruleOf([x1, y1], [x2, y1]), ruleOf([x1, y2], [x2, y2]), ruleOf([x1, y1], [x1, y2]), ruleOf([x2, y1], [x2, y2])].flatMap((rule) => rule ?? []);
}

/** Τα ευθύγραμμα κομμάτια μιας διαδρομής. Οι καμπύλες δεν είναι όρια κελιών, απλώς μετακινούν τον δρομέα των συντεταγμένων. */
function pathRules(ops: PdfjsOperators, [subOps, coords]: readonly unknown[], matrix: Matrix, toFraction: Fraction): PageStructureRule[] {
  const values = coords as ArrayLike<number>;
  const rules: PageStructureRule[] = [];
  const point = (at: number): Point => toFraction(applied(matrix, values[at], values[at + 1]));
  let at = 0;
  let cursor: Point | null = null;
  let start: Point | null = null;
  for (const op of subOps as readonly number[]) {
    if (op === ops.moveTo) { cursor = point(at); start = cursor; at += 2; }
    else if (op === ops.lineTo) {
      const next = point(at);
      at += 2;
      if (cursor) rules.push(...[ruleOf(cursor, next)].flatMap((rule) => rule ?? []));
      cursor = next;
    } else if (op === ops.closePath) {
      if (cursor && start) rules.push(...[ruleOf(cursor, start)].flatMap((rule) => rule ?? []));
      cursor = start;
    } else if (op === ops.rectangle) {
      const [x, y, width, height] = [values[at], values[at + 1], values[at + 2], values[at + 3]];
      rules.push(...rectangleEdges(toFraction(applied(matrix, x, y)), toFraction(applied(matrix, x + width, y + height))));
      at += 4;
    } else if (op === ops.curveTo) at += 6;
    else if (op === ops.curveTo2 || op === ops.curveTo3) at += 4;
  }
  return rules;
}

const paintOperators = (ops: PdfjsOperators): ReadonlySet<number> =>
  new Set([ops.stroke, ops.closeStroke, ops.fill, ops.eoFill, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke]);

function formMatrix(args: readonly unknown[] | null): Matrix {
  const matrix = args?.[0];
  return Array.isArray(matrix) && matrix.length === 6 ? (matrix as unknown as Matrix) : IDENTITY;
}

function collectRules(ops: PdfjsOperators, fnArray: readonly number[], argsArray: readonly (readonly unknown[] | null)[], toFraction: Fraction): PageStructureRule[] {
  const paints = paintOperators(ops);
  const rules: PageStructureRule[] = [];
  const stack: Matrix[] = [];
  let matrix = IDENTITY;
  let pending: PageStructureRule[] = [];
  fnArray.forEach((fn, index) => {
    const args = argsArray[index];
    if (fn === ops.save) stack.push(matrix);
    else if (fn === ops.restore) matrix = stack.pop() ?? matrix;
    else if (fn === ops.transform) matrix = multiply(matrix, args as unknown as Matrix);
    else if (fn === ops.paintFormXObjectBegin) { stack.push(matrix); matrix = multiply(matrix, formMatrix(args)); }
    else if (fn === ops.paintFormXObjectEnd) matrix = stack.pop() ?? matrix;
    else if (fn === ops.constructPath && args) pending.push(...pathRules(ops, args, matrix, toFraction));
    else if (paints.has(fn)) { rules.push(...pending); pending = []; }
    else if (fn === ops.endPath) pending = [];
  });
  return rules;
}

function markedText(items: readonly MarkedTextItem[]): ReadonlyMap<string, string> {
  const text = new Map<string, string>();
  const open: string[] = [];
  for (const item of items) {
    if (item.type === 'beginMarkedContentProps' || item.type === 'beginMarkedContent') open.push(item.id ?? '');
    else if (item.type === 'endMarkedContent') open.pop();
    else if (item.str) for (const id of open.filter((value) => value !== '')) text.set(id, `${text.get(id) ?? ''}${item.str}`);
  }
  return text;
}

function nodeText(node: StructNode, text: ReadonlyMap<string, string>): string {
  if (node.type === 'content') return text.get(node.id ?? '') ?? '';
  return (node.children ?? []).map((child) => nodeText(child, text)).join('');
}

function nodesWithRole(node: StructNode, role: string): StructNode[] {
  if (node.role === role) return [node];
  return (node.children ?? []).flatMap((child) => nodesWithRole(child, role));
}

function tagTablesOf(root: StructNode, text: ReadonlyMap<string, string>): PageStructureTagTable[] {
  return nodesWithRole(root, 'Table').map((table) => ({
    rows: nodesWithRole({ children: table.children }, 'TR').map((row) => (row.children ?? []).filter(({ role }) => role === 'TD' || role === 'TH').map((cell) => nodeText(cell, text).trim())),
  }));
}

/** Οι ετικέτες είναι μάρτυρας, όχι προϋπόθεση: PDF χωρίς ή με σπασμένο δέντρο δομής είναι σελίδα χωρίς μάρτυρα, ποτέ σφάλμα. */
async function readTagTables(page: StructurePage): Promise<readonly PageStructureTagTable[]> {
  try {
    const root = await page.getStructTree();
    if (!root) return [];
    const { items } = await page.getTextContent({ includeMarkedContent: true });
    return tagTablesOf(root, markedText(items));
  } catch {
    return [];
  }
}

function countTextOperations(ops: PdfjsOperators, fnArray: readonly number[]): number {
  const shows = new Set([ops.showText, ops.showSpacedText, ops.nextLineShowText, ops.nextLineSetSpacingShowText]);
  return fnArray.reduce((count, fn) => (shows.has(fn) ? count + 1 : count), 0);
}

export async function readPageStructure(page: StructurePage, viewport: StructureViewport, ops: PdfjsOperators): Promise<PdfPageStructure> {
  const { fnArray, argsArray } = await page.getOperatorList();
  return {
    rules: collectRules(ops, fnArray, argsArray, fractionOf(viewport)),
    tagTables: await readTagTables(page),
    textOperations: countTextOperations(ops, fnArray),
  };
}
