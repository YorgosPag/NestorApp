/**
 * 🔴 ADR-760 / ADR-739 §55 — **τι κάνει το πάτημα** στα πέντε κουμπιά αριθμού.
 *
 * Καθαρή μονάδα, μηδέν React: εδώ ελέγχεται η **απόφαση**, όχι το εικονίδιο. Τα δύο πράγματα
 * χωρίστηκαν επίτηδες (δες την κεφαλίδα του `table-number-format-ops.ts`), οπότε ένα test που
 * θα χρειαζόταν DOM για να ρωτήσει «τι γίνεται στα 8 δεκαδικά» θα ήταν απόδειξη ότι ο χωρισμός
 * απέτυχε.
 *
 * @see bim/table/table-number-format-ops.ts
 */

import {
  isTableCellFormatEqual,
  isTableNumberFormatActive,
  nextTableNumberFormat,
  stepTableNumberFormatDecimals,
} from '../table-number-format-ops';
import type { TableCellFormat } from '../../../types/table-cell-format';

const GENERAL: TableCellFormat = { kind: 'general' };

describe('πατημένο ή όχι', () => {
  it('ανάμεικτος στόχος (null) ⇒ ΚΑΝΕΝΑ κουμπί πατημένο — η ερώτηση δεν έχει μία απάντηση', () => {
    expect(isTableNumberFormatActive(null, 'accounting')).toBe(false);
    expect(isTableNumberFormatActive(null, 'percent')).toBe(false);
    expect(isTableNumberFormatActive(null, 'grouping')).toBe(false);
  });

  it('🔴 «απόν grouping» σημαίνει ΝΑΙ: ο δεκαδικός ομαδοποιεί χωρίς να το πει', () => {
    expect(isTableNumberFormatActive({ kind: 'decimal', decimals: 2 }, 'grouping')).toBe(true);
    expect(
      isTableNumberFormatActive({ kind: 'decimal', decimals: 2, grouping: false }, 'grouping'),
    ).toBe(false);
  });

  it('το ποσοστό ΔΕΝ έχει ομαδοποίηση — ούτε ως ψευδής θετική', () => {
    expect(isTableNumberFormatActive({ kind: 'percent', decimals: 0 }, 'grouping')).toBe(false);
  });
});

describe('η επόμενη μορφή', () => {
  it('πάτημα σε ελεύθερο «%» ⇒ ποσοστό με ΜΗΔΕΝ δεκαδικά (η σύμβαση του Excel)', () => {
    expect(nextTableNumberFormat(GENERAL, 'percent')).toEqual({ kind: 'percent', decimals: 0 });
  });

  it('🔴 πάτημα σε ΠΑΤΗΜΕΝΟ «%» ⇒ undefined = σβήσε το πεδίο (κληρονομιά), όχι «general»', () => {
    expect(nextTableNumberFormat({ kind: 'percent', decimals: 0 }, 'percent')).toBeUndefined();
  });

  it('🔴 το locale του ΣΧΕΔΙΟΥ επιβιώνει κάθε αλλαγή είδους', () => {
    const next = nextTableNumberFormat({ kind: 'general', locale: 'en-US' }, 'accounting');
    expect(next).toEqual({ kind: 'currency', decimals: 2, locale: 'en-US' });
  });

  it('οι χιλιάδες σε μορφή που ΔΕΝ τις υποστηρίζει ⇒ το «comma style» του Excel', () => {
    expect(nextTableNumberFormat({ kind: 'percent', decimals: 0 }, 'grouping'))
      .toEqual({ kind: 'decimal', decimals: 2, grouping: true });
  });

  it('ξεπάτημα χιλιάδων ⇒ ρητό false (σβήσιμο δεν θα άλλαζε τίποτα ορατό)', () => {
    expect(nextTableNumberFormat({ kind: 'decimal', decimals: 2 }, 'grouping'))
      .toEqual({ kind: 'decimal', decimals: 2, grouping: false });
  });
});

