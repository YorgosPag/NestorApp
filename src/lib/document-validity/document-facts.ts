/**
 * =============================================================================
 * Τα γεγονότα ενός εγγράφου — ζουν ΣΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ (ADR-915 Φ3 · Α3)
 * =============================================================================
 *
 * `FileRecord.documentFacts` = **τι είδους έγγραφο είναι, πότε εκδόθηκε, ως πότε γράφει ότι ισχύει**. Ακίνητο,
 * μεταβίβαση και αγγελία **διαβάζουν** από εδώ αντί να ξαναρωτούν τον άνθρωπο (Procore · ACC: η ημερομηνία ζει στο
 * έγγραφο).
 *
 * 🏆 **Πού ξεπερνάμε το ACC**: εκεί το χαρακτηριστικό **περνά στην επόμενη έκδοση**. Εδώ **ΟΧΙ**: νέο ΠΕΑ = νέα
 * επιθεώρηση = νέες ημερομηνίες· η παλιά έκδοση πάνω στο νέο αρχείο θα έβγαζε λάθος λήξη **σιωπηλά**. Τα γεγονότα
 * ανήκουν στο `fileId` (στην έκδοση), και η απουσία τους σημαίνει «δεν ξέρουμε».
 *
 * 🔑 **Ιεραρχία προέλευσης**: ό,τι διαβάστηκε **ντετερμινιστικά από τα bytes** (`document-text`) υπερισχύει της
 * **δήλωσης ανθρώπου** (`attested`). Ο άνθρωπος βλέπει την τιμή του εγγράφου προσυμπληρωμένη — δεν την ξαναγράφει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι**. Ο ΕΝΑΣ γραφέας: `server/files/document-facts-writer`.
 *
 * @module lib/document-validity/document-facts
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { isOneOf, isPlainRecord, trimmedStringOrNull as text } from '@/lib/type-guards';
import {
  DOCUMENT_KINDS,
  documentKindSpec,
  type DocumentKind,
} from '@/config/document-validity/document-validity';
import { documentExpiry, type DocumentExpiry } from '@/lib/document-validity/document-expiry';

/** Οι αναγνώστες κειμένου που γράφουν γεγονότα. Κλειστό σύνολο — νέος αναγνώστης = νέα γραμμή εδώ. */
export const DOCUMENT_TEXT_READERS = ['pea-text'] as const;
export type DocumentTextReader = (typeof DOCUMENT_TEXT_READERS)[number];

/** Οι διαδρομές από τις οποίες δηλώνει άνθρωπος. Κλειστό σύνολο. */
export const DOCUMENT_ATTESTATION_PATHS = ['conveyance-review'] as const;
export type DocumentAttestationPath = (typeof DOCUMENT_ATTESTATION_PATHS)[number];

/** Από πού ήρθαν τα γεγονότα — και άρα πόσο βαραίνουν. */
export type DocumentFactsSource =
  | { readonly kind: 'document-text'; readonly reader: DocumentTextReader }
  | { readonly kind: 'attested'; readonly via: DocumentAttestationPath };

export interface DocumentFacts {
  readonly kind: DocumentKind;
  /** Ημερομηνία έκδοσης, `YYYY-MM-DD` — `null` = το έγγραφο δεν τη δίνει / δεν διαβάστηκε. */
  readonly issuedOn: string | null;
  /** Ό,τι **τυπώνει** το έγγραφο ως λήξη (`YYYY-MM-DD`) — ίδιο όνομα με το `DocumentExpiryInput` (Α4). */
  readonly printedValidUntil: string | null;
  readonly source: DocumentFactsSource;
  /** `uid` ανθρώπου ή ονομασμένος αυτοματισμός (`system:…`). */
  readonly recordedBy: string;
  /** ISO — πότε καταγράφηκαν. */
  readonly recordedAt: string;
}

/** Τα γεγονότα **χωρίς** τη στιγμή — τη βάζει ο ΕΝΑΣ γραφέας (`recordDocumentFacts`), ποτέ ο καλών. */
export type DocumentFactsClaim = Omit<DocumentFacts, 'recordedAt'>;

/** Το κλειδί του πεδίου — ένα όνομα για τον τύπο, τον γραφέα, τους κανόνες και την άγκυρα. */
export const DOCUMENT_FACTS_FIELD = 'documentFacts';

// =============================================================================
// Ο ΑΝΕΚΤΙΚΟΣ ΑΝΑΓΝΩΣΤΗΣ
// =============================================================================

