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
import { tableUnderlineGeometry } from './table-text-decoration';
// 🔴 Η ΙΔΙΑ ερώτηση με τον ζωγράφο του καμβά, από το ΙΔΙΟ σημείο: αν οθόνη και χαρτί
// απαντούσαν χωριστά «είναι ΟΛΟ το κελί σύνδεσμος;», θα μπορούσαν κάποτε να διαφωνήσουν.
import { wholeRunLink } from './table-cell-link-spans';
import { TABLE_CELL_LINK } from '../../config/color-config';

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
    // ADR-751 — κελί που είναι ΟΛΟ διεύθυνση βγαίνει μπλε **και σε χαρτί**: ο σύνδεσμος είναι
    // περιεχόμενο, όχι διεπαφή, και ένα τυπωμένο φύλλο ποσοτήτων οφείλει να δείχνει ποια
    // κελιά είναι στοιχεία επικοινωνίας. Δες `TABLE_CELL_LINK` για το γιατί άλλο μπλε.
    colorHex: wholeRunLink(run) ? TABLE_CELL_LINK.colorHex : run.colorHex,
    align: run.hAlign,
    bold: run.bold,
    // 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **παρόν μόνο όταν αληθεύει**, όπως το `clipped` και το
    // `dashMm`. Ένα ρητό `italic: false` θα άλλαζε το **σχήμα** κάθε primitive κειμένου του
    // repo — και μαζί τα snapshots χαρακτηρισμού του ADR-622, που υπάρχουν για να αποδεικνύουν
    // ότι η μηχανή πίνακα αναπαράγει **αυτούσια** τα χειρόγραφα φύλλα οπλισμού. Μετρήθηκε:
    // 5 snapshots κόκκινα σε μία σουίτα. Ένα anchor που μετακινείται παύει να είναι anchor.
    //
    // Δεν χάνεται τίποτα: ο `mapTablePrimitive` γράφει `italic: prim.italic ?? false` προς την
    // οντότητα, οπότε το DXF/PDF/ΤΕΚ δηλώνουν πάντα την όψη — απλώς η προεπιλογή ζει στο ΕΝΑ
    // σημείο που μεταφράζει, όχι σε κάθε primitive που ταξιδεύει.
    ...(run.italic && { italic: true as const }),
    // Απούσα οικογένεια = «η προεπιλογή του μετρητή». Δεν γεμίζεται με literal εδώ: ένα
    // `?? 'Arial'` θα ήταν ακριβώς το καρφωτό `arial` που το βήμα 3 (Α3) μόλις ξερίζωσε.
    ...(run.fontFamily !== undefined && { fontFamily: run.fontFamily }),
  };
}

