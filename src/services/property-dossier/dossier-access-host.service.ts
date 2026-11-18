import 'server-only';

/**
 * @fileoverview **«ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟΝ ΦΑΚΕΛΟ ΜΟΥ;» — Η ΠΛΕΥΡΑ ΤΟΥ ΚΑΤΟΧΟΥ** (ADR-916 Φ-Ε1 Σ2): θέσεις · πρόσκληση ·
 *    ακύρωση πρόσκλησης · ανάκληση · ανανέωση · αλλαγή εύρους.
 * @module services/property-dossier/dossier-access-host.service
 * @related `services/conveyance/conveyance-engagement-host.service.ts` (ο αδελφός της μεταβίβασης — ίδιο σχήμα θέσεων) ·
 *          `server/engagement-invitations/engagement-invitation-issue.ts` (η ΜΙΑ μηχανή πρόσκλησης) ·
 *          `lib/auth/engagement-write.ts` (ο ΕΝΑΣ γραφέας μεταβάσεων) · `dossier-engagement-host-adapter.ts` (ο οικοδεσπότης)
 *
 * 🔑 **Καμία δεύτερη μηχανή**: έκδοση = `issueEngagementInvitation`, ακύρωση = `revokeDossierInvitation`, πράξεις =
 *    `transitionEngagement` (`end` · `renew` · `reach`). Εδώ ζει **μόνο** η κρίση κατοχής και το ίχνος του κατόχου.
 * 🔴 **Ο κάτοχος = ο αιτών, ποτέ το σώμα**. Ξένος ≡ ανύπαρκτος (ίδιο 404) — ποτέ «υπάρχει, αλλά όχι δικός σου».
 * 🔴 **Ίχνος στο Ιστορικό του ΦΑΚΕΛΟΥ** (προσωπικό βιβλίο του κατόχου, ADR-195): πρόσκληση **και** πράξεις, με λέξεις
 *    (`dossier-access-audit.ts` — ο ΕΝΑΣ γραφέας της πρόσβασης).
 *
 * ⚠️ **Δηλωμένα όρια (όχι παραλείψεις)**:
 * - Η αλλαγή ισχύει στο **επόμενο** άνοιγμα (ο κριτής κρίνει σε κάθε ανάγνωση)· ο επαγγελματίας τη μαθαίνει με
 *   ειδοποίηση (`dossier-engagement-notifier.ts`, Σ4) — ό,τι κατέβηκε ήδη **δεν** ανακαλείται.
 * - Η κρίση κατοχής πριν από τη μετάβαση **δεν** επαναλαμβάνεται μέσα στη συναλλαγή του γραφέα: η συμμετοχή ζει **κάτω**
 *   από τον φάκελο (η διαδρομή τη δένει), και η αλλαγή κατόχου κόβει ήδη κάθε πρόσβαση (ADR-866 Φ4).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { selectCurrentEngagement } from '@/lib/auth/engagement-read';
import { dossierEngagementsCollection, engagementsForSubjectQuery } from '@/lib/auth/engagement-ref';
import { parseEngagement } from '@/lib/auth/engagement-schema';
import { transitionEngagement, type EngagementTransition } from '@/lib/auth/engagement-write';
import type { DossierEngagementChangeRequest, DossierInvitationRequest } from '@/lib/property-dossier/dossier-access-request-schema';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import {
  issueEngagementInvitation,
  latestDossierInvitations,
  revokeDossierInvitation,
} from '@/server/engagement-invitations/engagement-invitation-issue';
import { notifyEngagementInvitation } from '@/server/engagement-invitations/engagement-invitation-notice';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type { DossierAccessResponse, DossierAccessSlot, DossierEngagementSummary } from '@/types/dossier-access';
import {
  DOSSIER_ENGAGEMENT_ROLES,
  LIVE_ENGAGEMENT_STATES,
  isDossierEngagement,
  type DossierEngagement,
  type DossierEngagementRole,
  type Engagement,
} from '@/types/engagement';
import type { PropertyDossier } from '@/types/property-dossier';
import {
  dossierAccessChanges,
  recordDossierAccessChanged,
  recordDossierInvitationAudit,
  touchedExclusions,
} from './dossier-access-audit';
import { NO_LIVE_VIEW, dossierFilesWithin, judgeDossierEngagement } from './dossier-engagement-host-adapter';
import { announceDossierAccessChanged, type DossierOwnerChange } from './dossier-engagement-notifier';
import { FULL_DOSSIER_REACH } from './dossier-share-reach';

/** Όσες συμμετοχές ενός φακέλου διαβάζει η όψη του κατόχου — φραγμένο ρητά (2 ρόλοι × ιστορικό). */
const DOSSIER_ENGAGEMENT_SCAN_LIMIT = 100;

