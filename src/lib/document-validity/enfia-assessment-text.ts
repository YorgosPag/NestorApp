/**
 * =============================================================================
 * Αναγνώστης πράξης ΕΝΦΙΑ — «Πράξη Διοικητικού Προσδιορισμού Φόρου», ενότητα Δ (ADR-949 Α-3 · οικογένεια ADR-915)
 * =============================================================================
 *
 * Γράφτηκε **πάνω σε πραγματικά δείγματα** (πράξεις ΕΝΦΙΑ 2020 δύο υπόχρεων, 2 και 4 σελίδων, ανωνυμοποιημένα —
 * ADR-949 §2.1α). Η ενότητα «Δ. ΣΤΟΙΧΕΙΑ ΟΙΚΟΠΕΔΩΝ … ΚΑΙ ΚΤΙΣΜΑΤΩΝ - ΠΙΝΑΚΑΣ 1 ΕΝΤΥΠΟΥ Ε9» είναι **ανατύπωση** του Πίνακα 1
 * του Ε9 (ίδιοι κωδικοί, `e9-codes.ts`) συν την **τιμή ζώνης** (στήλη 23) με την οποία υπολογίστηκε ο φόρος.
 *
 * 🔑 **Στήλες από τους ΑΡΙΘΜΟΥΣ τους**, όχι από τις ετικέτες: οι ετικέτες είναι κάθετο κείμενο (η θέση τους απέχει
 *    15-20 μονάδες από τη στήλη, μετρημένο), ενώ η γραμμή «(1) (2) … (27)» είναι οριζόντια και **επαναλαμβάνεται σε
 *    κάθε σελίδα**. Οι αριθμοί είναι **δεξιά στοιχισμένοι** (έως 23 μονάδες από το κέντρο της στήλης) ⇒ κατανομή με
 *    ζώνες ανάμεσα στους γειτονικούς αριθμούς (`bandColumnLocator`), ποτέ «πλησιέστερη επικεφαλίδα».
 * 🔑 **Μόνο η ενότητα Δ**: από τη γραμμή των αριθμών κάτω από την επικεφαλίδα της, ως την επόμενη ενότητα («Ε.
 *    ΣΤΟΙΧΕΙΑ ΓΗΠΕΔΩΝ» · «ΣΤ. ΣΤΟΙΧΕΙΑ ΠΛΗΡΩΜΗΣ») ή το τέλος της σελίδας. Ο Πίνακας 2 (γήπεδα) δεν διαβάζεται.
 * 🔑 **Το έτος ΕΝΦΙΑ** («Αρχική Εκκαθάριση ΕΝ.Φ.Ι.Α. 2020») δίνει το **«ισχύει κατά»** της τιμής ζώνης: ο φόρος του
 *    έτους Ε υπολογίζεται με τα στοιχεία της 1/1/Ε. Η τιμή ζώνης **ΔΕΝ** προτείνεται ποτέ (αυθεντία είναι ο χάρτης)·
 *    διασταυρώνεται (`objective-value-document-reading.ts`).
 * ⚠️ **Σημείωμα πληρωμής ≠ πράξη**: το «Σημείωμα για Πληρωμή» ΕΝΦΙΑ (χωρίς στοιχεία ακινήτου) ⇒ `not-recognized`.
 * 🔒 **Ελαχιστοποίηση από κατασκευής**: κανένα πεδίο για ΑΦΜ, ονόματα, ΑΤΑΚ, αξία ή ποσά φόρου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/enfia-assessment-text
 */

import { centerXOf, linesOf, type PdfPositionedPage, type PdfTextLine } from '@/lib/pdf/pdf-page-text';
import {
  bandColumnLocator,
  cellOf,
  wrappedCellOf,
  recordHalfHeightOf,
  type PdfColumnAnchors,
  type PdfColumnLocator,
  type PdfTableRecord,
} from '@/lib/pdf/pdf-positioned-table';

