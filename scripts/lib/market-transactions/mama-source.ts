/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΩΝ ΣΤΗΛΩΝ ΤΟΥ ΜΑΜΑ** — κεφαλίδα, και μία γραμμή σε τυποποιημένη εγγραφή (ADR-889 §3, §5.2 βήμα 3).
 * @related ADR-889 · `mama-vocabulary.ts` (οι τιμές κειμένου) · `scripts/build-market-transactions.ts` (ο καλών)
 *
 * 🔑 **ΚΑΘΑΡΟ.** Δέχεται τα κελιά όπως τα δίνει το exceljs και δεν ξέρει τίποτα για αρχεία. Έτσι το test
 * ελέγχει το συμβόλαιο χωρίς να κατεβάσει 30 MB.
 *
 * 🔴 **Η ΚΕΦΑΛΙΔΑ ΕΛΕΓΧΕΤΑΙ ΚΑΤΑ ΘΕΣΗ ΚΑΙ ΚΑΤΑ ΟΝΟΜΑ.** Αν η πηγή προσθέσει ή μετακινήσει στήλη, το
 * «τίμημα» θα διαβαζόταν από τη στήλη του «έτους» χωρίς κανένα σφάλμα, και κάθε αριθμός θα ήταν λάθος.
 * Η μετρημένη κεφαλίδα είναι **ταυτόσημη** σε όλα τα έτη 2017–2026.
 */

import {
  MAMA_APAA,
  MAMA_CATEGORIES,
  MAMA_RIGHTS,
  MAMA_SPECIAL_CONDITIONS,
  type MamaApaa,
  type MamaRight,
  type MamaSpecialCondition,
} from './mama-vocabulary';

/**
 * Οι 20 στήλες, **ακριβώς** όπως στο αρχείο.
 * ⚠️ `Tιμή Ζώνης` και `Eπιφάνεια Κύριων Χώρων` αρχίζουν με **λατινικό** `T`/`E` (μετρημένο 2026-09-26).
 */
export const MAMA_HEADER = [
  'Νομαρχία',
  'Δήμος Καλλικράτη',
  'Δημοτικό ή Κοινοτικό Διαμέρισμα',
  'Ένδειξη ΑΠΑΑ',
  'Κατηγορία Ακινήτου',
  'Πλήθος Προσόψεων',
  'Tιμή Ζώνης',
  'Eπιφάνεια Κύριων Χώρων (σε τ.μ.)',
  'Επιφάνεια Βοηθητικών Χώρων (σε τ.μ.)',
  'Έτος Κατασκευής',
  'Είδος Εμπράγματου δικαιώματος Κτίσματος',
  'Ποσοστό Συνιδιοκτησίας Κτίσματος',
  'Ειδικές Συνθήκες Ακινήτου',
  'Όροφος',
  'Επιφάνεια Οικοπέδου (σε τ.μ.)',
  'Είδος Εμπράγματου δικαιώματος Οικοπέδου',
  'Ποσοστό Συνιδιοκτησίας Οικοπέδου',
  'Συνολική Επιφάνεια Κτισμάτων στο οικόπεδο',
  'Ημερομηνία Συμβολαίου',
  'Τίμημα Δικαιώματος',
] as const;

/** Μία μεταβίβαση, τυποποιημένη. Κενό κελί της πηγής = `null`, ποτέ `0` (το μηδέν θα ήταν ψεύτικη τιμή). */
export interface MamaRecord {
  readonly prefecture: string;
  /** Ο προ-2011 δήμος, δηλαδή **Δημοτική Ενότητα** παρά το όνομα της στήλης (§3). */
  readonly municipality: string;
  /** Υποδιαίρεση του συστήματος αντικειμενικών αξιών — ετικέτα, **όχι** κοινότητα του Καλλικράτη. */
  readonly district: string;
  readonly apaa: MamaApaa;
  readonly category: string;
  readonly frontages: number | null;
  readonly zonePrice: number | null;
  readonly mainArea: number | null;
  readonly auxArea: number | null;
  readonly yearBuilt: number | null;
  readonly buildingRight: MamaRight | null;
  readonly buildingShare: number | null;
  readonly special: MamaSpecialCondition | null;
  readonly floor: string | null;
  readonly plotArea: number | null;
  readonly plotRight: MamaRight | null;
  readonly plotShare: number | null;
  /** Ημερομηνία συμβολαίου, `YYYY-MM-DD`. */
  readonly contractDate: string;
  readonly price: number;
}

/** Αποτυχία ανάγνωσης: πάντα με τη στήλη και την τιμή, για να τη βρει άνθρωπος στο αρχείο. */
export class MamaFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MamaFormatError';
  }
}

