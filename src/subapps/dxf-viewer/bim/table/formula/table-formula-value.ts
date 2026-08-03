/**
 * ADR-739 Φ.Ζ — **τι είναι μια τιμή τύπου**: το λεξιλόγιο του αξιολογητή, οι κωδικοί
 * σφάλματος ως SSoT, και οι τρεις μεταφράσεις (κελί → αριθμός, τιμή → κελί).
 *
 * ## 🔑 Το κελί μας κρατά **κείμενο** — γι' αυτό υπάρχει το {@link cellValueToNumber}
 * Ο `setPersistedCellText` γράφει ό,τι πληκτρολογήθηκε: το `10` αποθηκεύεται ως `'10'`, όχι
 * ως `10`. Χωρίς μετατροπή, το `=SUM(A1:A2)` πάνω σε πληκτρολογημένους αριθμούς θα έδινε
 * **μηδέν** — σιωπηλά, σε πίνακα ποσοτήτων.
 *
 * ## 🔴 Γιατί ο έλεγχος είναι ΑΥΣΤΗΡΟΣ ενώ ο `parseLocaleNumber` είναι επιεικής
 * Το `parseLocaleNumber` (ADR-576) **πετά** ό,τι δεν είναι ψηφίο πριν διαβάσει: `'€ 12,50'`
 * → `12.5`. Σωστό για **πεδίο εισαγωγής**, όπου ο χρήστης δηλώνει ήδη ότι γράφει αριθμό.
 * Καταστροφικό για **κελί πίνακα**: το `'Δοκός 12'` θα γινόταν `12` και θα έμπαινε σε
 * άθροισμα — δηλαδή μια στήλη περιγραφών θα συνεισέφερε νούμερα σε παραδοτέο.
 *
 * Η λύση δεν είναι δεύτερος αναλυτής αριθμών: η **σκληρή** δουλειά (ποιο από τα `.` `,`
 * είναι το δεκαδικό στο `'1.200,50'`) μένει ολόκληρη στο ADR-576. Προστίθεται **μόνο** μια
 * πύλη: αν το κελί δεν είναι **εξ ολοκλήρου** αριθμητικό, δεν είναι αριθμός. Ίδια αρχή με
 * τον λεξικογράφο — επαναχρησιμοποιούμε ακριβώς εκεί που η ερώτηση είναι η ίδια.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-value
 * @see lib/number/locale-number.ts — ADR-576, η μία ανάγνωση δεκαδικού
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';
import type { ScheduleCellValue } from '../../schedule/types';
import type { TableFormulaErrorCode } from '../../../types/table-formula';

/**
 * Οι κωδικοί σφάλματος ως **τιμές** — το SSoT που ονομάζει το ADR-739 §9.2.
 *
 * Ένα παγωμένο αντικείμενο και όχι σκόρπια κυριολεκτικά: ο αξιολογητής, οι συναρτήσεις και ο
 * επαναϋπολογισμός γράφουν όλοι τον ίδιο κωδικό, και ο μεταγλωττιστής το επιβάλλει.
 */
export const FORMULA_ERROR = {
  divideByZero: '#DIV/0!',
  value: '#VALUE!',
  reference: '#REF!',
  name: '#NAME?',
  number: '#NUM!',
  circular: '#CIRCULAR!',
} as const satisfies Readonly<Record<string, TableFormulaErrorCode>>;

/** Όλοι οι κωδικοί, για τον έλεγχο ταυτότητας. */
const ERROR_CODES: readonly string[] = Object.values(FORMULA_ERROR);

/**
 * Τι μπορεί να παράγει ένας τύπος. Το `boolean` υπάρχει επειδή οι συγκρίσεις πρέπει να
 * επιστρέφουν κάτι που η `IF` να μπορεί να ρωτήσει· γίνεται `'TRUE'`/`'FALSE'` **μόνο** όταν
 * φτάσει στο κελί, όπως στο Excel.
 */
export type TableFormulaValue = number | string | boolean;

