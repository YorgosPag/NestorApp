/**
 * =============================================================================
 * Αναγνώστης πράξης e-Άδειες — τύπος και ημερομηνία της πράξης (ADR-949 Α-3 · οικογένεια ADR-915)
 * =============================================================================
 *
 * Γράφτηκε **πάνω σε πραγματικά δείγματα** (4 πράξεις e-Άδειες, ανωνυμοποιημένες — ADR-949 §2.1α): μία «Οικοδομική
 * άδεια», δύο «Ενημέρωση έντυπης Αδείας (ν.4759/2020)», μία «Έγκριση Εργασιών Δόμησης Μικρής Κλίμακας». Όλα στην 1η
 * σελίδα: «Τύπος Πράξης», «Ημ/νία έκδοσης πράξης», «Περιγραφή έργου».
 *
 * 🔑 **Ο τύπος αποφασίζει αν η ημερομηνία ΕΙΝΑΙ ημερομηνία άδειας**: ο υπολογιστής ζητά την ημερομηνία της οικοδομικής
 *    άδειας (παλαιότητα). Μόνο η **αρχική** «Οικοδομική άδεια» τη δίνει. Η ενημέρωση γράφει τη **δική της** ημερομηνία
 *    (2026 για άδεια του 2008) και η ΕΕΔΜΚ μιας θερμοπρόσοψης του 2018 θα έκανε ένα κτίριο του 2003 «του 2018» = λάθος
 *    τιμή. Γι' αυτό ο αναγνώστης επιστρέφει τον **τύπο**· την απόφαση την παίρνει η πρόταση.
 * 🔑 **Η κύρια πράξη, ποτέ οι «Προγενέστερες Πράξεις»**: η ενότητα αυτή έχει δικές της ημερομηνίες (βεβαίωση όρων
 *    δόμησης · προηγούμενη ενημέρωση). Διαβάζεται μόνο ό,τι είναι **πάνω** από την επικεφαλίδα της· όλες οι
 *    «Ημ/νία έκδοσης πράξης» εκεί πρέπει να **συμφωνούν** (σφραγίδα και σώμα), αλλιώς η ημερομηνία μένει αδιάβαστη.
 * 🔑 **Ενημέρωση ⇒ η αρχική άδεια ΟΝΟΜΑΖΕΤΑΙ, ποτέ μαντεύεται**: «ΕΝΗΜΕΡΩΣΗ ΤΗΣ 417/2008 ΟΙΚΟΔΟΜΙΚΗΣ ΑΔΕΙΑΣ» ⇒ αριθμός
 *    και έτος, για να ζητηθεί η σωστή άδεια. Καμία ημερομηνία από «/2008».
 * ⚠️ Τύπος που δεν είδαμε σε δείγμα (π.χ. αναθεώρηση) ⇒ `unsupported` — κανόνας Α3: «μόνο ό,τι αποδείχθηκε».
 * 🔒 **Ελαχιστοποίηση από κατασκευής**: κανένα πεδίο για ονόματα, ΚΑΕΚ, κλειδιά, αριθμούς πράξης/αίτησης ή μηχανικό.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/unit-permit-text
 */

import { normalizeCalendarDay } from '@/lib/date-local';
import { linesOf, type PdfPositionedPage, type PdfTextLine } from '@/lib/pdf/pdf-page-text';

/** Μόνο η 1η σελίδα: εκεί ζουν τύπος, ημερομηνία και περιγραφή της πράξης. */
export const UNIT_PERMIT_MAX_PAGES = 1;

/**
 * Τι πράξη είναι:
 * - `initial`     — «Οικοδομική άδεια …»: η ημερομηνία της είναι η ημερομηνία άδειας
 * - `update`      — «Ενημέρωση … Αδείας»: δική της ημερομηνία· μετρά η αρχική άδεια
 * - `minor-works` — «Έγκριση Εργασιών Δόμησης Μικρής Κλίμακας»: δεν είναι άδεια ανέγερσης
 * - `unsupported` — τύπος που δεν είδαμε σε δείγμα
 */
export type UnitPermitActKind = 'initial' | 'update' | 'minor-works' | 'unsupported';

/** Η αρχική άδεια που αναφέρει μια ενημέρωση: «417/2008». */
export interface UnitPermitReference {
  readonly number: string;
  readonly year: number;
}

export interface UnitPermitAct {
  readonly page: number;
  readonly kind: UnitPermitActKind;
  /** `YYYY-MM-DD` — `null` όταν λείπει, δεν είναι υπαρκτή μέρα, ή οι εμφανίσεις της διαφωνούν. */
  readonly issuedOn: string | null;
  /** Μόνο για `update`: η αρχική άδεια, αν η περιγραφή την ονομάζει. */
  readonly originalPermit: UnitPermitReference | null;
}

