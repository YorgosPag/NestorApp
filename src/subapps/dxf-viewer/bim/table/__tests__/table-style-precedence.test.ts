/**
 * ADR-739 Φ.Ε (Α2/Α6) — **ο πίνακας αλήθειας της σειράς προτεραιότητας** (§28.4).
 *
 * ```
 *   1. κελί  →  2. γραμμή  →  3. στήλη  →  5. κλάση γραμμής (βάση)
 * ```
 *
 * ## Γιατί ανά πεδίο ΚΑΙ ανά επίπεδο, και όχι ένα δείγμα
 * Το merge είναι γραμμή-γραμμή. Ένα ξεχασμένο πεδίο (ή ένα `??` εκεί που έπρεπε να μπει
 * `!== undefined`) δεν σπάει τίποτα ορατό — απλώς **αυτή** η ιδιότητα σταματά να
 * κληρονομείται, σε **αυτό** το επίπεδο. Ένα δείγμα «bold από τη στήλη» θα ήταν πράσινο
 * ενώ το `italic` από τη γραμμή αγνοείται σιωπηλά.
 *
 * ## Το κρίσιμο test είναι το Α6
 * «Γραμμή > στήλη» είναι **απόφαση**, όχι λεπτομέρεια: αν αντιστραφεί, μια γραμμή συνόλων
 * χάνει τα έντονά της μόνο εκεί όπου περνά μέσα από βαμμένη στήλη — σφάλμα ορατό σε ένα
 * κελί στα εκατό, δηλαδή αόρατο.
 *
 * @see bim/table/table-style.ts — `resolveCellStyle`, το ΕΝΑ σημείο επίλυσης
 */

import { baseCellStyle, resolveCellStyle, type TableRowClassStyle } from '../table-style';
import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableAxisStyleOverride, TableCell, TableColumn, TableRow } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/** Μια βάση με **διακριτές** τιμές: κάθε πεδίο ξεχωρίζει από κάθε άλλο στα assertions. */
const BASE: TableRowClassStyle = {
  textHeightMm: 3,
  textColorHex: '#111111',
  fillColorHex: '#eeeeee',
  bold: false,
  italic: false,
  underline: false,
  fontFamily: 'arial',
  align: 'ML',
  indentLevel: 0,
  margins: { hMm: 2, vMm: 1 },
  borders: {
    top: { visible: true, colorHex: '#000000', widthMm: 0.25 },
    bottom: { visible: true, colorHex: '#000000', widthMm: 0.25 },
    left: { visible: true, colorHex: '#000000', widthMm: 0.25 },
    right: { visible: true, colorHex: '#000000', widthMm: 0.25 },
    insideH: { visible: true, colorHex: '#000000', widthMm: 0.25 },
    insideV: { visible: true, colorHex: '#000000', widthMm: 0.25 },
  },
};

/**
 * Τα οκτώ πεδία που ταξιδεύουν, με **διαφορετική** τιμή ανά επίπεδο ώστε το assertion να
 * λέει ΠΟΙΟ επίπεδο κέρδισε, όχι απλώς «άλλαξε κάτι».
 */
const FIELDS = [
  { key: 'textHeightMm', cell: 9, row: 8, column: 7 },
  { key: 'textColorHex', cell: '#c0ffee', row: '#r0wr0w', column: '#c01c01' },
  { key: 'fillColorHex', cell: '#111aaa', row: '#222bbb', column: '#333ccc' },
  { key: 'bold', cell: true, row: true, column: true },
  { key: 'italic', cell: true, row: true, column: true },
  { key: 'underline', cell: true, row: true, column: true },
  { key: 'fontFamily', cell: 'calibri', row: 'times', column: 'verdana' },
  { key: 'align', cell: 'TR', row: 'BC', column: 'MR' },
] as const;

type Level = 'cell' | 'row' | 'column';

