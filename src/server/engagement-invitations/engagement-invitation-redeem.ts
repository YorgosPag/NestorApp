import 'server-only';

/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΥΠΟΘΕΣΗΣ — Η ΠΛΕΥΡΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ**: αποδοχή (+ δήλωση ιδιότητας) · άρνηση.
 * @related ADR-901 Φ3 · §5.3 βήματα 6-9 · Ε-4 · ADR-853 §20 (κοινός πυρήνας) · ADR-862 §5.3
 * @module server/engagement-invitations/engagement-invitation-redeem
 *
 * 🔑 **Το είδος «συμμετοχή» πάνω στον κοινό πυρήνα.** Η κλειδαριά (υπογραφή · λήξη δύο φορές · nonce · δέσμευση
 * παραλήπτη στο email **του Auth** · απόδειξη γραμματοκιβωτίου · συναλλαγή που ξαναρωτά τα πάντα) είναι η **ίδια**
 * με τις προσκλήσεις χώρου/φωτογράφου. Εδώ ζουν μόνο:
 * - **πού** ζει η πρόσκληση: `engagement_invitations/{id}` (top-level — κανένας locator).
 * - **τι γράφει η αποδοχή**: μία **ενεργή** συμμετοχή στην υπόθεση, μέσω του ΕΝΟΣ γραφέα
 *   (`stageEngagementByInvitation`), στην **ίδια** συναλλαγή με το `pending → accepted`. Θέση πιασμένη ή υπόθεση
 *   κλειστή ⇒ ονομασμένη άρνηση, η πρόσκληση μένει `pending` (ο οικοδεσπότης αποφασίζει).
 *
 * ⛔ **Κανένας ρόλος χώρου, κανένα claim** (ADR-901 Α1): ο επαγγελματίας **δεν** γίνεται μέλος — βλέπει **μία** υπόθεση.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { stageEngagementByInvitation } from '@/lib/auth/engagement-write';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { declaredCredentialOf, type CredentialDeclarationInput } from '@/lib/conveyance/declared-credential';
import { engagementInvitationFromDocument } from '@/lib/conveyance/engagement-invitation-schema';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  redeemInvitation,
  type InvitationAcceptance,
  type InvitationKind,
  type InvitationLocator,
  type InvitationRedeemer,
  type InvitationRedeemOutcome,
  type InvitationResolution,
} from '@/server/invitations/invitation-redeem';
import { announceEngagementAnswered, announceInvitationDeclined } from '@/services/conveyance/conveyance-engagement-notifier';
import {
  acceptsEngagements,
  caseSubject,
  answerChanges,
  recordEngagementAudit,
} from '@/services/conveyance/conveyance-engagement-support';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { Engagement } from '@/types/engagement';
import type { EngagementInvitation, EngagementInvitationKindRefusal } from '@/types/engagement-invitation';
import type { InvitationDocumentCore } from '@/types/invitation-core';

import { ENGAGEMENT_INVITE_SECRET_ENV, engagementInvitationsCollection } from './engagement-invitation-issue';

const logger = createModuleLogger('engagement-invitation-redeem');

/** «Δεν μπόρεσα»: λείπει το μυστικό **μας**, ή οι συμμετοχές της υπόθεσης δεν διαβάζονται (fail-closed). */
export type EngagementInvitationUnavailable = 'secret-missing' | 'engagements-unreadable';

export type EngagementRedeemOutcome = InvitationRedeemOutcome<
  EngagementInvitation,
  EngagementInvitationKindRefusal,
  EngagementInvitationUnavailable,
  Engagement
>;

/**
 * **Πού ζει μια πρόσκληση υπόθεσης** — ο **ίδιος** εντοπισμός για όψη και εξαργύρωση.
 * `belongs` = πάντα: η top-level πρόσκληση δεν αλλάζει κάτοχο· η «ζωντάνια» της υπόθεσης κρίνεται στην αποδοχή.
 */
