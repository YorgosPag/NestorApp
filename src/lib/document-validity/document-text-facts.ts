/**
 * =============================================================================
 * Κείμενο εγγράφου → γεγονότα εγγράφου: ο ΕΝΑΣ πίνακας «ποιο είδος διαβάζεται με ποιον αναγνώστη» (ADR-915 §20)
 * =============================================================================
 *
 * Οι αναγνώστες υπάρχουν ήδη και είναι καθαροί (`readPeaText` — ΠΕΑ · `readClearanceText` — φορολογική / ΕΦΚΑ / ΕΝΦΙΑ).
 * Εδώ ζει **μόνο** η αντιστοίχιση είδος → αναγνώστης, και η κρίση «συμφωνεί το έγγραφο με αυτό που υποσχέθηκε το
 * ανέβασμα;». Τη χρησιμοποιούν **όλες** οι αφορμές ανάγνωσης (ανέβασμα μέσω CDC · «Ανάγνωση από το έγγραφο» στον
 * διάλογο ελέγχου · συμπλήρωση) — καμία δεν ξέρει ποιος αναγνώστης αντιστοιχεί σε ποιο είδος.
 *
 * 🔑 **Το έγγραφο κρίνει, όχι η ετικέτα του ανεβάσματος**: αρχείο ανεβασμένο ως «Φορολογική» που διαβάζεται ως
 * πιστοποιητικό ΕΝΦΙΑ ⇒ `kind-mismatch`, **κανένα** γεγονός. Ούτε το είδος της ετικέτας (ψέμα για τα bytes) ούτε το
 * είδος του κειμένου (θα κάθονταν σε γραμμή που ζητά άλλο έγγραφο).
 * ⚠️ Χωρίς διαβασμένη ημερομηνία έκδοσης **κανένα** γεγονός (`issue-date-unread`): μια κενή ανάγνωση `document-text`
 * θα υπερίσχυε της ημερομηνίας που θα δηλώσει αργότερα ο ελεγκτής (ίδιος κανόνας με το `peaDocumentFacts`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/document-text-facts
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { readPeaText, type PeaReading } from '@/lib/energy-certificate/pea-text';
import { readClearanceText } from './clearance-text';
import type { DocumentFactsClaim, RecordDocumentFactsOutcome } from './document-facts';

/** Τα γεγονότα όπως τα δίνει το κείμενο — το «ποιος τα κατέγραψε» το βάζει η αφορμή. */
export type DocumentTextFacts = Omit<DocumentFactsClaim, 'recordedBy'>;

/** Τι είπε το κείμενο ενός αναγνώστη. */
export type DocumentTextReading =
  | { readonly kind: 'read'; readonly facts: DocumentTextFacts }
  | { readonly kind: 'issue-date-unread'; readonly found: DocumentKind }
  | { readonly kind: 'not-recognized' };

/** Η κρίση για ένα αρχείο που υποσχέθηκε συγκεκριμένα είδη. */
export type DocumentTextVerdict =
  | DocumentTextReading
  | { readonly kind: 'kind-mismatch'; readonly found: DocumentKind };

/** Γιατί ένα αρχείο που παρακολουθείται **δεν** διαβάστηκε — πριν από κάθε κρίση κειμένου. */
export type DocumentTextUnreadable = 'not-live' | 'not-pdf' | 'no-object' | 'too-large' | 'unparsable';

/** Η έκβαση **μιας** ανάγνωσης αρχείου — το λεξιλόγιο κάθε αφορμής (CDC · διάλογος · συμπλήρωση) και του client. */
export type DocumentTextOutcome =
  | { readonly kind: 'not-tracked' }
  | { readonly kind: 'unreadable'; readonly reason: DocumentTextUnreadable }
  | Exclude<DocumentTextVerdict, { readonly kind: 'read' }>
  | { readonly kind: 'recorded'; readonly facts: DocumentTextFacts; readonly verdict: RecordDocumentFactsOutcome };

interface DocumentTextReaderSpec {
  /** Πόσες σελίδες χρειάζεται — ποτέ ολόκληρο ένα λάθος PDF εκατό σελίδων. */
  readonly maxPages: number;
  readonly read: (pages: readonly string[]) => DocumentTextReading;
}