type UnitPermitTextResult = { readonly kind: 'read'; readonly act: UnitPermitAct } | { readonly kind: 'not-recognized' };

const ACT_NUMBER_LABEL = /^Α\/Α\s+Πράξης/;
const ISSUED_LABEL = /^Ημ\/νία\s+έκδοσης\s+πράξης:?\s*(.*)$/;
const TYPE_LABEL = 'Τύπος Πράξης';
const PRIOR_ACTS = 'Προγενέστερες Πράξεις';
const SLASH_DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const MINOR_WORKS = /Εργασιών\s+Δόμησης\s+Μικρής\s+Κλίμακας/i;
// ⚠️ Ποτέ `\b` μετά από ελληνικό γράμμα: στη JS το `\b` είναι όριο **ASCII** λέξης — «Ενημέρωση\b» δεν ταιριάζει ΠΟΤΕ.
const UPDATE = /^Ενημέρωση\s/i;
const INITIAL = /^Οικοδομική\s+άδεια(?:\s|$)/i;
const ORIGINAL_PERMIT = /(\d{1,6})\s*\/\s*((?:19|20)\d{2})\s+ΟΙΚΟΔΟΜΙΚΗΣ\s+ΑΔΕΙΑΣ/i;

const lineText = (line: PdfTextLine) => line.items.map((item) => item.s.trim()).join(' ');

/** Οι γραμμές της κύριας πράξης: ό,τι είναι πάνω από τις «Προγενέστερες Πράξεις» (όλη η σελίδα αν δεν υπάρχουν). */
function mainLinesOf(page: PdfPositionedPage): readonly PdfTextLine[] {
  const lines = linesOf(page);
  const prior = lines.findIndex((line) => lineText(line) === PRIOR_ACTS);
  return prior < 0 ? lines : lines.slice(0, prior);
}

/** Η τιμή δίπλα στην ετικέτα — στο ίδιο κομμάτι μετά το «:» ή στα επόμενα της γραμμής. */
function valueAfter(line: PdfTextLine, index: number, inline: string): string {
  const rest = line.items.slice(index + 1).map((item) => item.s.trim());
  return [inline.trim(), ...rest].filter((part) => part !== '').join(' ');
}

/** Η ημερομηνία της κύριας πράξης — μόνο αν **όλες** οι εμφανίσεις της συμφωνούν (βλ. 🔑 πάνω). */
function issuedOnOf(lines: readonly PdfTextLine[]): string | null {
  const dates = lines.flatMap((line) =>
    line.items.flatMap((item, index) => {
      const match = ISSUED_LABEL.exec(item.s.trim());
      if (match === null) return [];
      const value = valueAfter(line, index, match[1]).split(' ')[0] ?? '';
      return [SLASH_DATE.test(value) ? normalizeCalendarDay(value) : null];
    }),
  );
  const unique = new Set(dates);
  return unique.size === 1 ? dates[0] ?? null : null;
}

/** Ο «Τύπος Πράξης» — ή, όπου η γραμμή λείπει (ΕΕΔΜΚ), η επικεφαλίδα της πράξης. */
function kindOf(lines: readonly PdfTextLine[]): UnitPermitActKind {
  const typeLine = lines.find((line) => line.items[0]?.s.trim() === TYPE_LABEL);
  const type = typeLine === undefined ? null : valueAfter(typeLine, 0, '');
  if (type === null) return lines.some((line) => MINOR_WORKS.test(lineText(line))) ? 'minor-works' : 'unsupported';
  if (MINOR_WORKS.test(type)) return 'minor-works';
  if (UPDATE.test(type)) return 'update';
  return INITIAL.test(type) ? 'initial' : 'unsupported';
}

function originalPermitOf(lines: readonly PdfTextLine[]): UnitPermitReference | null {
  const match = ORIGINAL_PERMIT.exec(lines.map(lineText).join(' '));
  return match === null ? null : { number: match[1], year: Number(match[2]) };
}

/** **Διάβασε την πράξη e-Άδειες.** `not-recognized` όταν η 1η σελίδα δεν έχει αριθμό και ημερομηνία πράξης. */
export function readUnitPermitText(pages: readonly PdfPositionedPage[]): UnitPermitTextResult {
  const first = pages[0];
  if (first === undefined) return { kind: 'not-recognized' };
  const lines = mainLinesOf(first);
  const has = (label: RegExp) => lines.some((line) => line.items.some((item) => label.test(item.s.trim())));
  if (!has(ACT_NUMBER_LABEL) || !has(ISSUED_LABEL)) return { kind: 'not-recognized' };
  const kind = kindOf(lines);
  return {
    kind: 'read',
    act: { page: first.page, kind, issuedOn: issuedOnOf(lines), originalPermit: kind === 'update' ? originalPermitOf(lines) : null },
  };
}