describe('τα δεκαδικά', () => {
  it('«general» ⇒ ένα πάτημα δίνει δεκαδικό — δεν μένει άπραγο', () => {
    expect(stepTableNumberFormatDecimals(GENERAL, 1)).toEqual({ kind: 'decimal', decimals: 1 });
  });

  it('🔴 στο άκρο (8) ⇒ null = ΚΑΜΙΑ εγγραφή, κανένα βήμα undo', () => {
    expect(stepTableNumberFormatDecimals({ kind: 'decimal', decimals: 8 }, 1)).toBeNull();
    expect(stepTableNumberFormatDecimals({ kind: 'decimal', decimals: 0 }, -1)).toBeNull();
  });

  it('το είδος ΔΕΝ αλλάζει όταν έχει ήδη ακρίβεια (νόμισμα μένει νόμισμα)', () => {
    expect(stepTableNumberFormatDecimals({ kind: 'currency', decimals: 2 }, 1))
      .toEqual({ kind: 'currency', decimals: 3 });
  });

  it('🔴 ο ακέραιος ΓΙΝΕΤΑΙ δεκαδικός και κρατά την ομαδοποίησή του', () => {
    expect(stepTableNumberFormatDecimals({ kind: 'whole', grouping: false }, 1))
      .toEqual({ kind: 'decimal', decimals: 1, grouping: false });
  });

  it('ακέραιος προς τα κάτω ⇒ null (είναι ήδη στο 0)', () => {
    expect(stepTableNumberFormatDecimals({ kind: 'whole' }, -1)).toBeNull();
  });

  it('ανάμεικτος στόχος ⇒ γράφει, δεν παραιτείται: ο χρήστης ζήτησε δεκαδικά', () => {
    expect(stepTableNumberFormatDecimals(null, 1)).toEqual({ kind: 'decimal', decimals: 1 });
  });
});

/**
 * 🔴 ADR-739 §55 — **η ισότητα μορφών**, ο κριτής του «ανάμεικτου» στόχου.
 *
 * Χωρίς αυτόν, η ανάγνωση της περιοχής (`resolveTableNumberFormatState`) θα σύγκρινε
 * **ταυτότητες αναφοράς** — και μια ολόκληρη στήλη ρητά ποσοστιαία θα διαβαζόταν ανάμεικτη,
 * γιατί κάθε κελί κρατά **δικό του** αντικείμενο μορφής.
 */
describe('ισότητα μορφών — δομική, με κανονικοποιημένες προεπιλογές', () => {
  it('🔴 ίδιο περιεχόμενο σε ΔΥΟ αντικείμενα ⇒ ίσα (η παγίδα του `===`)', () => {
    expect(isTableCellFormatEqual(
      { kind: 'percent', decimals: 0 },
      { kind: 'percent', decimals: 0 },
    )).toBe(true);
  });

  it('άλλο είδος ή άλλη ακρίβεια ⇒ άνισα', () => {
    expect(isTableCellFormatEqual({ kind: 'whole' }, GENERAL)).toBe(false);
    expect(isTableCellFormatEqual(
      { kind: 'decimal', decimals: 2 },
      { kind: 'decimal', decimals: 3 },
    )).toBe(false);
  });

  it('🔴 «απόν» και «η προεπιλογή» είναι Η ΙΔΙΑ μορφή — αλλιώς ψευδές «ανάμεικτο»', () => {
    // Ομαδοποίηση: απόν ⇒ ναι (ο ίδιος κριτής με το κουμπί των χιλιάδων).
    expect(isTableCellFormatEqual(
      { kind: 'decimal', decimals: 2 },
      { kind: 'decimal', decimals: 2, grouping: true },
    )).toBe(true);
    // Νόμισμα: απόν ⇒ EUR.
    expect(isTableCellFormatEqual(
      { kind: 'currency', decimals: 2 },
      { kind: 'currency', decimals: 2, currency: 'EUR' },
    )).toBe(true);
    // Ημερομηνία: απόν ⇒ short.
    expect(isTableCellFormatEqual({ kind: 'date' }, { kind: 'date', style: 'short' })).toBe(true);
  });

  it('ρητά διαφορετικό νόμισμα / στυλ / μονάδα γωνίας ⇒ άνισα', () => {
    expect(isTableCellFormatEqual(
      { kind: 'currency', decimals: 2, currency: 'USD' },
      { kind: 'currency', decimals: 2 },
    )).toBe(false);
    expect(isTableCellFormatEqual({ kind: 'date', style: 'iso' }, { kind: 'date' })).toBe(false);
    expect(isTableCellFormatEqual(
      { kind: 'angle', decimals: 2, unit: 'dms' },
      { kind: 'angle', decimals: 2 },
    )).toBe(false);
  });

  it('το `locale` του σχεδίου μετράει: δύο συμβάσεις αριθμών δεν είναι μία μορφή', () => {
    expect(isTableCellFormatEqual(
      { kind: 'decimal', decimals: 2, locale: 'el-GR' },
      { kind: 'decimal', decimals: 2, locale: 'en-US' },
    )).toBe(false);
  });
});
