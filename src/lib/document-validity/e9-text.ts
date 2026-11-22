/**
 * =============================================================================
 * Αναγνώστης Ε9 — «Βεβαίωση Δηλωθείσας Περιουσιακής Κατάστασης», Πίνακας 1 (ADR-949 Α-2 · οικογένεια ADR-915)
 * =============================================================================
 *
 * Γράφτηκε **πάνω σε πραγματικά δείγματα** (2 Ε9 · 2021 και 2026, ανωνυμοποιημένα, ADR-949 §2.1α), όπως ο ΠΕΑ
 * (`pea-text.ts`) και οι βεβαιώσεις (`clearance-text.ts`). Οι κωδικοί από τις οδηγίες της ΑΑΔΕ (ΠΟΛ.1237/11.11.2014,
 * Πίνακας 1: στήλη 9 «Κατηγορία ακινήτου», 10 «Ειδικών συνθηκών», 11 «Όροφος», 12-13 «Επιφάνεια κύριων/βοηθητικών
 * χώρων»).
 *
 * 🔑 **Πίνακας ⇒ ανάγνωση ΜΕ ΘΕΣΗ**: στο απλό κείμενο οι στήλες ανακατεύονται (μετρημένο). Οι στήλες βρίσκονται από τη
 *    **θέση των επικεφαλίδων** κάθε σελίδας, ποτέ από σταθερές συντεταγμένες· κάθε τιμή πάει στην πλησιέστερη
 *    επικεφαλίδα **μόνο** αν απέχει λίγο ({@link MAX_COLUMN_OFFSET}) — αλλιώς μένει αδιάβαστη, ποτέ «περίπου».
 *    Στα δείγματα οι τιμές είναι κεντραρισμένες κάτω από την επικεφαλίδα (απόκλιση ≤ 2,5) και η γειτονική στήλη
 *    απέχει ≥ 5,5.
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

import { parseStrictDecimal } from '@/lib/number/locale-number';
import { centerXOf, linesOf, type PdfPositionedPage, type PdfTextItem, type PdfTextLine } from '@/lib/pdf/pdf-page-text';

/** Οι σελίδες που χρειάζεται: όλος ο Πίνακας 1 (το δείγμα των 8 σελίδων είχε 6), με όριο ασφαλείας. */
export const E9_MAX_PAGES = 40;

/** Όροφος Ε9 (στήλη 11): `Υ` = υπόγειο · `0` = ισόγειο ή ημιυπόγειο · `1` = 1ος ή ημιόροφος · … */
export type E9Floor = { readonly kind: 'basement' } | { readonly kind: 'level'; readonly number: number };

/** Κωδικός «Ειδικών συνθηκών» (στήλη 10) για ημιτελές κτίσμα. */
export const E9_UNFINISHED_CONDITION = 99;

/** Μια γραμμή κτίσματος του Πίνακα 1. `null` = το κελί είναι κενό ή δεν διαβάστηκε με βεβαιότητα. */
export interface E9BuildingRow {
  /** Η σελίδα του εγγράφου (1-based) — για το «Ε9, σελ. 2». */
  readonly page: number;
  /** Στήλη 9 — 1 κατοικία/διαμέρισμα · 2 μονοκατοικία · 3 επαγγελματική στέγη · 5 αποθήκη · 6 στάθμευση · 7-13 άλλα. */
  readonly category: number;
  readonly specialCondition: number | null;
  readonly floor: E9Floor | null;
  /** Στήλη 12 — τ.μ. κύριων χώρων. */
  readonly mainArea: number | null;
  /** Στήλη 13 — τ.μ. βοηθητικών χώρων που ανήκουν στο κτίσμα. */
  readonly auxArea: number | null;
  readonly constructionYear: number | null;
  /** Στήλη 15 — είδος εμπράγματου δικαιώματος: 1 πλήρης κυριότητα · 2 ψιλή · 3 επικαρπία · 4 επιφανείας · … 13. */
  readonly rightKind: number | null;
  /** Στήλη 16 — ποσοστό συνιδιοκτησίας %, γραμμένο με πέντε δεκαδικά (μπορεί να σπάει σε περισσότερες γραμμές). */
  readonly ownershipPct: number | null;
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
type ColumnCenters = Readonly<Partial<Record<Column, number>>>;

/** Μέγιστη απόσταση τιμής από την επικεφαλίδα της (μονάδες σελίδας) — βλ. 🔑 πάνω. */
const MAX_COLUMN_OFFSET = 4;
/** Μισό ύψος εγγραφής: η διεύθυνση απλώνεται έως ±8 γύρω από τη γραμμή των αριθμών (μετρημένο). */
const RECORD_HALF_HEIGHT = 12;

/** Κωδικοί οικοπέδων (στήλη 9): δεν είναι κτίσματα — ο υπολογιστής κτισμάτων δεν τους αφορά. */
const PLOT_CATEGORIES: ReadonlySet<number> = new Set([4, 41, 42, 43, 44, 45, 46, 47]);
const BUILDING_CATEGORIES: ReadonlySet<number> = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 51, 52]);

const IS_E9 = /Ε9[\s\S]*ΠΕΡΙΟΥΣΙΑΚΗΣ\s+ΚΑΤΑΣΤΑΣΗΣ/;
const TABLE_1 = /ΠΙΝΑΚΑΣ\s+1\b/;
const INTEGER = /^\d{1,4}$/;

function textOf(page: PdfPositionedPage): string {
  return page.items.map((item) => item.s).join(' ');
}

