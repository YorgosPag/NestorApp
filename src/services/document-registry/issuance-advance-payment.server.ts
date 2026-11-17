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
 * 🔑 **Άρνηση του μειωτή = χρήματα που μπήκαν χωρίς να γίνουν δεκτά** (ακυρωμένη ανάθεση, άλλο ποσό) ⇒ `subject-refused`,
 *    σφάλμα προς άνθρωπο — ποτέ σιωπηλή απώλεια. Η αυτόματη επιστροφή είναι Φ5.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { IssuanceAdvanceAction } from '@/lib/document-validity/issuance-advance-reducer';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceAdvancePayableSubject } from '@/server/payments/payable-subject';
import type { PayableMovementInput, PayableMovementOutcome } from '@/server/payments/payable-subject-registry';
import { ensureHeldTransfer, heldTransferDescriptionOf } from '@/server/payments/payment-held-transfer';
import type { ProviderMovement } from '@/server/payments/payment-provider';
import { announceAdvanceFunded } from '@/server/issuance-invitations/issuance-advance-notifier';

import { readDocumentRegistry } from './document-registry.service';
import type { DocumentRegistryResponse, RegistryPropertyLabel } from './document-registry.types';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { stageIssuanceAction, type IssuanceWriteOutcome } from './issuance-assignments.server';
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
      companyId: assignment.companyId,
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
  if (!outcome.ok) {
    logger.error('Provider money the advance writer refused — needs a human (refund is Φ5)', {
      checkoutId: checkout.checkoutId, assignmentId: subject.assignmentId, movement: movement.kind, refusal: outcome.refusal,
    });
    return 'subject-refused';
  }
  if (movement.kind === 'payment') {
    await holdFunds(db, input);
    if (outcome.outcome === 'changed') await announceAdvanceFunded(db, { context, record: outcome.record, now: new Date() });
  }
  return outcome.outcome === 'changed' ? 'recorded' : 'duplicate';
}
