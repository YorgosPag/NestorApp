/**
 * ADR-769 — **ο πίνακας ΖΗΤΑΕΙ**: από επεξεργασία κελιού σε αίτημα προς τον ιδιοκτήτη.
 *
 * Καθαρή συνάρτηση: μηδέν store, μηδέν React, μηδέν εντολή. Απαντά **τι θα γινόταν**, ώστε η
 * ίδια απάντηση να δίνεται στον φρουρό, στην οθόνη (Δ7) και στο test — χωρίς σκηνή.
 *
 * ## 🔑 Γιατί «πλάνο» και όχι «εκτέλεση»
 * Το idiom **υπάρχει ήδη** στο repo: το `AssignTopoElevationCommand.fromPlan` δηλώνει ρητά ότι
 * *«το πλάνο υπολογίζεται στο UI ώστε ο χρήστης να δει τι θα γίνει **πριν** πατήσει — και
 * εκτελείται εδώ **αυτούσιο**, ώστε αυτό που εγκρίθηκε να είναι ακριβώς αυτό που γράφεται»*.
 * Είναι επίσης η βιομηχανική πρακτική: το Navisworks Quantification δεν γράφει ποτέ μόνο του —
 * *«you can then **accept or reject** the change»*. Ίδια αρχή με το Α4 του ADR-766.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΤΩΝ ΦΡΟΥΡΩΝ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ
 * ```
 *   1. δομή    — γράφεται ΠΟΤΕ αυτή η στήλη;        (Δ2 · πρότυπο Revit)
 *   2. άνθρωπος— είπε ρητά «μη»;                     (Δ5 · πρότυπο AutoCAD)
 *   3. δεσμός  — υπάρχει ιδιοκτήτης να ρωτηθεί;      (Δ1)
 *   4. πηγή    — ισχύει ακόμη η βάση σύγκρισης;      (Δ3 · compare-and-swap)
 *   5. τιμή    — είναι έγκυρη;                       (Δ4)
 *   6. αλλαγή  — άλλαξε πράγματι κάτι;               (ταυτοδυναμία, N.7.2 #3)
 * ```
 * Ο **δομικός** λόγος προηγείται του ανθρώπινου: «αυτή η στήλη δεν γράφεται ποτέ» είναι πιο
 * χρήσιμη πληροφορία από «το κλείδωσες», και δεν παύει να ισχύει αν ξεκλειδώσεις. Ο έλεγχος
 * της **πηγής** προηγείται της **τιμής** και της **αλλαγής**: πάνω σε μπαγιάτικη βάση, το
 * «τίποτα δεν άλλαξε» είναι σύμπτωση, όχι ησυχία.
 *
 * @module subapps/dxf-viewer/bim/table/write-back/table-write-back-plan
 * @see docs/centralized-systems/reference/adrs/ADR-769-table-live-write-back.md §4
 */

import type { ScheduleCellValue, ScheduleColumnValueType } from '../../schedule/types';
import { parseCellToStore } from '../../schedule/exporters/value-formatters';
import type { TableCell } from '../../../types/table';

// ─── Ο περιγραφέας στήλης (Δ2) ───────────────────────────────────────────────

/**
 * Ποιο πεδίο του ιδιοκτήτη αγγίζει μια γράψιμη στήλη.
 *
 * Γενικεύεται ανά παραγωγό (ADR-769 Δ9, πρότυπο ADR-767 Δ7: **μία** καταχώρηση υλοποιείται,
 * το **σχήμα** καλύπτει όλους από την πρώτη μέρα).
 */
export type TableWriteBackField = 'x' | 'y';

