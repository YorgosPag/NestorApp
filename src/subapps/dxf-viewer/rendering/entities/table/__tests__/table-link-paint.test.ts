/**
 * ADR-751 — **με τι χρώμα βγαίνει ο σύνδεσμος, και πού σταματά.**
 *
 * Δύο διαφορετικές διαδρομές, γιατί είναι δύο διαφορετικές αποφάσεις:
 *
 *  1. **Κελί που είναι ΟΛΟ σύνδεσμος** (μια στήλη «E-mail» — σχεδόν κάθε πραγματικό
 *     παράδειγμα): το μελάνι ξεκινά μπλε, **ένα** `fillText`, καμία αποκοπή. Αυτό δεν είναι
 *     βελτιστοποίηση — είναι η εγγύηση ότι τα γράμματα δεν κουνιούνται όταν το κείμενο
 *     τυχαίνει να είναι διεύθυνση.
 *  2. **Μικτό κείμενο**: το κείμενο βγαίνει ολόκληρο δύο φορές, η δεύτερη μπλε και
 *     περιορισμένη στη λωρίδα του τμήματος. Το test κλειδώνει και τη **λωρίδα** — αν βγει
 *     λάθος εύρος, ο σύνδεσμος βάφει γράμματα που δεν του ανήκουν, και κανένα test χρώματος
 *     δεν θα το έβλεπε.
 *
 * @see rendering/entities/table/stamp-table-text.ts
 */

import { layoutTable } from '../../../../bim/table/table-layout';
import { createTableModel } from '../../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../../../../bim/table/table-style-presets';
import type { TableStyle } from '../../../../bim/table/table-style';
import { TABLE_CELL_LINK } from '../../../../config/color-config';
import type { TableCell, TableColumn, TableRow } from '../../../../types/table';
import { stampTableText } from '../stamp-table-text';
import { createPaintLog, createRc, paintedInk, type PaintLog } from './table-paint-recorder';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

const COLUMN: TableColumn = {
  id: 'c1',
  sizing: { kind: 'fixed', widthMm: 120 },
  valueType: 'text',
  align: 'left',
};
const ROW: TableRow = { id: 'r1', rowClass: 'data' };

/** Η προεπιλογή του {@link createRc} — η μία πηγή, ώστε το test να μη μαντεύει κλίμακα. */
const RECORDER_PX_PER_MM = 10;

function modelWith(value: TableCell['value']) {
  return createTableModel({
    columns: [COLUMN],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value }]],
  });
}

/** Ζωγραφίζει ένα κελί και επιστρέφει το ημερολόγιο. */
function paint(value: TableCell['value']): PaintLog {
  const log = createPaintLog();
  stampTableText(createRc(log), layoutTable(modelWith(value), STYLE).cells);
  return log;
}

/** Το τμήμα-σύνδεσμος όπως το αποφάσισε η **διάταξη** — η αναφορά του ζωγράφου. */
function spanOf(value: string) {
  const links = layoutTable(modelWith(value), STYLE).cells[0]?.text?.links;
  if (!links?.length) throw new Error(`κανένα τμήμα-σύνδεσμος για: ${value}`);
  return links[0];
}

describe('κελί που είναι ΟΛΟ σύνδεσμος — ένα πέρασμα, μπλε', () => {
  const log = paint('georgios.pagonis@gmail.com');

  it('τα γράμματα βγαίνουν στο χρώμα συνδέσμου', () => {
    expect(paintedInk(log)).toEqual([
      { text: 'georgios.pagonis@gmail.com', color: TABLE_CELL_LINK.colorHex },
    ]);
  });

  it('🔴 ΕΝΑ `fillText` — το κείμενο δεν ξαναζωγραφίζεται, άρα δεν μπορεί να κουνηθεί', () => {
    expect(log.texts).toHaveLength(1);
  });

  it('🔴 ΚΑΜΙΑ αποκοπή — δεν υπάρχει τμήμα να απομονωθεί', () => {
    expect(log.clips).toHaveLength(0);
  });

  it('υπογραμμίζεται, στο ίδιο μπλε', () => {
    expect(log.rects).toHaveLength(1);
    expect(log.rects[0].color).toBe(TABLE_CELL_LINK.colorHex);
    expect(log.rects[0].widthPx).toBeGreaterThan(0);
  });
});

