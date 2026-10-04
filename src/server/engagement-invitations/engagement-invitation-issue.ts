import 'server-only';

/**
 * @fileoverview **ΠΡΟΣΚΛΗΣΗ ΥΠΟΘΕΣΗΣ — Η ΠΛΕΥΡΑ ΤΟΥ ΟΙΚΟΔΕΣΠΟΤΗ**: έκδοση (= επαναποστολή) · ανάκληση · οι προσκλήσεις των θέσεων.
 * @related ADR-901 Φ3 · §5.3 · Ε-5 · ADR-853 §20 (κοινός πυρήνας) · `engagement-invitation-redeem.ts` (ο επαγγελματίας)
 * @module server/engagement-invitations/engagement-invitation-issue
 *
 * 🔑 **Το τρίτο είδος της ΜΙΑΣ μηχανής** — ίδιο token, ίδιες αρνήσεις, ίδιο supersede με τις προσκλήσεις χώρου και
 * φωτογράφου. Εδώ ζει μόνο ό,τι είναι υπόθεσης: **μία** ζωντανή πρόσκληση **ανά θέση** (υπόθεση × ρόλος) — νέα
 * έκδοση ανακαλεί την προηγούμενη ατομικά, ακόμη κι αν άλλαξε το email της επαφής (το παλιό email δεν μένει με
 * έγκυρο σύνδεσμο). **Επαναποστολή = νέα έκδοση** (νέο token, νέα λήξη 14 ημερών, νέα υπενθύμιση).
 *
 * ⚠️ Ο καλών έχει **ήδη** κρίνει μισθωτή, δικαίωμα, κατάσταση υπόθεσης **και** συναινέσεις (Ε-3) — εδώ δεν
 * ξαναδιαβάζεται τίποτα από το αίτημα.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { engagementInvitationExpiryMs, engagementInvitationReminderDueAt } from '@/config/engagement-policy';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { engagementInvitationFromDocument } from '@/lib/conveyance/engagement-invitation-schema';
import { createModuleLogger } from '@/lib/telemetry';
import {
  presentedInvitationState,
  revokeInvitationAt,
  writeInvitationWithSupersede,
} from '@/server/invitations/invitation-lifecycle';
import { mintInvitationToken } from '@/server/invitations/invitation-token';
import { generateEngagementInvitationId } from '@/services/enterprise-id.service';
import { invitationHostSignal } from '@/services/conveyance/conveyance-view-signal.server';
import type { EngagementConsent } from '@/types/engagement';
import type { CaseInvitationSummary, CredentialHint, EngagementInvitation } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

const logger = createModuleLogger('engagement-invitation');

/**
 * ⚠️ **Δικό του μυστικό, ΠΟΤΕ κοινό** με τις προσκλήσεις χώρου/φωτογράφου: η υπογραφή δεν ξέρει σε ποια πύλη
 * ανήκει· με κοινό μυστικό, σύνδεσμος υπόθεσης θα διαβαζόταν ως πρόσκληση σε γραφείο (ADR-901 Α1).
 */
export const ENGAGEMENT_INVITE_SECRET_ENV = 'ENGAGEMENT_INVITE_SECRET';

/** Όσες προσκλήσεις μιας υπόθεσης διαβάζει η λίστα των θέσεων — φραγμένο ρητά (3 θέσεις × επαναποστολές). */
const CASE_SCAN_LIMIT = 100;

export function engagementInvitationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.ENGAGEMENT_INVITATIONS);
}

// =============================================================================
// 1. ΕΚΔΟΣΗ
// =============================================================================

export interface IssueEngagementInvitationInput {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly caseId: string;
  readonly propertyId: string;
  readonly role: LegalProfessionalRole;
  readonly contactId: string;
  readonly email: string;
  readonly consents: readonly EngagementConsent[];
  readonly credentialHint: CredentialHint;
  readonly actorUid: string;
  readonly nowMs: number;
}

export interface IssuedEngagementInvitation {
  readonly invitation: EngagementInvitation;
  /** Ωμό **μόνο εδώ και στο email** — στη βάση ζει μόνο το `sha256` του nonce. */
  readonly token: string;
  readonly supersededCount: number;
}

/** **Νέα πρόσκληση στη θέση** — γράφει το έγγραφο και ανακαλεί κάθε ζωντανή της ίδιας θέσης, ατομικά. */
export async function issueEngagementInvitation(
  db: Firestore,
  input: IssueEngagementInvitationInput,
): Promise<IssuedEngagementInvitation> {
  const { invitation, token } = await mintEngagementInvitation(input);
  const collection = engagementInvitationsCollection(db);
  // Μόνο ισότητες ⇒ κανένας σύνθετος δείκτης (οι μονοπεδικοί συγχωνεύονται).
  const liveQuery = collection
    .where('caseId', '==', input.caseId)
    .where('role', '==', input.role)
    .where('state', '==', 'pending');
  const supersededCount = await writeInvitationWithSupersede(db, {
    collection, invitation, liveQuery, actorUid: input.actorUid, nowValue: invitation.createdAt,
    observe: invitationHostSignal(db, invitation),
  });
  logger.info('Εκδόθηκε πρόσκληση υπόθεσης', { invitationId: invitation.id, caseId: input.caseId, role: input.role, supersededCount });
  return { invitation, token, supersededCount };
}

