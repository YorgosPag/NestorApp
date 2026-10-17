import 'server-only';

/**
 * @fileoverview ADR-915 §30 Η-Δ2 · Η-Δ4 — **τι απέγινε το email της ανάθεσης**: τα γεγονότα παράδοσης του παρόχου
 *   (delivered · bounced · complained) πάνω στο μήνυμα που τα γέννησε, μέσω του ΥΠΑΡΧΟΝΤΟΣ webhook και ημερολογίου (ADR-841).
 * @related server/comms/email-delivery/delivery-event-consumers.ts (το μητρώο που μας καλεί) ·
 *   services/document-registry/issuance-assignments.server.ts (`recordIssuanceObservation`, ο ΙΔΙΟΣ γραφέας) ·
 *   issuance-invitation-send.ts (η συσχέτιση στην αποστολή) · issuance-answer-notifier.ts (η ειδοποίηση επιστροφής)
 * @module server/issuance-invitations/issuance-delivery-events
 *
 * ```
 * Mailgun ─► webhook (υπογραφή) ─► ημερολόγιο (ιδεμποτές) ─► ΕΔΩ: ref → σύνδεσμος → ανάθεση (αναδίπλωση) ─► [επέστρεψε;] ειδοποίηση
 * ```
 * 🔑 **Συσχέτιση με ταυτότητα, όχι με διεύθυνση**: `v:nestor-ref = <invitationId>[/<contactId>]`. Η διεύθυνση δεν αρκεί — ο
 *    ίδιος άνθρωπος μπορεί να έχει πολλά μηνύματα ανοιχτά. Για τον παραλήπτη επιπλέον ελέγχεται ότι η διεύθυνση του γεγονότος
 *    **είναι** αυτή του συνδέσμου (belt-and-suspenders πάνω από την υπογραφή).
 * 🔑 **Ιδεμποτής από κατασκευή**: καλείται σε **κάθε** επανάληψη του ίδιου γεγονότος (και στο `duplicate` του ημερολογίου),
 *    ώστε μια αποτυχία εδώ να μη χάνει το γεγονός. Η αναδίπλωση (`foldDeliveryOutcome`) και το ντετερμινιστικό `eventId` της
 *    ειδοποίησης κάνουν τη δεύτερη φορά «τίποτα».
 * ⚠️ **Πετά** όταν πρέπει να ξανάρθει το γεγονός (βλάβη βάσης · πρόλαβε την αναφορά του αποστολέα) — ο webhook απαντά 5xx.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { DeliverySlot, ObservedDeliveryOutcome } from '@/lib/document-validity/issuance-delivery';
import { messageOf } from '@/lib/document-validity/issuance-assignment';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { createModuleLogger } from '@/lib/telemetry';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { recordIssuanceObservation } from '@/services/document-registry/issuance-assignments.server';
import type { EmailDeliveryEvent, EmailDeliveryKind } from '@/types/email-delivery';
import type { IssuanceInvitation } from '@/types/issuance-invitation';

import { announceIssuanceAnswer } from './issuance-answer-notifier';
import { parseIssuanceDeliveryRef } from './issuance-delivery-ref';
import { issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';

const logger = createModuleLogger('issuance-delivery-events');

/**
 * Το λεξιλόγιο του παρόχου → της ανάθεσης. `deferred` (ο πάροχος ξαναδοκιμάζει) και `unsubscribed` (συναλλακτικό μήνυμα,
 * καμία συνδρομή) **δεν** αλλάζουν τίποτα· `failed` είναι πάντα **μόνιμο** εδώ (ο προσαρμογέας κρατά το προσωρινό ως `deferred`).
 */
const OBSERVED: Readonly<Record<EmailDeliveryKind, ObservedDeliveryOutcome | null>> = {
  delivered: 'delivered', failed: 'bounced', complained: 'complained', deferred: null, unsubscribed: null,
};

export type IssuanceDeliveryEventOutcome = 'recorded' | 'unchanged' | 'stale' | 'ignored';

