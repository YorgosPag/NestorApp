/**
 * =============================================================================
 * Αναγνώστης Ε9 — «Βεβαίωση Δηλωθείσας Περιουσιακής Κατάστασης», Πίνακας 1 (ADR-949 Α-2 · οικογένεια ADR-915)
 * =============================================================================
 *
 * Γράφτηκε **πάνω σε πραγματικά δείγματα** (2 Ε9 · 2021 και 2026, ανωνυμοποιημένα, ADR-949 §2.1α), όπως ο ΠΕΑ
 * (`pea-text.ts`) και οι βεβαιώσεις (`clearance-text.ts`). Οι κωδικοί από τις οδηγίες της ΑΑΔΕ (ΠΟΛ.1237/11.11.2014,
 * Πίνακας 1: στήλη 9 «Κατηγορία ακινήτου», 10 «Ειδικών συνθηκών», 11 «Όροφος», 12-13 «Επιφάνεια κύριων/βοηθητικών
 * χώρων») — κοινοί με την πράξη ΕΝΦΙΑ στο `e9-codes.ts`.
 *
 * 🔑 **Πίνακας ⇒ ανάγνωση ΜΕ ΘΕΣΗ** (ο κινητήρας: `lib/pdf/pdf-positioned-table.ts`): στο απλό κείμενο οι στήλες
 *    ανακατεύονται (μετρημένο). Οι στήλες βρίσκονται από τη **θέση των επικεφαλίδων** κάθε σελίδας, ποτέ από σταθερές
 *    συντεταγμένες· κάθε τιμή πάει στην πλησιέστερη επικεφαλίδα **μόνο** αν απέχει λίγο ({@link MAX_COLUMN_OFFSET}) —
 *    αλλιώς μένει αδιάβαστη, ποτέ «περίπου». Στα δείγματα οι τιμές είναι κεντραρισμένες κάτω από την επικεφαλίδα
 *    (απόκλιση ≤ 2,5) και η γειτονική στήλη απέχει ≥ 5,5.
 * 🔑 **Γραμμές, όχι ένα ακίνητο** (ADR-949 Α5): το Ε9 έχει όλη την περιουσία· ο άνθρωπος διαλέγει ποια γραμμή είναι
 *    το ακίνητο που υπολογίζει. Οικόπεδα (κατηγορία 4 · 41-47) και ο Πίνακας 2 (γήπεδα) **δεν** επιστρέφονται.
 * 🔒 **Ελαχιστοποίηση από κατασκευής**: ο αναγνώστης **δεν έχει πεδίο** για ΑΦΜ, ονόματα, ΚΑΕΚ, ΑΤΑΚ ή αριθμό παροχής.
 *    Η διεύθυνση διαβάζεται μόνο για να ξεχωρίσει ο άνθρωπος τις γραμμές.
 * ⚠️ **Μεζονέτα**: το Ε9 γράφει **μία** γραμμή με τον **υψηλότερο** όροφο και τη συνολική επιφάνεια (ΠΟΛ.1237 ΙΙ) —
 *    ο αναγνώστης το λέει όπως είναι· την επιφύλαξη την κάνει η πρόταση (`objective-value-document-reading.ts`).
 * ⚠️ Το «έτος κατασκευής» διαβάζεται **μόνο** για την επιλογή γραμμής — **δεν** είναι η ημερομηνία άδειας (ADR-949 §2.1α).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/e9-text
 */

import { centerXOf, linesOf, type PdfPositionedPage, type PdfTextLine } from '@/lib/pdf/pdf-page-text';
import {
  cellOf,
  columnAnchorsOf,
  hasColumn,
  nearestColumnLocator,
  recordHalfHeightOf,
  wrappedCellOf,
  type PdfColumnLocator,
  type PdfTableRecord,
} from '@/lib/pdf/pdf-positioned-table';

import { e9BuildingFactsOf, isE9BuildingCategory, parseE9Integer, type E9BuildingFacts } from './e9-codes';

/** Οι σελίδες που χρειάζεται: όλος ο Πίνακας 1 (το δείγμα των 8 σελίδων είχε 6), με όριο ασφαλείας. */
export const E9_MAX_PAGES = 40;

/** Μια γραμμή κτίσματος του Πίνακα 1: τα γεγονότα (`e9-codes.ts`) + σελίδα, κατηγορία, διεύθυνση. */
export interface E9BuildingRow extends E9BuildingFacts {
  /** Η σελίδα του εγγράφου (1-based) — για το «Ε9, σελ. 2». */
  readonly page: number;
  /** Στήλη 9 — 1 κατοικία/διαμέρισμα · 2 μονοκατοικία · 3 επαγγελματική στέγη · 5 αποθήκη · 6 στάθμευση · 7-13 άλλα. */
  readonly category: number;
  readonly address: string | null;
}

type E9TextResult =
  | { readonly kind: 'read'; readonly rows: readonly E9BuildingRow[] }
  | { readonly kind: 'not-recognized' };

/** Οι επικεφαλίδες που ορίζουν στήλες — και όσες **φυλάνε** τις γειτονικές, ώστε καμία τιμή να μη «δανείζεται» στήλη. */
const COLUMN_LABELS = {
  category: 'ΚΑΤΗΓΟΡΙΑ ΑΚΙΝΗΤΟΥ',
  specialCondition: 'ΕΙΔΙΚΩΝ ΣΥΝΘΗΚΩΝ',
  floor: 'ΟΡΟΦΟΣ',
  mainArea: 'ΚΥΡΙΟΙ',
  auxArea: 'ΒΟΗΘΗΤΙΚΟΙ',
  constructionYear: 'ΕΤΟΣ ΚΑΤΑΣΚΕΥΗΣ',
  rightKind: 'ΕΙΔΟΣ ΔΙΚΑΙΩΜΑΤΟΣ',
  ownershipPct: 'ΠΟΣΟΣΤΟ',
  apaa: 'ΕΝΔΕΙΞΗ ΑΠΑΑ',
  frontageLength: 'ΜΗΚΟΣ ΠΡΟΣΟΨΗΣ',
  frontageCount: 'ΠΛΗΘΟΣ ΠΡΟΣΟΨΕΩΝ',
  usufructYear: 'ΕΤΟΣ ΓΕΝ',
} as const;
type Column = keyof typeof COLUMN_LABELS;