/** Ο πίνακας αλήθειας διαβάζεται σαν πρόταση: «σε αυτό το επίπεδο, αυτό το πεδίο, αυτή η τιμή». */
function only(level: Level, key: string, value: unknown) {
  return { [level]: { [key]: value } as TableAxisStyleOverride };
}

// ── 1. Καμία παράκαμψη ──────────────────────────────────────────────────────

describe('resolveCellStyle — χωρίς παρακάμψεις', () => {
  it('επιστρέφει τη βάση της κλάσης γραμμής', () => {
    expect(resolveCellStyle(BASE)).toEqual(baseCellStyle(BASE));
  });

  it('🔴 αντικείμενο με ΟΛΑ τα επίπεδα κενά δεν παράγει διαφορετικό στυλ', () => {
    // Ο φύλακας του no-op: το μενού ανοίγει και κλείνει χωρίς αλλαγή, και η διάταξη δεν
    // επιτρέπεται να θεωρήσει ότι κάτι άλλαξε (δύο αλυσιδωμένα WeakMap κρέμονται από αυτό).
    expect(resolveCellStyle(BASE, {})).toEqual(baseCellStyle(BASE));
  });
});

// ── 2. Ο πίνακας αλήθειας: κάθε πεδίο, κάθε επίπεδο ─────────────────────────

describe('resolveCellStyle — κάθε πεδίο κληρονομείται από κάθε επίπεδο', () => {
  for (const field of FIELDS) {
    for (const level of ['cell', 'row', 'column'] as const) {
      it(`${field.key} ← ${level}`, () => {
        const resolved = resolveCellStyle(BASE, only(level, field.key, field[level]));
        expect(resolved[field.key]).toBe(field[level]);
      });
    }

    it(`${field.key}: τα υπόλοιπα πεδία μένουν στη βάση`, () => {
      const resolved = resolveCellStyle(BASE, only('column', field.key, field.column));
      const base = baseCellStyle(BASE);
      for (const other of FIELDS) {
        if (other.key === field.key) continue;
        expect(resolved[other.key]).toBe(base[other.key]);
      }
    });
  }
});

// ── 3. Α6 — η απόφαση ───────────────────────────────────────────────────────

describe('resolveCellStyle — σειρά προτεραιότητας', () => {
  it('🔴 Α6: η ΓΡΑΜΜΗ νικά τη ΣΤΗΛΗ σε κάθε πεδίο', () => {
    for (const field of FIELDS) {
      const resolved = resolveCellStyle(BASE, {
        row: { [field.key]: field.row },
        column: { [field.key]: field.column },
      });
      expect(resolved[field.key]).toBe(field.row);
    }
  });

  it('το ΚΕΛΙ νικά και τα δύο, σε κάθε πεδίο', () => {
    for (const field of FIELDS) {
      const resolved = resolveCellStyle(BASE, {
        cell: { [field.key]: field.cell },
        row: { [field.key]: field.row },
        column: { [field.key]: field.column },
      });
      expect(resolved[field.key]).toBe(field.cell);
    }
  });

  it('ένα επίπεδο που σιωπά δεν εμποδίζει το επόμενο', () => {
    // Το κελί έχει άποψη για το χρώμα, όχι για τα έντονα ⇒ τα έντονα πέφτουν στη γραμμή.
    const resolved = resolveCellStyle(BASE, {
      cell: { textColorHex: '#c0ffee' },
      row: { bold: true },
      column: { bold: false, italic: true },
    });
    expect(resolved.textColorHex).toBe('#c0ffee');
    expect(resolved.bold).toBe(true);
    expect(resolved.italic).toBe(true);
  });
});

// ── 4. Η τρίτη κατάσταση ────────────────────────────────────────────────────

