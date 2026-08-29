/**
 * 🔴 ADR-828 §2-§3 — άγκυρες της **μηχανής σειράς**.
 *
 * Καθαρή στάθμη: κανένα μοντέλο, καμία γεωμετρία, κανένα ποντίκι. Ό,τι σπάει εδώ βγάζει
 * **λάθος κείμενο σε κελί** — όχι εξαίρεση, όχι κόκκινο στην οθόνη. Γι' αυτό κάθε test
 * ονομάζει τον ισχυρισμό του, όχι τη συνάρτηση.
 */

import { detectTableFillSeries } from '../table-fill-series-detect';
import { tableFillSeriesTextAt } from '../table-fill-series-generate';
import type { TableFillSeed, TableFillSeries } from '../table-fill-series-types';
import { excelSerialFromDate } from '../formula/excel-serial-date';
import { TABLE_GENERAL_FORMAT, type TableCellFormat } from '../../../types/table-cell-format';
import type { TableCell } from '../../../types/table';

const DATE_FORMAT: TableCellFormat = { kind: 'date' };

const seed = (value: string | number | null, format = TABLE_GENERAL_FORMAT): TableFillSeed => ({
  cell: value === null ? undefined : { kind: 'text', value },
  format,
});

const lane = (...values: readonly (string | number | null)[]): readonly TableFillSeed[] =>
  values.map((value) => seed(value));

const dateLane = (...isoDates: readonly string[]): readonly TableFillSeed[] =>
  isoDates.map((iso) => seed(excelSerialFromDate(new Date(`${iso}T00:00:00Z`)), DATE_FORMAT));

/** Η σειρά ξεδιπλωμένη σε `count` θέσεις από το `from` — έτσι διαβάζεται μια στήλη. */
const unfold = (series: TableFillSeries, count: number, from = 1): readonly (string | null)[] =>
  Array.from({ length: count }, (_, i) => tableFillSeriesTextAt(series, from + i));

/** Ο σειριακός πίσω σε ISO, ώστε οι ισχυρισμοί για ημερομηνίες να διαβάζονται. */
const asIso = (text: string | null): string | null =>
  text === null ? null : new Date(Date.UTC(1899, 11, 30) + Number(text) * 86_400_000)
    .toISOString()
    .slice(0, 10);

