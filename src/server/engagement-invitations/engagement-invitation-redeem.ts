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
import type { ActingWorkspaceRequest } from '@/lib/auth/acting-workspace';
import { stageEngagementByInvitation } from '@/lib/auth/engagement-write';
import type { ActiveWorkspace } from '@/lib/auth/workspace-membership';
import { acceptsEngagements, effectiveCaseState } from '@/lib/conveyance/case-state';
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
import { resolveActingFor } from '@/services/conveyance/conveyance-acting-workspace.server';
import { announceEngagementAnswered, announceInvitationDeclined } from '@/services/conveyance/conveyance-engagement-notifier';
import {
  caseSubject,
  answerChanges,
  recordEngagementAudit,
} from '@/services/conveyance/conveyance-engagement-support';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import { caseRosterSignal, invitationHostSignal } from '@/services/conveyance/conveyance-view-signal.server';
import type { Engagement } from '@/types/engagement';
import type { EngagementInvitation, EngagementInvitationKindRefusal } from '@/types/engagement-invitation';
import type { InvitationDocumentCore } from '@/types/invitation-core';
import type { WorkspaceRef } from '@/types/workspace-membership';

import { ENGAGEMENT_INVITE_SECRET_ENV, engagementInvitationsCollection } from './engagement-invitation-issue';

const logger = createModuleLogger('engagement-invitation-redeem');

/**
 * «Δεν μπόρεσα»: λείπει το μυστικό **μας**, οι συμμετοχές της υπόθεσης δεν διαβάζονται, ή **δεν μπόρεσα να ρωτήσω
 * τα γραφεία** του ανθρώπου (ADR-901 §15 Α43 — ποτέ σιωπηλά προσωπικός χώρος). Όλα fail-closed.
 */
export type EngagementInvitationUnavailable = 'secret-missing' | 'engagements-unreadable' | 'offices-unknown';

/** Ό,τι **δηλώνει** ο άνθρωπος στην αποδοχή: η ιδιότητά του (Ε-4) και ο χώρος για λογαριασμό του οποίου αναλαμβάνει (§15). */
interface AcceptanceDeclaration {
  readonly credential: CredentialDeclarationInput;
  readonly actingFor: WorkspaceRef;
}

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
  declaration: AcceptanceDeclaration,
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
    invitationId: record.id, declaredCredential: declaredCredentialOf(record.role, declaration.credential, new Date(nowMs).toISOString()),
    actingFor: declaration.actingFor,
  }, caseRosterSignal(db, conveyanceCase));
  if (stage.outcome === 'commit') return { kind: 'commit', write: stage.write };
  return stage.reason === 'unreadable'
    ? { kind: 'unavailable', reason: 'engagements-unreadable' }
    : { kind: 'refused', reason: stage.reason };
}

/** Το είδος — ανά αίτημα, γιατί η αποδοχή κουβαλά τη **δήλωση** του ανθρώπου. */
function engagementInvitationKind(
  db: Firestore,
  declaration: AcceptanceDeclaration | null,
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
      if (declaration === null) throw new Error('Engagement invitation accepted without a credential declaration');
      return stageAcceptance(db, tx, accepted, declaration);
    },
    // Η αποδοχή ενημερώνει τις όψεις μέσω του γραφέα συμμετοχών· η άρνηση αλλάζει μόνο τη θέση του οικοδεσπότη (§14.8).
    onDecline: (tx, record) => invitationHostSignal(db, record)(tx),
  };
}

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** ενεργή συμμετοχή, αδιαίρετα. Δύο ταυτόχρονα κλικ ⇒ **μία**
 * συμμετοχή (η δεύτερη συναλλαγή βρίσκει `accepted` ⇒ `already-used`).
 *
 * 🔑 ADR-901 §15 (Γ1) — ο κριτής της ιδιότητας τρέχει **πριν** από τη συναλλαγή (δεν είναι ανάγνωση συναλλαγής) και
 * το αποτέλεσμά του μπαίνει στο αίτημα του γραφέα. Ο **ίδιος** κριτής με το «Αναλαμβάνω»: ο νεογραμμένος δεν έχει
 * γραφείο (⇒ προσωρινά προσωπικός χώρος), ο **υπάρχων** λογαριασμός που πατά σύνδεσμο email μπορεί να έχει.
 */
export async function acceptEngagementInvitation(db: Firestore, input: EngagementInvitationAccept): Promise<EngagementRedeemOutcome> {
  const acting = await resolveActingFor({ uid: input.identity.uid, active: input.acting.active }, input.acting.requested);
  if (!acting.ok) {
    return acting.rejection === 'acting-unknown'
      ? { kind: 'unavailable', reason: 'offices-unknown' }
      : { kind: 'refused', reason: acting.rejection };
  }
  const declaration: AcceptanceDeclaration = { credential: input.credential, actingFor: acting.actingFor };
  return redeemInvitation(db, engagementInvitationKind(db, declaration), {
    token: input.token, identity: input.identity, target: 'accepted', nowValue: nowISO(),
  });
}

/** Η αποδοχή όπως φτάνει από το σύνορο: σύνδεσμος · λογαριασμός **του Auth** · δήλωση ιδιότητας · αίτημα χώρου. */
export interface EngagementInvitationAccept {
  readonly token: string;
  readonly identity: InvitationRedeemer;
  readonly credential: CredentialDeclarationInput;
  /** §15 — ο χώρος γραφείου του αιτήματος (από το token) και ό,τι **ζήτησε** ο άνθρωπος (αναξιόπιστο). */
  readonly acting: { readonly active: ActiveWorkspace | null; readonly requested: ActingWorkspaceRequest | null };
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
    | ({ readonly action: 'accept' } & EngagementInvitationAccept)
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
