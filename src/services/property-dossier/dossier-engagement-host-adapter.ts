import 'server-only';

/**
 * @fileoverview **Ο ΟΙΚΟΔΕΣΠΟΤΗΣ ΤΟΥ ΦΑΚΕΛΟΥ ΙΔΙΩΤΗ** — ό,τι απαντά ο φάκελος ακινήτου στη μηχανή συμμετοχής (ADR-916 Φ-Ε1).
 * @related ADR-862 §5.3.11 (μητρώο οικοδεσποτών) · ADR-866 Φ3 · `dossier-share-reach.ts` (η κρίση εύρους)
 * @module services/property-dossier/dossier-engagement-host-adapter
 *
 * 🔑 **Ο οικοδεσπότης είναι ο ΣΗΜΕΡΙΝΟΣ κάτοχος του φακέλου** (`dossier.userId`), ποτέ αποθηκευμένο πεδίο. Η υπόθεση
 *    «ζει» όσο ο φάκελος είναι ενεργός **και** ανήκει ακόμη σε όποιον κάλεσε (`invitedByUid` / `offeredBy`): αλλαγή
 *    χεριών ⇒ η πρόσκληση δεν εξαργυρώνεται και η όψη απαντά «δεν υπάρχει» (ADR-866 Φ4 — το κλείσιμο των εγγράφων εκεί).
 * 🔑 **Μητρώο από τον ρόλο** (`DOSSIER_ROLE_REGISTRY_AUTHORITY`): δικηγόρος ⇒ σύλλογος · συμβολαιογράφος ⇒ σύλλογος.
 * 🔑 **Ό,τι βλέπει ο επαγγελματίας = ό,τι ανοίγει**: η όψη φιλτράρει με τον **ίδιο** κριτή εύρους με την πόρτα αρχείων.
 * 🔒 Καμία πληροφορία επικοινωνίας του κατόχου (Ε-9′). Το όνομα του κατόχου **δεν** δίνεται: η όψη λέει τον φάκελο.
 *
 * ⚠️ **Δηλωμένα όρια (όχι παραλείψεις)**:
 * - Ο κάτοχος δεν έχει ακόμη ζωντανή όψη πρόσβασης (Σ4) ⇒ το σήμα του γραφέα είναι **ρητά** άδειο, όπως στην ανάθεση.
 * - Ειδοποίηση του κατόχου (απάντηση · αναπάντητη) = με την όψη πρόσβασης (Σ4). Το ίχνος γράφεται **από τώρα**.
 * - Εκκρεμότητα (`openItem`): ο φάκελος δεν έχει προθεσμία εργασίας — η λήξη φαίνεται στην κάρτα.
 * - Γραμμή επαφής γραφείου (`hostLine`): ο ιδιώτης δεν έχει βιβλίο επαφών· ο φάκελος δεν εμφανίζεται ποτέ εκεί.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import type { EngagementRosterSignal } from '@/lib/auth/engagement-write';
import { nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { normalizeToISO } from '@/lib/date-local';
import { fileDownloadName } from '@/lib/files/file-download-name';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import { floorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import type {
  EngagedViewOutcome,
  EngagementHostAdapter,
  InvitationAnswer,
  InvitationAnswerer,
} from '@/server/engagements/engagement-host-adapter';
import type { ActingViews } from '@/services/conveyance/conveyance-acting-workspace.server';
import { placementRejectionOf, shownCardsPerSubject, type CasesViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import { answerChanges, recordEngagementAudit } from '@/services/conveyance/conveyance-engagement-support';
import {
  DOSSIER_ROLE_REGISTRY_AUTHORITY,
  SCOPE_OF_SUBJECT,
  isDossierEngagement,
  type DossierEngagement,
} from '@/types/engagement';
import type { DossierEngagementInvitation, EngagementInvitationDescription } from '@/types/engagement-invitation';
import type { EngagedDossierFile, MyDossierCard } from '@/types/my-engagements';
import type { PropertyDossier } from '@/types/property-dossier';
import { readDossierReadyFiles, readPropertyDossier } from './dossier-media.reader';
import { dossierFileReach } from './dossier-share-reach';

/** Ο κάτοχος δεν έχει ακόμη ζωντανή όψη πρόσβασης (Σ4) ⇒ ρητά κανένα έγγραφο-σήμα. */
const NO_LIVE_VIEW: EngagementRosterSignal = () => undefined;

