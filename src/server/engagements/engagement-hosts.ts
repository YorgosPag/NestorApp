import 'server-only';

/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΟΙΚΟΔΕΣΠΟΤΩΝ** — ένας οικοδεσπότης ανά είδος υπόθεσης, ολικός πίνακας.
 * @related ADR-862 §5.3.11 · `engagement-host-adapter.ts` (η σύμβαση) · ADR-915 §39 (ο δεύτερος οικοδεσπότης) ·
 *          ADR-916 Φ-Ε1 (ο τρίτος: ο φάκελος ιδιώτη)
 * @module server/engagements/engagement-hosts
 *
 * 🔑 Νέο είδος υπόθεσης **δεν μεταγλωττίζεται** μέχρι να δηλώσει οικοδεσπότη εδώ (`satisfies` πάνω στο
 *    `EngagementSubjectKind`). Η μηχανή πρόσκλησης και η πλευρά του επαγγελματία ρωτούν **μόνο** αυτό το αρχείο —
 *    καμία δεύτερη διακλάδωση «αν είναι μεταβίβαση…» σε άλλο σημείο.
 * 🔑 **Κανένα `as`**: η πρόσκληση/συμμετοχή στενεύει με τους φρουρούς του τύπου της, και ο οικοδεσπότης δένεται πάνω
 *    της (`bind…`) — ο καλών παίρνει πίσω μεθόδους χωρίς όρισμα είδους.
 * 🔑 **Κάθε διακλάδωση τελειώνει σε ρητό φρουρό που ΡΙΧΝΕΙ** (ADR-916 Φ-Ε1): η παλιά μορφή «έκδοση ; αλλιώς
 *    μεταβίβαση» θα έστελνε σιωπηλά τρίτο είδος στον οικοδεσπότη της μεταβίβασης.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { RegistryAuthorityId } from '@/constants/professional-registries';
