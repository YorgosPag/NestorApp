/**
 * 🔴 ADR-753 Φ3 — **ο καμβάς ζωγραφίζει ένα `fillText` ανά ομοιογενές τμήμα.**
 *
 * Το `table-text-pieces.test.ts` κλειδώνει *ποια κομμάτια και σε ποιο mm*. Εδώ κλειδώνεται τι
 * φτάνει πραγματικά στον καμβά — δηλαδή οι δύο αποφάσεις που ένα test καθαρής συνάρτησης δεν
 * μπορεί να δει:
 *
 *  1. **Το `ctx.font` αλλάζει ανά κομμάτι.** Αν έμενε ένα για όλο το κελί, το κείμενο θα
 *     ζωγραφιζόταν με στυλ που η διάταξη **δεν** μέτρησε — το ελάττωμα του ADR-753 §13 και
 *     του ADR-635 Φ C.21, σε τρίτο υποσύστημα.
 *  2. **Η μετατόπιση περιστρέφεται.** Το `offsetMm` είναι μήκος κατά μήκος της **γραμμής
 *     βάσης**, και η γραμμή βάσης γέρνει με τον πίνακα. Μια ωμή πρόσθεση στο `x` της οθόνης
 *     θα άπλωνε τα τμήματα οριζόντια κάτω από γερμένο κείμενο.
 *
 * ⚠️ Και ο έλεγχος που **δεν** γράφεται εδώ: `expect(bold).toBeGreaterThan(plain)`. Μετρημένο
 * με τον πραγματικό μετρητή, τα έντονα είναι **αλλιώς** πλατιά ανά glyph, όχι μονότονα
 * πλατύτερα (`ΤΕΣΤ` έντονα **6,222** vs κανονικά **6,267**) — ADR-753 §13.1.
 *
 * @see rendering/entities/table/stamp-table-text.ts
 * @see bim/table/table-text-pieces.ts
 */

import { layoutTable } from '../../../../bim/table/table-layout';
import { createTableModel } from '../../../../bim/table/table-model-helpers';
import { tableTextPieces } from '../../../../bim/table/table-text-pieces';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
} from '../../../../bim/table/table-style-presets';
import type { TableStyle } from '../../../../bim/table/table-style';
import type { TableTextMeasurer } from '../../../../bim/table/table-layout-types';
import { TABLE_CELL_LINK } from '../../../../config/color-config';
import type {
  ScheduleColumnAlign,
  TableCell,
  TableCellTextRun,
  TableColumn,
  TableRow,
} from '../../../../types/table';
import { stampTableText } from '../stamp-table-text';
import { createPaintLog, createRc, type PaintLog } from './table-paint-recorder';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

/** Η προεπιλογή του `createRc` — η μία πηγή, ώστε το test να μη μαντεύει κλίμακα. */
const RECORDER_PX_PER_MM = 10;

/** `0.6 × ύψος` ανά χαρακτήρα, **έντονα διπλάσια** — ώστε τα δύο στυλ να μη συμπίπτουν (§8). */
const measureText: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

const ROW: TableRow = { id: 'r1', rowClass: 'data' };

const BOLD = (start: number, end: number): TableCellTextRun => ({
  start, end, style: { bold: true },
});

interface CellSpec {
  readonly value: TableCell['value'];
  readonly runs?: readonly TableCellTextRun[];
  readonly align?: ScheduleColumnAlign;
}

function layoutOf(spec: CellSpec) {
  const column: TableColumn = {
    id: 'c1',
    sizing: { kind: 'fixed', widthMm: 400 },
    valueType: 'text',
    align: spec.align ?? 'left',
  };
  const model = createTableModel({
    columns: [column],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value: spec.value, ...(spec.runs && { runs: spec.runs }) }]],
  });
  return layoutTable(model, STYLE, { measureText });
}

/** Ζωγραφίζει ένα κελί. Η `angleRad` γέρνει την **προβολή**, όπως ο πραγματικός πίνακας. */
function paint(spec: CellSpec, angleRad = 0): PaintLog {
  const log = createPaintLog();
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rc = createRc(log, {
    toScreen: (u, v) => ({ x: u * cos - v * sin, y: u * sin + v * cos }),
  });
  stampTableText(rc, layoutOf(spec).cells);
  return log;
}

// ── Η αναλλοίωτη ────────────────────────────────────────────────────────────

