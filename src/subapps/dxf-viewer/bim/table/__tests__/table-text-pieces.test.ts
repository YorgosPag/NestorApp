/**
 * 🔴 ADR-753 Φ3 — **τι ζωγραφίζεται για ένα κελί, και πού** (SSoT + η γέφυρα primitives).
 *
 * Το `table-cell-styled-spans.test.ts` κλειδώνει *πού κάθεται κάθε τμήμα σχετικά με την αρχή
 * του κειμένου*. Εδώ κλειδώνεται το βήμα που ακολουθεί και είναι αόρατο στη Φ2: **πού κάθεται
 * σχετικά με την ΑΓΚΥΡΑ** — δηλαδή η στοίχιση, που διπλώνεται **μία** φορά.
 *
 * ## 🔴 Γιατί αυτή η σουίτα υπάρχει: ένα σχόλιο έλεγε το αντίθετο από τον κώδικα
 * Μέχρι τη Φ3 το `TableTextStyleSpan.offsetMm` τεκμηριωνόταν ως «σχετικά με την **άγκυρα** …
 * ώστε ο ζωγράφος να μη χρειαστεί δεύτερο ternary». Ο κώδικας ξεκινούσε πάντα στο 0. Ένας
 * ζωγράφος που πίστευε το σχόλιο θα ζωγράφιζε **κάθε** κεντραρισμένο ή δεξιά στοιχισμένο κελί
 * με μορφοποίηση μετατοπισμένο κατά μισό ή ολόκληρο το πλάτος του — και **κανένα** test της
 * Φ2 δεν θα το έβλεπε, γιατί όλα ρωτούσαν αριστερά στοιχισμένα κελιά.
 *
 * ⚠️ Ο μετρητής κρατά τις **δύο** ιδιότητες της Φ2 (έντονα διπλάσια, ζεύγος `AB` μέσα στην
 * ίδια κλήση): χωρίς αυτές, ομοιογενής και ετερογενής μέτρηση δίνουν τον ίδιο αριθμό και κάθε
 * test είναι πράσινο **κατά σύμπτωση** (ADR-753 §8).
 *
 * @see bim/table/table-text-pieces.ts
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import {
  tablePieceInkHex,
  tablePieceLinkStrips,
  tableTextPieces,
} from '../table-text-pieces';
import { tableUnderlineGeometry } from '../table-text-decoration';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer, TableTextRun } from '../table-layout-types';
import { TABLE_CELL_LINK } from '../../../config/color-config';
import type {
  ScheduleColumnAlign,
  TableCell,
  TableCellTextRun,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { LinePrimitive, TextPrimitive } from '../../structural/detail-sheet/detail-sheet-types';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

/** `0.6 × ύψος` ανά χαρακτήρα, **έντονα διπλάσια** — ίδιος με τη Φ2, ίδιος λόγος (§8). */
const measureText: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

const ROW: TableRow = { id: 'r1', rowClass: 'data' };

const BOLD = (start: number, end: number): TableCellTextRun => ({
  start,
  end,
  style: { bold: true },
});

function columnWith(align: ScheduleColumnAlign): TableColumn {
  return { id: 'c1', sizing: { kind: 'fixed', widthMm: 400 }, valueType: 'text', align };
}

interface CellSpec {
  readonly value: TableCell['value'];
  readonly runs?: readonly TableCellTextRun[];
  readonly align?: ScheduleColumnAlign;
}

/** Το τοποθετημένο run ενός κελιού — η **έξοδος της διάταξης**, όχι στημένο δείγμα. */
function runOf(spec: CellSpec): TableTextRun {
  const model = createTableModel({
    columns: [columnWith(spec.align ?? 'left')],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value: spec.value, ...(spec.runs && { runs: spec.runs }) }]],
  });
  const run = layoutTable(model, STYLE, { measureText }).cells[0]?.text;
  if (!run) throw new Error('η διάταξη δεν παρήγαγε κείμενο');
  return run;
}

function textPrimitivesOf(spec: CellSpec): readonly TextPrimitive[] {
  const model = createTableModel({
    columns: [columnWith(spec.align ?? 'left')],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value: spec.value, ...(spec.runs && { runs: spec.runs }) }]],
  });
  return tableLayoutToPrimitives(layoutTable(model, STYLE, { measureText }))
    .filter((p): p is TextPrimitive => p.kind === 'text');
}