import { createModuleLogger } from '@/lib/telemetry';
import type { EngagementRosterSignal } from '@/lib/auth/engagement-write';
import { CONVEYANCE_ENGAGEMENT_HOST } from '@/services/conveyance/conveyance-engagement-host-adapter';
import type { CasesViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import type { EngagementHostLine } from '@/types/contact-professional-link';
import { ISSUANCE_ENGAGEMENT_HOST } from '@/services/document-registry/issuance-engagement-host-adapter';
import { DOSSIER_ENGAGEMENT_HOST } from '@/services/property-dossier/dossier-engagement-host-adapter';
import {
  isConveyanceEngagement,
  isDossierEngagement,
  isIssuanceEngagement,
  type Engagement,
  type EngagementSubjectKind,
} from '@/types/engagement';
import {
  isDossierInvitation,
  isIssuanceInvitation,
  type EngagementInvitation,
  type EngagementInvitationDescription,
} from '@/types/engagement-invitation';
import type { EngagementOpenItem, MyEngagementCard } from '@/types/my-engagements';

import type {
  EngagedViewOutcome,
  EngagementHostAdapter,
  InvitationAnswer,
  InvitationAnswerer,
} from './engagement-host-adapter';

const logger = createModuleLogger('engagement-hosts');

/** Ο οικοδεσπότης του είδους `K` — πάνω στην πρόσκληση **και** τη συμμετοχή **αυτού** του είδους. */
type HostFor<K extends EngagementSubjectKind> = EngagementHostAdapter<
  Extract<EngagementInvitation, { readonly subject: { readonly kind: K } }>,
  Extract<Engagement, { readonly subject: { readonly kind: K } }>
>;

/**
 * Ολικός: κάθε είδος υπόθεσης έχει **ακριβώς έναν** οικοδεσπότη, του σωστού τύπου.
 * ⚠️ **Συνάρτηση, όχι σταθερά module** (CHECK 3.80): οι οικοδεσπότες εξαρτώνται από τομείς που φτάνουν ξανά στη μηχανή
 *    πρόσκλησης· ο πίνακας διαβάζεται **τη στιγμή της κλήσης**, ποτέ στην αρχικοποίηση — κανένας κύκλος δεν «σκάει».
 */
function engagementHosts(): { readonly [K in EngagementSubjectKind]: HostFor<K> } {
  return {
    conveyance_case: CONVEYANCE_ENGAGEMENT_HOST,
    document_issuance: ISSUANCE_ENGAGEMENT_HOST,
    property_dossier: DOSSIER_ENGAGEMENT_HOST,
  };
}

/** Ο οικοδεσπότης **δεμένος** σε μία πρόσκληση — ό,τι ρωτά η μηχανή πρόσκλησης. */
export interface InvitationHost {
  signal(db: Firestore): (tx: Transaction) => void;
  stillOpen(db: Firestore): Promise<boolean>;
  stageOpen(db: Firestore, tx: Transaction): Promise<EngagementRosterSignal | null>;
  credentialAuthority(): RegistryAuthorityId | null;
  describe(db: Firestore): Promise<EngagementInvitationDescription>;
  afterAnswer(db: Firestore, answer: InvitationAnswer, answerer: InvitationAnswerer): Promise<void>;
  announceUnanswered(db: Firestore): Promise<void>;
}

function bindInvitation<I extends EngagementInvitation, E extends Engagement>(host: EngagementHostAdapter<I, E>, invitation: I): InvitationHost {
  return {
    signal: (db) => host.invitationSignal(db, invitation),
    stillOpen: (db) => host.stillOpen(db, invitation),
    stageOpen: (db, tx) => host.stageOpen(db, tx, invitation),
    credentialAuthority: () => host.credentialAuthority(invitation),
    describe: (db) => host.describe(db, invitation),
    afterAnswer: (db, answer, answerer) => host.afterAnswer(db, invitation, answer, answerer),
    announceUnanswered: (db) => host.announceUnanswered(db, invitation),
  };
}

/**
 * **Ο οικοδεσπότης αυτής της πρόσκλησης** — από το είδος της υπόθεσής της, ποτέ από το αίτημα. Ο τελευταίος κλάδος
 * δέχεται **μόνο** ό,τι απέμεινε μετά τους φρουρούς: νέο είδος ⇒ ο τύπος δεν ταιριάζει ⇒ **δεν μεταγλωττίζεται**.
 */
export function invitationHost(invitation: EngagementInvitation): InvitationHost {
  const hosts = engagementHosts();
  if (isIssuanceInvitation(invitation)) return bindInvitation(hosts.document_issuance, invitation);
  if (isDossierInvitation(invitation)) return bindInvitation(hosts.property_dossier, invitation);
  return bindInvitation(hosts.conveyance_case, invitation);
}

/** Το σήμα του οικοδεσπότη για μια πρόσκληση — συντόμευση για τους γραφείς της πρόσκλησης (έκδοση · ανάκληση · λήξη). */
export function invitationSignalOf(db: Firestore, invitation: EngagementInvitation): (tx: Transaction) => void {
  return invitationHost(invitation).signal(db);
}

// =============================================================================
// Η ΠΛΕΥΡΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ
// =============================================================================

/**
 * Οι κάρτες **όλων** των ειδών, πάνω στο **ένα** ιστορικό του ανθρώπου (ένα ερώτημα collection-group στο `uid`).
 * `unknown` ⇒ τουλάχιστον ένας οικοδεσπότης δεν μπόρεσε να κρίνει — η λίστα «δεν φορτώθηκε», ποτέ μισή.
 */
export async function engagementCardsOf(
  db: Firestore,
  viewer: CasesViewer,
  engagements: readonly Engagement[],
  nowMs: number,
): Promise<readonly MyEngagementCard[] | 'unknown'> {
  const hosts = engagementHosts();
  const parts = await Promise.all([
    hosts.conveyance_case.listCards(db, viewer, engagements.filter(isConveyanceEngagement), nowMs),
    hosts.document_issuance.listCards(db, viewer, engagements.filter(isIssuanceEngagement), nowMs),
    hosts.property_dossier.listCards(db, viewer, engagements.filter(isDossierEngagement), nowMs),
  ]);
  if (parts.some((part) => part === 'unknown')) return 'unknown';
  return parts
    .flatMap((part) => (part === 'unknown' ? [] : part))
    .sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
}

/** Η εκκρεμότητα μιας συμμετοχής, από τον οικοδεσπότη του είδους της. */
function openItemOf(db: Firestore, uid: string, engagement: Engagement, nowMs: number): Promise<EngagementOpenItem | null> {
  const hosts = engagementHosts();
  if (isIssuanceEngagement(engagement)) return hosts.document_issuance.openItem(db, uid, engagement, nowMs);
  if (isDossierEngagement(engagement)) return hosts.property_dossier.openItem(db, uid, engagement, nowMs);
  return hosts.conveyance_case.openItem(db, uid, asConveyance(engagement), nowMs);
}

/**
 * ADR-915 §45.19 Φ6β — **οι εκκρεμότητές του**, από **όλα** τα γραφεία (καμία κρίση χώρου — Procore «My Open Items»,
 * Consolidated): κάθε οικοδεσπότης κρίνει τη δική του συμμετοχή· η κοντινότερη ημερομηνία πρώτη. Ένας οικοδεσπότης
 * που πετά ⇒ `unknown` («δεν φορτώθηκε»), ποτέ μισή λίστα που μοιάζει πλήρης.
 */
export async function engagementOpenItemsOf(
  db: Firestore,
  uid: string,
  engagements: readonly Engagement[],
  nowMs: number,
): Promise<readonly EngagementOpenItem[] | 'unknown'> {
  const items = await Promise.all(engagements.map((engagement) => openItemOf(db, uid, engagement, nowMs))).catch((error: unknown) => {
    logger.warn('Οι εκκρεμότητες του επαγγελματία δεν διαβάστηκαν', { error: String(error) });
    return 'unknown' as const;
  });
  if (items === 'unknown') return 'unknown';
  return items
    .filter((item): item is EngagementOpenItem => item !== null)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.engagementId.localeCompare(b.engagementId));
}

