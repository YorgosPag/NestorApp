/**
 * ADR-739 Φάση Β — `TableLayout` → `DetailPrimitive[]`: η γέφυρα προς τα τρία **υπάρχοντα**
 * backends του §3.
 *
 * Ο `DetailPrimitive` (sheet-mm, y-κάτω) είναι ήδη η κοινή γλώσσα των τριών ζωγράφων που
 * το repo διαθέτει — canvas preview (`detail-canvas-renderer`), PDF (`detail-pdf-renderer`)
 * και **σκηνή** (`detail-primitives-to-entities`). Μεταφράζοντας εδώ, ο πίνακας αποκτά και
 * τους τρεις **χωρίς να γραφτεί ούτε ένας νέος ζωγράφος**· το τέταρτο backend (DXF
 * `ACAD_TABLE`, Φ.Ε) διαβάζει το `TableLayout` απευθείας, γιατί εκεί ο πίνακας είναι
 * first-class και η αποδόμηση σε γραμμές+κείμενο θα ήταν απώλεια.
 *
 * ## Η σειρά εξόδου — γιατί «ανά γραμμή: πρώτα η ακμή, μετά τα κελιά»
 * Σε καμβά και PDF η σειρά **είναι** το z-order. Η σειρά που παράγεται εδώ είναι:
 * ```
 *   ΟΛΑ τα γεμίσματα κελιών                       (ADR-739 Φ.Ε/Φ1)
 *   για κάθε γραμμή r:  η ΠΑΝΩ ακμή της r  →  τα κελιά της r
 *   η κάτω ακμή του πίνακα
 *   όλες οι κατακόρυφες
 * ```
 * Δεν είναι αυθαίρετη: αναπαράγει **ακριβώς** τη σειρά που έβγαζε ο ADR-622 χειρόγραφα
 * (κεφαλίδα → γραμμή κάτω από την κεφαλίδα → δεδομένα → γραμμή πάνω από το σύνολο →
 * σύνολο). Η απορρόφηση έτσι διατηρεί και το z-order, όχι μόνο τη γεωμετρία. Τα γεμίσματα
 * μπαίνουν **μπροστά από όλα** για τον ίδιο ακριβώς λόγο που ο ζωγράφος της οθόνης τα
 * στοιβάζει πρώτα — δες {@link fillPrimitive}. Ο ADR-622 δεν έχει γεμίσματα, οπότε το
 * πρόθεμα είναι κενό για τα φύλλα οπλισμού και κανένα snapshot τους δεν μετακινείται.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-to-primitives
 * @see ./table-layout.ts — η μηχανή που παράγει το `TableLayout`
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DetailPrimitive } from '../structural/detail-sheet/detail-sheet-types';
import type {
  TableBorderSegment,
  TableCellLayout,
  TableLayout,
  TableTextRun,
} from './table-layout-types';

/** Πού κάθεται η πάνω-αριστερή γωνία του πίνακα μέσα στο φύλλο (sheet-mm). */
export interface TableOriginMm {
  readonly xMm: number;
  readonly yMm: number;
}

const ORIGIN_ZERO: TableOriginMm = { xMm: 0, yMm: 0 };

function translate(p: Point2D, origin: TableOriginMm): Point2D {
  return { x: p.x + origin.xMm, y: p.y + origin.yMm };
}

function textPrimitive(run: TableTextRun, origin: TableOriginMm): DetailPrimitive {
  return {
    kind: 'text',
    position: translate(run.position, origin),
    text: run.text,
    heightMm: run.heightMm,
    colorHex: run.colorHex,
    align: run.hAlign,
    bold: run.bold,
  };
}

/**
 * 🔴 ADR-739 Φ.Ε/Φ1 — **το γέμισμα του κελιού, ως primitive**.
 *
 * Μέχρι τη Φ1 το `cell.style.fillColorHex` **δεν διαβαζόταν ποτέ** εδώ: ο καμβάς το
 * ζωγράφιζε (`stampTableFills`) και τα primitives δεν το γνώριζαν καν. Άρα το γέμισμα δεν
 * «χανόταν στην εξαγωγή» — **δεν γεννιόταν**. Η γκρίζα γραμμή κεφαλίδας έβγαινε λευκή σε
 * PDF, DXF και TEK ταυτόχρονα, και σε κανένα από τα τρία δεν υπήρχε τι να χαθεί.
 *
 * ## Γιατί `polyline` + `fillHex` και ΟΧΙ νέο `kind: 'fill'`
 * Το λεξιλόγιο **υπάρχει ήδη**: το `PolylinePrimitive.fillHex` (`detail-sheet-types.ts`) το
 * τιμούν και οι **τρεις** ζωγράφοι του μοντέλου φύλλου — καμβάς (`detail-canvas-renderer`),
 * PDF (`detail-pdf-primitives`, `'DF'`) και σκηνή (`detail-primitives-to-entities`). Ένα νέο
 * kind θα υποχρέωνε **κάθε** `switch (prim.kind)` του repo να το μάθει, και όποιο ξεχνούσε
 * θα το κατάπινε στο `default` — δηλαδή θα αναπαρήγαγε, σε νέα συσκευασία, ακριβώς το
 * ελάττωμα που αυτή η φάση διορθώνει.
 *
 * ## Γιατί το `stroke` έχει το χρώμα του γεμίσματος και μηδενικό πάχος
 * Το `stroke` είναι **υποχρεωτικό** στο `PolylinePrimitive` και οι ζωγράφοι χαράζουν πάντα
 * (`'DF'` = draw+fill). Ένα περίγραμμα στο **ίδιο** χρώμα με το γέμισμα, πάνω στο δικό του
 * περίγραμμα, είναι οπτικά ανύπαρκτο — ενώ ένα ξένο χρώμα θα ζωγράφιζε δεύτερο, αυθαίρετο
 * πλέγμα πάνω από το κανονικό. Τα πραγματικά περιγράμματα του πίνακα έρχονται χωριστά, από
 * το {@link borderPrimitive}, με τα δικά τους μολύβια.
 */
