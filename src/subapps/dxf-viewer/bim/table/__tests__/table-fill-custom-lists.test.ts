/**
 * 🔴 ADR-828 Φ4β — άγκυρες των **προσαρμοσμένων λιστών** μέσα στη μηχανή σειράς.
 *
 * Το ζητούμενο ολόκληρο, σε μία πρόταση: ο άνθρωπος γράφει «Ισόγειο, Α΄ όροφος…» στις
 * ρυθμίσεις του, τραβά τη λαβή, και η στήλη συνεχίζεται όπως συνεχίζονται οι μήνες.
 *
 * ⚠️ Καθαρή στάθμη: κανένα Firestore, καμία ρύθμιση, κανένα React. Οι λίστες φτάνουν εδώ
 * όπως φτάνουν στην παραγωγή — **ως όρισμα από τον καλούντα**. Ένα test που θα
 * πλαστογραφούσε αποθετήριο θα έλεγχε τη σύνδεση, όχι τη συμπεριφορά.
 */

import { detectTableFillSeries } from '../table-fill-series-detect';
import { tableFillSeriesTextAt } from '../table-fill-series-generate';
import type { TableFillSeed, TableFillSeries } from '../table-fill-series-types';
import { TABLE_GENERAL_FORMAT } from '../../../types/table-cell-format';
import type { NameListCandidate } from '@/lib/string/name-list-match';

const lane = (...values: readonly string[]): readonly TableFillSeed[] =>
  values.map((value) => ({ cell: { kind: 'text', value }, format: TABLE_GENERAL_FORMAT }));

const unfold = (series: TableFillSeries, count: number, from = 1): readonly (string | null)[] =>
  Array.from({ length: count }, (_, i) => tableFillSeriesTextAt(series, from + i));

const FLOORS: NameListCandidate = {
  key: 'user:Όροφοι',
  entries: ['Ισόγειο', 'Α΄ όροφος', 'Β΄ όροφος', 'Γ΄ όροφος'],
};

const PHASES: NameListCandidate = {
  key: 'user:Φάσεις',
  entries: ['Εκσκαφή', 'Θεμελίωση', 'Φέρων οργανισμός', 'Τοιχοποιίες'],
};