async function mintEngagementInvitation(
  input: IssueEngagementInvitationInput,
): Promise<{ readonly invitation: EngagementInvitation; readonly token: string }> {
  const id = generateEngagementInvitationId();
  const expiresAtMs = engagementInvitationExpiryMs(input.nowMs);
  // Χωρίς locator: top-level συλλογή, το id αρκεί για τον εντοπισμό.
  const { token, nonceHash } = await mintInvitationToken(ENGAGEMENT_INVITE_SECRET_ENV, { id, expiresAtMs, locator: [] });
  const createdAt = new Date(input.nowMs).toISOString();
  const invitation: EngagementInvitation = {
    id,
    inviteeEmail: normaliseChannelEmail(input.email),
    invitedByUid: input.actorUid,
    nonceHash,
    state: 'pending',
    createdAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
    mailboxProvenAt: null,
    hostCompanyId: input.hostCompanyId,
    projectId: input.projectId,
    caseId: input.caseId,
    propertyId: input.propertyId,
    role: input.role,
    contactId: input.contactId,
    consents: [...input.consents],
    credentialHint: input.credentialHint,
    reminderDueAt: engagementInvitationReminderDueAt(input.nowMs),
    reminderSentAt: null,
  };
  return { invitation, token };
}

// =============================================================================
// 2. ΟΙ ΠΡΟΣΚΛΗΣΕΙΣ ΤΗΣ ΥΠΟΘΕΣΗΣ · ΑΝΑΚΛΗΣΗ
// =============================================================================

/** Όλες οι αναγνώσιμες προσκλήσεις της υπόθεσης — **ξένη** υπόθεση (άλλος μισθωτής) ≡ καμία. */
async function readCaseInvitations(db: Firestore, hostCompanyId: string, caseId: string): Promise<readonly EngagementInvitation[]> {
  const snapshot = await engagementInvitationsCollection(db)
    .where('caseId', '==', caseId)
    .where('hostCompanyId', '==', hostCompanyId)
    .limit(CASE_SCAN_LIMIT)
    .get();
  return snapshot.docs
    .map((doc) => engagementInvitationFromDocument(doc.data(), doc.id))
    .filter((invitation): invitation is EngagementInvitation => invitation !== null);
}

/** Η **πιο πρόσφατη** πρόσκληση κάθε θέσης, όπως τη βλέπει ο οικοδεσπότης (η ληγμένη `pending` ⇒ `expired`). */
export async function latestCaseInvitations(
  db: Firestore,
  hostCompanyId: string,
  caseId: string,
  nowValue: string,
): Promise<ReadonlyMap<LegalProfessionalRole, CaseInvitationSummary>> {
  const latest = new Map<LegalProfessionalRole, EngagementInvitation>();
  for (const invitation of await readCaseInvitations(db, hostCompanyId, caseId)) {
    const current = latest.get(invitation.role);
    if (!current || invitation.createdAt > current.createdAt) latest.set(invitation.role, invitation);
  }
  return new Map([...latest].map(([role, invitation]) => [role, summaryOf(invitation, nowValue)]));
}

function summaryOf(invitation: EngagementInvitation, nowValue: string): CaseInvitationSummary {
  return {
    invitationId: invitation.id,
    state: presentedInvitationState(invitation, nowValue),
    inviteeEmail: invitation.inviteeEmail,
    sentAt: invitation.createdAt,
    openedAt: invitation.openedAt,
    expiresAt: invitation.expiresAt,
    resolvedAt: invitation.resolvedAt,
    reminderSentAt: invitation.reminderSentAt,
  };
}

/**
 * **Ανάκληση κάθε εκκρεμούς πρόσκλησης** της υπόθεσης (ή μίας θέσης της) — απόσυρση θέσης ή κλείσιμο υπόθεσης.
 * Ιδεμποτής: δεύτερη κλήση βρίσκει μηδέν `pending`. Επιστρέφει πόσες ανακλήθηκαν.
 */
export async function revokePendingCaseInvitations(
  db: Firestore,
  input: { readonly hostCompanyId: string; readonly caseId: string; readonly role: LegalProfessionalRole | null; readonly actorUid: string; readonly nowValue: string },
): Promise<number> {
  const pending = (await readCaseInvitations(db, input.hostCompanyId, input.caseId))
    .filter((invitation) => invitation.state === 'pending' && (input.role === null || invitation.role === input.role));
  const outcomes = await Promise.all(pending.map((invitation) => revokeInvitationAt(db, engagementInvitationsCollection(db).doc(invitation.id), {
    isOwned: (stored) => engagementInvitationFromDocument(stored, invitation.id)?.hostCompanyId === input.hostCompanyId,
    revokedByUid: input.actorUid,
    nowValue: input.nowValue,
    observe: invitationHostSignal(db, invitation),
  })));
  return outcomes.filter((outcome) => outcome.kind === 'revoked').length;
}