function fillPrimitive(cell: TableCellLayout, origin: TableOriginMm): DetailPrimitive | null {
  const fillHex = cell.style.fillColorHex;
  if (!fillHex) return null;
  const { x, y, w, h } = cell.rect;
  const points = [
    translate({ x, y }, origin),
    translate({ x: x + w, y }, origin),
    translate({ x: x + w, y: y + h }, origin),
    translate({ x, y: y + h }, origin),
  ];
  return {
    kind: 'polyline',
    points,
    closed: true,
    stroke: { colorHex: fillHex, widthMm: 0 },
    fillHex,
  };
}

/**
 * Το `dashMm` μπαίνει **μόνο** όταν υπάρχει: ένα ρητό `dashMm: undefined` θα άλλαζε το
 * σχήμα του αντικειμένου σε σύγκριση με τα χειρόγραφα primitives του ADR-622 (και άρα
 * κάθε snapshot), χωρίς καμία οπτική διαφορά.
 */
function borderPrimitive(segment: TableBorderSegment, origin: TableOriginMm): DetailPrimitive {
  const stroke = segment.spec.dashMm
    ? { colorHex: segment.spec.colorHex, widthMm: segment.spec.widthMm, dashMm: segment.spec.dashMm }
    : { colorHex: segment.spec.colorHex, widthMm: segment.spec.widthMm };
  return { kind: 'line', a: translate(segment.a, origin), b: translate(segment.b, origin), stroke };
}

/** Χωρίζει τα τμήματα σε οριζόντια (ομαδοποιημένα κατά y) και κατακόρυφα. */
function splitBorders(borders: readonly TableBorderSegment[]): {
  readonly horizontalByY: ReadonlyMap<number, TableBorderSegment[]>;
  readonly verticals: readonly TableBorderSegment[];
} {
  const horizontalByY = new Map<number, TableBorderSegment[]>();
  const verticals: TableBorderSegment[] = [];
  for (const segment of borders) {
    if (segment.a.y !== segment.b.y) {
      verticals.push(segment);
      continue;
    }
    const bucket = horizontalByY.get(segment.a.y);
    if (bucket) bucket.push(segment);
    else horizontalByY.set(segment.a.y, [segment]);
  }
  return { horizontalByY, verticals };
}

/** Τα κελιά ομαδοποιημένα ανά γραμμή, διατηρώντας τη σειρά στηλών. */
function cellsByRow(cells: readonly TableCellLayout[]): ReadonlyMap<string, TableCellLayout[]> {
  const map = new Map<string, TableCellLayout[]>();
  for (const cell of cells) {
    const bucket = map.get(cell.rowId);
    if (bucket) bucket.push(cell);
    else map.set(cell.rowId, [cell]);
  }
  return map;
}

/**
 * Μετατρέπει μια διάταξη πίνακα σε primitives φύλλου, μετατοπισμένα στην `origin`.
 *
 * Δεν παράγεται τίποτα για κενά κελιά (η μηχανή δεν τους δίνει `text`), για κελιά χωρίς
 * `fillColorHex`, ούτε για αόρατες ακμές (τις έχει ήδη απορρίψει το στάδιο περιγραμμάτων)
 * — ώστε ένας πίνακας χωρίς πλέγμα και χωρίς γεμίσματα να βγάζει **μόνο** κείμενο, όπως
 * ακριβώς τα σημερινά φύλλα οπλισμού.
 */
export function tableLayoutToPrimitives(
  layout: TableLayout,
  origin: TableOriginMm = ORIGIN_ZERO,
): DetailPrimitive[] {
  const out: DetailPrimitive[] = [];
  if (layout.rows.length === 0) return out;

  const { horizontalByY, verticals } = splitBorders(layout.borders);
  const byRow = cellsByRow(layout.cells);

  // 🔴 ADR-739 Φ.Ε/Φ1 — ΟΛΑ τα γεμίσματα ΠΡΩΤΑ, πριν από κάθε γραμμή και κάθε γράμμα.
  // Σε καμβά και PDF η σειρά ΕΙΝΑΙ το z-order (βλ. την επικεφαλίδα αυτού του αρχείου): ένα
  // γέμισμα που θα έβγαινε μετά θα σκέπαζε το πλέγμα και τα γράμματα του ίδιου του κελιού
  // του. Ίδια σειρά με τον ζωγράφο της οθόνης (`stampTableFills` → `stampTableBorders` →
  // `stampTableText`) — οι δύο διαδρομές δεν έχουν πλέον σημείο να διαφωνήσουν.
  for (const cell of layout.cells) {
    const fill = fillPrimitive(cell, origin);
    if (fill) out.push(fill);
  }

  const pushHorizontalAt = (y: number): void => {
    for (const segment of horizontalByY.get(y) ?? []) out.push(borderPrimitive(segment, origin));
  };

  for (const row of layout.rows) {
    pushHorizontalAt(row.yMm);
    for (const cell of byRow.get(row.id) ?? []) {
      if (cell.text) out.push(textPrimitive(cell.text, origin));
    }
  }

  const last = layout.rows[layout.rows.length - 1];
  pushHorizontalAt(last.yMm + last.heightMm);
  for (const segment of verticals) out.push(borderPrimitive(segment, origin));

  return out;
}
