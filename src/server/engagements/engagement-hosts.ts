import 'server-only';

/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΟΙΚΟΔΕΣΠΟΤΩΝ** — ένας οικοδεσπότης ανά είδος υπόθεσης, ολικός πίνακας.
 * @related ADR-862 §5.3.11 · `engagement-host-adapter.ts` (η σύμβαση) · ADR-915 §39 (ο δεύτερος οικοδεσπότης)
 * @module server/engagements/engagement-hosts
 *
 * 🔑 Τρίτο είδος υπόθεσης **δεν μεταγλωττίζεται** μέχρι να δηλώσει οικοδεσπότη εδώ (`satisfies` πάνω στο
 *    `EngagementSubjectKind`). Η μηχανή πρόσκλησης και η πλευρά του επαγγελματία ρωτούν **μόνο** αυτό το αρχείο —
 *    καμία δεύτερη διακλάδωση «αν είναι μεταβίβαση…» σε άλλο σημείο.
 * 🔑 **Κανένα `as`**: η πρόσκληση/συμμετοχή στενεύει με τους φρουρούς του τύπου της, και ο οικοδεσπότης δένεται πάνω
 *    της (`bind…`) — ο καλών παίρνει πίσω μεθόδους χωρίς όρισμα είδους.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { RegistryAuthorityId } from '@/constants/professional-registries';
import type { EngagementRosterSignal } from '@/lib/auth/engagement-write';
import { CONVEYANCE_ENGAGEMENT_HOST } from '@/services/conveyance/conveyance-engagement-host-adapter';
import type { CasesViewer } from '@/services/conveyance/conveyance-engagement-access.service';
import type { EngagementHostLine } from '@/types/contact-professional-link';
import { ISSUANCE_ENGAGEMENT_HOST } from '@/services/document-registry/issuance-engagement-host-adapter';
import {
  isConveyanceEngagement,
  isIssuanceEngagement,
  type Engagement,
  type EngagementSubjectKind,
} from '@/types/engagement';
import {
  isIssuanceInvitation,
  type EngagementInvitation,
  type EngagementInvitationDescription,
} from '@/types/engagement-invitation';
import type { MyEngagementCard } from '@/types/my-engagements';

import type {
  EngagedViewOutcome,
  EngagementHostAdapter,
  InvitationAnswer,
  InvitationAnswerer,
} from './engagement-host-adapter';

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
  return { conveyance_case: CONVEYANCE_ENGAGEMENT_HOST, document_issuance: ISSUANCE_ENGAGEMENT_HOST };
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

/** **Ο οικοδεσπότης αυτής της πρόσκλησης** — από το είδος της υπόθεσής της, ποτέ από το αίτημα. */
export function invitationHost(invitation: EngagementInvitation): InvitationHost {
  return isIssuanceInvitation(invitation)
    ? bindInvitation(engagementHosts().document_issuance, invitation)
    : bindInvitation(engagementHosts().conveyance_case, invitation);
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
  const parts = await Promise.all([
    engagementHosts().conveyance_case.listCards(db, viewer, engagements.filter(isConveyanceEngagement), nowMs),
    engagementHosts().document_issuance.listCards(db, viewer, engagements.filter(isIssuanceEngagement), nowMs),
  ]);
  if (parts.some((part) => part === 'unknown')) return 'unknown';
  return parts
    .flatMap((part) => (part === 'unknown' ? [] : part))
    .sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
}

/** Ο χώρος μιας **δικής του** συμμετοχής, από τον οικοδεσπότη του είδους της. */
export function engagedViewFor(db: Firestore, viewer: CasesViewer, engagement: Engagement, nowMs: number): Promise<EngagedViewOutcome> {
  return isIssuanceEngagement(engagement)
    ? engagementHosts().document_issuance.view(db, viewer, engagement, nowMs)
    : engagementHosts().conveyance_case.view(db, viewer, asConveyance(engagement), nowMs);
}

// =============================================================================
// Η ΠΛΕΥΡΑ ΤΟΥ ΓΡΑΦΕΙΟΥ
// =============================================================================

/** ADR-915 §40 — ποιο ακίνητο / ποιο έγγραφο μιας συμμετοχής, από τον οικοδεσπότη του είδους της (επαφή του γραφείου). */
export function hostLineOf(db: Firestore, engagement: Engagement): Promise<EngagementHostLine> {
  return isIssuanceEngagement(engagement)
    ? engagementHosts().document_issuance.hostLine(db, engagement)
    : engagementHosts().conveyance_case.hostLine(db, asConveyance(engagement));
}

/** Ο δεύτερος κλάδος της ένωσης — ρητός φρουρός, ώστε τρίτο είδος να **σκάσει** εδώ και όχι σιωπηλά ως μεταβίβαση. */
function asConveyance(engagement: Engagement) {
  if (!isConveyanceEngagement(engagement)) throw new Error(`Engagement ${engagement.id} has no host for its subject kind`);
  return engagement;
}