// ════════════════════════════════════════════════════════════════════════════════
describe('απορρίψεις — τι ΔΕΝ είναι σειρά', () => {
  it('κενή λωρίδα', () => {
    expect(detectTableFillSeries([])).toEqual({ kind: 'copy' });
  });

  it('κενό κελί ΣΠΑΕΙ τη σειρά — δεν παρεμβάλλεται', () => {
    expect(detectTableFillSeries(lane(1, null, 3))).toEqual({ kind: 'copy' });
  });

  it('καθαρό κείμενο αντιγράφεται', () => {
    expect(detectTableFillSeries(lane('Δοκός'))).toEqual({ kind: 'copy' });
    expect(detectTableFillSeries(lane('Δοκός', 'Πλάκα'))).toEqual({ kind: 'copy' });
  });

  it('🔴 κελί ΤΥΠΟΥ δεν είναι ΠΟΤΕ σειρά — η συνέχειά του είναι η ολίσθηση αναφορών', () => {
    const formulaCell: TableCell = {
      kind: 'formula',
      value: 10,
      formula: { source: '=A1', ast: null } as unknown as TableCell['formula'],
    };
    expect(
      detectTableFillSeries([{ cell: formulaCell, format: TABLE_GENERAL_FORMAT }]),
    ).toEqual({ kind: 'copy' });
  });

  it('🔴 ΔΕΜΕΝΟ κελί δεν είναι σειρά — ο όρος k+1 δεν τον ισχυρίστηκε καμία πηγή', () => {
    const bound: TableCell = {
      kind: 'text',
      value: 10,
      bound: { sourceValue: 10 } as unknown as TableCell['bound'],
    };
    expect(detectTableFillSeries([{ cell: bound, format: TABLE_GENERAL_FORMAT }])).toEqual({
      kind: 'copy',
    });
  });

  it('🔴 κελί με ΠΛΟΥΣΙΟ ΚΕΙΜΕΝΟ δεν είναι σειρά — οι δείκτες θα έβγαιναν εκτός ορίων', () => {
    const rich: TableCell = {
      kind: 'text',
      value: '9',
      runs: [{ start: 0, end: 1 }] as unknown as TableCell['runs'],
    };
    expect(detectTableFillSeries([{ cell: rich, format: TABLE_GENERAL_FORMAT }])).toEqual({
      kind: 'copy',
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('αριθμοί', () => {
  it('🔴 ΕΝΑΣ αριθμός δίνει ΑΝΤΙΓΡΑΦΗ — βήμα 1 θα ήταν μαντεψιά χωρίς απόδειξη', () => {
    expect(detectTableFillSeries(lane(10))).toEqual({ kind: 'copy' });
  });

  it('δύο αριθμοί ορίζουν το βήμα', () => {
    const series = detectTableFillSeries(lane(10, 20));
    expect(series).toMatchObject({ kind: 'numeric', start: 10, step: 10 });
    expect(unfold(series, 3, 2)).toEqual(['30', '40', '50']);
  });

  it('🔑 ακριβής πρόοδος δίνει ΑΚΡΙΒΕΣ βήμα, χωρίς θόρυβο κινητής υποδιαστολής', () => {
    const series = detectTableFillSeries(lane(1, 3, 5, 7));
    expect(series).toMatchObject({ step: 2 });
    if (series.kind === 'numeric') expect(Object.is(series.step, 2)).toBe(true);
    expect(unfold(series, 2, 4)).toEqual(['9', '11']);
  });

  it('μη γραμμικά δεδομένα προσαρμόζονται με ελάχιστα τετράγωνα, όπως το Excel', () => {
    const series = detectTableFillSeries(lane(1, 2, 4));
    expect(series).toMatchObject({ kind: 'numeric', step: 1.5 });
  });

  it('φθίνουσα σειρά', () => {
    const series = detectTableFillSeries(lane(100, 90));
    expect(unfold(series, 3, 2)).toEqual(['80', '70', '60']);
  });

  it('🔑 το δεκαδικό ΚΟΜΜΑ του σπόρου επιβιώνει — δεν γίνεται τελεία', () => {
    const series = detectTableFillSeries(lane('10,5', '11'));
    expect(unfold(series, 2, 2)).toEqual(['11,5', '12,0']);
  });

  it('η τελεία επιβιώνει επίσης, όταν αυτή έγραψε ο χρήστης', () => {
    const series = detectTableFillSeries(lane('10.5', '11'));
    expect(unfold(series, 1, 2)).toEqual(['11.5']);
  });

  it('🔑 ΑΡΝΗΤΙΚΗ θέση εξάγει προς τα ΠΙΣΩ — η ανάστροφη σύρση', () => {
    const series = detectTableFillSeries(lane(10, 20));
    expect(tableFillSeriesTextAt(series, -1)).toBe('0');
    expect(tableFillSeriesTextAt(series, -2)).toBe('-10');
  });

  it('η θέση 0 επιστρέφει τον πρώτο σπόρο', () => {
    const series = detectTableFillSeries(lane(10, 20));
    expect(tableFillSeriesTextAt(series, 0)).toBe('10');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('λίστες — μήνες και ημέρες', () => {
  it('🔴 ΕΝΑΣ μήνας δίνει ΣΕΙΡΑ — η ασυμμετρία με τον έναν αριθμό', () => {
    const series = detectTableFillSeries(lane('ΙΑΝΟΥΑΡΙΟΣ'));
    // Φ4β: η σειρά κρατά **τα ονόματα**, όχι δείκτη σε μητρώο — γι' αυτό ελέγχεται το
    // περιεχόμενο (12 μήνες, ξεκινώντας από τη θέση 0) και όχι ένα `listId` που έπαψε να υπάρχει.
    expect(series).toMatchObject({ kind: 'list', start: 0, step: 1 });
    expect(series.kind === 'list' && series.entries[0]).toBe('Ιανουάριος');
    expect(series.kind === 'list' && series.entries).toHaveLength(12);
  });

  it('🎯 ΤΟ ΑΙΤΗΜΑ: ΙΑΝΟΥΑΡΙΟΣ δίνει ΦΕΒΡΟΥΑΡΙΟΣ, ΜΑΡΤΙΟΣ, ΑΠΡΙΛΙΟΣ', () => {
    const series = detectTableFillSeries(lane('ΙΑΝΟΥΑΡΙΟΣ'));
    expect(unfold(series, 3)).toEqual(['ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ']);
  });

  it('🎯 ΤΟ ΑΙΤΗΜΑ: ΔΕΥΤΕΡΑ δίνει ΤΡΙΤΗ, ΤΕΤΑΡΤΗ', () => {
    const series = detectTableFillSeries(lane('ΔΕΥΤΕΡΑ'));
    expect(unfold(series, 2)).toEqual(['ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ']);
  });

  it('η γραφή του σπόρου διατηρείται: Title Case με τόνο', () => {
    const series = detectTableFillSeries(lane('Ιανουάριος'));
    expect(unfold(series, 2)).toEqual(['Φεβρουάριος', 'Μάρτιος']);
  });

  it('🔑 η ΓΕΝΙΚΗ συνεχίζεται σε γενική', () => {
    const series = detectTableFillSeries(lane('Ιανουαρίου'));
    // Φ4β: το `form` έπαψε να είναι πεδίο της σειράς — επιλύεται στην **ανίχνευση** και
    // αποτυπώνεται στα ίδια τα ονόματα. Η γενική αναγνωρίζεται όταν το `entries` **είναι** η γενική.
    expect(series.kind === 'list' && series.entries[0]).toBe('Ιανουαρίου');
    expect(unfold(series, 2)).toEqual(['Φεβρουαρίου', 'Μαρτίου']);
  });

  it('η συντομογραφία συνεχίζεται σε συντομογραφία', () => {
    const series = detectTableFillSeries(lane('Ιαν'));
    expect(unfold(series, 2)).toEqual(['Φεβ', 'Μαρ']);
  });

  it('🔑 αναδιπλώνεται: μετά τον ΔΕΚΕΜΒΡΙΟ έρχεται ο ΙΑΝΟΥΑΡΙΟΣ', () => {
    const series = detectTableFillSeries(lane('ΔΕΚΕΜΒΡΙΟΣ'));
    expect(unfold(series, 2)).toEqual(['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ']);
  });

  it('🔑 αναδιπλώνεται ΠΡΟΣ ΤΑ ΠΙΣΩ: πριν τον ΙΑΝΟΥΑΡΙΟ έρχεται ο ΔΕΚΕΜΒΡΙΟΣ', () => {
    const series = detectTableFillSeries(lane('ΙΑΝΟΥΑΡΙΟΣ'));
    expect(tableFillSeriesTextAt(series, -1)).toBe('ΔΕΚΕΜΒΡΙΟΣ');
  });

  it('🔴 οι ΗΜΕΡΕΣ αναδιπλώνονται στις 7, όχι στις 12', () => {
    const series = detectTableFillSeries(lane('ΚΥΡΙΑΚΗ'));
    expect(unfold(series, 2)).toEqual(['ΔΕΥΤΕΡΑ', 'ΤΡΙΤΗ']);
  });

  it('🔴 το κυκλικό βήμα ΗΜΕΡΩΝ μετριέται στις 7: Κυριακή→Δευτέρα είναι +1', () => {
    const series = detectTableFillSeries(lane('ΚΥΡΙΑΚΗ', 'ΔΕΥΤΕΡΑ'));
    expect(series).toMatchObject({ kind: 'list', step: 1 });
  });

  it('δύο μήνες ορίζουν βήμα 2', () => {
    const series = detectTableFillSeries(lane('Ιαν', 'Μαρ'));
    expect(series).toMatchObject({ kind: 'list', step: 2 });
    // 🔑 `Μαι` **χωρίς** τόνο, όχι `Μάι`: ο σπόρος `Ιαν` γράφτηκε άτονος, άρα η γραφή που
    // ταξιδεύει είναι «χωρίς τόνους». Ο χρήστης που δεν βάζει τόνους δεν θέλει να του
    // εμφανιστεί ένας στη μέση της στήλης του.
    expect(unfold(series, 2, 2)).toEqual(['Μαι', 'Ιουλ']);
  });

  it('ο τόνος επιστρέφει όταν ο σπόρος τον είχε', () => {
    const series = detectTableFillSeries(lane('Μάρτιος'));
    expect(unfold(series, 3)).toEqual(['Απρίλιος', 'Μάιος', 'Ιούνιος']);
  });

  it('ο Δεκέμβριος προς Ιανουάριο μετριέται +1, όχι −11', () => {
    const series = detectTableFillSeries(lane('ΔΕΚΕΜΒΡΙΟΣ', 'ΙΑΝΟΥΑΡΙΟΣ'));
    expect(series).toMatchObject({ step: 1 });
  });

  it('λίστα με ΜΗ σταθερό βήμα αντιγράφεται — κανένας μήνας 1,5', () => {
    expect(detectTableFillSeries(lane('Ιαν', 'Μαρ', 'Ιουν'))).toEqual({ kind: 'copy' });
  });

  it('ανάμεικτες στήλες δεν είναι σειρά', () => {
    expect(detectTableFillSeries(lane('Ιανουάριος', 'Φεβρουαρίου'))).toEqual({ kind: 'copy' });
  });

  it('αγγλικά δουλεύουν ανεξάρτητα από τη γλώσσα της διεπαφής', () => {
    const series = detectTableFillSeries(lane('January'));
    expect(unfold(series, 2)).toEqual(['February', 'March']);
  });

  it('το May διαβάζεται ως πλήρες όνομα και συνεχίζει June', () => {
    expect(unfold(detectTableFillSeries(lane('May')), 1)).toEqual(['June']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('κείμενο με αριθμό στο τέλος', () => {
  it('🔴 ΕΝΑ «Στοιχείο 1» δίνει ΣΕΙΡΑ', () => {
    const series = detectTableFillSeries(lane('Στοιχείο 1'));
    expect(series).toMatchObject({ kind: 'suffix-number', prefix: 'Στοιχείο ', step: 1 });
    expect(unfold(series, 2)).toEqual(['Στοιχείο 2', 'Στοιχείο 3']);
  });

  it('το ζωνάρωμα διατηρείται', () => {
    const series = detectTableFillSeries(lane('Στοιχείο 008'));
    expect(unfold(series, 2)).toEqual(['Στοιχείο 009', 'Στοιχείο 010']);
  });

  it('χωρίς μηδενικά στον σπόρο, χωρίς μηδενικά στη συνέχεια', () => {
    expect(unfold(detectTableFillSeries(lane('Δοκός 8')), 2)).toEqual(['Δοκός 9', 'Δοκός 10']);
  });

  it('διαφορετικό πρόθεμα σπάει την ανίχνευση', () => {
    expect(detectTableFillSeries(lane('Δοκός 1', 'Πλάκα 2'))).toEqual({ kind: 'copy' });
  });

  it('κοινό επίθεμα διατηρείται', () => {
    const series = detectTableFillSeries(lane('Τμήμα 1ο', 'Τμήμα 2ο'));
    expect(unfold(series, 1, 2)).toEqual(['Τμήμα 3ο']);
  });

  it('🔴 ΔΗΛΩΜΕΝΗ ΑΠΟΚΛΙΣΗ: «Ιανουάριος 2026» δίνει «Ιανουάριος 2027», όχι «Φεβρουάριος 2026»', () => {
    // Το Excel το διαβάζει ως ΗΜΕΡΟΜΗΝΙΑ. Εδώ δεν υπάρχει είδος κελιού «ημερομηνία» —
    // ημερομηνία είναι αριθμός συν μορφή, και αυτό το κελί είναι κείμενο. Δες ADR-828 §2.
    const series = detectTableFillSeries(lane('Ιανουάριος 2026'));
    expect(series).toMatchObject({ kind: 'suffix-number' });
    expect(unfold(series, 1)).toEqual(['Ιανουάριος 2027']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('ημερομηνίες', () => {
  it('🔴 ΜΙΑ ημερομηνία δίνει σειρά +1 ημέρας — η ασυμμετρία με τον έναν αριθμό', () => {
    const series = detectTableFillSeries(dateLane('2026-08-29'));
    expect(series).toMatchObject({ kind: 'date', unit: 'day', step: 1 });
    expect(unfold(series, 2).map(asIso)).toEqual(['2026-08-30', '2026-08-31']);
  });

  it('🔴 αριθμός ΧΩΡΙΣ μορφή ημερομηνίας μένει αριθμός — το 46239 μπορεί να είναι ευρώ', () => {
    expect(detectTableFillSeries(lane(46_239, 46_240))).toMatchObject({ kind: 'numeric' });
  });

  it('ίδια ημέρα του μήνα δίνει βήμα ΜΗΝΑ', () => {
    const series = detectTableFillSeries(dateLane('2026-01-15', '2026-02-15'));
    expect(series).toMatchObject({ kind: 'date', unit: 'month', step: 1 });
    expect(unfold(series, 2, 2).map(asIso)).toEqual(['2026-03-15', '2026-04-15']);
  });

  it('🔑 ΤΕΛΗ ΜΗΝΩΝ: 31/1 και 28/2 είναι σειρά ΜΗΝΑ, όχι «κάθε 28 ημέρες»', () => {
    const series = detectTableFillSeries(dateLane('2026-01-31', '2026-02-28'));
    expect(series).toMatchObject({ unit: 'month', step: 1 });
    expect(unfold(series, 2, 2).map(asIso)).toEqual(['2026-03-31', '2026-04-30']);
  });

  it('σταθερή διαφορά ημερών δίνει σειρά ημερών', () => {
    const series = detectTableFillSeries(dateLane('2026-01-01', '2026-01-08'));
    expect(series).toMatchObject({ unit: 'day', step: 7 });
    expect(unfold(series, 1, 2).map(asIso)).toEqual(['2026-01-15']);
  });

  it('🔑 το ψαλίδισμα κρατά τη σειρά μέσα στον μήνα: 31 Ιαν +1 μήνας = 28 Φεβ', () => {
    const series: TableFillSeries = {
      kind: 'date',
      start: excelSerialFromDate(new Date('2026-01-31T00:00:00Z')),
      step: 1,
      unit: 'month',
    };
    expect(asIso(tableFillSeriesTextAt(series, 1))).toBe('2026-02-28');
  });

  it('ημερομηνίες πάνε και προς τα πίσω', () => {
    const series = detectTableFillSeries(dateLane('2026-03-15', '2026-04-15'));
    expect(asIso(tableFillSeriesTextAt(series, -1))).toBe('2026-02-15');
  });

  it('🔑 η μονάδα «καθημερινή» προσπερνά Σάββατο και Κυριακή', () => {
    // 2026-08-28 είναι Παρασκευή· μία εργάσιμη μετά είναι η Δευτέρα 31/8.
    const series: TableFillSeries = {
      kind: 'date',
      start: excelSerialFromDate(new Date('2026-08-28T00:00:00Z')),
      step: 1,
      unit: 'weekday',
    };
    expect(new Date('2026-08-28T00:00:00Z').getUTCDay()).toBe(5);
    expect(asIso(tableFillSeriesTextAt(series, 1))).toBe('2026-08-31');
    expect(asIso(tableFillSeriesTextAt(series, 2))).toBe('2026-09-01');
  });

  it('🔴 σειριακός εκτός ημερολογίου δίνει null — το κελί αντιγράφει, δεν γράφει NaN', () => {
    const series: TableFillSeries = { kind: 'date', start: 1, step: -1, unit: 'day' };
    expect(tableFillSeriesTextAt(series, 5)).toBeNull();
  });
});