/** Ο δρών κάτοχος — από το σύνορο αυθεντικοποίησης, ποτέ από το σώμα. */
export interface DossierOwnerActor {
  readonly uid: string;
  readonly email: string;
}

/**
 * **Ο φάκελος, αν είναι ΔΙΚΟΣ σου** — ανύπαρκτος ή ξένος ⇒ `null` (η πόρτα απαντά το ίδιο 404 και στα δύο). Η κρίση
 * κατοχής = ο ΕΝΑΣ κριτής `isOwnedByCustody` (ίδιος με τον γραφέα του φακέλου· αρνείται και κενό `uid`).
 */
export async function readOwnedDossier(db: Firestore, dossierId: string, ownerUid: string): Promise<PropertyDossier | null> {
  const data = (await db.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(dossierId).get()).data();
  return isOwnedByCustody(data, { userId: ownerUid }) ? propertyDossierFromDocument(data, dossierId) : null;
}

// =============================================================================
// ΟΙ ΘΕΣΕΙΣ
// =============================================================================

/**
 * Οι συμμετοχές του φακέλου που πρότεινε ο **σημερινός** κάτοχος. Οι μη αναγνώσιμες παραλείπονται: δεν δίνουν
 * πρόσβαση (ο κριτής τις αρνείται) — ίδια αρχή με το `listCaseEngagements`.
 */
async function listDossierEngagements(db: Firestore, dossier: PropertyDossier): Promise<DossierEngagement[]> {
  const subject = { kind: 'property_dossier', dossierId: dossier.id } as const;
  const snapshot = await engagementsForSubjectQuery(dossierEngagementsCollection(db, dossier.id), subject)
    .limit(DOSSIER_ENGAGEMENT_SCAN_LIMIT)
    .get();
  return snapshot.docs
    .map((doc) => parseEngagement(doc.data()))
    .filter((e): e is Engagement => e !== null)
    .filter(isDossierEngagement)
    .filter((e) => e.offeredBy === dossier.userId);
}

function engagementSummaryOf(engagement: DossierEngagement, nowMs: number): DossierEngagementSummary {
  return {
    engagementId: engagement.id,
    role: engagement.role,
    state: engagement.state,
    verdict: judgeDossierEngagement(engagement, engagement.uid, nowMs).verdict,
    email: engagement.email,
    reach: engagement.reach,
    shareDays: engagement.shareDays,
    offeredAt: engagement.offeredAt,
    respondedAt: engagement.respondedAt,
    closedAt: engagement.closedAt,
    expiresAt: engagement.expiresAt,
    declaredCredential: engagement.declaredCredential ?? null,
  };
}

/** **Όλες οι θέσεις** του φακέλου: η τρέχουσα συμμετοχή κάθε ρόλου (`selectCurrentEngagement`) + η πιο πρόσφατη πρόσκληση. */
export async function listDossierAccessSlots(db: Firestore, dossier: PropertyDossier, nowMs: number): Promise<readonly DossierAccessSlot[]> {
  const [engagements, invitations] = await Promise.all([
    listDossierEngagements(db, dossier),
    latestDossierInvitations(db, dossier.id, dossier.userId, new Date(nowMs).toISOString()),
  ]);
  return DOSSIER_ENGAGEMENT_ROLES.map((role): DossierAccessSlot => {
    const current = selectCurrentEngagement(engagements.filter((e) => e.role === role)).engagement;
    return {
      role,
      engagement: current ? engagementSummaryOf(current, nowMs) : null,
      invitation: invitations.get(role) ?? null,
    };
  });
}

