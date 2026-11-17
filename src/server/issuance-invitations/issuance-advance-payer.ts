import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 · Φ5β (Ζ-2) — **ποιος είναι ο πληρωτής** της προκαταβολής: ο ΕΝΑΣ δρόμος από token σε
 *   «ο ιδιοκτήτης της ισχύουσας απόφασης», για κάθε πράξη της σελίδας προκαταβολής (όψη · πληρωμή · έκβαση · αντίρρηση).
 * @related issuance-advance-checkout.ts (όψη + πληρωμή) · issuance-advance-objection.ts (αντίρρηση) ·
 *   server/invitations/invitation-redeem.ts (`readLiveOrRedeemedInvitationByToken`) · issuance-link-access.ts (§29)
 * @module server/issuance-invitations/issuance-advance-payer
 *
 * 🔑 **Δύο είδη συνδέσμων, μία κρίση** (πρότυπο Stripe hosted invoice: κάθε email φέρει έγκυρο σύνδεσμο):
 *    - ο σύνδεσμος που **ενέκρινε** (`accepted`, σκοπός `answer`) — όσο η απόφαση δείχνει **αυτό** το `invitationId`·
 *    - ζωντανός σύνδεσμος **προκαταβολής** (`pending`, σκοπός `advance`) — όσο είναι δεμένος στην **ίδια** απόφαση
 *      (`decidedAt`) και στάλθηκε στον **ίδιο** ιδιοκτήτη (`ownerContactId`). Νέα απόφαση ⇒ `superseded`, από κατασκευή.
 * 🔑 **Η σελίδα ζει όσο ζουν τα χρήματα** (Ζ-1): 30 ημέρες μετά το τέλος τους ⇒ `expired` (`isAdvancePageLive`).
 * 🔑 **Κωδικός §29 του «φακέλου»** (πρότυπο DocuSign): ο έλεγχος γίνεται στον **κάτοχο του κωδικού** — ο ιδιοκτήτης
 *    πληκτρολογεί τον κωδικό που ήδη ξέρει, και 5 λάθη κλειδώνουν **όλους** τους συνδέσμους του φακέλου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceStateOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { advanceStateOf, isAdvancePageLive, type AdvanceState } from '@/lib/document-validity/issuance-advance';
import { readLiveOrRedeemedInvitationByToken } from '@/server/invitations/invitation-redeem';
import { readHostedIssuanceContext, type HostedIssuanceContext } from '@/services/document-registry/issuance-advance-payment.server';
import { issuanceRecordOf } from '@/services/document-registry/issuance-assignment-schema';
import type { IssuanceInvitation } from '@/types/issuance-invitation';

import type { LinkRefused } from './issuance-invitation-answer';
import { ISSUANCE_INVITATION_LOCATOR, isAdvanceLink, issuanceInvitationsCollection, parseIssuanceInvitation } from './issuance-invitation-kind';
import { checkIssuanceAccessCode, type IssuanceAccessCheck } from './issuance-link-access';

/** Ο ιδιοκτήτης που πληρώνει, η ανάθεση όπως τη βλέπει το γραφείο, και πού βρίσκεται η προκαταβολή. */
export interface AdvancePayer {
  readonly invitation: IssuanceInvitation;
  readonly context: HostedIssuanceContext;
  readonly record: IssuanceAssignmentRecord;
  readonly state: AdvanceState;
}

type Unavailable = { readonly kind: 'unavailable' };
export type PayerResolution = { readonly ok: true; readonly payer: AdvancePayer } | LinkRefused | Unavailable;

const SUPERSEDED: LinkRefused = { kind: 'refused', reason: 'superseded' };

/**
 * Token ⇒ η πρόσκληση ενός συνδέσμου **πληρωτή**: εξαργυρωμένος σύνδεσμος απάντησης ή ζωντανός σύνδεσμος προκαταβολής.
 * Ζωντανός σύνδεσμος απάντησης (δεν απάντησε ακόμη) **δεν** είναι πληρωτής ⇒ ίδια άρνηση με ανύπαρκτο.
 */