function readSource(raw: unknown): DocumentFactsSource | null {
  if (!isPlainRecord(raw)) return null;
  const { kind, reader, via } = raw;
  if (kind === 'document-text' && isOneOf(DOCUMENT_TEXT_READERS, reader)) return { kind, reader };
  if (kind === 'attested' && isOneOf(DOCUMENT_ATTESTATION_PATHS, via)) return { kind, via };
  return null;
}

const dateOrNull = (value: unknown): string | null => (isDateKey(value) ? value : null);

/**
 * **`raw` → `DocumentFacts`, ή `null` = «δεν ξέρουμε».** Ποτέ «ισχύει».
 *
 * ⚠️ Ανεκτικός στην απουσία (κάθε αρχείο πριν τη Φ3 — **καμία** μαζική μετάπτωση), αυστηρός στο σχήμα: άγνωστο είδος ή
 * προέλευση ⇒ `null`. Μια ημερομηνία που δεν διαβάζεται χάνεται **μόνη της**· μια τυπωμένη λήξη **πριν** από την έκδοση
 * είναι αδύνατη και απορρίπτεται μόνη της — ποτέ μαντεψιά για το ποια από τις δύο είναι η σωστή.
 */
export function readDocumentFacts(raw: unknown): DocumentFacts | null {
  if (!isPlainRecord(raw)) return null;
  const { kind } = raw;
  const source = readSource(raw.source);
  const recordedBy = text(raw.recordedBy);
  const recordedAt = text(raw.recordedAt);
  if (!isOneOf(DOCUMENT_KINDS, kind) || source === null || recordedBy === null || recordedAt === null) return null;
  const issuedOn = dateOrNull(raw.issuedOn);
  const printed = dateOrNull(raw.printedValidUntil);
  const printedValidUntil = printed !== null && issuedOn !== null && printed < issuedOn ? null : printed;
  return { kind, issuedOn, printedValidUntil, source, recordedBy, recordedAt };
}

// =============================================================================
// Η ΙΕΡΑΡΧΙΑ — ΚΑΘΑΡΗ ΚΡΙΣΗ ΓΙΑ ΤΟΝ ΓΡΑΦΕΑ
// =============================================================================

/** Τι κάνει ο γραφέας. `outranked` = υπάρχει ήδη ανάγνωση του εγγράφου, και η δήλωση ανθρώπου **δεν** την αντικαθιστά. */
export type DocumentFactsVerdict = 'write' | 'already-recorded' | 'outranked';

const sameSource = (a: DocumentFactsSource, b: DocumentFactsSource): boolean =>
  a.kind === 'document-text' && b.kind === 'document-text'
    ? a.reader === b.reader
    : a.kind === 'attested' && b.kind === 'attested' && a.via === b.via;

/** Ίδια **γεγονότα** — το ποιος/πότε δεν μετρά (ιδεμπότητα: ίδια bytes ⇒ καμία δεύτερη γραφή). */
export function sameDocumentFacts(a: DocumentFacts, b: DocumentFacts): boolean {
  return a.kind === b.kind
    && a.issuedOn === b.issuedOn
    && a.printedValidUntil === b.printedValidUntil
    && sameSource(a.source, b.source);
}

/**
 * Γράφεται το `incoming` πάνω στο `stored`;
 *
 *   κενό                                  ⇒ write
 *   ίδια γεγονότα                         ⇒ already-recorded   (ιδεμπότητα)
 *   δήλωση ανθρώπου πάνω σε ανάγνωση      ⇒ outranked          (το έγγραφο λέει άλλο· δεν σβήνεται)
 *   ανάγνωση πάνω σε οτιδήποτε             ⇒ write              (τα bytes είναι αμετάβλητα ⇒ νεότερος αναγνώστης)
 *   δήλωση πάνω σε δήλωση                 ⇒ write              (διόρθωση ανθρώπου· το ημερολόγιο την κρατά)
 */
export function documentFactsVerdict(stored: DocumentFacts | null, incoming: DocumentFacts): DocumentFactsVerdict {
  if (stored === null) return 'write';
  if (sameDocumentFacts(stored, incoming)) return 'already-recorded';
  if (incoming.source.kind === 'attested' && stored.source.kind === 'document-text') return 'outranked';
  return 'write';
}

// =============================================================================
// Η ΓΕΦΥΡΑ ΠΡΟΣ ΤΗ ΛΗΞΗ (Α4)
// =============================================================================