/** Ο χώρος μιας **δικής του** συμμετοχής, από τον οικοδεσπότη του είδους της. */
export function engagedViewFor(db: Firestore, viewer: CasesViewer, engagement: Engagement, nowMs: number): Promise<EngagedViewOutcome> {
  const hosts = engagementHosts();
  if (isIssuanceEngagement(engagement)) return hosts.document_issuance.view(db, viewer, engagement, nowMs);
  if (isDossierEngagement(engagement)) return hosts.property_dossier.view(db, viewer, engagement, nowMs);
  return hosts.conveyance_case.view(db, viewer, asConveyance(engagement), nowMs);
}

// =============================================================================
// Η ΠΛΕΥΡΑ ΤΟΥ ΓΡΑΦΕΙΟΥ
// =============================================================================

/** ADR-915 §40 — ποιο ακίνητο / ποιο έγγραφο μιας συμμετοχής, από τον οικοδεσπότη του είδους της (επαφή του γραφείου). */
export function hostLineOf(db: Firestore, engagement: Engagement): Promise<EngagementHostLine> {
  const hosts = engagementHosts();
  if (isIssuanceEngagement(engagement)) return hosts.document_issuance.hostLine(db, engagement);
  if (isDossierEngagement(engagement)) return hosts.property_dossier.hostLine(db, engagement);
  return hosts.conveyance_case.hostLine(db, asConveyance(engagement));
}

/** Ο τελευταίος κλάδος — ρητός φρουρός, ώστε είδος χωρίς κλάδο να **σκάσει** εδώ και όχι σιωπηλά ως μεταβίβαση. */
function asConveyance(engagement: Engagement) {
  if (!isConveyanceEngagement(engagement)) throw new Error(`Engagement ${engagement.id} has no host for its subject kind`);
  return engagement;
}