/**
 * **Η όψη του κατόχου στο άνοιγμα της κάρτας**: οι θέσεις **και** τα αρχεία του φακέλου, ταξινομημένα ανά καρτέλα από
 * τον ΕΝΑ κριτή της πόρτας — ώστε ο διάλογος να προβλέπει «θα δει N αρχεία» και να διαλέγει εξαιρέσεις **χωρίς**
 * δεύτερο κανόνα στον client (Datasite/Intralinks «view as»). Μόνο στην ανάγνωση: οι πράξεις δεν αλλάζουν αρχεία.
 */
export async function readDossierAccessView(db: Firestore, dossier: PropertyDossier, nowMs: number): Promise<DossierAccessResponse> {
  const [slots, files] = await Promise.all([
    listDossierAccessSlots(db, dossier, nowMs),
    dossierFilesWithin(db, dossier, FULL_DOSSIER_REACH),
  ]);
  return { slots, files };
}

// =============================================================================
// ΠΡΟΣΚΛΗΣΗ · ΑΚΥΡΩΣΗ ΠΡΟΣΚΛΗΣΗΣ
// =============================================================================

export type DossierInvitationRejection = 'dossier-archived' | 'slot-occupied';

export type DossierInvitationOutcome =
  | { readonly ok: true; readonly invited: InvitationNoticeOutcome; readonly slots: readonly DossierAccessSlot[] }
  | { readonly ok: false; readonly rejection: DossierInvitationRejection };

/**
 * **Ζωντανή θέση** = ο ρόλος έχει συμμετοχή `offered`/`active` — η ίδια κρίση με την αποδοχή (`readLiveForSubject`).
 * 🔴 Και η `active` με περασμένη λήξη πιάνει τη θέση (καμία εργασία λήξης δεν τη γράφει `expired`): εκεί η διέξοδος
 *    είναι η **ανανέωση** ή η ανάκληση — όχι ένα email που η αποδοχή του θα αρνηθεί.
 */
async function isSlotLive(db: Firestore, dossier: PropertyDossier, role: DossierEngagementRole): Promise<boolean> {
  const engagements = await listDossierEngagements(db, dossier);
  return engagements.some((e) => e.role === role && LIVE_ENGAGEMENT_STATES.includes(e.state));
}

/**
 * **Έκδοση (ή επαναποστολή) πρόσκλησης** στη θέση. Η πρόσκληση γράφεται **πρώτα** (await — ορθότητα)· το email φεύγει
 * **μετά**, και η έκβασή του επιστρέφει ονομασμένη ώστε ο κάτοχος να δει «δεν στάλθηκε» αντί για σιωπή.
 */
export async function inviteToDossier(
  db: Firestore,
  actor: DossierOwnerActor,
  dossier: PropertyDossier,
  request: DossierInvitationRequest,
  nowMs: number,
): Promise<DossierInvitationOutcome> {
  if (dossier.lifecycle !== 'active') return { ok: false, rejection: 'dossier-archived' };
  if (await isSlotLive(db, dossier, request.role)) return { ok: false, rejection: 'slot-occupied' };
  const issued = await issueEngagementInvitation(db, {
    subject: { kind: 'property_dossier', dossierId: dossier.id },
    role: request.role, reach: request.reach, shareDays: request.shareDays,
    email: request.email, actorUid: actor.uid, nowMs,
  });
  // ⛔ Ποτέ το token στο ίχνος — μόνο το είδος της πράξης και το email που έγραψε ο ίδιος ο κάτοχος.
  await recordDossierInvitationAudit(dossier, actor, request.role, {
    kind: issued.supersededCount > 0 ? 'resent' : 'invited',
    email: issued.invitation.inviteeEmail,
  });
  const invited = await notifyEngagementInvitation(db, issued);
  return { ok: true, invited, slots: await listDossierAccessSlots(db, dossier, nowMs) };
}

/** **Ακύρωση** μιας εκκρεμούς πρόσκλησης — `false` ⇒ δεν υπάρχει σε αυτόν τον φάκελο (η πόρτα: 404). Ιδεμποτής. */
export async function cancelDossierInvitation(
  db: Firestore,
  actor: DossierOwnerActor,
  dossier: PropertyDossier,
  invitationId: string,
  nowMs: number,
): Promise<{ readonly found: boolean; readonly slots: readonly DossierAccessSlot[] }> {
  const outcome = await revokeDossierInvitation(db, {
    dossierId: dossier.id, invitationId, ownerUid: dossier.userId, nowValue: new Date(nowMs).toISOString(),
  });
  if (outcome.kind === 'absent') return { found: false, slots: [] };
  if (outcome.kind === 'revoked') {
    await recordDossierInvitationAudit(dossier, actor, outcome.role, { kind: 'revoked' });
  }
  return { found: true, slots: await listDossierAccessSlots(db, dossier, nowMs) };
}