/**
 * Ένα όρισμα συνάρτησης: μία τιμή ή **λίστα** (από εύρος `A1:B5`).
 *
 * Ο διαχωρισμός ζει στα ορίσματα και όχι στις τιμές γιατί ένα εύρος **δεν είναι τιμή**: το
 * `=A1:A5 + 1` δεν έχει νόημα, ενώ το `=SUM(A1:A5)` έχει. Με μία ενιαία «τιμή που μπορεί να
 * είναι λίστα» η πρώτη περίπτωση θα έπρεπε να ανιχνεύεται σε κάθε τελεστή χωριστά.
 */
export type TableFormulaArgument =
  | { readonly kind: 'value'; readonly value: TableFormulaValue }
  | { readonly kind: 'list'; readonly values: readonly TableFormulaValue[] };

/** True όταν η τιμή **είναι** κωδικός σφάλματος και όχι απλώς κείμενο που του μοιάζει. */
export function isFormulaError(value: TableFormulaValue): value is TableFormulaErrorCode {
  return typeof value === 'string' && ERROR_CODES.includes(value);
}

/**
 * Το **πρώτο** σφάλμα μέσα σε ορίσματα, ή `null`. Η διάδοση σφάλματος είναι κανόνας του
 * Excel: μια `SUM` που περιέχει `#DIV/0!` δίνει `#DIV/0!`, δεν το αγνοεί — αλλιώς ένα λάθος
 * θα εξαφανιζόταν μέσα σε ένα σύνολο.
 */
export function firstError(args: readonly TableFormulaArgument[]): TableFormulaErrorCode | null {
  for (const arg of args) {
    const values = arg.kind === 'value' ? [arg.value] : arg.values;
    for (const value of values) {
      if (isFormulaError(value)) return value;
    }
  }
  return null;
}

/** Ένα κελί (`string | number | null`) ως αριθμός, ή `null` όταν δεν είναι αριθμός. */
export function cellValueToNumber(value: ScheduleCellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null) return null;

  const text = value.trim();
  // Η πύλη αυστηρότητας — δες την κεφαλίδα. Μόνο ψηφία, χωριστές και προαιρετικό πρόσημο.
  if (text === '' || !/^-?[\d.,]+$/u.test(text)) return null;
  return parseLocaleNumber(text);
}

/**
 * Μια τιμή αξιολόγησης ως αριθμός, ή `null`.
 *
 * Το **κενό** γίνεται `0` (σύμβαση κάθε φύλλου υπολογισμού: κενό κελί σε άθροισμα είναι
 * μηδέν, όχι σφάλμα), το `TRUE`/`FALSE` γίνεται `1`/`0`, το σφάλμα **ποτέ** δεν γίνεται
 * αριθμός.
 */
export function valueToNumber(value: TableFormulaValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isFormulaError(value)) return null;
  return value.trim() === '' ? 0 : cellValueToNumber(value);
}

/**
 * Πόσα **σημαντικά** ψηφία κρατά ένα αποθηκευμένο αποτέλεσμα. Δεκαπέντε, όπως το Excel:
 * το `0.1+0.2` πρέπει να γράφει `0.3` και όχι `0.30000000000000004`. Δεν είναι καλλωπισμός —
 * ο δεύτερος αριθμός θα τυπωνόταν αυτούσιος σε **σχέδιο** (ADR-720: κατασκευασμένη ακρίβεια
 * είναι σφάλμα τιμής, όχι εμφάνισης).
 */
const SIGNIFICANT_DIGITS = 15;

/**
 * Το αποτέλεσμα όπως αποθηκεύεται στο κελί.
 *
 * Τα σφάλματα αποθηκεύονται **ως κείμενο** (`'#DIV/0!'`): έτσι τα γράφει το Excel, έτσι
 * ταξιδεύουν σε DXF και στο πρόχειρο, και έτσι ο ζωγράφος, ο μετρητής και η εξαγωγή δεν
 * μαθαίνουν ποτέ ότι υπάρχει έννοια «σφάλμα» — μηδέν ειδική περίπτωση σε τέσσερις καταναλωτές.
 */
export function toCellValue(value: TableFormulaValue): ScheduleCellValue {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return FORMULA_ERROR.number;
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}