export const ENGAGEMENT_INVITATION_LOCATOR: InvitationLocator = {
  secretEnv: ENGAGEMENT_INVITE_SECRET_ENV,
  locatorCount: 0,
  locate: async (db, invitationId) => ({ ref: engagementInvitationsCollection(db).doc(invitationId), belongs: () => true }),
};

/** Το έγγραφο στο σχήμα του είδους — `null` ⇒ `invitation-corrupt`, **πριν** από κάθε γραφή. */
function recordOf(stored: InvitationDocumentCore, resolution: InvitationResolution): EngagementInvitation | null {
  const record = engagementInvitationFromDocument({ ...stored, ...resolution }, stored.id);
  if (record === null) logger.error('Πρόσκληση υπόθεσης που δεν διαβάζεται — δεν εξαργυρώνεται', { invitationId: stored.id });
  return record;
}

/** Ζει ακόμη η υπόθεση; — συμβουλευτικά πριν τη συναλλαγή (με τη **φάση** του ακινήτου), ξανά μέσα της. */
async function caseStillOpen(db: Firestore, record: EngagementInvitation): Promise<boolean> {
  const conveyanceCase = parseConveyanceCase((await db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(record.caseId).get()).data());
  if (!conveyanceCase || conveyanceCase.companyId !== record.hostCompanyId) return false;
  const context = await loadConveyanceSubject(db, record.hostCompanyId, record.propertyId);
  return acceptsEngagements(effectiveCaseState(conveyanceCase.storedState, context?.legalPhase));
}

async function stageAcceptance(
  db: Firestore,
  tx: Transaction,
  accepted: { readonly record: EngagementInvitation; readonly identity: InvitationRedeemer },
  credential: CredentialDeclarationInput,
): Promise<InvitationAcceptance<EngagementInvitationKindRefusal, EngagementInvitationUnavailable, Engagement>> {
  const { record, identity } = accepted;
  // 🔴 Η αποθηκευμένη κατάσταση ξαναρωτιέται **μέσα** στη συναλλαγή: κλείσιμο/ακύρωση είναι ρητές πράξεις.
  const conveyanceCase = parseConveyanceCase((await tx.get(db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(record.caseId))).data());
  if (!conveyanceCase || conveyanceCase.companyId !== record.hostCompanyId || !acceptsEngagements(conveyanceCase.storedState)) {
    return { kind: 'refused', reason: 'case-closed' };
  }
  // Η **ίδια** στιγμή με τη σφράγιση της πρόσκλησης (`resolvedAt` της επίλυσης) — ένα ρολόι ανά αποδοχή.
  const nowMs = Date.parse(record.resolvedAt ?? nowISO());
  const stage = await stageEngagementByInvitation(db, tx, {
    hostCompanyId: record.hostCompanyId, projectId: record.projectId, uid: identity.uid, email: identity.email,
    template: 'legal', role: record.role, subject: caseSubject(record.caseId),
    origin: { kind: 'professional_appointment', contactId: record.contactId },
    consents: record.consents, offeredBy: record.invitedByUid, nowMs,
    invitationId: record.id, declaredCredential: declaredCredentialOf(record.role, credential, new Date(nowMs).toISOString()),
  });
  if (stage.outcome === 'commit') return { kind: 'commit', write: stage.write };
  return stage.reason === 'unreadable'
    ? { kind: 'unavailable', reason: 'engagements-unreadable' }
    : { kind: 'refused', reason: stage.reason };
}