/** ΠΕΑ → γεγονότα. Η ΜΙΑ μετάφραση· το `peaDocumentFacts` της εισαγωγής ΠΕΑ την καλεί. */
export function peaTextFacts(reading: PeaReading): DocumentTextFacts | null {
  if (reading.issuedOn === null) return null;
  return {
    kind: 'energy-certificate',
    issuedOn: reading.issuedOn,
    printedValidUntil: reading.validUntil,
    classification: null,
    source: { kind: 'document-text', reader: 'pea-text' },
  };
}

const PEA_READER: DocumentTextReaderSpec = {
  // Το έντυπο έχει δύο σελίδες· λίγες παραπάνω για ανοχή (ίδιο όριο με την εισαγωγή ΠΕΑ).
  maxPages: 4,
  read: (pages) => {
    const text = readPeaText(pages);
    if (text.kind === 'not-a-certificate') return { kind: 'not-recognized' };
    const facts = peaTextFacts(text.reading);
    return facts === null ? { kind: 'issue-date-unread', found: 'energy-certificate' } : { kind: 'read', facts };
  },
};

const CLEARANCE_READER: DocumentTextReaderSpec = {
  // Τα τρία έντυπα είναι μονοσέλιδα (μετρημένο, §19.1)· δύο ακόμη για ανοχή.
  maxPages: 3,
  read: (pages) => {
    const text = readClearanceText(pages);
    if (text.kind === 'not-recognized') return text;
    const { kind, reader, issuedOn, printedValidUntil } = text.reading;
    if (issuedOn === null) return { kind: 'issue-date-unread', found: kind };
    return {
      kind: 'read',
      facts: { kind, issuedOn, printedValidUntil, classification: null, source: { kind: 'document-text', reader } },
    };
  },
};

/** **Ο πίνακας.** Είδος χωρίς γραμμή εδώ = δεν διαβάζεται από το κείμενό του (σήμερα: ταυτότητα κτιρίου). */
export const DOCUMENT_TEXT_READER_OF_KIND = {
  'energy-certificate': PEA_READER,
  'tax-clearance': CLEARANCE_READER,
  'insurance-clearance': CLEARANCE_READER,
  'enfia-certificate': CLEARANCE_READER,
} as const satisfies Partial<Record<DocumentKind, DocumentTextReaderSpec>>;

type TextReadableKind = keyof typeof DOCUMENT_TEXT_READER_OF_KIND;

function isTextReadable(kind: DocumentKind): kind is TextReadableKind {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_TEXT_READER_OF_KIND, kind);
}

/** Οι αναγνώστες για τα είδη που υποσχέθηκε το αρχείο — χωρίς επανάληψη. Κενό ⇒ τίποτα δεν διαβάζεται. */
export function documentTextReadersFor(kinds: readonly DocumentKind[]): readonly DocumentTextReaderSpec[] {
  return [...new Set(kinds.filter(isTextReadable).map((kind) => DOCUMENT_TEXT_READER_OF_KIND[kind]))];
}

/** Πόσες σελίδες να βγάλει ο εξαγωγέας ώστε να φτάσουν σε **κάθε** αναγνώστη. */
export function documentTextMaxPages(readers: readonly DocumentTextReaderSpec[]): number {
  return Math.max(0, ...readers.map((reader) => reader.maxPages));
}

/**
 * **Η κρίση.** Ο πρώτος αναγνώστης που **αναγνωρίζει** το έντυπο αποφασίζει· αν το έντυπο είναι άλλο είδος από όσα
 * υποσχέθηκε το αρχείο ⇒ `kind-mismatch`. Κανένας δεν το αναγνωρίζει ⇒ `not-recognized`.
 */
export function judgeDocumentText(
  pages: readonly string[],
  expected: readonly DocumentKind[],
  readers: readonly DocumentTextReaderSpec[] = documentTextReadersFor(expected),
): DocumentTextVerdict {
  for (const reader of readers) {
    const reading = reader.read(pages);
    if (reading.kind === 'not-recognized') continue;
    const found = reading.kind === 'read' ? reading.facts.kind : reading.found;
    return expected.includes(found) ? reading : { kind: 'kind-mismatch', found };
  }
  return { kind: 'not-recognized' };
}