describe('μικτό κείμενο — δεύτερο πέρασμα με αποκοπή', () => {
  const log = paint('Τηλ: 2310788493');

  it('το κείμενο βγαίνει ΟΛΟΚΛΗΡΟ και τις δύο φορές, με το ίδιο string', () => {
    expect(log.texts.map((t) => t.text)).toEqual(['Τηλ: 2310788493', 'Τηλ: 2310788493']);
  });

  it('🔴 ΙΔΙΑ ΑΓΚΥΡΑ — το δεύτερο πέρασμα πέφτει ακριβώς πάνω στο πρώτο', () => {
    // Αυτό είναι το κλειδί ολόκληρης της προσέγγισης: αν οι δύο άγκυρες αποκλίνουν, τα μπλε
    // γράμματα είναι μετατοπισμένα αντίγραφα και το κείμενο φαίνεται θολό.
    expect(log.texts[1].at.x).toBeCloseTo(log.texts[0].at.x, 10);
    expect(log.texts[1].at.y).toBeCloseTo(log.texts[0].at.y, 10);
    expect(log.texts[1].font).toBe(log.texts[0].font);
  });

  it('η πρώτη φορά με το χρώμα του στυλ, η δεύτερη μπλε', () => {
    expect(log.texts[0].color).not.toBe(TABLE_CELL_LINK.colorHex);
    expect(log.texts[1].color).toBe(TABLE_CELL_LINK.colorHex);
  });

  it('🔴 η λωρίδα αποκοπής ξεκινά ΜΕΤΑ τον πρόλογο, όχι στην αρχή του κειμένου', () => {
    expect(log.clips).toHaveLength(1);
    // Αριστερή στοίχιση: η άγκυρα είναι η αρχή του κειμένου. Η λωρίδα πρέπει να ξεκινά
    // δεξιότερα — αλλιώς το «Τηλ: » θα βαφόταν κι αυτό μπλε.
    expect(log.clips[0].at.x).toBeGreaterThan(log.texts[0].at.x);
  });

  it('🔴 η λωρίδα είναι ΑΚΡΙΒΩΣ ό,τι μέτρησε η διάταξη — ο ζωγράφος δεν ξαναμετρά', () => {
    // ⚠️ Το πλάτος ΔΕΝ βγαίνει από το `RECORDER_CHAR_PX`: εκείνο είναι ο ψεύτικος
    // `ctx.measureText` του καμβά, ενώ το `advanceMm` το αποφάσισε ο μετρητής της **διάταξης**
    // σε sheet-mm. Δύο διαφορετικές μηχανές — και το ζητούμενο εδώ είναι ακριβώς ότι ο
    // ζωγράφος τιμά τη δεύτερη, όπως κάνει ήδη για την υπογράμμιση (Φ.Ε/Φ2 βήμα 4).
    const span = spanOf('Τηλ: 2310788493');
    expect(log.clips[0].widthPx).toBeCloseTo(span.advanceMm * RECORDER_PX_PER_MM, 6);
    expect(log.clips[0].at.x - log.texts[0].at.x).toBeCloseTo(span.offsetMm * RECORDER_PX_PER_MM, 6);
  });

  it('🔴 η λωρίδα δεν καλύπτει όλο το κείμενο — αλλιώς θα βαφόταν μπλε και το «Τηλ: »', () => {
    const span = spanOf('Τηλ: 2310788493');
    expect(span.offsetMm).toBeGreaterThan(0);
    expect(span.text).toBe('2310788493');
  });

  it('η υπογράμμιση καλύπτει ακριβώς τη λωρίδα, στο ίδιο μπλε', () => {
    const underline = log.rects.filter((r) => r.color === TABLE_CELL_LINK.colorHex);
    expect(underline).toHaveLength(1);
    expect(underline[0].widthPx).toBeCloseTo(log.clips[0].widthPx, 6);
    expect(underline[0].at.x).toBeCloseTo(log.clips[0].at.x, 6);
  });
});

describe('κελί χωρίς διεύθυνση — τίποτα δεν αλλάζει', () => {
  const log = paint('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ');

  it('ένα πέρασμα, χρώμα στυλ, καμία αποκοπή, καμία υπογράμμιση', () => {
    expect(log.texts).toHaveLength(1);
    expect(log.texts[0].color).not.toBe(TABLE_CELL_LINK.colorHex);
    expect(log.clips).toHaveLength(0);
    expect(log.rects).toHaveLength(0);
  });
});

describe('αριθμητικό κελί — ο φραγμός φτάνει μέχρι το μελάνι', () => {
  it('δεκαψήφια ΤΙΜΗ δεν βάφεται ποτέ μπλε', () => {
    const log = paint(2000000000);
    expect(log.texts.every((t) => t.color !== TABLE_CELL_LINK.colorHex)).toBe(true);
    expect(log.clips).toHaveLength(0);
  });
});