/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **η υπογράμμιση ταξιδεύει ως γεωμετρία, όχι ως κωδικός ελέγχου.**
 *
 * ## Γιατί ΟΧΙ το `%%u` του DXF
 * Το `%%u` είναι ο κωδικός ελέγχου υπογράμμισης σε οντότητα `TEXT`, και η προφανής επιλογή —
 * μέχρι να διαβαστούν τρία μετρημένα γεγονότα:
 *
 * 1. **Η ίδια η τεκμηρίωση της Autodesk** («Control Codes and Special Characters») λέει ότι
 *    ο κωδικός δουλεύει «with standard AutoCAD text fonts (**SHX**) and Adobe PostScript
 *    fonts». **Η TrueType δεν αναφέρεται** — και τα κελιά του πίνακα είναι TrueType (Α3).
 * 2. **Ο δικός μας importer δεν αποκωδικοποιεί `%%u`**: ο tokenizer γνωρίζει `%%c`/`%%d`/`%%p`
 *    και τα MTEXT `\L`/`\l`, τίποτε άλλο. Γράφοντας `%%u` θα εξάγαμε αρχείο που **η ίδια μας
 *    η εφαρμογή** ξαναδιαβάζει ως το κυριολεκτικό κείμενο «%%uΣΥΝΟΛΟ».
 * 3. Ο κωδικός **δεν ισχύει σε MTEXT** — δηλαδή θα πέθαινε στη native `ACAD_TABLE` διαδρομή
 *    της Φ.Ε, που είναι MTEXT-based.
 *
 * ## Τι κερδίζει η γεωμετρία
 * Ένα `line` primitive περνά από την **υπάρχουσα** διαδρομή και φτάνει σε **τέσσερα**
 * backends χωρίς κώδικα ανά backend: καμβάς προεπισκόπησης, PDF, DXF **και ΤΕΚ** — ο
 * Τέκτονας δεν έχει καμία έννοια υπογράμμισης, αλλά ζωγραφίζει γραμμές. Είναι το **μόνο**
 * κομμάτι της τυπογραφίας αυτού του βήματος που φτάνει και στα τέσσερα.
 *
 * Και επειδή παράγεται στο πλαίσιο του **φύλλου**, η στροφή του πίνακα εφαρμόζεται πάνω της
 * από την ίδια `tableFrameToWorld` με κάθε άλλη γραμμή — δηλαδή η υπογράμμιση **δεν μπορεί**
 * να μείνει οριζόντια κάτω από γερμένο κείμενο. Στον καμβά αυτό χρειάστηκε ρητή προσοχή
 * (§28.10.3)· εδώ είναι δομικά αδύνατο.
 *
 * ## Γιατί `line` με πένα και όχι γεμισμένο ορθογώνιο
 * Ένα γεμισμένο ορθογώνιο (ό,τι κάνει το explode κειμένου) θα ήταν εξίσου ακριβές σε καμβά
 * και PDF, αλλά **αόρατο στον Τέκτονα**, που δεν ζωγραφίζει solid fills (δες
 * `mapTablePrimitive`). Η γραμμή με πάχος = το κλάσμα του `em` κουμπώνει στον κατάλογο ISO
 * μέσω του υπάρχοντος `penFor` — και ένα υπογραμμισμένο σύνολο σε φύλλο εκτύπωσης **είναι**
 * μολύβι, όχι επιφάνεια.
 */
function underlinePrimitive(run: TableTextRun, origin: TableOriginMm): DetailPrimitive | null {
  if (!run.underline) return null;
  return underlineLine(run, origin, run.hAlign, run.advanceMm, 0, run.colorHex);
}

/**
 * 🔴 ADR-751 — οι γραμμές των **συνδέσμων** ενός κελιού, σε sheet-mm.
 *
 * ## Τι φτάνει στο χαρτί και τι όχι — ρητά
 * Κελί που είναι **ολόκληρο** διεύθυνση φτάνει πλήρες: μπλε γράμματα (δες `textPrimitive`)
 * **και** μπλε υπογράμμιση. Σε **μικτό** κείμενο («Τηλ: 2310788493») φτάνει η υπογράμμιση
 * του τμήματος, αλλά τα γράμματα μένουν στο χρώμα του στυλ.
 *
 * Ο περιορισμός είναι πραγματικός και δηλώνεται αντί να κρυφτεί: το `DetailPrimitive` με
 * `kind: 'text'` κουβαλά **ένα** `colorHex` για όλη τη συμβολοσειρά, και το να σπάσει το
 * κείμενο σε Ν primitives θα σήμαινε Ν χωριστές κλήσεις σχεδίασης σε **τέσσερα** backends —
 * δηλαδή θα έχανε το ζεύγος kerning σε κάθε όριο, σε PDF, DXF και ΤΕΚ ταυτόχρονα, για να
 * κερδίσει χρώμα σε μια περίπτωση που **καμία** εφαρμογή αναφοράς δεν υποστηρίζει: στο Excel
 * ο υπερσύνδεσμος είναι ιδιότητα **ολόκληρου** του κελιού, ποτέ υποσυμβολοσειράς.
 *
 * Άρα η οθόνη είναι πιο εκφραστική από το χαρτί εδώ **κατά σχεδιασμό**, και το χαρτί δεν λέει
 * ποτέ ψέματα: η υπογράμμιση δείχνει ακριβώς ποιο κομμάτι είναι η διεύθυνση.
 */
