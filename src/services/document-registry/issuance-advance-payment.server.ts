import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 — **η προκαταβολή ως πληρωτέο αντικείμενο**: ο handler του είδους `issuance-advance` στο
 *   μητρώο (`payable-subject-registry.ts`). Μια κίνηση του παρόχου ⇒ **ο ΕΝΑΣ γραφέας** της ανάθεσης (`stageIssuanceAction`,
 *   actor `system`) ⇒ μετά την είσπραξη, **η κρατημένη μεταφορά** στον μηχανικό (`ensureHeldTransfer`).
 * @related lib/document-validity/issuance-advance-reducer.ts (η κρίση) · issuance-assignments.server.ts (ο γραφέας) ·
 *   server/payments/payment-held-transfer.ts (η μεταφορά) · server/accounting/payments/invoice-payable-subject.ts (το δίδυμο του τιμολογίου)
 * @module services/document-registry/issuance-advance-payment.server
 *
 * 🔑 **Ιδεμποτία από τον μειωτή**: η αναφορά του παρόχου είναι η ταυτότητα του γεγονότος (`advance-funded` με το ίδιο `pmt_…`
 *    ⇒ `unchanged`). Webhook + cron + επιστροφή browser για την ίδια κίνηση γράφουν **μία** φορά.
 * 🔑 **Η μεταφορά και στο `duplicate`**: η κίνηση μπορεί να γράφτηκε σε προηγούμενη εκτέλεση που κατέρρευσε πριν από τη
 *    μεταφορά — η δηλωτική πράξη + μίσθωση την ολοκληρώνει χωρίς δεύτερη.
 * 🔑 **Άρνηση του μειωτή = χρήματα που μπήκαν χωρίς να γίνουν δεκτά** (ακυρωμένη ανάθεση, άλλο ποσό) ⇒ `subject-refused`
 *    + Φ5γ (Ζ-8): εντολή **πλήρους** επιστροφής από τον ΕΝΑ εκτελεστή — ποτέ σιωπηλή απώλεια, ποτέ βρόχος (Θ-7).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { issuanceKeyOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { IssuanceAdvanceAction } from '@/lib/document-validity/issuance-advance-reducer';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceAdvancePayableSubject } from '@/server/payments/payable-subject';
import type { PayableMovementInput, PayableMovementOutcome } from '@/server/payments/payable-subject-registry';
import { ensureHeldTransfer, heldTransferDescriptionOf } from '@/server/payments/payment-held-transfer';
import type { ProviderMovement } from '@/server/payments/payment-provider';
import { scheduleSettlement } from '@/server/payments/payment-settlement-order';
import { announceAdvanceFunded, announceAdvanceMilestone, latestAdvanceMilestone } from '@/server/issuance-invitations/issuance-advance-notifier';