async function readInvitation(db: Firestore, invitationId: string): Promise<IssuanceInvitation | null> {
  const snapshot = await issuanceInvitationsCollection(db).doc(invitationId).get();
  return snapshot.exists ? parseIssuanceInvitation(snapshot.data(), invitationId) : null;
}

/** Ο παραλήπτης του γεγονότος **είναι** αυτός του συνδέσμου; — για τον συνιδιοκτήτη η διεύθυνση δεν αποθηκεύεται (ποτέ cc). */
function addressMatches(invitation: IssuanceInvitation, slot: DeliverySlot, recipient: string): boolean {
  return slot.kind !== 'recipient' || normaliseChannelEmail(invitation.inviteeEmail) === normaliseChannelEmail(recipient);
}

/** Σφάλμα που **ζητά** επανάληψη από τον πάροχο — το γεγονός πρόλαβε την αναφορά του αποστολέα. */
export class IssuanceDeliveryNotReportedError extends Error {
  constructor(invitationId: string) {
    super(`Η αναφορά αποστολής του ${invitationId} δεν έχει γραφτεί ακόμη`);
    this.name = 'IssuanceDeliveryNotReportedError';
  }
}

/** «Το email προς τον παραλήπτη επέστρεψε» — μία φορά (ντετερμινιστικό `eventId`), στους ίδιους με την απάντηση. */
async function announceBounce(db: Firestore, invitation: IssuanceInvitation, record: IssuanceAssignmentRecord): Promise<void> {
  const registry = await readDocumentRegistry(db, invitation.companyId, new Date());
  const sentBy = messageOf(record, invitation.id)?.byUid;
  const results = await announceIssuanceAnswer({
    companyId: invitation.companyId, assignmentId: invitation.assignmentId, invitationId: invitation.id, answer: 'delivery-failed',
    recipientUids: [record.proposedByUid, ...(sentBy === undefined ? [] : [sentBy])],
    propertyName: registry.properties[invitation.propertyId]?.name ?? null,
    respondentName: registry.people[invitation.contactId]?.name ?? null,
  });
  // Εδώ, αντίθετα από την απάντηση, **υπάρχει** δεύτερη ευκαιρία: ο πάροχος ξαναστέλνει, και τα ήδη σταλμένα απορρίπτονται.
  if (results.includes('failed')) throw new Error(`Return notice for ${invitation.id} was not sent to all recipients`);
}

/** **Ένα γεγονός παράδοσης** για μήνυμα ανάθεσης. Ιδεμποτές· πετά μόνο όταν το γεγονός πρέπει να ξανάρθει. */
export async function applyIssuanceDeliveryEvent(db: Firestore, event: EmailDeliveryEvent): Promise<IssuanceDeliveryEventOutcome> {
  const outcome = OBSERVED[event.kind];
  const parsed = event.ref === null ? null : parseIssuanceDeliveryRef(event.ref);
  if (outcome === null || parsed === null) return 'ignored';
  const invitation = await readInvitation(db, parsed.invitationId);
  if (invitation === null || !addressMatches(invitation, parsed.slot, event.recipient)) {
    logger.warn('Γεγονός παράδοσης χωρίς αντίστοιχο σύνδεσμο ανάθεσης — αγνοήθηκε', { invitationId: parsed.invitationId, kind: event.kind });
    return 'ignored';
  }
  const target = { companyId: invitation.companyId, propertyId: invitation.propertyId, documentKind: invitation.documentKind, invitationId: invitation.id };
  const observed = await recordIssuanceObservation(db, target, parsed.slot, outcome);
  if (observed.kind === 'not-reported') throw new IssuanceDeliveryNotReportedError(invitation.id);
  if (observed.kind === 'stale') return 'stale';
  // Η ειδοποίηση κρίνεται από την **τελική** τιμή, όχι από το «άλλαξε τώρα»: αν χάθηκε σε προηγούμενη προσπάθεια, η
  // επανάληψη τη στέλνει· αν όχι, το `eventId` την απορρίπτει ως διπλότυπη.
  if (parsed.slot.kind === 'recipient' && outcome === 'bounced' && observed.next === 'bounced') await announceBounce(db, invitation, observed.record);
  return observed.previous === observed.next ? 'unchanged' : 'recorded';
}
