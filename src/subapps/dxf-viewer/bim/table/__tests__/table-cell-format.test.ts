/**
 * 🔴 ADR-760 — **Η ΜΟΡΦΟΠΟΙΗΣΗ ΚΕΛΙΟΥ**: τιμή ≠ εμφάνιση, αποδεδειγμένα.
 *
 * Τέσσερα επίπεδα ελέγχου, και το δεύτερο είναι που μετράει:
 *  1. **Απόδοση** — τι δείχνει κάθε μορφή.
 *  2. 🔴 **Ο κανόνας** — η αποθηκευμένη τιμή δεν αγγίζεται ΠΟΤΕ, και η γραμμή τύπων δείχνει
 *     το πηγαίο. Χωρίς αυτό, η μορφοποίηση θα ήταν σφάλμα τιμής μεταμφιεσμένο σε εμφάνιση.
 *  3. **Κληρονομικότητα** — τα πέντε επίπεδα, στη σωστή σειρά.
 *  4. **Διάταξη** — η μορφή τρέχει ΠΡΙΝ τη μέτρηση πλάτους, αλλιώς οι στήλες κόβουν.
 *
 * ⚠️ Τα tests **δεν** καρφώνουν τα ψηφία που παράγει το CLDR εκεί που δεν χρειάζεται (π.χ. τη
 * θέση του `€`): αυτά τα ξέρει το `Intl` και αλλάζουν με την έκδοση των δεδομένων. Καρφώνεται
 * ό,τι είναι **δική μας απόφαση** — υποδιαστολή, πλήθος δεκαδικών, ομαδοποίηση, εποχή
 * ημερομηνίας, και το ότι ο ωμός αριθμός επιβιώνει.
 */

import {
  cellDisplayText,
  resolveCellNumberFormat,
  type TableFormatOverrides,
} from '../table-cell-format';
import { TABLE_GENERAL_FORMAT, type TableCellFormat } from '../../../types/table-cell-format';
import { commitCellWrites, cellInputText, writeCellInput } from '../formula/table-formula-engine';
import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type {
  PersistedTableModel,
  TableCell,
  TableColumn,
  TableRow,
} from '../../../types/table';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const numberCell = (value: number): TableCell => ({ kind: 'text', value });
const textCell = (value: string): TableCell => ({ kind: 'text', value });

const show = (cell: TableCell | undefined, format: TableCellFormat): string =>
  cellDisplayText(cell, format);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Απόδοση — τι δείχνει κάθε μορφή
// ─────────────────────────────────────────────────────────────────────────────