describe('resolveCellStyle — `null` = ρητά ΚΑΝΕΝΑ (η δοκτρίνα του BYLAYER)', () => {
  it('`fillColorHex: null` σβήνει το γέμισμα της κλάσης γραμμής', () => {
    expect(resolveCellStyle(BASE, { column: { fillColorHex: null } }).fillColorHex).toBeUndefined();
  });

  it('`fontFamily: null` επιστρέφει στην προεπιλογή του μετρητή', () => {
    expect(resolveCellStyle(BASE, { row: { fontFamily: null } }).fontFamily).toBeUndefined();
  });

  /**
   * 🔴 Το κενό που άφησαν τα δύο από πάνω: το `fillColorHex: null` δοκιμαζόταν σε **στήλη**
   * και σε **κελί**, ποτέ σε **γραμμή** — κι όμως η γραμμή είναι το επίπεδο που ο χρήστης
   * αγγίζει πρώτο («Κανένα γέμισμα» σε κεφαλίδα). Ίδιο σχήμα με το §35.8: το επίπεδο που
   * κανείς δεν δοκίμασε ήταν το κανονικό, όχι το εξεζητημένο.
   *
   * Οι δύο ισχυρισμοί εδώ είναι διαφορετικοί και **και οι δύο** χρειάζονται: η γραμμή πρέπει
   * να σβήνει (α) τη **βάση** (το γέμισμα της κλάσης κεφαλίδας) και (β) το γέμισμα μιας
   * **στήλης** που περνά από κάτω της — αλλιώς μια βαμμένη στήλη θα επιβίωνε μέσα σε γραμμή
   * που ο χρήστης μόλις καθάρισε.
   */
  it('🔴 `row: { fillColorHex: null }` σβήνει και τη ΒΑΣΗ και το γέμισμα ΣΤΗΛΗΣ', () => {
    expect(resolveCellStyle(BASE, { row: { fillColorHex: null } }).fillColorHex).toBeUndefined();

    const overColumn = resolveCellStyle(BASE, {
      row: { fillColorHex: null },
      column: { fillColorHex: '#ff00ff' },
    });
    expect(overColumn.fillColorHex).toBeUndefined();
  });

  it('🔴 το ρητό γέμισμα ΚΕΛΙΟΥ επιβιώνει της καθαρισμένης γραμμής (η σειρά δεν αντιστράφηκε)', () => {
    const resolved = resolveCellStyle(BASE, {
      cell: { fillColorHex: '#00ff00' },
      row: { fillColorHex: null },
    });
    expect(resolved.fillColorHex).toBe('#00ff00');
  });

  it('🔴 το `null` ενός ΑΝΩΤΕΡΟΥ επιπέδου νικά την τιμή ενός κατώτερου', () => {
    // Αυτό είναι το ρίσκο 4 ολόκληρο: με `??` αντί για `!== undefined`, το `null` του κελιού
    // θα προσπερνιόταν και θα κέρδιζε το γέμισμα της στήλης — «Κανένα γέμισμα» που δεν σβήνει.
    const resolved = resolveCellStyle(BASE, {
      cell: { fillColorHex: null },
      column: { fillColorHex: '#333ccc' },
    });
    expect(resolved.fillColorHex).toBeUndefined();
  });

  it('το `undefined` ΔΕΝ σβήνει — παραδίδει τη σκυτάλη στο επόμενο επίπεδο', () => {
    const resolved = resolveCellStyle(BASE, {
      cell: { fillColorHex: undefined },
      column: { fillColorHex: '#333ccc' },
    });
    expect(resolved.fillColorHex).toBe('#333ccc');
  });

  it('`bold: false` είναι ρητό ΟΧΙ, όχι σιωπή — σβήνει τα έντονα της κλάσης', () => {
    const boldBase: TableRowClassStyle = { ...BASE, bold: true };
    expect(resolveCellStyle(boldBase, { column: { bold: false } }).bold).toBe(false);
  });
});

// ── 5. Τα περιθώρια μένουν έξω ──────────────────────────────────────────────

describe('resolveCellStyle — τι ΔΕΝ παρακάμπτεται', () => {
  it('τα `margins` έρχονται πάντα από την κλάση γραμμής, ίδια αναφορά', () => {
    const resolved = resolveCellStyle(BASE, { cell: { bold: true }, row: { italic: true } });
    expect(resolved.margins).toBe(BASE.margins);
  });
});