import { e9BuildingFactsOf, isE9BuildingCategory, parseE9Integer, parseGreekNumber } from './e9-codes';
import type { E9BuildingRow } from './e9-text';

/** Οι σελίδες που χρειάζεται: όλη η ενότητα Δ (το δείγμα με 98 δικαιώματα είχε 4 σελίδες), με όριο ασφαλείας. */
export const ENFIA_ASSESSMENT_MAX_PAGES = 40;

/** Μια γραμμή κτίσματος της ενότητας Δ: η γραμμή του Ε9 + η τιμή ζώνης του υπολογισμού (€/τ.μ., `null` = αδιάβαστη). */
export interface EnfiaBuildingRow extends E9BuildingRow {
  readonly zonePrice: number | null;
}

type EnfiaAssessmentResult =
  | {
      readonly kind: 'read';
      /** Το έτος ΕΝΦΙΑ — `null` όταν δεν διαβάζεται (τότε η τιμή ζώνης δεν έχει «ισχύει κατά» και δεν διασταυρώνεται). */
      readonly year: number | null;
      readonly rows: readonly EnfiaBuildingRow[];
    }
  | { readonly kind: 'not-recognized' };

/** Οι στήλες της ενότητας Δ, με τον αριθμό που τυπώνει το έντυπο (μετρημένο στα δείγματα). */
const COLUMN_NUMBERS = {
  serial: 1,
  address: 3,
  category: 6,
  specialCondition: 7,
  floor: 8,
  mainArea: 9,
  auxArea: 10,
  constructionYear: 11,
  rightKind: 12,
  ownershipPct: 13,
  zonePrice: 23,
} as const;
type Column = keyof typeof COLUMN_NUMBERS;

/** Πόσοι αριθμοί στηλών πρέπει να βρεθούν για να εμπιστευτούμε τις ζώνες — όλοι (27): ζώνη χωρίς γείτονα κατάπινε στήλες. */
const COLUMN_COUNT = 27;
/** Μισό ύψος εγγραφής: η διεύθυνση σπάει σε 2 γραμμές, έως 6 μονάδες πάνω από τη γραμμή των αριθμών (μετρημένο). */
const RECORD_HALF_HEIGHT = 12;

const IS_ASSESSMENT = /ΠΡΑΞΗ\s+ΔΙΟΙΚΗΤΙΚΟΥ\s+ΠΡΟΣΔΙΟΡΙΣΜΟΥ\s+ΦΟΡΟΥ/;
const IS_ENFIA = /ΕΝ\.Φ\.Ι\.Α\./;
const YEAR = /Εκκαθάριση\s+ΕΝ\.Φ\.Ι\.Α\.\s+((?:19|20)\d{2})\b/;
const SECTION_D = /^Δ\.\s+ΣΤΟΙΧΕΙΑ\s+ΟΙΚΟΠΕΔΩΝ/;
const NEXT_SECTION = /^(?:Ε|ΣΤ)\.\s+ΣΤΟΙΧΕΙΑ/;
const COLUMN_MARKER = /^\((\d{1,2})\)$/;

function textOf(page: PdfPositionedPage): string {
  return page.items.map((item) => item.s).join(' ');
}

const lineStarts = (line: PdfTextLine, pattern: RegExp) => line.items.some((item) => pattern.test(item.s.trim()));

/** Οι αριθμοί στηλών μιας γραμμής: `(6)` → [6, κέντρο]. */
function markersOf(line: PdfTextLine): PdfColumnAnchors<number> {
  return line.items.flatMap((item) => {
    const match = COLUMN_MARKER.exec(item.s.trim());
    return match === null ? [] : [[Number(match[1]), centerXOf(item)] as const];
  });
}

interface SectionTable {
  /** Οι γραμμές **κάτω** από τους αριθμούς στηλών και **πάνω** από την επόμενη ενότητα. */
  readonly body: readonly PdfTextLine[];
  readonly locate: PdfColumnLocator<number>;
}