import { readDocumentRegistry } from './document-registry.service';
import type { DocumentRegistryResponse, RegistryPropertyLabel } from './document-registry.types';
import { issuanceRecordOf, type DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { stageIssuanceAction, type IssuanceWriteOutcome } from './issuance-assignments.server';
import { officeLedger } from './issuance-ledger';
import { readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';

const logger = createModuleLogger('IssuanceAdvancePayment');

/** Η ανάθεση **όπως τη βλέπει το γραφείο** — ο ίδιος αναγνώστης με την οθόνη (ετικέτα ακινήτου · νεότερο έγγραφο). */
export interface HostedIssuanceContext {
  readonly assignment: DocumentIssuanceAssignment;
  readonly registry: DocumentRegistryResponse;
  readonly label: RegistryPropertyLabel;
  readonly latestIssuedOn: string | null;
}

/** `null` ⇒ ξένη / ανύπαρκτη / μη αναγνώσιμη· `'unknown'` ⇒ δεν μπορέσαμε να ρωτήσουμε (ποτέ «δεν υπάρχει»). */
export async function readHostedIssuanceContext(
  db: Firestore, companyId: string, assignmentId: string, now: Date,
): Promise<HostedIssuanceContext | null | 'unknown'> {
  const assignment = await readHostedIssuanceAssignment(db, companyId, assignmentId);
  if (assignment === null) return null;
  const registry = await readDocumentRegistry(db, companyId, now);
  if (!registry.issuanceKnown) return 'unknown';
  const issuance = registry.issuance[issuanceKeyOf(assignment.propertyId, assignment.documentKind)];
  const label = registry.properties[assignment.propertyId];
  if (issuance === undefined || label === undefined) return null;
  return { assignment, registry, label, latestIssuedOn: issuance.latestIssuedOn };
}

/** Κίνηση παρόχου ⇒ πράξη χρημάτων της προκαταβολής. Το ποσό είναι **η αλήθεια του παρόχου** — ο μειωτής το συγκρίνει. */
function advanceActionOf(subject: IssuanceAdvancePayableSubject, movement: ProviderMovement): IssuanceAdvanceAction {
  return movement.kind === 'payment'
    ? { kind: 'advance-funded', amountMinor: movement.amountMinor, paymentReference: movement.reference, withdrawalWaiverAt: subject.withdrawalWaiverAt }
    : { kind: 'advance-refunded', amountMinor: movement.amountMinor, reference: movement.reference };
}

/** Η γραφή του γεγονότος χρημάτων από τον ΕΝΑ γραφέα (actor `system`), σε δική της συναλλαγή· ίχνος μετά την επιτυχία. */
export async function writeAdvanceEvent(
  db: Firestore, context: HostedIssuanceContext, action: IssuanceAdvanceAction, provider: string,
): Promise<IssuanceWriteOutcome> {
  const { assignment, label } = context;
  const staged = await db.runTransaction(async (tx) => {
    const next = await stageIssuanceAction(tx, db, {
      ledger: officeLedger(assignment.companyId),
      writer: { kind: 'system', source: 'payments', provider, name: null },
      property: { id: assignment.propertyId, scope: label.scope, name: label.name },
      documentKind: assignment.documentKind,
      latestIssuedOn: context.latestIssuedOn,
      action,
      names: {},
      nowIso: nowISO(),
    });
    next.commit();
    return next;
  });
  await staged.audit();
  return staged.outcome;
}

/** Κρατημένη μεταφορά μετά την είσπραξη. Σφάλμα ⇒ ρίχνει: ο πάροχος ξαναστέλνει το webhook, το cron πιάνει την οφειλή. */
async function holdFunds(db: Firestore, input: PayableMovementInput<IssuanceAdvancePayableSubject>): Promise<void> {
  const { checkout, movement, provider } = input;
  await ensureHeldTransfer(db, provider, {
    checkoutId: checkout.checkoutId, paymentReference: movement.reference,
    description: heldTransferDescriptionOf(checkout.checkoutId), nowMs: Date.now(),
  });
}

/** Καταγράφει μία κίνηση στην προκαταβολή της ανάθεσης. Ιδεμποτικό. Σφάλμα βάσης/παρόχου ⇒ ρίχνει (ο καλών ξαναδοκιμάζει). */
export async function recordIssuanceAdvanceMovement(
  input: PayableMovementInput<IssuanceAdvancePayableSubject>,
): Promise<PayableMovementOutcome> {
  const { checkout, subject, movement, provider } = input;
  const db = getAdminFirestore();
  const context = await readHostedIssuanceContext(db, subject.companyId, subject.assignmentId, new Date());
  if (context === 'unknown') throw new Error('Document registry unavailable — retry');
  if (context === null) {
    logger.error('Provider money for an issuance assignment that cannot be found — needs a human', {
      checkoutId: checkout.checkoutId, assignmentId: subject.assignmentId, reference: movement.reference,
    });
    return 'subject-absent';
  }
  const outcome = await writeAdvanceEvent(db, context, advanceActionOf(subject, movement), provider.id);
  if (!outcome.ok) return refusedMovement(db, input, issuanceRecordOf(context.assignment), outcome.refusal);
  if (movement.kind === 'payment') {
    await holdFunds(db, input);
    if (outcome.outcome === 'changed') await announceAdvanceFunded(db, { context, record: outcome.record, now: new Date() });
  }
  if (movement.kind === 'refund' && outcome.outcome === 'changed') {
    const milestone = latestAdvanceMilestone(outcome.record, 'refunded');
    if (milestone !== null) await announceAdvanceMilestone(db, { context, record: outcome.record, milestone, now: new Date() });
  }
  return outcome.outcome === 'changed' ? 'recorded' : 'duplicate';
}

/** Η πληρωμή της συνεδρίας **έγινε** ποτέ δεκτή από την ανάθεση; (αλλιώς είναι χρήματα χωρίς λόγο — Θ-6). */
function isAcceptedPayment(record: IssuanceAssignmentRecord, paymentReference: string | null): boolean {
  return record.advanceEvents.some((event) => event.kind === 'funded' && event.paymentReference === paymentReference);
}

/**
 * ADR-943 Φ5γ (Ζ-8 · Θ-6 · Θ-7) — **κίνηση που ο μειωτής αρνήθηκε**. Πληρωμή ⇒ χρήματα χωρίς λόγο ⇒ εντολή **πλήρους**
 * επιστροφής (`refused-payment`, στη στιγμή της πληρωμής ⇒ ίδια εντολή σε κάθε συγχρονισμό), εκτός αν ο πάροχος δείχνει
 * ήδη όλα πίσω (κανένας βρόχος). Επιστροφή πληρωμής που δεν έγινε ποτέ δεκτή ⇒ τα χρήματα γύρισαν, τίποτα για την
 * ανάθεση. Οτιδήποτε άλλο ⇒ σφάλμα προς άνθρωπο, ποτέ σιωπηλά.
 */
async function refusedMovement(
  db: Firestore, input: PayableMovementInput<IssuanceAdvancePayableSubject>, record: IssuanceAssignmentRecord, refusal: string,
): Promise<PayableMovementOutcome> {
  const { checkout, subject, movement } = input;
  const facts = { checkoutId: checkout.checkoutId, assignmentId: subject.assignmentId, movement: movement.kind, refusal };
  const accepted = isAcceptedPayment(record, checkout.paymentReference ?? (movement.kind === 'payment' ? movement.reference : null));
  if (accepted) {
    logger.error('Provider money the advance writer refused — needs a human', facts);
    return 'subject-refused';
  }
  if (movement.kind === 'refund' || input.refundedTotalMinor >= movement.amountMinor) {
    logger.info('Refused advance payment — the money is back with the payer', facts);
    return 'duplicate';
  }
  logger.error('Provider money the advance writer refused — full refund ordered', facts);
  await scheduleSettlement(db, checkout.checkoutId, {
    refundMinor: checkout.amountMinor, releaseMinor: 0, basis: 'refused-payment', dueAt: movement.occurredAt,
  }, Date.now());
  return 'subject-refused';
}
