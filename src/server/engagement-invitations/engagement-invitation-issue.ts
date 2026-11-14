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

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { engagementInvitationExpiryMs, engagementInvitationReminderDueAt } from '@/config/engagement-policy';
import { engagementInvitationFromDocument, engagementInvitationToDocument } from '@/lib/auth/engagement-invitation-schema';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { createModuleLogger } from '@/lib/telemetry';
import { invitationSignalOf } from '@/server/engagements/engagement-hosts';
import {
  presentedInvitationState,
  revokeInvitationAt,
  stageInvitationWithSupersede,
  writeInvitationWithSupersede,
} from '@/server/invitations/invitation-lifecycle';
import { mintInvitationToken } from '@/server/invitations/invitation-token';
import { generateEngagementInvitationId } from '@/services/enterprise-id.service';
import type {
  ConveyanceEngagementSubject,
  EngagementConsent,
  IssuanceEngagementRole,
  IssuanceEngagementSubject,
} from '@/types/engagement';
import {
  isConveyanceInvitation,
  isIssuanceInvitation,
  type CaseInvitationSummary,
  type ConveyanceEngagementInvitation,
  type IssuanceEngagementInvitation,
  type CredentialHint,
  type EngagementInvitation,
} from '@/types/engagement-invitation';
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

/** Τα κοινά της έκδοσης, όποιου είδους υπόθεσης. */
interface IssueEngagementInvitationBase {
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly propertyId: string;
  readonly contactId: string;
  readonly email: string;
  readonly consents: readonly EngagementConsent[];
  readonly credentialHint: CredentialHint;
  readonly actorUid: string;
  readonly nowMs: number;
}

/**
 * Η θέση της πρόσκλησης — **ποια υπόθεση, ποιος ρόλος** (ADR-862 §5.3.11). Διακριτή ένωση: το ζεύγος υπόθεσης/ρόλου
 * και ό,τι ζητά το είδος (η ανάθεση έκδοσης: είδος εγγράφου + προσόν) δεν μπορούν να αναμιχθούν.
 */
export type IssueEngagementInvitationInput = IssueEngagementInvitationBase & (
  | { readonly subject: ConveyanceEngagementSubject; readonly role: LegalProfessionalRole }
  | {
      readonly subject: IssuanceEngagementSubject;
      readonly role: IssuanceEngagementRole;
      readonly documentKind: DocumentKind;
      readonly qualification: IssuerQualification;
    }
);

export interface IssuedEngagementInvitation {
  readonly invitation: EngagementInvitation;
  /** Ωμό **μόνο εδώ και στο email** — στη βάση ζει μόνο το `sha256` του nonce. */
  readonly token: string;
  readonly supersededCount: number;
}

/**
 * Οι **ζωντανές** προσκλήσεις της ίδιας θέσης — αυτές που ανακαλεί η νέα έκδοση. Μόνο ισότητες ⇒ κανένας σύνθετος
 * δείκτης (οι μονοπεδικοί συγχωνεύονται). Το πεδίο-κλειδί διαφέρει ανά είδος, όπως στη συμμετοχή (`engagement-ref.ts`).
 */
function liveSlotQuery(db: Firestore, input: Pick<IssueEngagementInvitationInput, 'subject' | 'role'>) {
  const collection = engagementInvitationsCollection(db);
  const bySubject = input.subject.kind === 'conveyance_case'
    ? collection.where('caseId', '==', input.subject.caseId)
    : collection.where('subject.assignmentId', '==', input.subject.assignmentId);
  return bySubject.where('role', '==', input.role).where('state', '==', 'pending');
}

/** **Νέα πρόσκληση στη θέση** — γράφει το έγγραφο και ανακαλεί κάθε ζωντανή της ίδιας θέσης, ατομικά. */
export async function issueEngagementInvitation(
  db: Firestore,
  input: IssueEngagementInvitationInput,
): Promise<IssuedEngagementInvitation> {
  const { invitation, token } = await mintEngagementInvitation(input);
  const supersededCount = await writeInvitationWithSupersede(db, {
    collection: engagementInvitationsCollection(db), invitation: engagementInvitationToDocument(invitation),
    liveQuery: liveSlotQuery(db, input), actorUid: input.actorUid, nowValue: invitation.createdAt,
    observe: invitationSignalOf(db, invitation),
  });
  logger.info('Εκδόθηκε πρόσκληση συμμετοχής', { invitationId: invitation.id, subject: input.subject.kind, role: input.role, supersededCount });
  return { invitation, token, supersededCount };
}

/**
 * **Η ίδια έκδοση, ΜΕΣΑ σε συναλλαγή του καλούντα** (ADR-915 §39): το «Αναλαμβάνω» της ανάθεσης και η πρόσκληση σε
 * λογαριασμό γράφονται **αδιαίρετα**. Οι αναγνώσεις (ζωντανές της θέσης) γίνονται **εδώ**· το `commit()` γράφει, και
 * ο καλών το καλεί **μετά** από κάθε δική του ανάγνωση (κανόνας Firestore). Το token κόβεται **πριν** (καθαρή κρυπτογραφία).
 */
export async function stageEngagementInvitation(
  db: Firestore,
  tx: Transaction,
  input: IssueEngagementInvitationInput,
): Promise<{ readonly issued: Omit<IssuedEngagementInvitation, 'supersededCount'>; commit(): void }> {
  const issued = await mintEngagementInvitation(input);
  const staged = await stageInvitationWithSupersede(tx, {
    collection: engagementInvitationsCollection(db), invitation: engagementInvitationToDocument(issued.invitation),
    liveQuery: liveSlotQuery(db, input), actorUid: input.actorUid, nowValue: issued.invitation.createdAt,
  });
  return {
    issued,
    commit: () => {
      staged.commit();
      invitationSignalOf(db, issued.invitation)(tx);
    },
  };
}