/** Χωρίς γραφέα σήματος, η αναθεώρηση της όψης δεν αλλάζει ποτέ — ρητή σταθερά, όχι «ξεχασμένο 0». */
const NO_SIGNAL_REVISION = 0;

/**
 * Ο φάκελος **ως υπόθεση που δέχεται είσοδο**: υπάρχει, είναι ενεργός και ανήκει ακόμη σε όποιον κάλεσε. Αλλιώς `null`
 * (ξένος, αρχειοθετημένος ή άλλαξε χέρια ≡ ανύπαρκτος).
 */
function openDossier(dossier: PropertyDossier | null, hostUid: string): PropertyDossier | null {
  return dossier !== null && dossier.lifecycle === 'active' && dossier.userId === hostUid ? dossier : null;
}

/** Ο φάκελος μιας **ήδη γραμμένης** συμμετοχής — κάτοχος = όποιος την πρότεινε (`offeredBy`). */
export async function hostedDossierOf(db: Firestore, engagement: DossierEngagement): Promise<PropertyDossier | null> {
  return openDossier(await readPropertyDossier(db, engagement.subject.dossierId), engagement.offeredBy);
}

// =============================================================================
// Η ΠΡΟΣΚΛΗΣΗ
// =============================================================================

async function stillOpen(db: Firestore, invitation: DossierEngagementInvitation): Promise<boolean> {
  return openDossier(await readPropertyDossier(db, invitation.subject.dossierId), invitation.invitedByUid) !== null;
}

/** 🔴 Ο **ίδιος** έλεγχος μέσα στη συναλλαγή: αρχειοθέτηση ή αλλαγή κατόχου ανάμεσα στο κλικ και τη σφράγιση ⇒ καμία είσοδος. */
async function stageOpen(db: Firestore, tx: Transaction, invitation: DossierEngagementInvitation): Promise<EngagementRosterSignal | null> {
  const ref = db.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(invitation.subject.dossierId);
  const dossier = propertyDossierFromDocument((await tx.get(ref)).data(), invitation.subject.dossierId);
  return openDossier(dossier, invitation.invitedByUid) === null ? null : NO_LIVE_VIEW;
}

/** Η **μία** περιγραφή της πρόσκλησης φακέλου — για την όψη (`describe`) **και** το email της. */
export async function describeDossierInvitation(db: Firestore, invitation: DossierEngagementInvitation): Promise<EngagementInvitationDescription> {
  const dossier = openDossier(await readPropertyDossier(db, invitation.subject.dossierId).catch(() => null), invitation.invitedByUid);
  return {
    propertyLabel: dossier?.label ?? null,
    hostName: null,
    subject: { kind: 'property_dossier', role: invitation.role, tabs: invitation.reach.tabs, shareDays: invitation.shareDays },
  };
}

/** Ίχνος της αποδοχής στο **προσωπικό** βιβλίο του κατόχου (ποτέ σε βιβλίο γραφείου). */
async function afterAnswer(db: Firestore, invitation: DossierEngagementInvitation, answer: InvitationAnswer, answerer: InvitationAnswerer): Promise<void> {
  if (answer.kind !== 'accepted') return;
  const engagement = answer.engagement;
  if (!isDossierEngagement(engagement)) throw new Error(`Engagement ${engagement.id} is not a property-dossier engagement`);
  const dossier = await readPropertyDossier(db, invitation.subject.dossierId).catch(() => null);
  await recordEngagementAudit({
    engagement, ownerUid: invitation.invitedByUid, action: 'created', changes: answerChanges(null, engagement),
    performedBy: answerer.uid, performedByName: answerer.email, entityName: dossier?.label ?? null,
  });
}