/** Ο πίνακας της ενότητας Δ στη σελίδα — `null` αν η σελίδα δεν τον έχει ή οι αριθμοί στηλών δεν είναι πλήρεις. */
function sectionTableOf(page: PdfPositionedPage): SectionTable | null {
  const lines = linesOf(page);
  const heading = lines.findIndex((line) => lineStarts(line, SECTION_D));
  if (heading < 0) return null;
  const markerIndex = lines.findIndex((line, i) => i > heading && markersOf(line).length > 0);
  if (markerIndex < 0) return null;
  const markers = markersOf(lines[markerIndex]);
  if (new Set(markers.map(([column]) => column)).size !== COLUMN_COUNT) return null;
  const after = lines.slice(markerIndex + 1);
  const end = after.findIndex((line) => lineStarts(line, NEXT_SECTION));
  return { body: end < 0 ? after : after.slice(0, end), locate: bandColumnLocator(markers) };
}

interface RowContext {
  readonly page: PdfPositionedPage;
  readonly locate: PdfColumnLocator<number>;
  readonly halfHeight: number;
}

function rowOf(line: PdfTextLine, category: number, { page, locate, halfHeight }: RowContext): EnfiaBuildingRow {
  const cell = (column: Column) => cellOf(line, COLUMN_NUMBERS[column], locate);
  const record: PdfTableRecord<number> = { items: page.items, anchorY: line.y, halfHeight, locate };
  const facts = e9BuildingFactsOf((fact) =>
    fact === 'ownershipPct' ? wrappedCellOf(record, COLUMN_NUMBERS.ownershipPct, '') : cell(fact),
  );
  const address = wrappedCellOf(record, COLUMN_NUMBERS.address, ' ');
  return { page: page.page, category, ...facts, address, zonePrice: positiveOf(parseGreekNumber(cell('zonePrice'))) };
}

function positiveOf(value: number | null): number | null {
  return value !== null && value > 0 ? value : null;
}

/** Οι γραμμές κτισμάτων μιας σελίδας — γραμμή-άγκυρα = όποια έχει αύξοντα αριθμό (στήλη 1). */
function rowsOfPage(page: PdfPositionedPage): readonly EnfiaBuildingRow[] {
  const table = sectionTableOf(page);
  if (table === null) return [];
  const { locate } = table;
  const anchorLines = table.body.filter((line) => parseE9Integer(cellOf(line, COLUMN_NUMBERS.serial, locate)) !== null);
  const context: RowContext = { page, locate, halfHeight: recordHalfHeightOf(anchorLines, RECORD_HALF_HEIGHT) };
  return anchorLines.flatMap((line) => {
    const category = parseE9Integer(cellOf(line, COLUMN_NUMBERS.category, locate));
    return category === null || !isE9BuildingCategory(category) ? [] : [rowOf(line, category, context)];
  });
}

/**
 * **Διάβασε την πράξη ΕΝΦΙΑ.** `not-recognized` όταν το έγγραφο δεν είναι πράξη προσδιορισμού ΕΝΦΙΑ ή δεν έχει ενότητα
 * Δ. Πράξη μόνο με οικόπεδα ⇒ `read` με κενές γραμμές (η οθόνη το λέει, δεν το κρύβει).
 */
export function readEnfiaAssessmentText(pages: readonly PdfPositionedPage[]): EnfiaAssessmentResult {
  const text = pages.map(textOf).join(' ');
  if (!IS_ASSESSMENT.test(text) || !IS_ENFIA.test(text)) return { kind: 'not-recognized' };
  if (!pages.some((page) => sectionTableOf(page) !== null)) return { kind: 'not-recognized' };
  const year = YEAR.exec(text);
  return { kind: 'read', year: year === null ? null : Number(year[1]), rows: pages.flatMap(rowsOfPage) };
}
