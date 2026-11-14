import 'server-only';

/**
 * @fileoverview **Ο ΟΙΚΟΔΕΣΠΟΤΗΣ ΤΗΣ ΑΝΑΘΕΣΗΣ ΕΚΔΟΣΗΣ** — ό,τι απαντά η ανάθεση (π.χ. ΠΕΑ) στη μηχανή συμμετοχής.
 * @related ADR-915 §39 (γέφυρα «Αναλαμβάνω» → χώρος) · ADR-862 §5.3.11 (μητρώο οικοδεσποτών) · §5.3.10 (πυρήνας)
 * @module services/document-registry/issuance-engagement-host-adapter
 *
 * 🔑 **Ο χώρος ζει όσο η ανάθεση είναι αναληφθείσα** (`accepted`): ακύρωση από το γραφείο ⇒ καμία νέα είσοδος (η
 *    αποδοχή της πρόσκλησης αρνείται `case-closed`, το ίδιο λεξιλόγιο με τη μεταβίβαση).
 * 🔑 **Το μητρώο το παράγει το προσόν** (`qualificationRegistryAuthority`): ενεργειακός επιθεωρητής ⇒ ΥΠΕΝ (εθνικό,
 *    χωρίς σύλλογο). Ο άνθρωπος δηλώνει μόνο αριθμό.
 * 🔒 **Ε-9′**: η όψη του επαγγελματία **δεν** φέρει τηλέφωνο ή email του γραφείου — μόνο ονόματα και γεγονότα.
 * ⚠️ **Χωρίς ζωντανή όψη στο μητρώο λήξεων**: η κάρτα του γραφείου ξαναδιαβάζεται στο άνοιγμα/ανανέωση (δεν υπάρχει
 *    υποδομή σήματος όψεων εκεί — ADR-915 §39). Το σήμα του γραφέα είναι γι' αυτό **ρητά** άδειο, όχι ξεχασμένο.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { qualificationRegistryAuthority } from '@/config/document-validity/document-issuers';
import { COLLECTIONS } from '@/config/firestore-collections';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { selectCurrentEngagement } from '@/lib/auth/engagement-read';
import type { EngagementRosterSignal } from '@/lib/auth/engagement-write';
import { ballInCourtOf, issuanceStageOf, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import type {
  EngagedViewOutcome,
  EngagementHostAdapter,
  InvitationAnswer,
  InvitationAnswerer,
} from '@/server/engagements/engagement-host-adapter';
import { announceIssuanceAnswer, type IssuanceSpaceEvent } from '@/server/issuance-invitations/issuance-answer-notifier';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { actingViews, type ActingViews } from '@/services/conveyance/conveyance-acting-workspace.server';
import { placementRejectionOf, shownIn, type CasesViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import { answerChanges, recordEngagementAudit } from '@/services/conveyance/conveyance-engagement-support';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { EngagementHostLine } from '@/types/contact-professional-link';
import { SCOPE_OF_SUBJECT, type IssuanceEngagement } from '@/types/engagement';
import type { IssuanceEngagementInvitation } from '@/types/engagement-invitation';
import type { MyIssuanceCard } from '@/types/my-engagements';
import { parseIssuanceAssignment, type DocumentIssuanceAssignment } from './issuance-assignment-schema';

/** Το στάδιο όπου ο χώρος δέχεται είσοδο — μετά το «Αναλαμβάνω», πριν από ακύρωση/παράδοση. */
const SPACE_OPEN_STAGE: IssuanceStage = 'accepted';

/** Ο γραφέας συμμετοχών απαιτεί σήμα· το μητρώο λήξεων δεν έχει ζωντανή όψη (βλ. κεφαλίδα) ⇒ ρητά κανένα έγγραφο-σήμα. */
const NO_LIVE_VIEW: EngagementRosterSignal = () => undefined;

/** Χωρίς γραφέα σήματος, η αναθεώρηση του χώρου δεν αλλάζει ποτέ — ρητή σταθερά, όχι «ξεχασμένο 0». */
const NO_SIGNAL_REVISION = 0;

function assignmentRef(db: Firestore, assignmentId: string) {
  return db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS).doc(assignmentId);
}

/** Η ανάθεση — **μόνο** αν ανήκει στον μισθωτή, στο ακίνητο και στο είδος της πρόσκλησης/συμμετοχής (ξένη ≡ ανύπαρκτη). */
function ownAssignment(
  raw: unknown,
  expected: { readonly hostCompanyId: string; readonly assignmentId: string },
): DocumentIssuanceAssignment | null {
  const assignment = parseIssuanceAssignment(raw);
  return assignment && assignment.companyId === expected.hostCompanyId && assignment.id === expected.assignmentId ? assignment : null;
}