// ════════════════════════════════════════════════════════════════════════════════
describe('🎯 ΤΟ ΑΙΤΗΜΑ — η λίστα του ανθρώπου συνεχίζεται σαν τους μήνες', () => {
  it('«Ισόγειο» δίνει «Α΄ όροφος, Β΄ όροφος»', () => {
    const series = detectTableFillSeries(lane('Ισόγειο'), { customLists: [FLOORS] });
    expect(unfold(series, 2)).toEqual(['Α΄ όροφος', 'Β΄ όροφος']);
  });

  it('🔑 ΕΝΑ όνομα αρκεί — ίδια ασυμμετρία με τους μήνες, ίδιος λόγος', () => {
    const series = detectTableFillSeries(lane('Εκσκαφή'), { customLists: [PHASES] });
    expect(series.kind).toBe('list');
  });

  it('δύο σπόροι δηλώνουν βήμα: κάθε δεύτερος όροφος, με αναδίπλωση', () => {
    const series = detectTableFillSeries(lane('Ισόγειο', 'Β΄ όροφος'), {
      customLists: [FLOORS],
    });
    // Βήμα +2 πάνω σε κύκλο 4: μετά τον Β΄ (θέση 2) η επόμενη είναι η 4 ⇒ πίσω στο Ισόγειο.
    expect(unfold(series, 2)).toEqual(['Β΄ όροφος', 'Ισόγειο']);
  });

  it('🔑 αναδιπλώνεται όπως ο Δεκέμβριος: μετά τον Γ΄ όροφο έρχεται το Ισόγειο', () => {
    const series = detectTableFillSeries(lane('Γ΄ όροφος'), { customLists: [FLOORS] });
    expect(tableFillSeriesTextAt(series, 1)).toBe('Ισόγειο');
  });

  it('🔑 αναδιπλώνεται και ΠΡΟΣ ΤΑ ΠΙΣΩ — η ανάστροφη σύρση δεν είναι δεύτερος κλάδος', () => {
    const series = detectTableFillSeries(lane('Ισόγειο'), { customLists: [FLOORS] });
    expect(tableFillSeriesTextAt(series, -1)).toBe('Γ΄ όροφος');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('χωρίς λίστες, τίποτα δεν αλλάζει', () => {
  it('η ίδια λέξη χωρίς δηλωμένη λίστα είναι απλό κείμενο ⇒ αντιγραφή', () => {
    expect(detectTableFillSeries(lane('Ισόγειο'))).toEqual({ kind: 'copy' });
  });

  it('οι ενσωματωμένοι μήνες συνεχίζουν να δουλεύουν όταν δίνονται λίστες χρήστη', () => {
    const series = detectTableFillSeries(lane('ΙΑΝΟΥΑΡΙΟΣ'), { customLists: [FLOORS] });
    expect(unfold(series, 2)).toEqual(['ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('🔴 ΠΡΟΤΕΡΑΙΟΤΗΤΑ — κερδίζει αυτό που δήλωσε ο άνθρωπος', () => {
  /**
   * Ο άνθρωπος που έγραψε δική του λίστα μηνών **σε συντομογραφία τριών γραμμάτων** το
   * έκανε επειδή τη θέλει· η ενσωματωμένη είναι προεπιλογή. Το επιχείρημα δεν είναι
   * αισθητικό: η ρητή δήλωση είναι πληροφορία, η προεπιλογή είναι απουσία πληροφορίας.
   */
  const OWN_MONTHS: NameListCandidate = {
    key: 'user:Δικοί μου μήνες',
    entries: ['Ιανουάριος', 'Φλεβάρης', 'Μάρτης'],
  };

  it('η λίστα του χρήστη κερδίζει την ενσωματωμένη στην ίδια λέξη', () => {
    const series = detectTableFillSeries(lane('Ιανουάριος'), { customLists: [OWN_MONTHS] });
    expect(unfold(series, 2)).toEqual(['Φλεβάρης', 'Μάρτης']);
  });

  it('⚠️ και ΧΩΡΙΣ αυτήν, η ίδια λέξη δίνει την ενσωματωμένη — η σειρά ΕΙΝΑΙ ο κανόνας', () => {
    const series = detectTableFillSeries(lane('Ιανουάριος'));
    expect(unfold(series, 2)).toEqual(['Φεβρουάριος', 'Μάρτιος']);
  });

  it('ανάμεσα σε δύο λίστες χρήστη κερδίζει η πρώτη δηλωμένη', () => {
    const other: NameListCandidate = { key: 'user:Άλλη', entries: ['Ισόγειο', 'Πατάρι'] };
    const series = detectTableFillSeries(lane('Ισόγειο'), { customLists: [other, FLOORS] });
    expect(tableFillSeriesTextAt(series, 1)).toBe('Πατάρι');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('ομοιομορφία — τι ΔΕΝ είναι σειρά', () => {
  it('🔑 σπόροι από ΔΥΟ διαφορετικές λίστες δεν είναι σειρά', () => {
    const series = detectTableFillSeries(lane('Ισόγειο', 'Θεμελίωση'), {
      customLists: [FLOORS, PHASES],
    });
    expect(series).toEqual({ kind: 'copy' });
  });

  it('μη ακριβές κυκλικό βήμα απορρίπτεται αντί να «στρογγυλοποιηθεί»', () => {
    const series = detectTableFillSeries(lane('Ισόγειο', 'Α΄ όροφος', 'Γ΄ όροφος'), {
      customLists: [FLOORS],
    });
    expect(series).toEqual({ kind: 'copy' });
  });

  it('η γραφή του σπόρου φοριέται στη συνέχεια: ΚΕΦΑΛΑΙΑ μένουν ΚΕΦΑΛΑΙΑ', () => {
    const series = detectTableFillSeries(lane('ΙΣΟΓΕΙΟ'), { customLists: [FLOORS] });
    expect(unfold(series, 1)).toEqual(['Α΄ ΟΡΟΦΟΣ']);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
/**
 * 🔴 Η **κλάση** του σφάλματος που έβγαλε η πρώτη πολυλεκτική λίστα, όχι το δείγμα.
 *
 * Το `'title'` τιτλοποιεί **κάθε λέξη**. Ένας σπόρος μίας λέξης δεν αποδεικνύει τίποτα για
 * τη δεύτερη λέξη μιας φράσης, οπότε το φόρεμά του εκεί είναι **επανα-γραφή δεδομένων που
 * πληκτρολόγησε ο άνθρωπος**. Καμία ενσωματωμένη εγγραφή δεν είναι φράση, γι' αυτό το
 * σφάλμα ήταν δομικά αόρατο μέχρι τη Φ4β.
 */
describe('🔴 το σχήμα γραφής δεν επανα-γράφει φράσεις', () => {
  it('Title Case ΔΕΝ κεφαλαιοποιεί τη δεύτερη λέξη μιας εγγραφής-φράσης', () => {
    const series = detectTableFillSeries(lane('Ισόγειο'), { customLists: [FLOORS] });
    expect(unfold(series, 1)).toEqual(['Α΄ όροφος']);
  });

  it('⚠️ και όμως ΦΟΡΙΕΤΑΙ κανονικά όταν οι εγγραφές είναι μονολεκτικές', () => {
    const single: NameListCandidate = { key: 'user:Μονολεκτική', entries: ['Άλφα', 'βήτα'] };
    const series = detectTableFillSeries(lane('Άλφα'), { customLists: [single] });
    expect(unfold(series, 1)).toEqual(['Βήτα']);
  });

  it('τα ΚΕΦΑΛΑΙΑ και τα πεζά εφαρμόζονται ομοιόμορφα — εκείνα δεν εφευρίσκουν', () => {
    const upper = detectTableFillSeries(lane('ΙΣΟΓΕΙΟ'), { customLists: [FLOORS] });
    expect(unfold(upper, 1)).toEqual(['Α΄ ΟΡΟΦΟΣ']);
    const lower = detectTableFillSeries(lane('ισογειο'), { customLists: [FLOORS] });
    expect(unfold(lower, 1)).toEqual(['α΄ οροφος']);
  });
});
