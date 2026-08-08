/**
 * 🔴 ADR-739 §60 / ADR-760 — **οι ΟΨΕΙΣ της μορφής αριθμού**: τι αλλάζει και, κυρίως, **τι
 * επιβιώνει** όταν ο χρήστης περιηγείται τη λίστα κατηγοριών του διαλόγου.
 *
 * ⚠️ Η μισή αξία αυτού του αρχείου είναι στα «επιβιώνει»: μια αλλαγή κατηγορίας που πετά τα
 * δεκαδικά **δουλεύει** και είναι λάθος, και κανένα άλλο test δεν το βλέπει — η μορφή που
 * προκύπτει είναι απολύτως έγκυρη.
 */

import {
  DEFAULT_TABLE_ANGLE_UNIT,
  TABLE_DECIMAL_STEPS,
  TABLE_NUMBER_FORMAT_KINDS,
  clampTableFormatDecimals,
  tableNumberFormatDecimals,
  tableNumberFormatHasGrouping,
  tableNumberFormatSupportsGrouping,
  withTableNumberFormatAngleUnit,
  withTableNumberFormatCurrency,
  withTableNumberFormatDateStyle,
  withTableNumberFormatDecimals,
  withTableNumberFormatGrouping,
  withTableNumberFormatKind,
} from '../table-number-format-facets';
import { isTableCellFormatEqual } from '../table-number-format-ops';
import type { TableCellFormat, TableCellFormatKind } from '../../../types/table-cell-format';

describe('§60 — ο κατάλογος των κατηγοριών', () => {
  it('🔴 προσφέρει ΟΛΑ τα είδη του μοντέλου — κανένα εκφράσιμο δεν είναι απρόσιτο', () => {
    // ⚠️ Ο έλεγχος πληρότητας ζει στον **μεταγλωττιστή** (ο κατάλογος παράγεται από
    // `Record<TableCellFormatKind, number>`), όχι εδώ: ένα `toHaveLength(8)` θα ήταν τρίτη
    // δήλωση του ίδιου συνόλου, και θα περνούσε ακόμη κι αν ένα είδος ήταν γραμμένο δύο φορές
    // και ένα άλλο έλειπε. Αυτό που **δεν** μπορεί να δει ο μεταγλωττιστής είναι διπλοεγγραφή
    // μετά την παραγωγή — και μόνο αυτό ελέγχεται.
    const unique = new Set(TABLE_NUMBER_FORMAT_KINDS);
    expect(unique.size).toBe(TABLE_NUMBER_FORMAT_KINDS.length);

    // Και η άλλη κατεύθυνση: κάθε είδος που **παράγει** η μηχανή αλλαγής κατηγορίας πρέπει να
    // υπάρχει στον κατάλογο — αλλιώς θα ήταν μορφή που το μοντέλο φτιάχνει και ο διάλογος δεν
    // δείχνει ποτέ.
    const reachable: TableCellFormatKind[] = TABLE_NUMBER_FORMAT_KINDS.map(
      (kind) => withTableNumberFormatKind(null, kind).kind,
    );
    expect(new Set(reachable)).toEqual(unique);
  });

  it('🔑 η «Γενική» είναι ΠΡΩΤΗ και το «Κείμενο» ΤΕΛΕΥΤΑΙΟ — η σειρά του Excel', () => {
    expect(TABLE_NUMBER_FORMAT_KINDS[0]).toBe('general');
    expect(TABLE_NUMBER_FORMAT_KINDS[TABLE_NUMBER_FORMAT_KINDS.length - 1]).toBe('text');
  });
});