// ── 6. Anti-drift: ο μετρητής βλέπει ό,τι και ο ζωγράφος ────────────────────

describe('🔴 anti-drift — η ΜΕΤΡΗΣΗ βλέπει τις ίδιες παρακάμψεις με την ΤΟΠΟΘΕΤΗΣΗ', () => {
  function styleById(id: string): TableStyle {
    const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
    if (!style) throw new Error(`missing preset: ${id}`);
    return style;
  }

  const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

  function col(id: string, extra?: Partial<TableColumn>): TableColumn {
    return { id, sizing: { kind: 'hug' }, valueType: 'text', align: 'left', ...extra };
  }
  function row(id: string, extra?: Partial<TableRow>): TableRow {
    return { id, rowClass: 'data', ...extra };
  }
  const text = (value: string): TableCell => ({ kind: 'text', value });

  it('μια στήλη με διπλάσιο ύψος κειμένου μετριέται ΔΙΠΛΑΣΙΑ (όχι με τη βάση)', () => {
    const measureText: TableTextMeasurer = (t, heightMm) => t.length * heightMm * 0.6;
    const base = STANDARD.rowClasses.data.textHeightMm;

    const plain = layoutTable(
      createTableModel({ columns: [col('a')], rows: [row('r1')], cells: [['r1', 'a', text('ABCDE')]] }),
      STANDARD,
      { measureText },
    );
    const bigger = layoutTable(
      createTableModel({
        columns: [col('a', { styleOverride: { textHeightMm: base * 2 } })],
        rows: [row('r1')],
        cells: [['r1', 'a', text('ABCDE')]],
      }),
      STANDARD,
      { measureText },
    );

    const margins = STANDARD.rowClasses.data.margins.hMm * 2;
    expect(plain.columns[0].widthMm - margins).toBeCloseTo(5 * base * 0.6, 6);
    expect(bigger.columns[0].widthMm - margins).toBeCloseTo(5 * base * 2 * 0.6, 6);
  });

  it('ο μετρητής δέχεται τη ΓΡΑΜΜΑΤΟΣΕΙΡΑ και τα ΠΛΑΓΙΑ της παράκαμψης', () => {
    const seen: { fontFamily?: string; bold?: boolean; italic?: boolean }[] = [];
    const measureText: TableTextMeasurer = (t, heightMm, style) => {
      seen.push({ ...style });
      return t.length * heightMm * 0.6;
    };

    layoutTable(
      createTableModel({
        columns: [col('a', { styleOverride: { fontFamily: 'verdana' } })],
        rows: [row('r1', { styleOverride: { italic: true, bold: true } })],
        cells: [['r1', 'a', text('AB')]],
      }),
      STANDARD,
      { measureText },
    );

    expect(seen.length).toBeGreaterThan(0);
    for (const style of seen) {
      expect(style.fontFamily).toBe('verdana');
      expect(style.italic).toBe(true);
      expect(style.bold).toBe(true);
    }
  });

  it('το run που παράγεται φέρει τα ΙΔΙΑ χαρακτηριστικά που μετρήθηκαν', () => {
    const measureText: TableTextMeasurer = (t, heightMm) => t.length * heightMm * 0.6;
    const layout = layoutTable(
      createTableModel({
        columns: [col('a', { sizing: { kind: 'fixed', widthMm: 80 }, styleOverride: { fontFamily: 'verdana' } })],
        rows: [row('r1', { styleOverride: { italic: true, underline: true } })],
        cells: [['r1', 'a', text('AB')]],
      }),
      STANDARD,
      { measureText },
    );

    const run = layout.cells[0].texts[0];
    expect(run?.fontFamily).toBe('verdana');
    expect(run?.italic).toBe(true);
    expect(run?.underline).toBe(true);
  });
});