/**
 * Γιατί μια στήλη **δεν** γράφεται. Ρητός λόγος, ποτέ σιωπηλή απόρριψη — ο χρήστης πρέπει να
 * ξεχωρίζει «δεν γράφεται **ποτέ**» από «δεν γράφεται **ακόμη**».
 *
 * - `ordinal`  — αύξων αριθμός γραμμής. Revit: *«calculated values are not recognized as
 *   parameters, only as values»* ⇒ read-only, γκριζαρισμένα.
 * - `computed` — παράγεται από γεωμετρία ή άλλα πεδία (βάρος σκυροδέματος, οπλισμός).
 * - `identity` — η ταυτότητα της οντότητας· γράψιμη ταυτότητα δεν είναι ταυτότητα.
 * - `no-owner` — 🔑 **πραγματική παράμετρος, αλλά κανείς δεν την κατέχει ακόμη.** Χωρίς αυτόν
 *   τον κλάδο η μόνη εναλλακτική θα ήταν να τη δηλώσουμε ψευδώς `computed` (ψέμα που θα
 *   επιβίωνε) ή να τη σιωπήσουμε. Δες ADR-769 §8 #1.
 */
export type TableColumnUnwritableReason = 'ordinal' | 'computed' | 'identity' | 'no-owner';

export interface TableColumnUnwritable {
  readonly kind: 'unwritable';
  readonly reason: TableColumnUnwritableReason;
}

export interface TableColumnWritable {
  readonly kind: 'writable';
  readonly field: TableWriteBackField;
}

/** Η απόφαση γραψιμότητας **μιας** στήλης. Δηλώνεται δίπλα στον εμπρός χάρτη (Δ2). */
export type TableColumnWriteBack = TableColumnUnwritable | TableColumnWritable;

// ─── Το αίτημα ───────────────────────────────────────────────────────────────

/** Μία στήλη της **ίδιας γραμμής** με τη βάση σύγκρισής της — το «expected value» του CAS. */
export interface TableWriteBackBasis {
  readonly sourceKey: string;
  readonly sourceValue: ScheduleCellValue;
}

export interface TableWriteBackInput {
  /** Ο περιγραφέας της στήλης που γράφεται. */
  readonly column: TableColumnWriteBack;
  /** Το `sourceKey` της στήλης που γράφεται — για μηνύματα και για τον έλεγχο αλλαγής. */
  readonly sourceKey: string;
  /** Ο τύπος τιμής της στήλης — καθορίζει τη μετατροπή μονάδων. */
  readonly valueType: ScheduleColumnValueType;
  /** Το κελί που γράφεται: δίνει το `locked` (Δ5) και τον δεσμό του (Δ1). */
  readonly cell: TableCell | undefined;
  /** Ό,τι πληκτρολόγησε ο χρήστης, σε μονάδες **ΟΘΟΝΗΣ**. */
  readonly nextDisplayValue: ScheduleCellValue;
  /** Οι **υπόλοιπες** στήλες της γραμμής με τη βάση τους (Δ3). */
  readonly rowBasis: readonly TableWriteBackBasis[];
  /**
   * Τι λέει **η πηγή τώρα** για τη γραμμή-στόχο.
   *
   * 🔴 `undefined` ≠ κενό αντικείμενο: το πρώτο σημαίνει «**κανείς δεν ρώτησε** την πηγή» και
   * είναι δική του άρνηση. Ίδια διάκριση με το `TableSourceContext` του ADR-767 §11.2.
   */
  readonly liveRow: Readonly<Record<string, ScheduleCellValue>> | undefined;
}

// ─── Η απάντηση ──────────────────────────────────────────────────────────────

export type TableWriteBackRejection =
  | { readonly kind: 'column-unwritable'; readonly reason: TableColumnUnwritableReason }
  | { readonly kind: 'cell-locked' }
  | { readonly kind: 'not-bound' }
  | { readonly kind: 'source-unavailable' }
  | { readonly kind: 'source-moved'; readonly sourceKey: string }
  | { readonly kind: 'invalid-value' };

export type TableWriteBackPlan =
  | { readonly status: 'accepted'; readonly field: TableWriteBackField; readonly storeValue: number }
  | { readonly status: 'unchanged' }
  | { readonly status: 'rejected'; readonly reason: TableWriteBackRejection };