describe('§60 — η ΑΛΛΑΓΗ ΚΑΤΗΓΟΡΙΑΣ κρατά ό,τι μεταφέρεται', () => {
  const currency: TableCellFormat = {
    kind: 'currency', decimals: 3, currency: 'USD', grouping: false, locale: 'en-US',
  };

  it('🔴 τα δεκαδικά επιβιώνουν Νόμισμα → Δεκαδικός', () => {
    const next = withTableNumberFormatKind(currency, 'decimal');
    expect(next.kind).toBe('decimal');
    expect(tableNumberFormatDecimals(next)).toBe(3);
  });

  it('🔴 η ομαδοποίηση επιβιώνει, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΡΗΤΟ `false`', () => {
    // Το «απόν σημαίνει ναι» κάνει το ρητό `false` τη μόνη κατάσταση που μπορεί να χαθεί
    // σιωπηλά: ένα `{...}` χωρίς το πεδίο θα διαβαζόταν «ομαδοποιεί» και ο χρήστης θα έβλεπε
    // τελείες να εμφανίζονται μόνες τους.
    expect(tableNumberFormatHasGrouping(withTableNumberFormatKind(currency, 'whole'))).toBe(false);
  });

  it('🔴 το `locale` επιβιώνει ΠΑΝΤΑ — είναι σύμβαση του ΣΧΕΔΙΟΥ, όχι του είδους', () => {
    for (const kind of TABLE_NUMBER_FORMAT_KINDS) {
      expect(withTableNumberFormatKind(currency, kind).locale).toBe('en-US');
    }
  });

  it('ο κωδικός νομίσματος επιβιώνει Νόμισμα → Δεκαδικός → Νόμισμα', () => {
    const back = withTableNumberFormatKind(
      withTableNumberFormatKind(currency, 'decimal'), 'currency',
    );
    expect(back.kind === 'currency' && back.currency).toBe('EUR');
  });

  it('🔑 τα `general`/`text` ΔΕΝ κρατούν αριθμητική γνώμη — δηλώνουν ότι δεν έχουν', () => {
    expect(tableNumberFormatDecimals(withTableNumberFormatKind(currency, 'general'))).toBeNull();
    expect(tableNumberFormatDecimals(withTableNumberFormatKind(currency, 'text'))).toBeNull();
  });

  it('από ΚΑΜΙΑ μορφή (ανάμεικτος στόχος) κάθε είδος παίρνει την προεπιλογή του', () => {
    expect(tableNumberFormatDecimals(withTableNumberFormatKind(null, 'currency'))).toBe(2);
    expect(tableNumberFormatDecimals(withTableNumberFormatKind(null, 'percent'))).toBe(0);
    const angle = withTableNumberFormatKind(null, 'angle');
    expect(angle.kind === 'angle' && angle.unit).toBe(DEFAULT_TABLE_ANGLE_UNIT);
  });

  it('🔴 ΚΑΘΕ είδος παράγει μορφή ΤΟΥ είδους — κανένα δεν πέφτει σιωπηλά αλλού', () => {
    const kinds: readonly TableCellFormatKind[] = TABLE_NUMBER_FORMAT_KINDS;
    for (const kind of kinds) {
      expect(withTableNumberFormatKind(currency, kind).kind).toBe(kind);
    }
  });
});

describe('§60 — μία όψη τη φορά', () => {
  const decimal: TableCellFormat = { kind: 'decimal', decimals: 2, grouping: true };

  it('τα δεκαδικά αλλάζουν ΧΩΡΙΣ να αλλάξει είδος', () => {
    const next = withTableNumberFormatDecimals(decimal, 5);
    expect(next.kind).toBe('decimal');
    expect(tableNumberFormatDecimals(next)).toBe(5);
    expect(tableNumberFormatHasGrouping(next)).toBe(true);
  });

  it('🔑 ο ΑΚΕΡΑΙΟΣ με δεκαδικά γίνεται ΔΕΚΑΔΙΚΟΣ — «ακέραιος με 2 δεκαδικά» δεν υπάρχει', () => {
    const next = withTableNumberFormatDecimals({ kind: 'whole', grouping: false }, 2);
    expect(next.kind).toBe('decimal');
    expect(tableNumberFormatHasGrouping(next)).toBe(false);
  });

  it('η ομαδοποίηση αγνοείται σε είδη που δεν τη δέχονται — καμία σιωπηλή πλεονάζουσα ιδιότητα', () => {
    const percent: TableCellFormat = { kind: 'percent', decimals: 1 };
    expect(tableNumberFormatSupportsGrouping(percent)).toBe(false);
    expect(withTableNumberFormatGrouping(percent, true)).toBe(percent);
  });

  it('νόμισμα / ημερομηνία / γωνία γράφονται ΜΟΝΟ στο δικό τους είδος', () => {
    expect(withTableNumberFormatCurrency(decimal, 'USD')).toBe(decimal);
    expect(withTableNumberFormatDateStyle(decimal, 'iso')).toBe(decimal);
    expect(withTableNumberFormatAngleUnit(decimal, 'grads')).toBe(decimal);
  });

  it('🔴 το κόψιμο ακρίβειας δίνει ΠΑΝΤΑ τιμή του καταλόγου — ποτέ cast', () => {
    expect(clampTableFormatDecimals(-4)).toBe(TABLE_DECIMAL_STEPS[0]);
    expect(clampTableFormatDecimals(99)).toBe(TABLE_DECIMAL_STEPS[TABLE_DECIMAL_STEPS.length - 1]);
    // Κλασματική είσοδος από πληκτρολόγηση: στρογγυλοποιείται, δεν πέφτει στο `0`.
    expect(clampTableFormatDecimals(2.6)).toBe(3);
  });
});

describe('§60 — η ΕΞΑΓΩΓΗ δεν άλλαξε συμπεριφορά (ADR-750/739 §55)', () => {
  it('🔑 η σύγκριση μορφών εξακολουθεί να κανονικοποιεί τα «απόντα»', () => {
    // Ο λόγος που τα `hasGrouping`/`decimalsOf` μετακόμισαν αντί να αντιγραφούν: **αυτός** ο
    // κριτής και το κουμπί των χιλιάδων πρέπει να απαντούν το ίδιο, πάντα.
    const a: TableCellFormat = { kind: 'currency', decimals: 2 };
    const b: TableCellFormat = { kind: 'currency', decimals: 2, currency: 'EUR', grouping: true };
    expect(isTableCellFormatEqual(a, b)).toBe(true);
  });
});