function linkUnderlinePrimitives(run: TableTextRun, origin: TableOriginMm): DetailPrimitive[] {
  const links = run.links;
  if (!links?.length) return [];
  // Το στυλ υπογραμμίζει ήδη ΟΛΟ το κελί — δεύτερη γραμμή στο ίδιο `y` είναι η ίδια γραμμή.
  if (run.underline && wholeRunLink(run)) return [];

  const out: DetailPrimitive[] = [];
  for (const span of links) {
    // `'left'`: η στοίχιση είναι ήδη διπλωμένη μέσα στο `offsetMm` (δες `table-cell-link-spans`).
    const line = underlineLine(
      run, origin, 'left', span.advanceMm, span.offsetMm, TABLE_CELL_LINK.colorHex,
    );
    if (line) out.push(line);
  }
  return out;
}

/**
 * Η ΜΙΑ κατασκευή γραμμής υπογράμμισης — του στυλ και των συνδέσμων.
 *
 * Εξήχθη όταν απέκτησε δεύτερο καλούντα (ADR-751): δύο σώματα που μεταφράζουν
 * `tableUnderlineGeometry` σε `line` primitive θα ήταν sibling clone (N.18 / CHECK 3.28),
 * και — χειρότερα — δύο σημεία που θα μπορούσαν να διαφωνήσουν για το πού πέφτει η γραμμή.
 */
function underlineLine(
  run: TableTextRun,
  origin: TableOriginMm,
  hAlign: TableTextRun['hAlign'],
  advanceMm: number,
  offsetMm: number,
  colorHex: string,
): DetailPrimitive | null {
  const g = tableUnderlineGeometry(run.heightMm, advanceMm, hAlign);
  if (!(g.width > 0)) return null;
  const p = translate(run.position, origin);
  const y = p.y + g.y;
  const x = p.x + g.x + offsetMm;
  return {
    kind: 'line',
    a: { x, y },
    b: { x: x + g.width, y },
    // Το μελάνι της υπογράμμισης είναι το μελάνι του κειμένου — όπως στον καμβά, όπου το
    // `fillRect` κληρονομεί το `ctx.fillStyle` του run, και όπως στο AutoCAD, όπου η γραμμή
    // υπογράμμισης παίρνει το χρώμα του ίδιου του κειμένου.
    stroke: { colorHex, widthMm: g.thickness },
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

  // ADR-750 Φ5 (Α2) — οι **διαγώνιοι**, αμέσως μετά τα γεμίσματα και **πριν** από κάθε γραμμή
  // πλέγματος και κάθε γράμμα. Η ίδια σειρά με τον ζωγράφο της οθόνης, όπου ζωγραφίζονται
  // επίσης πριν το κείμενο: ένα «Ν/Α» πάνω σε διαγραμμένο κελί οφείλει να μένει αναγνώσιμο σε
  // χαρτί όσο και στην οθόνη.
  for (const cell of layout.cells) {
    for (const segment of cell.diagonals ?? []) out.push(borderPrimitive(segment, origin));
  }

  for (const row of layout.rows) {
    pushHorizontalAt(row.yMm);
    for (const cell of byRow.get(row.id) ?? []) {
      if (!cell.text) continue;
      out.push(textPrimitive(cell.text, origin));
      // Η υπογράμμιση **μετά** το κείμενο του ίδιου κελιού: σε καμβά και PDF η σειρά είναι το
      // z-order, και ο ζωγράφος της οθόνης τη βάζει κι αυτός μετά το `fillText` (μέσα στην
      // ίδια στροφή). Ίδια σειρά ⇒ ίδιο αποτέλεσμα σε ημιδιαφανή μελάνια.
      const underline = underlinePrimitive(cell.text, origin);
      if (underline) out.push(underline);
      // ADR-751 — και οι γραμμές των διευθύνσεων, με την ίδια λογική σειράς (μετά το κείμενο).
      out.push(...linkUnderlinePrimitives(cell.text, origin));
    }
  }

  const last = layout.rows[layout.rows.length - 1];
  pushHorizontalAt(last.yMm + last.heightMm);
  for (const segment of verticals) out.push(borderPrimitive(segment, origin));

  return out;
}