// ── Η αναλλοίωτη: χωρίς spans, ο σημερινός δρόμος ───────────────────────────

describe('χωρίς μορφοποίηση ανά χαρακτήρα — ΕΝΑ κομμάτι, το ίδιο το run', () => {
  it('ένα κομμάτι, μηδενική μετατόπιση, η στοίχιση ΤΟΥ RUN', () => {
    const run = runOf({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' });
    const pieces = tableTextPieces(run);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].text).toBe(run.text);
    expect(pieces[0].offsetMm).toBe(0);
    expect(pieces[0].align).toBe(run.hAlign);
    expect(pieces[0].whole).toBe(true);
  });

  it('🔴 το κομμάτι κουβαλά ΤΗΝ τυπογραφία του run — καμία κληρονομιά να αποκλίνει', () => {
    const run = runOf({ value: 'ΠΕΡΙΓΡΑΦΗ' });
    const [piece] = tableTextPieces(run);
    expect({
      heightMm: piece.heightMm, colorHex: piece.colorHex,
      bold: piece.bold, italic: piece.italic, underline: piece.underline,
    }).toEqual({
      heightMm: run.heightMm, colorHex: run.colorHex,
      bold: run.bold, italic: run.italic, underline: run.underline,
    });
  });

  it('🔴 το χαρτί βγάζει ΕΝΑ primitive κειμένου — byte-ίδιο με πριν τη Φ3', () => {
    const prims = textPrimitivesOf({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' });
    const run = runOf({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' });
    expect(prims).toHaveLength(1);
    expect(prims[0].position).toEqual(run.position);
    expect(prims[0].align).toBe(run.hAlign);
    expect(prims[0].text).toBe(run.text);
  });
});

// ── Η στοίχιση διπλώνεται ΜΙΑ φορά ──────────────────────────────────────────

describe('🔴 η στοίχιση — το εύρημα που το σχόλιο του Φ2 έκρυβε', () => {
  const text = 'AABBCC';

  it('αριστερή στοίχιση: τα κομμάτια κάθονται στα ωμά αθροίσματα της Φ2', () => {
    const run = runOf({ value: text, runs: [BOLD(2, 4)], align: 'left' });
    const pieces = tableTextPieces(run);
    expect(pieces.map((p) => [p.text, p.offsetMm])).toEqual(
      run.spans!.map((s) => [s.text, s.offsetMm]),
    );
  });

  it('🔴 ΚΕΝΤΡΙΚΗ στοίχιση: το ΠΡΩΤΟ κομμάτι ξεκινά στο −πλάτος/2, ΟΧΙ στο μηδέν', () => {
    const run = runOf({ value: text, runs: [BOLD(2, 4)], align: 'center' });
    const spans = run.spans!;
    const totalMm = spans[spans.length - 1].offsetMm + spans[spans.length - 1].advanceMm;

    const pieces = tableTextPieces(run);
    expect(pieces[0].offsetMm).toBeCloseTo(-totalMm / 2, 10);
    // Και κάθε επόμενο μετατοπίζεται κατά ΤΟ ΙΔΙΟ ποσό — μία δίπλωση, όχι μία ανά κομμάτι.
    for (let i = 0; i < pieces.length; i++) {
      expect(pieces[i].offsetMm - spans[i].offsetMm).toBeCloseTo(-totalMm / 2, 10);
    }
  });

  it('🔴 ΔΕΞΙΑ στοίχιση: το ΤΕΛΕΥΤΑΙΟ κομμάτι τελειώνει ΑΚΡΙΒΩΣ στην άγκυρα', () => {
    const pieces = tableTextPieces(runOf({ value: text, runs: [BOLD(2, 4)], align: 'right' }));
    const last = pieces[pieces.length - 1];
    expect(last.offsetMm + last.advanceMm!).toBeCloseTo(0, 10);
    // …και το πρώτο ξεκινά αριστερά της, δηλαδή αρνητικά.
    expect(pieces[0].offsetMm).toBeLessThan(0);
  });

  it('🔴 τα κομμάτια είναι ΣΥΝΕΧΟΜΕΝΑ σε κάθε στοίχιση — κανένα κενό, καμία επικάλυψη', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      const pieces = tableTextPieces(runOf({ value: text, runs: [BOLD(2, 4)], align }));
      for (let i = 1; i < pieces.length; i++) {
        expect(pieces[i].offsetMm).toBeCloseTo(
          pieces[i - 1].offsetMm + pieces[i - 1].advanceMm!, 10,
        );
      }
    }
  });

  it('τα κομμάτια είναι αριστερά-αγκυρωμένα: η θέση ΕΙΝΑΙ η αριστερή ακμή', () => {
    const pieces = tableTextPieces(runOf({ value: text, runs: [BOLD(2, 4)], align: 'center' }));
    expect(pieces.every((p) => p.align === 'left')).toBe(true);
    expect(pieces.every((p) => p.whole === false)).toBe(true);
  });
});

// ── Η τυπογραφία ταξιδεύει ανά κομμάτι ──────────────────────────────────────

describe('η τυπογραφία του τμήματος φτάνει στον ζωγράφο', () => {
  it('🔴 μόνο το έντονο κομμάτι είναι έντονο — το κελί δεν ισοπεδώνεται', () => {
    const pieces = tableTextPieces(runOf({ value: 'AABBCC', runs: [BOLD(2, 4)] }));
    expect(pieces.map((p) => [p.text, p.bold])).toEqual([
      ['AA', false], ['BB', true], ['CC', false],
    ]);
  });

  it('🔴 run που καλύπτει ΟΛΟ το κελί ⇒ ΕΝΑ κομμάτι, και είναι έντονο', () => {
    // Το ελάττωμα του §13 από την πλευρά του ζωγράφου: αν το `spans` παραλειπόταν, εδώ θα
    // ερχόταν `bold: false` ενώ η στήλη μετρήθηκε για έντονα.
    const pieces = tableTextPieces(runOf({ value: 'AABB', runs: [BOLD(0, 4)] }));
    expect(pieces).toHaveLength(1);
    expect(pieces[0].bold).toBe(true);
    expect(pieces[0].whole).toBe(false);
  });

  it('🔴 το χαρτί βγάζει Ν primitives, ένα ανά κομμάτι, με το ΔΙΚΟ του bold', () => {
    const prims = textPrimitivesOf({ value: 'AABBCC', runs: [BOLD(2, 4)] });
    expect(prims.map((p) => [p.text, p.bold ?? false])).toEqual([
      ['AA', false], ['BB', true], ['CC', false],
    ]);
  });

  it('🔴 τα primitives κάθονται στα mm που είπε το SSoT — οθόνη και χαρτί δεν ρωτούν χωριστά', () => {
    const spec: CellSpec = { value: 'AABBCC', runs: [BOLD(2, 4)], align: 'center' };
    const run = runOf(spec);
    const prims = textPrimitivesOf(spec);
    const pieces = tableTextPieces(run);
    expect(prims.map((p) => p.position.x)).toEqual(
      pieces.map((p) => run.position.x + p.offsetMm),
    );
    expect(prims.every((p) => p.align === 'left')).toBe(true);
  });
});

// ── Η υπογράμμιση ανήκει στο κομμάτι, με το em του κομματιού ────────────────

describe('🔴 υπογράμμιση ανά τμήμα — δικό της πλάτος, δικό της em, δική της στοίχιση', () => {
  /** Μεσαίο τμήμα υπογραμμισμένο **και** ψηλότερο — το `A↑` του §16.5. */
  const TALL_UNDERLINE: TableCellTextRun = {
    start: 2, end: 4, style: { underline: true, textHeightMm: 20 },
  };

  /**
   * 🔴 Οι γραμμές που πρόσθεσε **η υπογράμμιση**, ως διαφορά από το ΙΔΙΟ κελί χωρίς runs.
   *
   * Ένα σκέτο `filter(kind === 'line')` θα έπιανε και τα **περιγράμματα** του πίνακα — και το
   * έπιασε: το πρώτο γράψιμο αυτού του test κοκκίνισε με «−200 αντί −12», δηλαδή μετρούσε την
   * αριστερή ακμή του κελιού. Η διαφορά είναι το μόνο κριτήριο που δεν χρειάζεται να ξέρει
   * τίποτα για το σχήμα μιας υπογράμμισης (δηλαδή δεν αντιγράφει τον κώδικα υπό δοκιμή).
   */
  function underlineLines(align: ScheduleColumnAlign) {
    const linesFor = (runs?: readonly TableCellTextRun[]) => {
      const model = createTableModel({
        columns: [columnWith(align)],
        rows: [ROW],
        cells: [['r1', 'c1', { kind: 'text', value: 'AABBCC', ...(runs && { runs }) }]],
      });
      return tableLayoutToPrimitives(layoutTable(model, STYLE, { measureText }))
        .filter((p) => p.kind === 'line')
        .map((p) => JSON.stringify(p));
    };
    const borders = new Set(linesFor());
    return linesFor([TALL_UNDERLINE])
      .filter((json) => !borders.has(json))
      .map((json) => JSON.parse(json) as LinePrimitive);
  }

  it('🔴 υπογραμμίζεται ΜΟΝΟ το δηλωμένο τμήμα — μία γραμμή, όχι μία ανά τμήμα', () => {
    // Το κελί δεν υπογραμμίζεται· μόνο το `BB`. Μια βαφή που διάβαζε `run.underline` θα
    // έβγαζε **μηδέν** γραμμές — δηλαδή θα κατάπινε σιωπηλά τη δήλωση του χρήστη.
    const lines = underlineLines('left');
    expect(lines).toHaveLength(1);
  });

  it('🔴 η γραμμή έχει το πλάτος ΤΟΥ ΤΜΗΜΑΤΟΣ και ξεκινά στη θέση του', () => {
    const run = runOf({ value: 'AABBCC', runs: [TALL_UNDERLINE] });
    const middle = tableTextPieces(run)[1];
    const [line] = underlineLines('left');
    expect(line.b.x - line.a.x).toBeCloseTo(middle.advanceMm!, 10);
    expect(line.a.x - run.position.x).toBeCloseTo(middle.offsetMm, 10);
  });

  it('🔴 το em είναι ΤΟΥ ΤΜΗΜΑΤΟΣ: ψηλότερα γράμματα ⇒ παχύτερη γραμμή, πιο χαμηλά', () => {
    // Αν το `em` ερχόταν από το run (10mm αντί 20mm), η γραμμή θα ήταν στο μισό πάχος και θα
    // κάθιζε **μέσα** στα γράμματα που υπογραμμίζει.
    const run = runOf({ value: 'AABBCC', runs: [TALL_UNDERLINE] });
    const middle = tableTextPieces(run)[1];
    expect(middle.heightMm).toBeGreaterThan(run.heightMm);

    const [line] = underlineLines('left');
    const fromRunEm = tableUnderlineGeometry(run.heightMm, middle.advanceMm!, 'left');
    const fromPieceEm = tableUnderlineGeometry(middle.heightMm, middle.advanceMm!, 'left');
    expect(line.stroke.widthMm).toBeCloseTo(fromPieceEm.thickness, 10);
    expect(line.stroke.widthMm).not.toBeCloseTo(fromRunEm.thickness, 10);
    expect(line.a.y - run.position.y).toBeCloseTo(fromPieceEm.y, 10);
  });

  it('🔴 σε ΚΕΝΤΡΙΚΗ στοίχιση η γραμμή ακολουθεί το τμήμα, όχι το κέντρο του κελιού', () => {
    // Το κομμάτι είναι αριστερά-αγκυρωμένο (η στοίχιση διπλώθηκε ήδη στο `offsetMm`). Μια
    // γραμμή που ξαναρωτούσε το `run.hAlign` θα μετατοπιζόταν κατά μισό πλάτος τμήματος.
    const run = runOf({ value: 'AABBCC', runs: [TALL_UNDERLINE], align: 'center' });
    const middle = tableTextPieces(run)[1];
    const [line] = underlineLines('center');
    expect(line.a.x - run.position.x).toBeCloseTo(middle.offsetMm, 10);
  });
});

// ── Η τομή των δύο επιπέδων ─────────────────────────────────────────────────

describe('🔴 σύνδεσμος × τμήμα — η τομή γίνεται σε mm, και είναι ακριβής', () => {
  const value = 'Τηλ: 2310788493';

  it('χωρίς τμήματα, η λωρίδα είναι ο σύνδεσμος ΑΥΤΟΥΣΙΟΣ — ο σημερινός δρόμος', () => {
    const run = runOf({ value });
    const [piece] = tableTextPieces(run);
    expect(tablePieceLinkStrips(run, piece)).toEqual(
      run.links!.map((l) => ({ offsetMm: l.offsetMm, advanceMm: l.advanceMm })),
    );
  });

  it('🔴 σύνδεσμος που ΔΙΑΣΧΙΖΕΙ όριο στυλ κόβεται σε δύο λωρίδες, μία ανά τμήμα', () => {
    // Το «2310788493» ξεκινά στον δείκτη 5· το έντονο σπάει στον 10, δηλαδή ΜΕΣΑ στα ψηφία.
    const run = runOf({ value, runs: [BOLD(10, 15)] });
    const pieces = tableTextPieces(run);
    const touched = pieces.filter((p) => tablePieceLinkStrips(run, p).length > 0);
    expect(touched.length).toBe(2);
  });

  it('🔴 οι λωρίδες ΚΑΛΥΠΤΟΥΝ ακριβώς τον σύνδεσμο — ούτε γράμμα λιγότερο, ούτε παραπάνω', () => {
    const run = runOf({ value, runs: [BOLD(10, 15)] });
    const link = run.links![0];
    const strips = tableTextPieces(run).flatMap((p) => tablePieceLinkStrips(run, p));
    const totalMm = strips.reduce((sum, s) => sum + s.advanceMm, 0);
    expect(totalMm).toBeCloseTo(link.advanceMm, 10);
    expect(Math.min(...strips.map((s) => s.offsetMm))).toBeCloseTo(link.offsetMm, 10);
  });

  it('🔴 στο όριο τμήματος οι δύο λωρίδες ΕΦΑΠΤΟΝΤΑΙ — bit προς bit, χωρίς ανοχή', () => {
    // Η ακρίβεια δεν είναι σύμπτωση: το `styledPrefixWidthMm` επιστρέφει το `span.offsetMm`
    // **αυτούσιο** πάνω σε όριο, και ο περιορισμός επιστρέφει τον **ίδιο** τελεστή του `Math.min`.
    const run = runOf({ value, runs: [BOLD(10, 15)] });
    const strips = tableTextPieces(run).flatMap((p) => tablePieceLinkStrips(run, p));
    expect(strips).toHaveLength(2);
    expect(strips[0].offsetMm + strips[0].advanceMm).toBe(strips[1].offsetMm);
  });

  it('τμήμα που ο σύνδεσμος δεν αγγίζει δεν παίρνει καμία λωρίδα', () => {
    const run = runOf({ value, runs: [BOLD(0, 3)] });
    const pieces = tableTextPieces(run);
    // Το πρώτο τμήμα είναι το «Τηλ» — πριν από τα ψηφία.
    expect(tablePieceLinkStrips(run, pieces[0])).toEqual([]);
  });

  it('🔴 κελί ΟΛΟ σύνδεσμος: το μελάνι ξεκινά μπλε και καμία λωρίδα δεν χρειάζεται', () => {
    const run = runOf({ value: 'georgios.pagonis@gmail.com' });
    const [piece] = tableTextPieces(run);
    expect(tablePieceInkHex(run, piece, TABLE_CELL_LINK.colorHex)).toBe(TABLE_CELL_LINK.colorHex);
  });

  it('μικτό κείμενο: το μελάνι μένει του στυλ — το μπλε έρχεται από τη λωρίδα', () => {
    const run = runOf({ value });
    const [piece] = tableTextPieces(run);
    expect(tablePieceInkHex(run, piece, TABLE_CELL_LINK.colorHex)).toBe(piece.colorHex);
  });

  it('κελί χωρίς καμία διεύθυνση δεν παράγει λωρίδα', () => {
    const run = runOf({ value: 'AABBCC', runs: [BOLD(2, 4)] });
    expect(tableTextPieces(run).flatMap((p) => tablePieceLinkStrips(run, p))).toEqual([]);
  });
});