/** Ο χώρος δέχεται είσοδο: ίδιο ακίνητο, ίδιο είδος, και η ανάθεση είναι **ακόμη** αναληφθείσα. */
function spaceAccepts(assignment: DocumentIssuanceAssignment | null, invitation: IssuanceEngagementInvitation): boolean {
  if (!assignment || assignment.propertyId !== invitation.propertyId || assignment.documentKind !== invitation.documentKind) return false;
  return issuanceStageOf(assignment) === SPACE_OPEN_STAGE;
}

async function readAssignment(db: Firestore, hostCompanyId: string, assignmentId: string): Promise<DocumentIssuanceAssignment | null> {
  return ownAssignment((await assignmentRef(db, assignmentId).get()).data(), { hostCompanyId, assignmentId });
}

function expectedOf(invitation: IssuanceEngagementInvitation) {
  return { hostCompanyId: invitation.hostCompanyId, assignmentId: invitation.subject.assignmentId };
}

async function stillOpen(db: Firestore, invitation: IssuanceEngagementInvitation): Promise<boolean> {
  return spaceAccepts(await readAssignment(db, invitation.hostCompanyId, invitation.subject.assignmentId), invitation);
}

/** 🔴 Ο **ίδιος** έλεγχος μέσα στη συναλλαγή: ακύρωση από το γραφείο ανάμεσα στο κλικ και τη σφράγιση ⇒ καμία είσοδος. */
async function stageOpen(db: Firestore, tx: Transaction, invitation: IssuanceEngagementInvitation): Promise<EngagementRosterSignal | null> {
  const assignment = ownAssignment((await tx.get(assignmentRef(db, invitation.subject.assignmentId))).data(), expectedOf(invitation));
  return spaceAccepts(assignment, invitation) ? NO_LIVE_VIEW : null;
}

async function propertyNameOf(db: Firestore, hostCompanyId: string, propertyId: string): Promise<string | null> {
  return (await loadConveyanceSubject(db, hostCompanyId, propertyId).catch(() => null))?.propertyName ?? null;
}

async function hostNameOf(hostCompanyId: string): Promise<string | null> {
  return readWorkspaceName(hostCompanyId).then(trimmedStringOrNull, () => null);
}

/** Το όνομα της επαφής **στο βιβλίο του γραφείου** — για τις ειδοποιήσεις του γραφείου, ποτέ για τον επαγγελματία. */
export async function contactNameOf(db: Firestore, hostCompanyId: string, contactId: string): Promise<string | null> {
  const docs = await readOwnedContactDocs(db, hostCompanyId, [contactId]).catch(() => null);
  const data = docs?.get(contactId);
  return data ? trimmedStringOrNull(extractContactDisplayName(data)) : null;
}

/** Η **μία** περιγραφή της πρόσκλησης ανάθεσης — για την όψη (`describe` του οικοδεσπότη) **και** το email της. */
export async function describeIssuanceInvitation(db: Firestore, invitation: IssuanceEngagementInvitation) {
  const [propertyLabel, hostName] = await Promise.all([
    propertyNameOf(db, invitation.hostCompanyId, invitation.propertyId),
    hostNameOf(invitation.hostCompanyId),
  ]);
  return { propertyLabel, hostName, subject: { kind: 'document_issuance', documentKind: invitation.documentKind } } as const;
}

/** Η ειδοποίηση του γραφείου — όποιος πρότεινε + όποιος έστειλε. Ανάθεση που δεν διαβάζεται ⇒ σιωπή με ίχνος στο log του notifier. */
async function announceSpace(db: Firestore, invitation: IssuanceEngagementInvitation, event: IssuanceSpaceEvent): Promise<void> {
  const assignment = await readAssignment(db, invitation.hostCompanyId, invitation.subject.assignmentId);
  if (!assignment) return;
  const sentBy = assignment.notice?.byUid;
  const [propertyName, respondentName] = await Promise.all([
    propertyNameOf(db, invitation.hostCompanyId, invitation.propertyId),
    contactNameOf(db, invitation.hostCompanyId, invitation.contactId),
  ]);
  await announceIssuanceAnswer({
    companyId: invitation.hostCompanyId, assignmentId: assignment.id, invitationId: invitation.id, answer: event,
    recipientUids: [assignment.proposedByUid, ...(sentBy === undefined ? [] : [sentBy])], propertyName, respondentName,
  });
}

async function afterAnswer(db: Firestore, invitation: IssuanceEngagementInvitation, answer: InvitationAnswer, answerer: InvitationAnswerer): Promise<void> {
  if (answer.kind === 'accepted') {
    await recordEngagementAudit({
      engagement: answer.engagement, action: 'created', changes: answerChanges(null, answer.engagement),
      performedBy: answerer.uid, performedByName: answerer.email,
      entityName: await propertyNameOf(db, invitation.hostCompanyId, invitation.propertyId),
    });
  }
  await announceSpace(db, invitation, answer.kind === 'accepted' ? 'space-entered' : 'space-declined');
}

