import 'server-only';

/**
 * @fileoverview **Τι πληρώνεται** με μια συνεδρία πληρωμής — το «πληρωτέο αντικείμενο» (ADR-943 §5.6 · §5.9 · ADR-ACC-030 §5)
 * @description Η συνεδρία πληρωμής (`accounting_payment_checkouts`) ήταν δεμένη σε **ένα** είδος: τιμολόγιο από σύνδεσμο
 *   (`invoiceId` + `shareId`). Εδώ ζει το **κλειστό** λεξιλόγιο των ειδών και ο **ένας** κωδικοποιητής τους από/προς τη βάση.
 *   Καθαρό — καμία βάση, κανένας πάροχος. Ό,τι **κάνει** κάθε είδος με τα χρήματα (ποιος γραφέας τα καταγράφει) ζει στο
 *   μητρώο (`payable-subject-registry.ts`), όπως το `payment-provider.ts` ↔ `payment-provider-registry.ts`.
 *
 *   **Μορφή στη βάση — αμετάβλητη για το τιμολόγιο:** τα πεδία μένουν στο πάνω επίπεδο του εγγράφου (`invoiceId`,
 *   `shareId`) και το είδος γράφεται στο `subjectKind`. Έγγραφο **χωρίς** `subjectKind` είναι τιμολόγιο (όλα όσα γράφτηκαν
 *   πριν από αυτό το αρχείο) — **καμία μετάπτωση**, κανένας νέος δείκτης, η αναζήτηση `shareId ==` μένει ίδια.
 *   Στη μνήμη το αντικείμενο είναι **ένα** πεδίο με διάκριση (`subject`), ώστε ο compiler να αναγκάζει κάθε αναγνώστη να
 *   ρωτήσει «ποιο είδος;» αντί να υποθέτει τιμολόγιο.
 *
 *   ⚠️ Το `CheckoutSubject` του port (`payment-provider.ts`) είναι **άλλη** έννοια: ό,τι χρειάζεται ο πάροχος για να ρωτήσει
 *   για τη συνεδρία. Ο πάροχος **δεν** μαθαίνει ποτέ τι πληρώνεται.
 */

import { DOCUMENT_REQUEST_PATH } from '@/lib/document-validity/document-request-link';
import { plainRecordOrNull, trimmedStringOrNull } from '@/lib/type-guards';

/**
 * Τα είδη που δέχεται σήμερα το checkout. Κλειστό σύνολο: νέο είδος ⇒ ο compiler ζητά handler στο μητρώο, διαδρομή
 * επιστροφής και εμβέλεια ανοιχτών συνεδριών. Η προκαταβολή ανάθεσης (`issuance-advance`) μπήκε **μαζί** με τον γραφέα
 * της (ADR-943 Φ4β, actor `system`) — κανένα είδος δεν δέχεται χρήματα χωρίς γραφέα.
 */
export const PAYABLE_SUBJECT_KINDS = ['invoice', 'issuance-advance'] as const;

export type PayableSubjectKind = (typeof PAYABLE_SUBJECT_KINDS)[number];

/** Τιμολόγιο που πληρώνεται από τον δημόσιο σύνδεσμό του (ADR-ACC-030). */
export interface InvoicePayableSubject {
  readonly kind: 'invoice';
  readonly invoiceId: string;
  /** Ο σύνδεσμος από τον οποίο ξεκίνησε η πληρωμή — η εμβέλεια της απόπειρας και των ανοιχτών συνεδριών. */
  readonly shareId: string;
}

/**
 * ADR-943 Φ4β — η **προκαταβολή μιας ανάθεσης έκδοσης**, πληρωμένη από τον υπεύθυνο ιδιοκτήτη με τον σύνδεσμο που
 * ενέκρινε. Τα χρήματα είναι **του μηχανικού** και τα κρατά ο πάροχος (marketplace, `split=1`).
 */
export interface IssuanceAdvancePayableSubject {
  readonly kind: 'issuance-advance';
  /** Ο μισθωτής της ανάθεσης — και εμβέλεια του ερωτήματος των ανοιχτών συνεδριών (CHECK 3.10 / 3.35). */
  readonly companyId: string;
  readonly assignmentId: string;
  /**
   * Κ-6 — η στιγμή του **ρητού αιτήματος έναρξης** μέσα στις 14 ημέρες, μαζί με την αναγνώριση ότι το δικαίωμα
   * υπαναχώρησης χάνεται με την πλήρη παροχή (ν.2251/1994 3ι §4 α ii · 3ιβ (α)). Χωρίς αυτό η πληρωμή **δεν ξεκινά** —
   * άρα υπάρχει πάντα.
   */
  readonly withdrawalWaiverAt: string;
}

export type PayableSubject = InvoicePayableSubject | IssuanceAdvancePayableSubject;

/** Το πεδίο του εγγράφου που λέει το είδος. Λείπει ⇒ `invoice` (έγγραφα πριν από ADR-943). */
export const PAYABLE_SUBJECT_KIND_FIELD = 'subjectKind';