export async function readPayerLink(db: Firestore, token: string, now: Date): Promise<{ readonly invitation: IssuanceInvitation } | LinkRefused | Unavailable> {
  const found = await readLiveOrRedeemedInvitationByToken(db, ISSUANCE_INVITATION_LOCATOR, { token, nowValue: now.toISOString() });
  if (found.kind === 'secret-missing') return { kind: 'unavailable' };
  if (found.kind === 'refused') return { kind: 'refused', reason: found.reason };
  const invitation = parseIssuanceInvitation(found.stored, found.invitationId);
  if (invitation === null) return { kind: 'unavailable' };
  const redeemed = invitation.state === 'accepted';
  return redeemed === isAdvanceLink(invitation) ? { kind: 'refused', reason: 'invitation-unknown' } : { invitation };
}

/** Ο σύνδεσμος ανήκει στον ιδιοκτήτη της **ισχύουσας** εγκεκριμένης απόφασης — η ανάθεση ανοιχτή, αναληφθείσα. */
function ownsCurrentDecision(record: IssuanceAssignmentRecord, latestIssuedOn: string | null, invitation: IssuanceInvitation): boolean {
  const decision = record.decision;
  const state = issuanceStateOf(record, latestIssuedOn);
  if (state.kind !== 'open' || state.stage !== 'accepted' || decision === null || decision.outcome !== 'approved') return false;
  if (isAdvanceLink(invitation)) {
    return invitation.purpose.decidedAt === decision.at && invitation.contactId === decision.ownerContactId;
  }
  return decision.basis === 'owner-link-approval' && decision.invitationId === invitation.id;
}

/** **Token ⇒ ο πληρωτής.** Κάθε άλλη περίπτωση ⇒ ονομασμένη άρνηση (βλ. κεφαλίδα). */
export async function resolveAdvancePayer(db: Firestore, token: string, now: Date): Promise<PayerResolution> {
  const read = await readPayerLink(db, token, now);
  if (!('invitation' in read)) return read;
  const { invitation } = read;
  if (invitation.audience !== 'owner') return SUPERSEDED;
  const context = await readHostedIssuanceContext(db, invitation.companyId, invitation.assignmentId, now);
  if (context === 'unknown') return { kind: 'unavailable' };
  if (context === null) return SUPERSEDED;
  const record = issuanceRecordOf(context.assignment);
  if (!ownsCurrentDecision(record, context.latestIssuedOn, invitation)) return SUPERSEDED;
  if (!isAdvancePageLive(record, now.toISOString())) return { kind: 'refused', reason: 'expired' };
  const state = advanceStateOf(record);
  return state.kind === 'none' ? SUPERSEDED : { ok: true, payer: { invitation, context, record, state } };
}

/**
 * **Ο κάτοχος του κωδικού §29** για αυτόν τον σύνδεσμο: ο ίδιος, ή (σύνδεσμος προκαταβολής) η πρόσκληση του φακέλου.
 * Κάτοχος που δεν διαβάζεται ⇒ `null` (fail-closed: ο καλών απαντά `unavailable`, ποτέ «ο σύνδεσμος αρκεί»).
 */
export async function accessHolderOf(db: Firestore, invitation: IssuanceInvitation): Promise<IssuanceInvitation | null> {
  if (!isAdvanceLink(invitation)) return invitation;
  const holderId = invitation.purpose.codeHolderId;
  if (holderId === null || holderId === invitation.id) return invitation;
  const holder = parseIssuanceInvitation((await issuanceInvitationsCollection(db).doc(holderId).get()).data(), holderId);
  return holder !== null && holder.assignmentId === invitation.assignmentId ? holder : null;
}

export type PayerAccess = IssuanceAccessCheck | Unavailable;

/** **Ο κωδικός για αυτή την πράξη** — στον κάτοχό του (μία προσπάθεια, μετρά στο όριο του φακέλου). */
export async function checkPayerAccess(db: Firestore, invitation: IssuanceInvitation, attempt: string | null, nowIso: string): Promise<PayerAccess> {
  const holder = await accessHolderOf(db, invitation);
  return holder === null ? { kind: 'unavailable' } : checkIssuanceAccessCode(db, holder, attempt, nowIso);
}