describe('απόδοση ανά μορφή', () => {
  it('`general` δείχνει τον αριθμό ΟΠΩΣ ΕΧΕΙ — δεν μαντεύει ποτέ ημερομηνία', () => {
    // Το 46239 είναι σειριακή ημερομηνία, τιμή σε ευρώ ή αριθμός τεμαχίων. Η αυτόματη
    // αναγνώριση θα ήταν σωστή τις περισσότερες φορές και σιωπηλά καταστροφική τις υπόλοιπες.
    expect(show(numberCell(46239), TABLE_GENERAL_FORMAT)).toBe('46239');
    expect(show(numberCell(12.5), TABLE_GENERAL_FORMAT)).toBe('12.5');
  });

  it('`decimal` σέβεται τα δεκαδικά και γράφει με ΕΛΛΗΝΙΚΗ υποδιαστολή', () => {
    expect(show(numberCell(12.5), { kind: 'decimal', decimals: 2 })).toBe('12,50');
    expect(show(numberCell(12.567), { kind: 'decimal', decimals: 1 })).toBe('12,6');
    expect(show(numberCell(1234.5), { kind: 'decimal', decimals: 2 })).toBe('1.234,50');
  });

  it('`decimal` χωρίς ομαδοποίηση — η σύμβαση CAD', () => {
    expect(show(numberCell(1234.5), { kind: 'decimal', decimals: 2, grouping: false })).toBe(
      '1234,50',
    );
  });

  it('`whole` στρογγυλοποιεί', () => {
    expect(show(numberCell(12.6), { kind: 'whole' })).toBe('13');
    expect(show(numberCell(-0.4), { kind: 'whole' })).toBe('-0');
  });

  it('`percent` δέχεται ΚΛΑΣΜΑ, όπως το Excel', () => {
    // Αποθηκευμένο `0,25` ⇒ `25%`. Αν ήταν το `25`, το `=A1*B1` θα έδινε εκατονταπλάσιο.
    expect(show(numberCell(0.25), { kind: 'percent', decimals: 0 })).toBe('25%');
    expect(show(numberCell(0.1234), { kind: 'percent', decimals: 1 })).toBe('12,3%');
  });

  it('`currency` γράφει με κωδικό ISO — η θέση του συμβόλου ανήκει στο CLDR', () => {
    const shown = show(numberCell(1200.5), { kind: 'currency', decimals: 2 });
    expect(shown).toContain('1.200,50');
    expect(shown).toContain('€');
  });

  it('🔴 η ΑΓΚΥΡΑ ΕΠΙΤΥΧΙΑΣ — το `46239` δείχνει ημερομηνία', () => {
    expect(show(numberCell(46239), { kind: 'date' })).toBe('05/08/2026');
  });

  it('`date` — οι μορφές του καταλόγου', () => {
    expect(show(numberCell(46239), { kind: 'date', style: 'iso' })).toBe('2026-08-05');
    expect(show(numberCell(46239), { kind: 'date', style: 'year' })).toBe('2026');
    expect(show(numberCell(46239), { kind: 'date', style: 'long' })).toContain('2026');
  });

  it('`date` — το ISO είναι ίδιο σε ΚΑΘΕ locale, εξ ορισμού', () => {
    expect(show(numberCell(46239), { kind: 'date', style: 'iso', locale: 'en-US' })).toBe(
      '2026-08-05',
    );
  });

  it('`angle` — οι πέντε γραφές του ADR-082, χωρίς δεύτερο μετατροπέα', () => {
    expect(show(numberCell(45.5), { kind: 'angle', decimals: 1 })).toBe('45,5°');
    expect(show(numberCell(45.5), { kind: 'angle', unit: 'dms', decimals: 0 })).toBe(`45°30'0"`);
    expect(show(numberCell(90), { kind: 'angle', unit: 'grads', decimals: 2 })).toBe('100.00g');
  });

  it('το locale του ΣΧΕΔΙΟΥ, όχι του χρήστη — ρητό `en-US` αλλάζει τα ψηφία', () => {
    expect(show(numberCell(1234.5), { kind: 'decimal', decimals: 2, locale: 'en-US' })).toBe(
      '1,234.50',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Τι ΔΕΝ αγγίζεται
// ─────────────────────────────────────────────────────────────────────────────

describe('η μορφή δεν αγγίζει ό,τι δεν είναι αριθμός', () => {
  it('κενό κελί μένει κενό — η ίδια απάντηση με το `cellText`', () => {
    expect(show(undefined, { kind: 'date' })).toBe('');
    expect(show({ kind: 'text', value: null }, { kind: 'decimal', decimals: 2 })).toBe('');
  });

  it('περιγραφή σε στήλη ημερομηνιών περνά ΑΥΤΟΥΣΙΑ', () => {
    expect(show(textCell('Δοκός Δ12'), { kind: 'date' })).toBe('Δοκός Δ12');
  });

  it('🔴 κωδικός σφάλματος περνά αυτούσιος — ταξιδεύει σε DXF', () => {
    expect(show(textCell('#VALUE!'), { kind: 'currency', decimals: 2 })).toBe('#VALUE!');
    expect(show(textCell('#NAME?'), { kind: 'date' })).toBe('#NAME?');
  });

  it('🔴 κριτήριο `SUMIF` δεν είναι αριθμός', () => {
    expect(show(textCell('>15'), { kind: 'decimal', decimals: 2 })).toBe('>15');
  });

  it('αριθμός γραμμένος ως κείμενο ΜΟΡΦΟΠΟΙΕΙΤΑΙ — ίδιος κριτής με τη μηχανή τύπων', () => {
    // Ο χρήστης πληκτρολογεί· ο γραφέας αποθηκεύει **κείμενο**. Αν εδώ κρινόταν με
    // `typeof value === 'number'`, η μορφοποίηση θα δούλευε μόνο σε κελιά τύπου.
    expect(show(textCell('12,5'), { kind: 'decimal', decimals: 2 })).toBe('12,50');
    expect(show(textCell('46239'), { kind: 'date' })).toBe('05/08/2026');
  });

  it('🔴 μορφή που ΔΕΝ αποδίδεται δείχνει τον ωμό αριθμό — ποτέ "Invalid Date"', () => {
    // Σειριακός εκτός ημερολογίου (στην πραγματικότητα τιμή σε ευρώ). Ένα σχέδιο δεν
    // τυπώνει αγγλικά μηνύματα σφάλματος, και η αστοχία της μορφής δεν καταπίνει το δεδομένο.
    expect(show(numberCell(3_500_000), { kind: 'date' })).toBe('3500000');
    expect(show(numberCell(-5), { kind: 'date' })).toBe('-5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 🔴 Ο ΚΑΝΟΝΑΣ — τιμή ≠ εμφάνιση
// ─────────────────────────────────────────────────────────────────────────────

describe('🔴 η αποθηκευμένη τιμή δεν αλλάζει ΠΟΤΕ από τη μορφή', () => {
  const dateColumn = (): PersistedTableModel => {
    const columns: TableColumn[] = [
      {
        id: 'cA',
        sizing: { kind: 'fixed', widthMm: 40 },
        valueType: 'text',
        align: 'left',
        styleOverride: { numberFormat: { kind: 'date' } },
      },
    ];
    const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
    const base: PersistedTableModel = { columns, rows, cells: [], merges: [] };
    return commitCellWrites(writeCellInput(base, 'r1', 'cA', '=DATE(2026,8,5)'));
  };

  // 🔴 **ΑΝΑΘΕΩΡΗΘΗΚΕ ΑΠΟ ΤΟ ADR-761.** Αυτό το σχόλιο έγραφε ότι ο πίνακας μιλά την
  // **κανονική** μορφή «γιατί αυτό γράφει το `ACAD_TABLE` στο DXF». Το επιχείρημα αφορά τη
  // **σειριοποίηση** — και εδώ δεν σειριοποιείται καν συμβολοσειρά: αποθηκεύεται δέντρο.
  //
  // 🔑 Και αυτό το test είναι **η ζωντανή απόδειξη της ανεκτικής εφεδρείας**: η είσοδος
  // γράφεται με `,` (αγγλική γραφή), η κύρια γραμματική του σχεδίου την **απορρίπτει**, η
  // εφεδρεία τη δέχεται, και η γραμμή τύπων την ξαναγράφει με `;`. Δηλαδή ο χρήστης δεν
  // χάνει τίποτα από ό,τι ήξερε, και βλέπει τη γραφή του σχεδίου του.
  it('η άγκυρα του handoff, και στα τρία σκέλη της', () => {
    const model = dateColumn();

    // (α) ο καμβάς δείχνει ΗΜΕΡΟΜΗΝΙΑ
    const layout = layoutTable(resolveTableModel(model), STANDARD, { measureText });
    expect(layout.cells[0].text?.text).toBe('05/08/2026');

    // (β) η γραμμή τύπων δείχνει το ΠΗΓΑΙΟ
    expect(cellInputText(model, 'r1', 'cA')).toBe('=DATE(2026;8;5)');

    // (γ) η ΑΠΟΘΗΚΕΥΜΕΝΗ τιμή παραμένει ο ωμός σειριακός
    expect(model.cells[0][2].value).toBe(46239);
  });

  it('η ακρίβεια επιβιώνει: μορφή 2 δεκαδικών δεν στρογγυλοποιεί το μοντέλο', () => {
    const columns: TableColumn[] = [
      {
        id: 'cA',
        sizing: { kind: 'fixed', widthMm: 30 },
        valueType: 'text',
        align: 'right',
        styleOverride: { numberFormat: { kind: 'decimal', decimals: 2 } },
      },
      { id: 'cB', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'right' },
    ];
    const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
    const base: PersistedTableModel = {
      columns,
      rows,
      cells: [['r1', 'cA', numberCell(1 / 3)]],
      merges: [],
    };
    // Το `A1` δείχνει `0,33`. Ο τύπος που το διαβάζει οφείλει να δει **το ένα τρίτο**, όχι
    // το 0,33 — αλλιώς η μορφοποίηση θα ήταν σφάλμα τιμής (ADR-720), όχι εμφάνισης.
    const model = commitCellWrites(writeCellInput(base, 'r1', 'cB', '=A1*3'));

    const layout = layoutTable(resolveTableModel(model), STANDARD, { measureText });
    expect(layout.cells[0].text?.text).toBe('0,33');
    expect(model.cells.find(([, c]) => c === 'cB')?.[2].value).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Κληρονομικότητα — πέντε επίπεδα
// ─────────────────────────────────────────────────────────────────────────────

describe('επίλυση μορφής — κελί ▸ γραμμή ▸ στήλη ▸ valueType ▸ general', () => {
  const decimal = (decimals: 0 | 1 | 2 | 3): TableCellFormat => ({ kind: 'decimal', decimals });
  const resolve = (o: TableFormatOverrides, vt: TableColumn['valueType'] = 'text') =>
    resolveCellNumberFormat(o, vt);

  it('το κελί νικά τα πάντα', () => {
    expect(
      resolve({
        cell: { numberFormat: decimal(3) },
        row: { numberFormat: decimal(2) },
        column: { numberFormat: decimal(1) },
      }),
    ).toEqual(decimal(3));
  });

  it('η γραμμή νικά τη στήλη', () => {
    expect(resolve({ row: { numberFormat: decimal(2) }, column: { numberFormat: decimal(1) } }))
      .toEqual(decimal(2));
  });

  it('🔑 ένα κελί «Σύνολο» μέσα σε στήλη ημερομηνιών ΥΠΑΡΧΕΙ', () => {
    expect(
      resolve({ cell: { numberFormat: decimal(2) }, column: { numberFormat: { kind: 'date' } } }),
    ).toEqual(decimal(2));
  });

  it('χωρίς καμία ρητή παράκαμψη, μιλά ο σημασιολογικός `valueType`', () => {
    expect(resolve({}, 'number')).toEqual({ kind: 'decimal', decimals: 2 });
    expect(resolve({}, 'count')).toEqual({ kind: 'whole' });
    expect(resolve({}, 'volume-m3')).toEqual({ kind: 'decimal', decimals: 3 });
  });

  it('`text` δεν εκφράζει γνώμη ⇒ καμία μορφή', () => {
    expect(resolve({}, 'text')).toEqual(TABLE_GENERAL_FORMAT);
  });

  it('🔴 τα `dimension-mm-to-*` ΔΕΝ μετατρέπουν — η μονάδα του κελιού είναι άγνωστη', () => {
    // Μετατροπή εδώ θα διαιρούσε σιωπηλά διά 1000 έναν αριθμό που κανείς δεν δήλωσε
    // χιλιοστά: σφάλμα ΤΙΜΗΣ μεταμφιεσμένο σε μορφοποίηση.
    expect(resolve({}, 'dimension-mm-to-m')).toEqual(TABLE_GENERAL_FORMAT);
    expect(show(numberCell(1250), resolve({}, 'dimension-mm-to-m'))).toBe('1250');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Διάταξη — η μορφή τρέχει ΠΡΙΝ τη μέτρηση
// ─────────────────────────────────────────────────────────────────────────────

describe('🔴 το πλάτος μετριέται πάνω στο ΜΟΡΦΟΠΟΙΗΜΕΝΟ κείμενο', () => {
  function hugTable(format: TableCellFormat | undefined): number {
    const columns: TableColumn[] = [
      {
        id: 'cA',
        sizing: { kind: 'hug' },
        valueType: 'text',
        align: 'left',
        ...(format ? { styleOverride: { numberFormat: format } } : {}),
      },
    ];
    const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
    const model: PersistedTableModel = {
      columns,
      rows,
      cells: [['r1', 'cA', numberCell(46239)]],
      merges: [],
    };
    return layoutTable(resolveTableModel(model), STANDARD, { measureText }).columns[0].widthMm;
  }

  it('η στήλη `hug` μεγαλώνει για να χωρέσει το `05/08/2026`, όχι το `46239`', () => {
    // 5 χαρακτήρες vs 10. Μετρημένη πριν τη μορφοποίηση, η στήλη θα έβγαινε στο μισό και το
    // κείμενο θα κοβόταν — σύμπτωμα «κομμένο κείμενο», όχι «λάθος πλάτος».
    expect(hugTable({ kind: 'date' })).toBeGreaterThan(hugTable(undefined));
  });

  it('μετρητής και ζωγράφος συμφωνούν: τίποτα δεν κόβεται', () => {
    const columns: TableColumn[] = [
      {
        id: 'cA',
        sizing: { kind: 'hug' },
        valueType: 'text',
        align: 'left',
        styleOverride: { numberFormat: { kind: 'date' } },
      },
    ];
    const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
    const model: PersistedTableModel = {
      columns,
      rows,
      cells: [['r1', 'cA', numberCell(46239)]],
      merges: [],
    };
    const layout = layoutTable(resolveTableModel(model), STANDARD, { measureText });
    expect(layout.cells[0].text?.text).toBe('05/08/2026');
    expect(layout.cells[0].text?.clipped ?? false).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Φ3 — ο συμπερασμός μορφής από τον ΤΥΠΟ (ο κανόνας του Excel)
// ─────────────────────────────────────────────────────────────────────────────

describe('🔴 τύπος που επιστρέφει ημερομηνία δείχνει ημερομηνία χωρίς καμία ρύθμιση', () => {
  function typedInto(input: string, columnFormat?: TableCellFormat): PersistedTableModel {
    const columns: TableColumn[] = [
      {
        id: 'cA',
        sizing: { kind: 'fixed', widthMm: 60 },
        valueType: 'text',
        align: 'left',
        ...(columnFormat ? { styleOverride: { numberFormat: columnFormat } } : {}),
      },
      { id: 'cB', sizing: { kind: 'fixed', widthMm: 60 }, valueType: 'text', align: 'left' },
    ];
    const rows: TableRow[] = [{ id: 'r1', rowClass: 'data', heightMm: 6 }];
    const base: PersistedTableModel = { columns, rows, cells: [], merges: [] };
    return commitCellWrites(writeCellInput(base, 'r1', 'cA', input));
  }

  const painted = (model: PersistedTableModel): string | undefined =>
    layoutTable(resolveTableModel(model), STANDARD, { measureText }).cells[0].text?.text;

  it('🔴 Η ΠΛΗΓΗ ΤΗΣ Φ3 ΚΛΕΙΝΕΙ: `=DATE(2026,8,5)` σε ΣΚΕΤΟ κελί δείχνει ημερομηνία', () => {
    const model = typedInto('=DATE(2026,8,5)');
    expect(painted(model)).toBe('05/08/2026');
    // …και η τιμή παραμένει ο ωμός σειριακός. Ο συμπερασμός ΔΕΝ γράφεται στο μοντέλο.
    expect(model.cells[0][2].value).toBe(46239);
    expect(model.cells[0][2].styleOverride).toBeUndefined();
  });

  it('αριθμητικός τύπος ΔΕΝ γίνεται ημερομηνία', () => {
    expect(painted(typedInto('=1+1'))).toBe('2');
  });

  it('🔴 σκέτος αριθμός δεν συμπεραίνεται ΠΟΤΕ — η εικασία θα ήταν από την τιμή', () => {
    expect(painted(typedInto('46239'))).toBe('46239');
  });

  it('ρητή παράκαμψη κερδίζει τον συμπερασμό', () => {
    const model = typedInto('=DATE(2026,8,5)', { kind: 'decimal', decimals: 0 });
    expect(painted(model)).toBe('46.239');
  });

  it('🔴 ΚΛΗΣΗ που δίνει ΠΛΗΘΟΣ ημερών μένει αριθμός — ο κατάλογος ρωτά «τι ΕΙΝΑΙ»', () => {
    // ⚠️ Η ρίζα πρέπει να είναι **κλήση** (`DAYS(...)`), όχι αφαίρεση: το
    // `=DATE(...)-DATE(...)` έχει ρίζα `binary`, οπότε δεν περνά καν από τον κατάλογο —
    // πράσινο που θα σήμαινε «δεν κοίταξα». Μετρημένο: με τη διατύπωση της αφαίρεσης, η
    // μετάλλαξη «βάλε το `DAYS` στον κατάλογο» **δεν πιανόταν**.
    expect(painted(typedInto('=DAYS(DATE(2026,8,5),DATE(2026,7,5))'))).toBe('31');
    expect(painted(typedInto('=DATE(2026,8,5)-DATE(2026,7,5)'))).toBe('31');
  });
});