/** Η επικεφαλίδα **αρχίζει** με την ετικέτα· η άγκυρα είναι η αριστερή της άκρη (εκεί κεντράρονται οι τιμές, μετρημένο). */
const COLUMN_MATCHERS = (Object.keys(COLUMN_LABELS) as Column[]).map(
  (column) => [column, (text: string) => text.startsWith(COLUMN_LABELS[column])] as const,
);

/** Μέγιστη απόσταση τιμής από την επικεφαλίδα της (μονάδες σελίδας) — βλ. 🔑 πάνω. */
const MAX_COLUMN_OFFSET = 4;
/** Μισό ύψος εγγραφής: η διεύθυνση απλώνεται έως ±8 γύρω από τη γραμμή των αριθμών (μετρημένο). */
const RECORD_HALF_HEIGHT = 12;

const IS_E9 = /Ε9[\s\S]*ΠΕΡΙΟΥΣΙΑΚΗΣ\s+ΚΑΤΑΣΤΑΣΗΣ/;
const TABLE_1 = /ΠΙΝΑΚΑΣ\s+1\b/;

function textOf(page: PdfPositionedPage): string {
  return page.items.map((item) => item.s).join(' ');
}

/** Η διεύθυνση της εγγραφής: ό,τι βρίσκεται στη στήλη «ΟΔΟΣ - ΑΡΙΘΜΟΣ», μέσα στο ύψος της εγγραφής. */
function addressOf(page: PdfPositionedPage, anchorY: number, halfHeight: number): string | null {
  // Τέσσερα «ΟΔΟΣ» στην επικεφαλίδα: η διεύθυνση και οι τρεις πρόσοψεις — η διεύθυνση είναι η αριστερότερη.
  const street = page.items.filter((item) => item.s === 'ΟΔΟΣ').sort((a, b) => a.x - b.x)[0];
  const municipal = page.items.find((item) => item.s.startsWith('ΔΗΜΟΤΙΚΟ'));
  const postal = page.items.find((item) => item.s.startsWith('Τ.Κ.'));
  if (street === undefined || municipal === undefined || postal === undefined) return null;
  const from = (municipal.x + street.x) / 2;
  const parts = page.items
    .filter((item) => Math.abs(item.y - anchorY) <= halfHeight && centerXOf(item) > from && centerXOf(item) < postal.x)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => item.s.trim());
  return parts.length === 0 ? null : parts.join(' ');
}

interface RowContext {
  readonly page: PdfPositionedPage;
  readonly locate: PdfColumnLocator<Column>;
  readonly halfHeight: number;
}

function rowOf(line: PdfTextLine, category: number, context: RowContext): E9BuildingRow {
  const { page, locate, halfHeight } = context;
  const cell = (column: Column) => cellOf(line, column, locate);
  const record: PdfTableRecord<Column> = { items: page.items, anchorY: line.y, halfHeight, locate };
  // Το ποσοστό σπάει σε γραμμές μέσα στην εγγραφή· τα υπόλοιπα κελιά είναι στη γραμμή-άγκυρα.
  const facts = e9BuildingFactsOf((fact) => (fact === 'ownershipPct' ? wrappedCellOf(record, fact, '') : cell(fact)));
  return { page: page.page, category, ...facts, address: addressOf(page, line.y, halfHeight) };
}

/** Οι γραμμές κτισμάτων μιας σελίδας του Πίνακα 1 — γραμμή-άγκυρα = όποια έχει κωδικό στη στήλη 9. */
function rowsOfPage(page: PdfPositionedPage): readonly E9BuildingRow[] {
  const anchors = columnAnchorsOf(page.items, COLUMN_MATCHERS, (item) => item.x);
  if (!hasColumn(anchors, 'category')) return [];
  const locate = nearestColumnLocator(anchors, MAX_COLUMN_OFFSET);
  const categoryOf = (line: PdfTextLine) => parseE9Integer(cellOf(line, 'category', locate));
  const anchorLines = linesOf(page).filter((line) => categoryOf(line) !== null);
  const context: RowContext = { page, locate, halfHeight: recordHalfHeightOf(anchorLines, RECORD_HALF_HEIGHT) };
  return anchorLines.flatMap((line) => {
    const category = categoryOf(line);
    return category === null || !isE9BuildingCategory(category) ? [] : [rowOf(line, category, context)];
  });
}

/**
 * **Διάβασε το Ε9.** `not-recognized` όταν το έγγραφο δεν είναι Ε9 ή δεν έχει Πίνακα 1. Ε9 χωρίς κτίσματα ⇒ `read`
 * με κενές γραμμές (η οθόνη το λέει, δεν το κρύβει).
 */
export function readE9Text(pages: readonly PdfPositionedPage[]): E9TextResult {
  if (!IS_E9.test(pages.map(textOf).join(' '))) return { kind: 'not-recognized' };
  const tablePages = pages.filter((page) => TABLE_1.test(textOf(page)));
  if (tablePages.length === 0) return { kind: 'not-recognized' };
  return { kind: 'read', rows: tablePages.flatMap(rowsOfPage) };
}