// =============================================================================
// Η ΠΛΕΥΡΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ
// =============================================================================

function judge(engagement: IssuanceEngagement, uid: string, nowMs: number) {
  return decideEngagement({ engagement, uid, subject: engagement.subject, scope: SCOPE_OF_SUBJECT.document_issuance, nowMs });
}

async function cardOf(db: Firestore, engagement: IssuanceEngagement, uid: string, nowMs: number, acting: ActingViews): Promise<MyIssuanceCard> {
  const [assignment, hostName, actingFor] = await Promise.all([
    readAssignment(db, engagement.hostCompanyId, engagement.subject.assignmentId),
    hostNameOf(engagement.hostCompanyId),
    acting.actingFor(engagement),
  ]);
  // Ποιο ακίνητο — ναι (για να αναγνωρίσει την ανάθεση)· περιεχόμενο — όχι, όπως και στη μεταβίβαση.
  const propertyName = assignment ? await propertyNameOf(db, engagement.hostCompanyId, assignment.propertyId) : null;
  const stage = assignment ? issuanceStageOf(assignment) : null;
  return {
    kind: 'document_issuance',
    engagementId: engagement.id,
    engagementState: engagement.state,
    verdict: judge(engagement, uid, nowMs).verdict,
    offeredAt: engagement.offeredAt,
    expiresAt: engagement.expiresAt,
    hostName,
    propertyName,
    documentKind: assignment?.documentKind ?? null,
    stage,
    ballInCourt: stage ? ballInCourtOf(stage) : null,
    actingFor,
  };
}

async function listCards(db: Firestore, viewer: CasesViewer, history: readonly IssuanceEngagement[], nowMs: number) {
  const acting = actingViews(viewer);
  const byAssignment = new Map<string, IssuanceEngagement[]>();
  for (const e of history) byAssignment.set(e.subject.assignmentId, [...(byAssignment.get(e.subject.assignmentId) ?? []), e]);
  const candidates = [...byAssignment.values()]
    .map((engagements) => selectCurrentEngagement(engagements).engagement)
    .filter((e): e is IssuanceEngagement => e !== null);
  const current = await shownIn(candidates, viewer.viewed, acting);
  if (current === 'unknown') return 'unknown' as const;
  return Promise.all(current.map((e) => cardOf(db, e, viewer.uid, nowMs, acting)));
}

async function view(db: Firestore, viewer: CasesViewer, engagement: IssuanceEngagement, nowMs: number): Promise<EngagedViewOutcome> {
  const decision = judge(engagement, viewer.uid, nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const misplaced = await placementRejectionOf(viewer, engagement);
  if (misplaced !== null) return misplaced;
  const assignment = await readAssignment(db, engagement.hostCompanyId, engagement.subject.assignmentId);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const [propertyName, hostName] = await Promise.all([
    propertyNameOf(db, engagement.hostCompanyId, assignment.propertyId),
    hostNameOf(engagement.hostCompanyId),
  ]);
  const stage = issuanceStageOf(assignment);
  return {
    ok: true,
    view: {
      kind: 'document_issuance',
      engagementId: engagement.id,
      hostName,
      propertyName,
      documentKind: assignment.documentKind,
      stage,
      ballInCourt: ballInCourtOf(stage),
      credential: engagement.declaredCredential ?? null,
      proposedAt: assignment.proposedAt,
      freshness: { revision: NO_SIGNAL_REVISION, freshUntil: nextConveyanceDayStart(new Date(nowMs)).toISOString() },
    },
  };
}

/** ADR-915 §40 — η γραμμή «Ανέλαβε» στην επαφή του γραφείου: ποιο ακίνητο, ποιο έγγραφο. */
async function hostLine(db: Firestore, engagement: IssuanceEngagement): Promise<EngagementHostLine> {
  const assignment = await readAssignment(db, engagement.hostCompanyId, engagement.subject.assignmentId).catch(() => null);
  if (!assignment) return { propertyName: null, documentKind: null };
  return { propertyName: await propertyNameOf(db, engagement.hostCompanyId, assignment.propertyId), documentKind: assignment.documentKind };
}

export const ISSUANCE_ENGAGEMENT_HOST: EngagementHostAdapter<IssuanceEngagementInvitation, IssuanceEngagement> = {
  invitationSignal: () => () => undefined,
  stillOpen,
  stageOpen,
  credentialAuthority: (invitation) => qualificationRegistryAuthority(invitation.qualification),
  describe: describeIssuanceInvitation,
  afterAnswer,
  announceUnanswered: (db, invitation) => announceSpace(db, invitation, 'space-pending'),
  listCards,
  view,
  hostLine,
};