// ─── Οι φρουροί, ένας ανά ερώτηση ────────────────────────────────────────────

/** Δεμένο κελί = υπάρχει ιδιοκτήτης να ρωτηθεί. Άδετο κελί δεν έχει σε ποιον να απευθυνθεί. */
function isBound(cell: TableCell | undefined): boolean {
  return cell?.bound !== undefined;
}

/**
 * 🔴 Compare-and-swap: **ισχύει ακόμη η βάση πάνω στην οποία ο χρήστης αποφάσισε;**
 *
 * Ελέγχονται οι **υπόλοιπες** στήλες της γραμμής — αυτές που ο χρήστης **δεν** άλλαξε και
 * επομένως χρησιμοποίησε ως ένδειξη ταυτότητας («η γραμμή του ΣΤ3»). Η στήλη που γράφεται
 * εξαιρείται εξ ορισμού: εκεί η διαφορά είναι ο **σκοπός** της πράξης.
 *
 * @returns το `sourceKey` που **απέκλινε**, ή `null` όταν η βάση ισχύει.
 */
function findMovedKey(
  rowBasis: readonly TableWriteBackBasis[],
  liveRow: Readonly<Record<string, ScheduleCellValue>>,
): string | null {
  for (const basis of rowBasis) {
    if (liveRow[basis.sourceKey] !== basis.sourceValue) return basis.sourceKey;
  }
  return null;
}

/** Άρνηση με ρητό λόγο — ένα σημείο κατασκευής, ώστε καμία άρνηση να μη γεννηθεί ανώνυμη. */
function reject(reason: TableWriteBackRejection): TableWriteBackPlan {
  return { status: 'rejected', reason };
}

// ─── Ο σχεδιαστής ────────────────────────────────────────────────────────────

/**
 * Το αίτημα του πίνακα προς τον ιδιοκτήτη — **υπολογισμένο, όχι εκτελεσμένο**.
 *
 * Η συνάρτηση δεν αγγίζει τίποτα: ο καλών παίρνει το πλάνο και το μεταφράζει σε **υπάρχουσα**
 * εντολή (ADR-769 Δ1). Καμία νέα οικογένεια εντολών, κανένα δεύτερο μονοπάτι γραφής.
 */
export function planTableWriteBack(input: TableWriteBackInput): TableWriteBackPlan {
  const { column, cell, liveRow, rowBasis } = input;

  // 1. δομή — γράφεται ΠΟΤΕ αυτή η στήλη; (Δ2)
  if (column.kind === 'unwritable') {
    return reject({ kind: 'column-unwritable', reason: column.reason });
  }

  // 2. άνθρωπος — είπε ρητά «μη»; (Δ5)
  if (cell?.locked === true) return reject({ kind: 'cell-locked' });

  // 3. δεσμός — υπάρχει ιδιοκτήτης να ρωτηθεί; (Δ1)
  if (!isBound(cell)) return reject({ kind: 'not-bound' });

  // 4. πηγή — ισχύει ακόμη η βάση σύγκρισης; (Δ3)
  if (liveRow === undefined) return reject({ kind: 'source-unavailable' });
  const movedKey = findMovedKey(rowBasis, liveRow);
  if (movedKey !== null) return reject({ kind: 'source-moved', sourceKey: movedKey });

  // 5. τιμή — είναι έγκυρη; (Δ4 — κενό ⇒ άρνηση, ΠΟΤΕ 0)
  const storeValue = parseCellToStore(input.nextDisplayValue, input.valueType);
  if (storeValue === null) return reject({ kind: 'invalid-value' });

  // 6. αλλαγή — άλλαξε πράγματι κάτι; (ταυτοδυναμία)
  if (liveRow[input.sourceKey] === storeValue) return { status: 'unchanged' };

  return { status: 'accepted', field: column.field, storeValue };
}