// =============================================================================
// ΠΡΑΞΕΙΣ ΠΑΝΩ ΣΕ ΣΥΜΜΕΤΟΧΗ — ανάκληση · ανανέωση · εύρος
// =============================================================================

export type DossierEngagementChangeOutcome =
  | { readonly ok: true; readonly slots: readonly DossierAccessSlot[] }
  | { readonly ok: false; readonly rejection: 'not-found' | 'not-allowed' };

/** Το αίτημα της πόρτας → η μετάβαση του ΕΝΟΣ γραφέα. Ο δρών είναι πάντα ο κάτοχος. */
function transitionOf(change: DossierEngagementChangeRequest, byUid: string): EngagementTransition {
  switch (change.action) {
    case 'revoke':
      return { kind: 'end', byUid };
    case 'renew':
      return { kind: 'renew', byUid, shareDays: change.shareDays };
    case 'reach':
      return { kind: 'reach', byUid, reach: change.reach };
  }
}

/** Η πράξη του αιτήματος → η αλλαγή που λέει η ειδοποίηση του επαγγελματία. */
const OWNER_CHANGE_OF: Readonly<Record<DossierEngagementChangeRequest['action'], DossierOwnerChange>> = {
  revoke: 'ended',
  renew: 'renewed',
  reach: 'reach',
};

/**
 * Τα ονόματα των αρχείων που μπήκαν ή βγήκαν από τις εξαιρέσεις — **μόνο** τότε διαβάζεται ο φάκελος (ανανέωση και
 * ανάκληση δεν πληρώνουν ανάγνωση). Αρχείο που δεν είναι πια έτοιμο μένει χωρίς όνομα: η γραμμή κρατά το id του.
 */
async function exclusionNames(db: Firestore, dossier: PropertyDossier, before: DossierEngagement, after: DossierEngagement): Promise<ReadonlyMap<string, string>> {
  if (touchedExclusions(before, after).length === 0) return new Map();
  const files = await dossierFilesWithin(db, dossier, FULL_DOSSIER_REACH);
  return new Map(files.map((file) => [file.fileId, file.fileName]));
}

/**
 * **Ανάκληση · ανανέωση · αλλαγή εύρους** μιας συμμετοχής του φακέλου. Η διαδρομή (`property_dossiers/{id}/engagements`)
 * δένει τη συμμετοχή στον φάκελο ⇒ συμμετοχή άλλου φακέλου είναι **δομικά** `not-found`. Ίδια τιμή ⇒ `noop` ⇒ 200 χωρίς ίχνος.
 */
export async function changeDossierEngagement(
  db: Firestore,
  actor: DossierOwnerActor,
  dossier: PropertyDossier,
  input: { readonly engagementId: string; readonly change: DossierEngagementChangeRequest; readonly nowMs: number },
): Promise<DossierEngagementChangeOutcome> {
  const key = { dossierId: dossier.id, engagementId: input.engagementId };
  const outcome = await transitionEngagement(db, key, transitionOf(input.change, actor.uid), input.nowMs, NO_LIVE_VIEW);
  if (outcome.outcome === 'not-found') return { ok: false, rejection: 'not-found' };
  if (outcome.outcome === 'not-allowed') return { ok: false, rejection: 'not-allowed' };
  if (outcome.outcome === 'changed' && isDossierEngagement(outcome.before) && isDossierEngagement(outcome.after)) {
    const names = await exclusionNames(db, dossier, outcome.before, outcome.after);
    await recordDossierAccessChanged(
      dossier, actor,
      input.change.action === 'revoke' ? 'status_changed' : 'updated',
      dossierAccessChanges(outcome.before, outcome.after, names),
    );
    await announceDossierAccessChanged(outcome.after, OWNER_CHANGE_OF[input.change.action], dossier);
  }
  return { ok: true, slots: await listDossierAccessSlots(db, dossier, input.nowMs) };
}