/** Η κεφαλίδα είναι ακριβώς η αναμενόμενη; Αλλιώς πετά με την πρώτη διαφορά. */
export function assertMamaHeader(cells: readonly unknown[]): void {
  if (cells.length !== MAMA_HEADER.length) {
    throw new MamaFormatError(`κεφαλίδα: ${cells.length} στήλες, αναμένονταν ${MAMA_HEADER.length}`);
  }
  MAMA_HEADER.forEach((expected, i) => {
    if (cells[i] !== expected) {
      throw new MamaFormatError(`κεφαλίδα στήλη ${i}: ${JSON.stringify(cells[i])} ≠ ${JSON.stringify(expected)}`);
    }
  });
}

function isBlank(cell: unknown): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
}

function requiredText(cell: unknown, column: number): string {
  if (typeof cell !== 'string' || cell.trim() === '') {
    throw new MamaFormatError(`στήλη «${MAMA_HEADER[column]}»: αναμενόταν κείμενο, βρέθηκε ${JSON.stringify(cell)}`);
  }
  return cell.trim();
}

function optionalNumber(cell: unknown, column: number): number | null {
  if (isBlank(cell)) return null;
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  throw new MamaFormatError(`στήλη «${MAMA_HEADER[column]}»: αναμενόταν αριθμός, βρέθηκε ${JSON.stringify(cell)}`);
}

/** Τιμή από κλειστό σύνολο, ή `null` για κενό κελί. Άγνωστη τιμή = σφάλμα, ποτέ σιωπηλή απόρριψη. */
function closedValue<T extends string>(cell: unknown, column: number, allowed: readonly T[]): T | null {
  if (isBlank(cell)) return null;
  const match = allowed.find((value) => value === cell);
  if (match === undefined) {
    throw new MamaFormatError(`στήλη «${MAMA_HEADER[column]}»: άγνωστη τιμή ${JSON.stringify(cell)}`);
  }
  return match;
}

function contractDate(cell: unknown): string {
  if (!(cell instanceof Date) || Number.isNaN(cell.getTime())) {
    throw new MamaFormatError(`στήλη «${MAMA_HEADER[18]}»: αναμενόταν ημερομηνία, βρέθηκε ${JSON.stringify(cell)}`);
  }
  // Το exceljs δίνει μεσάνυχτα UTC για ημερομηνία χωρίς ώρα· το ISO σε UTC κρατά την ημέρα της πηγής.
  return cell.toISOString().slice(0, 10);
}

function category(cell: unknown): string {
  const value = requiredText(cell, 4);
  if (!(value in MAMA_CATEGORIES)) throw new MamaFormatError(`στήλη «${MAMA_HEADER[4]}»: άγνωστη κατηγορία ${JSON.stringify(value)}`);
  return value;
}

function price(cell: unknown): number {
  const value = optionalNumber(cell, 19);
  if (value === null) throw new MamaFormatError(`στήλη «${MAMA_HEADER[19]}»: κενό τίμημα`);
  return value;
}

/** Ο όροφος είναι **κείμενο** στην πηγή (`'0'`, `'2'`, `'Υ'`). Κρατιέται όπως είναι. */
function floor(cell: unknown): string | null {
  if (isBlank(cell)) return null;
  return String(cell).trim();
}

/**
 * **Μία γραμμή → εγγραφή.** `cells` = οι 20 τιμές με σειρά στήλης (δείκτης 0 = «Νομαρχία»).
 * Πετά {@link MamaFormatError} σε κάθε απόκλιση από το συμβόλαιο.
 */
export function parseMamaRow(cells: readonly unknown[]): MamaRecord {
  const apaa = closedValue(cells[3], 3, MAMA_APAA);
  if (apaa === null) throw new MamaFormatError(`στήλη «${MAMA_HEADER[3]}»: κενή ένδειξη ΑΠΑΑ`);

  return {
    prefecture: requiredText(cells[0], 0),
    municipality: requiredText(cells[1], 1),
    district: requiredText(cells[2], 2),
    apaa,
    category: category(cells[4]),
    frontages: optionalNumber(cells[5], 5),
    zonePrice: optionalNumber(cells[6], 6),
    mainArea: optionalNumber(cells[7], 7),
    auxArea: optionalNumber(cells[8], 8),
    yearBuilt: optionalNumber(cells[9], 9),
    buildingRight: closedValue(cells[10], 10, MAMA_RIGHTS),
    buildingShare: optionalNumber(cells[11], 11),
    special: closedValue(cells[12], 12, MAMA_SPECIAL_CONDITIONS),
    floor: floor(cells[13]),
    plotArea: optionalNumber(cells[14], 14),
    plotRight: closedValue(cells[15], 15, MAMA_RIGHTS),
    plotShare: optionalNumber(cells[16], 16),
    contractDate: contractDate(cells[18]),
    price: price(cells[19]),
  };
}