/** Ό,τι χρειάζεται ο υπολογισμός λήξης — χωρίς το «ποιος/πότε». */
type ExpiryFacts = Pick<DocumentFacts, 'kind' | 'issuedOn' | 'printedValidUntil'>;

/** Η ισχύουσα λήξη των γεγονότων — κανόνας του είδους + τυπωμένη, η νωρίτερη (ο ΕΝΑΣ υπολογισμός της Φ1). */
export function documentFactsExpiry(facts: ExpiryFacts): DocumentExpiry {
  return documentExpiry({
    rule: documentKindSpec(facts.kind).rule,
    issuedOn: facts.issuedOn,
    printedValidUntil: facts.printedValidUntil,
  });
}

/**
 * **Α3 — το αρχείο κερδίζει, ανά πεδίο.** Γεγονότα **του ίδιου είδους** δίνουν έκδοση και τυπωμένη λήξη· ό,τι δεν
 * ξέρουν (`issuedOn: null`) το συμπληρώνει η ημερομηνία που πληκτρολόγησε άνθρωπος. Γεγονότα άλλου είδους **αγνοούνται**
 * (ένα ΠΕΑ δεν δίνει λήξη σε ταυτότητα κτιρίου). Η ΜΙΑ γέφυρα για μεταβίβαση και ακίνητο.
 */
export function resolvedDocumentExpiry(
  kind: DocumentKind,
  facts: ExpiryFacts | null,
  fallbackIssuedOn: string | null,
): DocumentExpiry {
  const own = facts !== null && facts.kind === kind ? facts : null;
  return documentFactsExpiry({
    kind,
    issuedOn: own?.issuedOn ?? fallbackIssuedOn,
    printedValidUntil: own?.printedValidUntil ?? null,
  });
}

// =============================================================================
// Η ΠΡΟΒΟΛΗ — ό,τι ταξιδεύει σε τρίτους
// =============================================================================

/**
 * Τα γεγονότα **χωρίς** το «ποιος/πότε». Ταξιδεύουν στα τεκμήρια μεταβίβασης, που βλέπουν και εξωτερικοί
 * επαγγελματίες: το `uid` όποιου τα κατέγραψε δεν είναι δική τους πληροφορία (πνεύμα ADR-901 Α18).
 */
export type DocumentFactsView = Omit<DocumentFacts, 'recordedBy' | 'recordedAt'>;

export function documentFactsView(facts: DocumentFacts | null): DocumentFactsView | null {
  if (facts === null) return null;
  return { kind: facts.kind, issuedOn: facts.issuedOn, printedValidUntil: facts.printedValidUntil, source: facts.source };
}

/** Το ωμό πεδίο ενός αρχείου → η προβολή, μέσω του ΕΝΟΣ ανεκτικού αναγνώστη. */
export function readDocumentFactsView(raw: unknown): DocumentFactsView | null {
  return documentFactsView(readDocumentFacts(raw));
}

/** Διάβασε το έγγραφο ο αναγνώστης κειμένου; Τότε η ημερομηνία του δεν αλλάζει από δήλωση ανθρώπου. */
export function isDocumentText(facts: Pick<DocumentFacts, 'source'> | null): boolean {
  return facts !== null && facts.source.kind === 'document-text';
}

/**
 * **Αντιλέγει η δηλωμένη ημερομηνία έκδοσης σε ό,τι διάβασε ο αναγνώστης από το ΙΔΙΟ το έγγραφο;** Ο ΕΝΑΣ φρουρός
 * για μεταβίβαση (έγκριση ελεγκτή) και ακίνητο (δήλωση ΠΕΑ).
 *
 * ⚠️ `declaredIssuedOn: null` = «δεν ξέρω», **όχι** αντίφαση — η λήξη τη συμπληρώνει από το αρχείο (Α3 ανά πεδίο).
 * ⚠️ Δήλωση ανθρώπου (`attested`) δεν «αντιλέγει»: δύο άνθρωποι διαφωνούν, το έγγραφο δεν μίλησε.
 */
export function contradictsDocumentText(
  kind: DocumentKind | undefined,
  facts: Pick<DocumentFacts, 'kind' | 'issuedOn' | 'source'> | null,
  declaredIssuedOn: string | null,
): boolean {
  if (declaredIssuedOn === null || facts === null || !isDocumentText(facts) || facts.issuedOn === null) return false;
  return facts.kind === kind && facts.issuedOn !== declaredIssuedOn;
}