// =============================================================================
// Η ΠΛΕΥΡΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ
// =============================================================================

/** Ο ΕΝΑΣ κριτής της συμμετοχής φακέλου — τον μοιράζονται κάρτα, όψη και πόρτα αρχείων. */
export function judgeDossierEngagement(engagement: DossierEngagement, uid: string, nowMs: number) {
  return decideEngagement({ engagement, uid, subject: engagement.subject, scope: SCOPE_OF_SUBJECT.property_dossier, nowMs });
}

async function cardOf(db: Firestore, engagement: DossierEngagement, uid: string, nowMs: number, acting: ActingViews): Promise<MyDossierCard> {
  const [dossier, actingFor] = await Promise.all([hostedDossierOf(db, engagement).catch(() => null), acting.actingFor(engagement)]);
  return {
    kind: 'property_dossier',
    engagementId: engagement.id,
    engagementState: engagement.state,
    verdict: judgeDossierEngagement(engagement, uid, nowMs).verdict,
    offeredAt: engagement.offeredAt,
    expiresAt: engagement.expiresAt,
    role: engagement.role,
    dossierLabel: dossier?.label ?? null,
    actingFor,
  };
}

function listCards(db: Firestore, viewer: CasesViewer, history: readonly DossierEngagement[], nowMs: number) {
  return shownCardsPerSubject(viewer, history, (e, acting) => cardOf(db, e, viewer.uid, nowMs, acting));
}

/** Τα αρχεία του φακέλου που **φτάνουν** σε αυτή τη συμμετοχή — η ίδια κρίση με την πόρτα ανοίγματος. */
async function reachedFilesOf(db: Firestore, dossier: PropertyDossier, engagement: DossierEngagement): Promise<EngagedDossierFile[]> {
  const files = await readDossierReadyFiles(db, dossier);
  return files.flatMap((file) => {
    const tab = dossierFileReach(dossier, file, engagement.reach);
    if (tab === null) return [];
    return [{
      fileId: file.id,
      fileName: fileDownloadName(file, file.id),
      tab,
      contentType: typeof file.contentType === 'string' ? file.contentType : 'application/octet-stream',
      addedAt: normalizeToISO(file.createdAt),
    }];
  });
}

async function view(db: Firestore, viewer: CasesViewer, engagement: DossierEngagement, nowMs: number): Promise<EngagedViewOutcome> {
  const decision = judgeDossierEngagement(engagement, viewer.uid, nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const misplaced = await placementRejectionOf(viewer, engagement);
  if (misplaced !== null) return misplaced;
  const dossier = await hostedDossierOf(db, engagement);
  if (!dossier) return { ok: false, rejection: 'not-found' };
  return {
    ok: true,
    view: {
      kind: 'property_dossier',
      engagementId: engagement.id,
      dossierLabel: dossier.label,
      role: engagement.role,
      expiresAt: engagement.expiresAt,
      tabs: engagement.reach.tabs,
      floorplanKind: floorplanTabKind(dossier.type),
      files: await reachedFilesOf(db, dossier, engagement),
      credential: engagement.declaredCredential ?? null,
      freshness: { revision: NO_SIGNAL_REVISION, freshUntil: nextConveyanceDayStart(new Date(nowMs)).toISOString() },
    },
  };
}

export const DOSSIER_ENGAGEMENT_HOST: EngagementHostAdapter<DossierEngagementInvitation, DossierEngagement> = {
  invitationSignal: () => () => undefined,
  stillOpen,
  stageOpen,
  credentialAuthority: (invitation) => DOSSIER_ROLE_REGISTRY_AUTHORITY[invitation.role],
  describe: describeDossierInvitation,
  afterAnswer,
  announceUnanswered: async () => undefined,
  listCards,
  view,
  openItem: async () => null,
  hostLine: async () => ({ propertyId: null, propertyName: null, documentKind: null }),
};