describe('κελί χωρίς μορφοποίηση — ΕΝΑ `fillText`, ο σημερινός δρόμος', () => {
  it('ένα πέρασμα με το στυλ του κελιού', () => {
    const log = paint({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' });
    expect(log.texts).toHaveLength(1);
    expect(log.texts[0].text).toBe('ΠΕΡΙΓΡΑΦΗ');
  });

  it('🔴 η στοίχιση μένει στο `ctx.textAlign` — δεν μεταφράζεται σε μετατόπιση', () => {
    // Το κρίσιμο του εκφυλισμού: για να τοποθετηθεί αριστερά-αγκυρωμένο το μονό κομμάτι θα
    // χρειαζόταν το συνολικό πλάτος, που **δεν μετριέται** για μη υπογραμμισμένα κελιά. Άρα η
    // άγκυρα πρέπει να μείνει ακριβώς αυτή της διάταξης, χωρίς καμία πρόσθεση.
    const centered = paint({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' });
    const run = layoutOf({ value: 'ΠΕΡΙΓΡΑΦΗ', align: 'center' }).cells[0].texts[0]!;
    // ⚠️ Ωμό `run.position.x`, χωρίς `pxPerMm`: η προβολή του καταγραφέα είναι ταυτοτική (η
    // κλίμακα ζει μέσα στο πραγματικό `toScreen`), ενώ οι **μετατοπίσεις** κομματιών περνούν
    // ρητά από το `pxPerMm`. Ίδια σύμβαση με το `table-link-paint.test.ts`, που γι' αυτόν
    // ακριβώς τον λόγο συγκρίνει πάντα **διαφορές** για τις λωρίδες.
    expect(centered.texts[0].at.x).toBeCloseTo(run.position.x, 6);
  });
});

// ── Ένα `fillText` ανά τμήμα ────────────────────────────────────────────────

describe('🔴 κελί με τμήματα — ένα πέρασμα ανά τμήμα, δικό του `ctx.font`', () => {
  const spec: CellSpec = { value: 'AABBCC', runs: [BOLD(2, 4)] };

  it('τρία περάσματα, με τα τρία κομμάτια στη σειρά', () => {
    expect(paint(spec).texts.map((t) => t.text)).toEqual(['AA', 'BB', 'CC']);
  });

  it('🔴 ΜΟΝΟ το μεσαίο πέρασμα είναι έντονο — η βαφή ακολουθεί τη μέτρηση', () => {
    const fonts = paint(spec).texts.map((t) => t.font);
    expect(fonts[1]).toContain('bold');
    expect(fonts[0]).not.toContain('bold');
    expect(fonts[2]).not.toContain('bold');
  });

  it('🔴 κάθε κομμάτι πέφτει ΑΚΡΙΒΩΣ στο mm που είπε το SSoT', () => {
    const log = paint(spec);
    const run = layoutOf(spec).cells[0].texts[0]!;
    const pieces = tableTextPieces(run);
    for (let i = 0; i < pieces.length; i++) {
      expect(log.texts[i].at.x).toBeCloseTo(
        run.position.x + pieces[i].offsetMm * RECORDER_PX_PER_MM, 6,
      );
    }
  });

  it('🔴 τα κομμάτια δεν καβαλούν το ένα το άλλο — η απόσταση ΕΙΝΑΙ το μετρημένο πλάτος', () => {
    // Το ελάττωμα του ADR-635 Φ C.21 («ΦΕΚ405»): span ζωγραφισμένο πλατύτερο απ' όσο
    // μετρήθηκε καβαλά το επόμενο. Με τον διπλασιαστή των έντονων, μια βαφή που αγνοεί το
    // `bold` θα άφηνε το «CC» στο μισό της σωστής απόστασης.
    const log = paint(spec);
    const pieces = tableTextPieces(layoutOf(spec).cells[0].texts[0]!);
    for (let i = 1; i < pieces.length; i++) {
      expect(log.texts[i].at.x - log.texts[i - 1].at.x).toBeCloseTo(
        pieces[i - 1].advanceMm! * RECORDER_PX_PER_MM, 6,
      );
    }
  });

  it('όλα τα κομμάτια μοιράζονται τη γραμμή βάσης — μία γραμμή, όχι τρεις', () => {
    const log = paint(spec);
    for (const record of log.texts) expect(record.at.y).toBeCloseTo(log.texts[0].at.y, 6);
  });
});

// ── Ο γερμένος πίνακας ──────────────────────────────────────────────────────

describe('🔴 γερμένος πίνακας — η μετατόπιση περιστρέφεται μαζί με τη γραμμή βάσης', () => {
  const spec: CellSpec = { value: 'AABBCC', runs: [BOLD(2, 4)] };
  const TILT_RAD = 0.35;

  it('τα κομμάτια γέρνουν όλα — καμία εξαίρεση', () => {
    for (const record of paint(spec, TILT_RAD).texts) {
      expect(record.angleRad).toBeCloseTo(TILT_RAD, 10);
    }
  });

  it('🔴 τα κομμάτια απλώνονται ΠΑΝΩ ΣΤΗ ΓΕΡΜΕΝΗ γραμμή, όχι οριζόντια', () => {
    // Η απόδειξη: το διάνυσμα από κομμάτι σε κομμάτι πρέπει να δείχνει κατά `TILT_RAD`. Μια
    // ωμή πρόσθεση στο `x` της οθόνης θα έδινε γωνία **μηδέν** και το test θα κοκκίνιζε.
    const log = paint(spec, TILT_RAD);
    for (let i = 1; i < log.texts.length; i++) {
      const dx = log.texts[i].at.x - log.texts[i - 1].at.x;
      const dy = log.texts[i].at.y - log.texts[i - 1].at.y;
      expect(Math.atan2(dy, dx)).toBeCloseTo(TILT_RAD, 10);
    }
  });

  it('🔴 το μήκος της μετατόπισης δεν αλλάζει με τη στροφή — η στροφή δεν είναι κλίμακα', () => {
    const flat = paint(spec);
    const tilted = paint(spec, TILT_RAD);
    for (let i = 1; i < flat.texts.length; i++) {
      const straight = flat.texts[i].at.x - flat.texts[i - 1].at.x;
      const dx = tilted.texts[i].at.x - tilted.texts[i - 1].at.x;
      const dy = tilted.texts[i].at.y - tilted.texts[i - 1].at.y;
      expect(Math.hypot(dx, dy)).toBeCloseTo(Math.abs(straight), 6);
    }
  });
});

// ── Η τομή με τους συνδέσμους, στον καμβά ───────────────────────────────────

describe('🔴 σύνδεσμος που διασχίζει όριο στυλ — αποκοπή ΑΝΑ ΤΜΗΜΑ', () => {
  const spec: CellSpec = { value: 'Τηλ: 2310788493', runs: [BOLD(10, 15)] };

  it('δύο λωρίδες αποκοπής, μία σε κάθε τμήμα που τέμνει ο σύνδεσμος', () => {
    expect(paint(spec).clips).toHaveLength(2);
  });

  it('🔴 μέσα στην αποκοπή ξαναγράφεται ΤΟ ΤΜΗΜΑ, όχι όλο το κείμενο του κελιού', () => {
    // Αυτό είναι ολόκληρη η απόφαση της Φ3: το χρώμα **δεν** ορίζει όριο τμηματοποίησης, άρα
    // ξαναγράφεται η μονάδα shaping — που είναι πλέον το τμήμα. Ένα `fillText(run.text)` εδώ
    // θα ζωγράφιζε το «Τηλ: » με το **έντονο** font του δεύτερου τμήματος.
    const blue = paint(spec).texts.filter((t) => t.color === TABLE_CELL_LINK.colorHex);
    expect(blue.map((t) => t.text)).toEqual(['Τηλ: 23107', '88493']);
  });

  it('🔴 το μπλε πέρασμα πέφτει ΑΚΡΙΒΩΣ πάνω στο μαύρο του ίδιου τμήματος', () => {
    // Η προϋπόθεση υπό την οποία δουλεύει η αποκοπή (ADR-753 §11): ταυτόσημες θέσεις glyph.
    const log = paint(spec);
    const black = log.texts.filter((t) => t.color !== TABLE_CELL_LINK.colorHex);
    const blue = log.texts.filter((t) => t.color === TABLE_CELL_LINK.colorHex);
    expect(blue).toHaveLength(black.length);
    for (let i = 0; i < blue.length; i++) {
      expect(blue[i].at.x).toBeCloseTo(black[i].at.x, 10);
      expect(blue[i].at.y).toBeCloseTo(black[i].at.y, 10);
      expect(blue[i].font).toBe(black[i].font);
    }
  });

  it('🔴 οι δύο λωρίδες εφάπτονται και μαζί καλύπτουν ακριβώς τον σύνδεσμο', () => {
    const log = paint(spec);
    const link = layoutOf(spec).cells[0].texts[0]!.links![0];
    const total = log.clips.reduce((sum, c) => sum + c.widthPx, 0);
    expect(total).toBeCloseTo(link.advanceMm * RECORDER_PX_PER_MM, 6);
    expect(log.clips[0].at.x + log.clips[0].widthPx).toBeCloseTo(log.clips[1].at.x, 6);
  });

  it('η μπλε υπογράμμιση κόβεται κι αυτή στα δύο, με το em ΤΟΥ ΚΑΘΕ τμήματος', () => {
    const blue = paint(spec).rects.filter((r) => r.color === TABLE_CELL_LINK.colorHex);
    expect(blue).toHaveLength(2);
    const clips = paint(spec).clips;
    for (let i = 0; i < blue.length; i++) {
      expect(blue[i].widthPx).toBeCloseTo(clips[i].widthPx, 6);
    }
  });
});