/** Το είδος — ανά αίτημα, γιατί η αποδοχή κουβαλά τη **δήλωση** του ανθρώπου. */
function engagementInvitationKind(
  db: Firestore,
  credential: CredentialDeclarationInput | null,
): InvitationKind<InvitationDocumentCore, EngagementInvitation, InvitationRedeemer, EngagementInvitationKindRefusal, EngagementInvitationUnavailable, Engagement> {
  return {
    ...ENGAGEMENT_INVITATION_LOCATOR,
    secretMissing: 'secret-missing',
    recordOf,
    prepareAcceptance: async (_identity, stored) => {
      const record = engagementInvitationFromDocument(stored, stored.id);
      return record !== null && !(await caseStillOpen(db, record)) ? { kind: 'refused', reason: 'case-closed' } : null;
    },
    onAccept: async (tx, accepted) => {
      // Η άρνηση δεν φτάνει ποτέ εδώ· η αποδοχή χωρίς δήλωση την έχει ήδη κόψει το σύνορο HTTP (zod).
      if (credential === null) throw new Error('Engagement invitation accepted without a credential declaration');
      return stageAcceptance(db, tx, accepted, credential);
    },
  };
}

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** ενεργή συμμετοχή, αδιαίρετα. Δύο ταυτόχρονα κλικ ⇒ **μία**
 * συμμετοχή (η δεύτερη συναλλαγή βρίσκει `accepted` ⇒ `already-used`).
 */
export function acceptEngagementInvitation(
  db: Firestore,
  input: { readonly token: string; readonly identity: InvitationRedeemer; readonly credential: CredentialDeclarationInput },
): Promise<EngagementRedeemOutcome> {
  return redeemInvitation(db, engagementInvitationKind(db, input.credential), {
    token: input.token, identity: input.identity, target: 'accepted', nowValue: nowISO(),
  });
}

/** **Άρνηση** («Δεν αναλαμβάνω») — ίδια κλειδαριά, καμία συμμετοχή· ο οικοδεσπότης ειδοποιείται από τον καλούντα. */
export function declineEngagementInvitation(
  db: Firestore,
  input: { readonly token: string; readonly identity: InvitationRedeemer },
): Promise<EngagementRedeemOutcome> {
  return redeemInvitation(db, engagementInvitationKind(db, null), {
    token: input.token, identity: input.identity, target: 'declined', nowValue: nowISO(),
  });
}

// =============================================================================
// ΑΠΑΝΤΗΣΗ + ΠΑΡΕΝΕΡΓΕΙΕΣ — ίχνος και ειδοποίηση του οικοδεσπότη
// =============================================================================

/**
 * **Η απάντηση του επαγγελματία, ολόκληρη**: εξαργύρωση (ατομική) → ίχνος στο βιβλίο του οικοδεσπότη (await —
 * ορθότητα) → ειδοποίηση του προσκαλούντος (ποτέ δεν πετά). Ε-5: «η άρνηση ειδοποιεί τον προσκαλούντα».
 */
export async function respondToEngagementInvitation(
  db: Firestore,
  input:
    | { readonly action: 'accept'; readonly token: string; readonly identity: InvitationRedeemer; readonly credential: CredentialDeclarationInput }
    | { readonly action: 'decline'; readonly token: string; readonly identity: InvitationRedeemer },
): Promise<EngagementRedeemOutcome> {
  const outcome = input.action === 'accept'
    ? await acceptEngagementInvitation(db, input)
    : await declineEngagementInvitation(db, input);
  if (outcome.kind !== 'accepted' && outcome.kind !== 'declined') return outcome;

  const invitation = outcome.invitation;
  const propertyName = (await loadConveyanceSubject(db, invitation.hostCompanyId, invitation.propertyId).catch(() => null))?.propertyName ?? null;
  if (outcome.kind === 'declined') {
    await announceInvitationDeclined(invitation, propertyName);
    return outcome;
  }
  const engagement = outcome.effect;
  await recordEngagementAudit({
    engagement, action: 'created', changes: answerChanges(null, engagement),
    performedBy: input.identity.uid, performedByName: input.identity.email, entityName: propertyName,
  });
  await announceEngagementAnswered(engagement, invitation.propertyId, propertyName);
  return outcome;
}
