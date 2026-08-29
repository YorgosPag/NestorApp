/**
 * 🔴 ADR-828 §7.2 — άγκυρες της **αναγκαστικής μονάδας ημερολογίου**: ό,τι διαλέγει ο άνθρωπος
 * από το μενού δεξιού συρσίματος.
 *
 * Καθαρή στάθμη — κανένα μοντέλο, καμία γεωμετρία, κανένα ποντίκι. Ό,τι σπάει εδώ γράφει
 * **λάθος ημερομηνία σε κελί χρήστη**: δεν πετά, δεν κοκκινίζει, φαίνεται μόνο αν κάποιος
 * διαβάσει τη στήλη.
 *
 * ## Τι κλειδώνει, με μία πρόταση το καθένα
 *  1. Οι «καθημερινές» **υπάρχουν μόνο εδώ** — καμία ανίχνευση δεν τις παράγει (§2).
 *  2. Η ρητή μονάδα **ανατρέπει** τη συμπερασμένη (`31/1, 28/2` = μήνες ⇒ «ημέρες» = +28).
 *  3. Η ρητή μονάδα **δεν εφευρίσκει είδος**: πάνω σε αριθμούς δίνει **αντιγραφή**, όχι σειρά.
 *
 * @see bim/table/table-fill-series-detect.ts — `TableFillDetectOptions.forceDateUnit`
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §7.2
 */

import { detectTableFillSeries } from '../table-fill-series-detect';
import { tableFillSeriesTextAt } from '../table-fill-series-generate';
import type { TableFillSeed } from '../table-fill-series-types';
import { excelSerialFromDate } from '../formula/excel-serial-date';
import { TABLE_GENERAL_FORMAT, type TableCellFormat } from '../../../types/table-cell-format';

const DATE_FORMAT: TableCellFormat = { kind: 'date' };

const seed = (value: string | number, format = TABLE_GENERAL_FORMAT): TableFillSeed => ({
  cell: { kind: 'text', value },
  format,
});

const dateLane = (...isoDates: readonly string[]): readonly TableFillSeed[] =>
  isoDates.map((iso) => seed(excelSerialFromDate(new Date(`${iso}T00:00:00Z`)), DATE_FORMAT));

/** Ο σειριακός πίσω σε ISO, ώστε οι ισχυρισμοί να διαβάζονται σαν ημερολόγιο. */
const asIso = (text: string | null): string | null =>
  text === null
    ? null
    : new Date(Date.UTC(1899, 11, 30) + Number(text) * 86_400_000).toISOString().slice(0, 10);

/** Οι επόμενες `count` τιμές μιας λωρίδας, με τη ρητή μονάδα του μενού. */
const filledWith = (
  seeds: readonly TableFillSeed[],
  unit: 'day' | 'weekday' | 'month' | 'year',
  count: number,
): readonly (string | null)[] => {
  const series = detectTableFillSeries(seeds, { forceDateUnit: unit });
  return Array.from({ length: count }, (_, i) =>
    asIso(tableFillSeriesTextAt(series, seeds.length + i)),
  );
};

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 «Συμπλήρωση καθημερινών» — η μονάδα που ΔΕΝ συμπεραίνεται ποτέ', () => {
  it('Παρασκευή ⇒ Δευτέρα: το σαββατοκύριακο προσπερνιέται', () => {
    // 2026-08-28 = Παρασκευή. Χωρίς την εντολή, η ίδια είσοδος δίνει «+1 ημέρα» (§2) — δηλαδή
    // 29/8 και 30/8, που είναι Σάββατο και Κυριακή. Αυτή είναι όλη η αξία του item.
    expect(filledWith(dateLane('2026-08-28'), 'weekday', 3)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('🔑 η ΑΥΤΟΜΑΤΗ ανίχνευση της ΙΔΙΑΣ εισόδου δίνει ημέρες — άρα το item δεν είναι διακοσμητικό', () => {
    // Ο έλεγχος που κάνει τον προηγούμενο μέτρηση αντί για ισχυρισμό: αν το `'auto'` έδινε ήδη
    // καθημερινές, το μενού δεν θα πρόσθετε τίποτα και το test από πάνω θα ήταν πράσινο για
    // λάθος λόγο.
    const auto = detectTableFillSeries(dateLane('2026-08-28'));
    expect(asIso(tableFillSeriesTextAt(auto, 1))).toBe('2026-08-29');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 Η ΡΗΤΗ ΜΟΝΑΔΑ ΑΝΑΤΡΕΠΕΙ ΤΗ ΣΥΜΠΕΡΑΣΜΕΝΗ', () => {
  it('«τέλη μηνών» + «Συμπλήρωση ημερών» ⇒ μετρά ΗΜΕΡΕΣ, κρατώντας τη διαφορά των σπόρων', () => {
    // `31/1, 28/2` είναι η υπογραφή «τέλος μήνα» που το `'auto'` διαβάζει ως μήνες (§2). Ο
    // άνθρωπος λέει «όχι, ημέρες»: η **μονάδα** αλλάζει, το **βήμα** εξακολουθούν να το λένε οι
    // σπόροι — 28 ημέρες, όχι 1.
    expect(filledWith(dateLane('2026-01-31', '2026-02-28'), 'day', 2)).toEqual([
      '2026-03-28',
      '2026-04-25',
    ]);
  });

  it('η ίδια είσοδος με «Συμπλήρωση μηνών» μένει στα τέλη των μηνών', () => {
    expect(filledWith(dateLane('2026-01-31', '2026-02-28'), 'month', 2)).toEqual([
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('μονήρης σπόρος ⇒ βήμα 1 στη ζητούμενη μονάδα (κανείς δεν δήλωσε άλλο)', () => {
    expect(filledWith(dateLane('2026-01-31'), 'month', 3)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(filledWith(dateLane('2026-01-31'), 'year', 2)).toEqual(['2027-01-31', '2028-01-31']);
  });

  it('βήμα 0 στη ζητούμενη μονάδα ΔΕΝ είναι σειρά ⇒ υποχωρεί σε 1', () => {
    // `15/1, 15/2` έχουν βήμα **ετών** μηδέν. Ένα `step: 0` θα έγραφε την ίδια χρονιά επ' άπειρον
    // — δηλαδή αντιγραφή με το όνομα της σειράς.
    expect(filledWith(dateLane('2026-01-15', '2026-02-15'), 'year', 2)).toEqual([
      '2028-01-15',
      '2029-01-15',
    ]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 Η ΕΝΤΟΛΗ ΔΙΝΕΙ ΜΟΝΑΔΑ, ΠΟΤΕ ΕΙΔΟΣ', () => {
  it('μονάδα ημερολογίου πάνω σε ΑΡΙΘΜΟΥΣ ⇒ αντιγραφή, όχι αριθμητική σειρά', () => {
    // Ο φρουρός που κρατά τη «Συμπλήρωση μηνών» από το να καταλήξει σιωπηλά στο P2 και να
    // γράψει `30, 40`. Στην πράξη το item είναι γκρίζο εκεί — αλλά ένα γκρίζο item είναι
    // απόφαση **διεπαφής**, και η μηχανή δεν επιτρέπεται να στηρίζεται σε αυτήν.
    const series = detectTableFillSeries([seed(10), seed(20)], { forceDateUnit: 'month' });
    expect(series.kind).toBe('copy');
  });

  it('μονάδα ημερολογίου πάνω σε ΚΕΙΜΕΝΟ ⇒ αντιγραφή', () => {
    const series = detectTableFillSeries([seed('Στοιχείο 1')], { forceDateUnit: 'day' });
    expect(series.kind).toBe('copy');
  });
});