async function mintEngagementInvitation(
  input: IssueEngagementInvitationInput,
): Promise<{ readonly invitation: EngagementInvitation; readonly token: string }> {
  const id = generateEngagementInvitationId();
  const expiresAtMs = engagementInvitationExpiryMs(input.nowMs);
  // Χωρίς locator: top-level συλλογή, το id αρκεί για τον εντοπισμό.
  const { token, nonceHash } = await mintInvitationToken(ENGAGEMENT_INVITE_SECRET_ENV, { id, expiresAtMs, locator: [] });
  const createdAt = new Date(input.nowMs).toISOString();
  const base = {
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
    propertyId: input.propertyId,
    contactId: input.contactId,
    consents: [...input.consents],
    credentialHint: input.credentialHint,
    reminderDueAt: engagementInvitationReminderDueAt(input.nowMs),
    reminderSentAt: null,
  } as const;
  // Η ένωση εισόδου στενεύει με το πεδίο που έχει **μόνο** η ανάθεση (`documentKind`) — κανένα `as`.
  const invitation: EngagementInvitation = 'documentKind' in input
    ? { ...base, subject: input.subject, role: input.role, documentKind: input.documentKind, qualification: input.qualification }
    : { ...base, subject: input.subject, caseId: input.subject.caseId, role: input.role };
  return { invitation, token };
}

// =============================================================================
// 2. ΟΙ ΠΡΟΣΚΛΗΣΕΙΣ ΤΗΣ ΥΠΟΘΕΣΗΣ · ΑΝΑΚΛΗΣΗ
// =============================================================================

/** Όλες οι αναγνώσιμες προσκλήσεις της υπόθεσης — **ξένη** υπόθεση (άλλος μισθωτής) ≡ καμία. */
async function readCaseInvitations(db: Firestore, hostCompanyId: string, caseId: string): Promise<readonly ConveyanceEngagementInvitation[]> {
  const snapshot = await engagementInvitationsCollection(db)
    .where('caseId', '==', caseId)
    .where('hostCompanyId', '==', hostCompanyId)
    .limit(CASE_SCAN_LIMIT)
    .get();
  return snapshot.docs
    .map((doc) => engagementInvitationFromDocument(doc.data(), doc.id))
    .filter((invitation): invitation is ConveyanceEngagementInvitation => invitation !== null && isConveyanceInvitation(invitation));
}

/** Η **πιο πρόσφατη** πρόσκληση κάθε θέσης, όπως τη βλέπει ο οικοδεσπότης (η ληγμένη `pending` ⇒ `expired`). */
export async function latestCaseInvitations(
  db: Firestore,
  hostCompanyId: string,
  caseId: string,
  nowValue: string,
): Promise<ReadonlyMap<LegalProfessionalRole, CaseInvitationSummary>> {
  const latest = new Map<LegalProfessionalRole, ConveyanceEngagementInvitation>();
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

/** Όσες προσκλήσεις χώρου αναθέσεων διαβάζει το μητρώο λήξεων ενός γραφείου — φραγμένο ρητά, ποτέ σιωπηλά. */
const ISSUANCE_SPACE_SCAN_LIMIT = 500;

/** Η πιο πρόσφατη πρόσκληση χώρου κάθε ανάθεσης, όπως τη βλέπει το γραφείο — με το κλειδί της γραμμής του μητρώου. */
export interface IssuanceSpaceInvitationSummary extends CaseInvitationSummary {
  readonly assignmentId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

/**
 * ADR-915 §39 — **οι προσκλήσεις χώρου των αναθέσεων του γραφείου**, η πιο πρόσφατη ανά ανάθεση (η ληγμένη `pending` ⇒
 * `expired`). **Ένα** ερώτημα μόνο με ισότητες (`hostCompanyId` · `subject.kind`) ⇒ κανένας σύνθετος δείκτης. Ξένος
 * μισθωτής ≡ καμία. `truncated` ⇒ το όριο χτυπήθηκε — ο καλών το λέει, ποτέ σιωπηλό «καμία».
 */
export async function latestIssuanceSpaceInvitations(
  db: Firestore,
  hostCompanyId: string,
  nowValue: string,
): Promise<{ readonly byAssignment: ReadonlyMap<string, IssuanceSpaceInvitationSummary>; readonly truncated: boolean }> {
  const snapshot = await engagementInvitationsCollection(db)
    .where('hostCompanyId', '==', hostCompanyId)
    .where('subject.kind', '==', 'document_issuance')
    .limit(ISSUANCE_SPACE_SCAN_LIMIT)
    .get();
  const latest = new Map<string, IssuanceEngagementInvitation>();
  for (const doc of snapshot.docs) {
    const invitation = engagementInvitationFromDocument(doc.data(), doc.id);
    if (invitation === null || !isIssuanceInvitation(invitation) || invitation.hostCompanyId !== hostCompanyId) continue;
    const current = latest.get(invitation.subject.assignmentId);
    if (!current || invitation.createdAt > current.createdAt) latest.set(invitation.subject.assignmentId, invitation);
  }
  const byAssignment = new Map([...latest].map(([assignmentId, invitation]) => [assignmentId, {
    ...summaryOf(invitation, nowValue),
    assignmentId,
    propertyId: invitation.propertyId,
    documentKind: invitation.documentKind,
  }]));
  return { byAssignment, truncated: snapshot.size === ISSUANCE_SPACE_SCAN_LIMIT };
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
    observe: invitationSignalOf(db, invitation),
  })));
  return outcomes.filter((outcome) => outcome.kind === 'revoked').length;
}