/** Τα πεδία του αντικειμένου όπως γράφονται στο έγγραφο της συνεδρίας (πάνω επίπεδο). */
export type StoredPayableSubject =
  | { readonly subjectKind: 'invoice'; readonly invoiceId: string; readonly shareId: string }
  | {
      readonly subjectKind: 'issuance-advance'; readonly companyId: string; readonly assignmentId: string;
      readonly withdrawalWaiverAt: string;
    };

function invoiceSubjectOf(raw: Record<string, unknown> | null): InvoicePayableSubject | null {
  const invoiceId = trimmedStringOrNull(raw?.invoiceId);
  const shareId = trimmedStringOrNull(raw?.shareId);
  return invoiceId !== null && shareId !== null ? { kind: 'invoice', invoiceId, shareId } : null;
}

function issuanceAdvanceSubjectOf(raw: Record<string, unknown> | null): IssuanceAdvancePayableSubject | null {
  const companyId = trimmedStringOrNull(raw?.companyId);
  const assignmentId = trimmedStringOrNull(raw?.assignmentId);
  const withdrawalWaiverAt = trimmedStringOrNull(raw?.withdrawalWaiverAt);
  if (companyId === null || assignmentId === null || withdrawalWaiverAt === null) return null;
  return { kind: 'issuance-advance', companyId, assignmentId, withdrawalWaiverAt };
}

/**
 * Έγγραφο ⇒ αντικείμενο, ή `null` όταν το είδος είναι άγνωστο ή λείπει υποχρεωτικό πεδίο (ποτέ «περίπου σωστό»).
 * Ένα είδος που δεν ξέρει αυτή η έκδοση του κώδικα είναι **ανύπαρκτο** — δεν διαβάζεται ως τιμολόγιο.
 */
export function payableSubjectOf(data: unknown): PayableSubject | null {
  const raw = plainRecordOrNull(data);
  const kind = raw?.[PAYABLE_SUBJECT_KIND_FIELD];
  if (kind === undefined || kind === 'invoice') return invoiceSubjectOf(raw);
  return kind === 'issuance-advance' ? issuanceAdvanceSubjectOf(raw) : null;
}

/** Αντικείμενο ⇒ πεδία εγγράφου. Το είδος γράφεται **πάντα** ρητά στα νέα έγγραφα. */
export function storedPayableSubjectOf(subject: PayableSubject): StoredPayableSubject {
  switch (subject.kind) {
    case 'invoice':
      return { subjectKind: 'invoice', invoiceId: subject.invoiceId, shareId: subject.shareId };
    case 'issuance-advance':
      return {
        subjectKind: 'issuance-advance', companyId: subject.companyId, assignmentId: subject.assignmentId,
        withdrawalWaiverAt: subject.withdrawalWaiverAt,
      };
  }
}

/**
 * Πού επιστρέφει ο browser μετά τον πάροχο, ανά είδος — **μόνο** διαδρομή της ίδιας εφαρμογής, ποτέ εξωτερική διεύθυνση
 * (καμία ανοιχτή ανακατεύθυνση). Τιμολόγιο: η σελίδα του συνδέσμου `/shared/<token>`. Προκαταβολή: η σελίδα έγκρισης
 * `/document-request` **χωρίς** διαπιστευτήριο — η σελίδα κρατά τον σύνδεσμο στο `sessionStorage` της καρτέλας.
 */
const RETURN_PATH_OF_KIND: { readonly [K in PayableSubjectKind]: RegExp } = {
  invoice: /^\/shared\/[A-Za-z0-9_\-%]+$/,
  'issuance-advance': new RegExp(`^${DOCUMENT_REQUEST_PATH}$`),
};

/** Επιτρέπεται αυτή η διαδρομή ως επιστροφή για αυτό το είδος; */
export function isReturnPathOfKind(kind: PayableSubjectKind, path: string): boolean {
  return RETURN_PATH_OF_KIND[kind].test(path);
}

/** Επιτρέπεται αυτή η διαδρομή ως επιστροφή για **κάποιο** είδος; (το cookie δεν ξέρει είδος — ελέγχεται ξανά στην ανάγνωση) */
export function isPayableReturnPath(path: string): boolean {
  return PAYABLE_SUBJECT_KINDS.some((kind) => isReturnPathOfKind(kind, path));
}

/**
 * Ανήκουν δύο αντικείμενα στην **ίδια εμβέλεια απόπειρας**; Τιμολόγιο: ίδιος σύνδεσμος. Προκαταβολή: ίδια ανάθεση του
 * ίδιου μισθωτή. Η εμβέλεια ορίζει ποιες ανοιχτές συνεδρίες κλείνουν όταν ξεκινά νέα, και σε ποιον απαντά η σελίδα για
 * την έκβαση μιας απόπειρας.
 */
export function sameAttemptScope(a: PayableSubject, b: PayableSubject): boolean {
  switch (a.kind) {
    case 'invoice':
      return b.kind === 'invoice' && a.shareId === b.shareId;
    case 'issuance-advance':
      return b.kind === 'issuance-advance' && a.companyId === b.companyId && a.assignmentId === b.assignmentId;
  }
}
