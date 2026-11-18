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
 * 🔒 Καμία πληροφορία επικοινωνίας του κατόχου (Ε-9′): ούτε email ούτε τηλέφωνο.
 * 🔑 **Το ΟΝΟΜΑ του κατόχου όμως δίνεται** στην πρόσκληση (`hostName` — σελίδα αποδοχής **και** email), απόφαση Giorgio
 *    2026-11-17: όπως το Google Drive / Dropbox / DocuSign («ο Χ μοιράστηκε…»), ο παραλήπτης πρέπει να ξέρει **ποιος**
 *    τον καλεί — ένα ανώνυμο «ο κάτοχος σας καλεί» μοιάζει με phishing. Το προωθημένο email δεν διαρρέει: ο σύνδεσμος
 *    δουλεύει μόνο για τη διεύθυνση του παραλήπτη. Πηγή: το `displayName` του προφίλ (`resolveUserDisplayName`, εφεδρεία
 *    `null` ⇒ **ποτέ** email στη θέση του ονόματος).
 *
 * ⚠️ **Δηλωμένα όρια (όχι παραλείψεις)**:
 * - Η κάρτα «Πρόσβαση» του κατόχου (Σ4) διαβάζει στο άνοιγμα και μετά από κάθε πράξη του — **όχι** ζωντανά: το σήμα του
 *   γραφέα μένει **ρητά** άδειο, όπως στην ανάθεση. Το έγκαιρο «μπήκε» το φέρνει η **ειδοποίηση** της απάντησης.
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
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import {
  DOSSIER_ROLE_REGISTRY_AUTHORITY,
  SCOPE_OF_SUBJECT,
  isDossierEngagement,
  type DossierEngagement,
  type DossierShareReach,
} from '@/types/engagement';
import type {
  DossierEngagementInvitation,
  EngagementInvitationDescription,
  EngagementInvitationSubjectView,
} from '@/types/engagement-invitation';
import type { EngagedDossierFile, MyDossierCard } from '@/types/my-engagements';
import type { PropertyDossier } from '@/types/property-dossier';
import { recordDossierAccessAccepted } from './dossier-access-audit';
import { readDossierReadyFiles, readPropertyDossier } from './dossier-media.reader';
import { announceDossierInvitationAnswered, announceDossierInvitationUnanswered } from './dossier-engagement-notifier';
import { dossierFileReach } from './dossier-share-reach';

/**
 * Η όψη του κατόχου δεν είναι ζωντανή (βλ. δηλωμένα όρια) ⇒ ρητά κανένα έγγραφο-σήμα. Το ΕΝΑ σήμα του φακέλου: το
 * μοιράζονται η αποδοχή (εδώ) και οι πράξεις του κατόχου (`dossier-access-host.service.ts`).
 */
export const NO_LIVE_VIEW: EngagementRosterSignal = () => undefined;

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

/** Η περιγραφή **στενεμένη** στο είδος — το email διαβάζει `subject.floorplanKind` χωρίς διακλάδωση ή εφεδρεία. */
type DossierInvitationDescription = EngagementInvitationDescription & {
  readonly subject: Extract<EngagementInvitationSubjectView, { readonly kind: 'property_dossier' }>;
};

/** Η **μία** περιγραφή της πρόσκλησης φακέλου — για την όψη (`describe`) **και** το email της. */
export async function describeDossierInvitation(db: Firestore, invitation: DossierEngagementInvitation): Promise<DossierInvitationDescription> {
  const dossier = openDossier(await readPropertyDossier(db, invitation.subject.dossierId).catch(() => null), invitation.invitedByUid);
  // Όνομα **μόνο** για ζωντανό φάκελο του ίδιου κατόχου — φάκελος που έκλεισε ή άλλαξε χέρια δεν ονομάζει κανέναν.
  const hostName = dossier === null ? null : await resolveUserDisplayName(dossier.userId, null);
  return {
    propertyLabel: dossier?.label ?? null,
    hostName,
    subject: {
      kind: 'property_dossier',
      role: invitation.role,
      tabs: invitation.reach.tabs,
      // Ο ΙΔΙΟΣ κριτής με τη σελίδα του κατόχου· φάκελος που δεν διαβάστηκε ⇒ «κάτοψη» (η προεπιλογή του κριτή).
      floorplanKind: floorplanTabKind(dossier?.type ?? null),
      shareDays: invitation.shareDays,
    },
  };
}

/**
 * Μετά την απάντηση: ίχνος της αποδοχής στο **Ιστορικό του φακέλου** (προσωπικό βιβλίο του κατόχου, await — ποτέ σε
 * βιβλίο γραφείου· `dossier-access-audit.ts`), και
 * ειδοποίηση του κατόχου για αποδοχή **ή** άρνηση (ποτέ δεν πετά).
 */
async function afterAnswer(db: Firestore, invitation: DossierEngagementInvitation, answer: InvitationAnswer, answerer: InvitationAnswerer): Promise<void> {
  const dossier = await readPropertyDossier(db, invitation.subject.dossierId).catch(() => null);
  if (answer.kind === 'accepted') {
    const engagement = answer.engagement;
    if (!isDossierEngagement(engagement)) throw new Error(`Engagement ${engagement.id} is not a property-dossier engagement`);
    const target = { id: invitation.subject.dossierId, userId: invitation.invitedByUid, label: dossier?.label ?? null };
    await recordDossierAccessAccepted(target, answerer, engagement);
  }
  await announceDossierInvitationAnswered(invitation, answer.kind, dossier?.label ?? null, answerer.uid);
}

/** Ε-5 — η πρόσκληση έμεινε αναπάντητη 3 ημέρες: ο κάτοχος το μαθαίνει (μία φορά, από την υπενθύμιση της μηχανής). */
async function announceUnanswered(db: Firestore, invitation: DossierEngagementInvitation): Promise<void> {
  const dossier = await readPropertyDossier(db, invitation.subject.dossierId).catch(() => null);
  await announceDossierInvitationUnanswered(invitation, dossier?.label ?? null);
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

/**
 * Τα αρχεία του φακέλου που **φτάνουν** σε ένα εύρος — η ίδια κρίση με την πόρτα ανοίγματος. Τη ρωτούν η όψη του
 * επαγγελματία (το εύρος της συμμετοχής του) **και** η κάρτα του κατόχου (`FULL_DOSSIER_REACH`: όλα, ταξινομημένα).
 */
export async function dossierFilesWithin(db: Firestore, dossier: PropertyDossier, reach: DossierShareReach): Promise<EngagedDossierFile[]> {
  const files = await readDossierReadyFiles(db, dossier);
  return files.flatMap((file) => {
    const tab = dossierFileReach(dossier, file, reach);
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
      files: await dossierFilesWithin(db, dossier, engagement.reach),
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
  announceUnanswered,
  listCards,
  view,
  openItem: async () => null,
  hostLine: async () => ({ propertyId: null, propertyName: null, documentKind: null }),
};