/**
 * Το κέντρο κάθε στήλης στη σελίδα: η **αριστερότερη** εμφάνιση της επικεφαλίδας. «Είδος δικαιώματος» και «Ποσοστό»
 * γράφονται δύο φορές (κτίσμα · οικόπεδο), και η σειρά τους στη ροή του pdf.js **δεν** είναι σταθερή (μετρημένο).
 */
function columnCentersOf(page: PdfPositionedPage): ColumnCenters {
  const centers: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(COLUMN_LABELS) as Column[]) {
    const xs = page.items.filter((item) => item.s.startsWith(COLUMN_LABELS[column])).map((item) => item.x);
    if (xs.length > 0) centers[column] = Math.min(...xs);
  }
  return centers;
}

/** Σε ποια στήλη ανήκει το κομμάτι — ή σε καμία, αν δεν είναι κοντά σε επικεφαλίδα. */
function columnOf(item: PdfTextItem, centers: ColumnCenters): Column | null {
  let best: { readonly column: Column; readonly distance: number } | null = null;
  for (const [column, x] of Object.entries(centers) as [Column, number][]) {
    const distance = Math.abs(centerXOf(item) - x);
    if (best === null || distance < best.distance) best = { column, distance };
  }
  return best !== null && best.distance <= MAX_COLUMN_OFFSET ? best.column : null;
}

function cellOf(line: PdfTextLine, column: Column, centers: ColumnCenters): string | null {
  const item = line.items.find((candidate) => columnOf(candidate, centers) === column);
  return item === undefined ? null : item.s.trim();
}

function integerOf(cell: string | null): number | null {
  return cell !== null && INTEGER.test(cell) ? Number(cell) : null;
}

/**
 * `93,51` → 93.51 · `4.522,00` → 4522 — με την ΜΙΑ γραμματική αριθμού εγγράφου (`parseStrictDecimal`): ό,τι δεν είναι
 * εξ ολοκλήρου αριθμός (`100,` · `Ο.Τ.2`) ⇒ `null`. Επιφάνεια δεν είναι ποτέ αρνητική.
 */
export function parseGreekNumber(cell: string | null): number | null {
  const value = parseStrictDecimal(cell);
  return value === null || value < 0 ? null : value;
}

/** Στήλη 16: ποσοστό στο (0, 100] — ό,τι άλλο ⇒ αδιάβαστο. */
function percentOf(cell: string | null): number | null {
  const value = parseGreekNumber(cell);
  return value !== null && value > 0 && value <= 100 ? value : null;
}

/** Στήλη 11: `Υ` ⇒ υπόγειο · ακέραιος ⇒ όροφος · ό,τι άλλο ⇒ αδιάβαστο. */
export function parseE9Floor(cell: string | null): E9Floor | null {
  if (cell === 'Υ') return { kind: 'basement' };
  const number = integerOf(cell);
  return number === null ? null : { kind: 'level', number };
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
  readonly centers: ColumnCenters;
  readonly halfHeight: number;
}

/**
 * Κελί που **σπάει σε γραμμές** μέσα στην εγγραφή: ό,τι ανήκει στη στήλη, από πάνω προς τα κάτω, ενωμένο χωρίς κενό.
 * Μετρημένο: το ποσοστό `100,00000` φτάνει ως `100,` + `0000` + `0` στο ένα δείγμα και ως ένα κομμάτι στο άλλο.
 */
function wrappedCellOf(anchorY: number, column: Column, context: RowContext): string | null {
  const parts = context.page.items
    .filter((item) => Math.abs(item.y - anchorY) <= context.halfHeight && columnOf(item, context.centers) === column)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => item.s.trim());
  return parts.length === 0 ? null : parts.join('');
}

function rowOf(line: PdfTextLine, category: number, context: RowContext): E9BuildingRow {
  const cell = (column: Column) => cellOf(line, column, context.centers);
  return {
    page: context.page.page,
    category,
    specialCondition: integerOf(cell('specialCondition')),
    floor: parseE9Floor(cell('floor')),
    mainArea: parseGreekNumber(cell('mainArea')),
    auxArea: parseGreekNumber(cell('auxArea')),
    constructionYear: integerOf(cell('constructionYear')),
    rightKind: integerOf(cell('rightKind')),
    ownershipPct: percentOf(wrappedCellOf(line.y, 'ownershipPct', context)),
    address: addressOf(context.page, line.y, context.halfHeight),
  };
}

/** Το μισό ύψος εγγραφής γύρω από κάθε γραμμή-άγκυρα: ποτέ ως τη μέση της επόμενης εγγραφής. */
function halfHeightOf(anchors: readonly PdfTextLine[]): number {
  const gaps = anchors.slice(1).map((line, i) => line.y - anchors[i].y);
  return Math.min(RECORD_HALF_HEIGHT, ...gaps.map((gap) => gap / 2 - 1));
}

/** Οι γραμμές κτισμάτων μιας σελίδας του Πίνακα 1 — γραμμή-άγκυρα = όποια έχει κωδικό στη στήλη 9. */
function rowsOfPage(page: PdfPositionedPage): readonly E9BuildingRow[] {
  const centers = columnCentersOf(page);
  if (centers.category === undefined) return [];
  const anchors = linesOf(page).filter((line) => integerOf(cellOf(line, 'category', centers)) !== null);
  const context: RowContext = { page, centers, halfHeight: halfHeightOf(anchors) };
  return anchors.flatMap((line) => {
    const category = integerOf(cellOf(line, 'category', centers));
    if (category === null || PLOT_CATEGORIES.has(category) || !BUILDING_CATEGORIES.has(category)) return [];
    return [rowOf(line, category, context)];
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
