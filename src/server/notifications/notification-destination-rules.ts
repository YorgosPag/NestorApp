/**
 * =============================================================================
 * ΑΝΙΧΝΕΥΤΗΣ ΑΠΟΚΛΙΣΗΣ ΠΡΟΟΡΙΣΜΩΝ — οι ΚΑΝΟΝΕΣ ανά τύπο (ADR-849 §6δ Β2)
 * =============================================================================
 *
 * «Τι προορισμό θα έγραφε **σήμερα** ο παραγωγός αυτής της ειδοποίησης;» — ένας κανόνας
 * ανά τύπο, και κάθε κανόνας **καλεί τη συνάρτηση του ίδιου του παραγωγού**:
 *
 * | Τύπος | Ρωτά | Ο παραγωγός |
 * |---|---|---|
 * | `properties.demandInterest` | `locatePlace` + `placeDestination` | `announceOnePlace` |
 * | `properties.demandListingMatch` | `listingMatchDestination` | `announceOneMatch` |
 * | `properties.demandPriceDrop` | `listingMatchDestination` | `announcePriceDrop` |
 * | `properties.mandateRequestAnswered` | `mandateRequestDestination` | `announceMandateRequestAnswer` |
 * | `properties.mandateDecided` | `custodyOf` + `mandateDecisionDestination` | `announceMandateDecision` |
 * | `properties.stayRequestReceived` | `custodyOf` + `stayRequestReceivedDestination` | `announceStayBookingNotice` |
 * | `properties.ownershipVerificationDecided` · `security.ownershipLost` | `custodyOf` + `ownershipDecisionDestination` | `announceOwnershipDecision` |
 * | `properties.stayRequestAnswered` | `stayRequestAnsweredDestination` | `announceStayBookingNotice` |
 * | `properties.firstContactReceived` | `firstContactReceivedDestination` | `announceFirstContactReceived` |
 * | `properties.tourAccessRequested` | `readTourHost` + `tourAccessReceivedDestination` | `announceTourAccessRequested` |
 * | `properties.tourAccessAnswered` | `tourAccessAnsweredDestination` | `announceTourAccessAnswered` |
 * | `properties.tourLinkOpened` | `readTourHost` + `tourAccessReceivedDestination` | `announceTourLinkOpened` |
 * | `network.threadMessage` | `readThreadTopic` + `threadDestination` | `announceNetworkMessage` |
 * | `network.teamJoined` | `actTeamRefById` + `threadDestination` | `announceTeamArrivals` |
 * | `properties.caseEngagementChanged` | `caseEngagementChangedDestination` | `announceEngagementChanged` |
 * | `properties.caseEngagementAnswered` | ακίνητο + `caseEngagementAnsweredDestination` | `announceToInviter` |
 * | `properties.caseExpiryHost` | ακίνητο + `caseEngagementAnsweredDestination` | `announceExpiryToHost` |
 * | `properties.caseExpiryEngaged` | `caseEngagementChangedDestination` | `announceExpiryToEngaged` |
 * | `properties.caseDocumentHost` | ακίνητο + `caseEngagementAnsweredDestination` | `announceDocumentToHost` |
 * | `properties.caseDocumentEngaged` | `caseEngagementChangedDestination` | `announceDocumentToEngaged` |
 * | `properties.caseDocumentRequestHost` | ακίνητο + `caseEngagementAnsweredDestination` | `announceDocumentRequest` (host) |
 * | `properties.caseDocumentRequestEngaged` | `caseEngagementChangedDestination` | `announceDocumentRequest` (engaged) |
 *
 * 🔑 **Κανένας κανόνας δεν γράφει δική του διαδρομή ή δικό του χώρο.** Αν αύριο ο
 * παραγωγός αλλάξει πόρτα, ο ανιχνευτής την ξέρει την ίδια στιγμή — δεν υπάρχει δεύτερο
 * αντίγραφο να παλιώσει (ADR-749).
 *
 * ⚠️ **Τύπος χωρίς κανόνα ⇒ `no-rule`, ΠΟΤΕ μαντεψιά.** Μετρημένο 2026-09-11: οι 27
 * ειδοποιήσεις με σύνδεσμο ανήκουν **όλες** στους τέσσερις τύπους του πίνακα. Ένας
 * πέμπτος θα φανεί στην αναφορά ονομαστικά — όχι θα διορθωθεί «κάπως».
 *
 * ⛔ **ΠΟΤΕ από το `tenantId`** (`place-detail-route.ts`) — ο κανόνας ρωτά τη **συλλογή**.
 *
 * @module server/notifications/notification-destination-rules
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  NOTIFICATION_EVENT_TYPES,
  isNotificationEventType,
  type NotificationEventType,
} from '@/config/notification-events';
import type { NotificationDestination } from '@/lib/notifications/notification-destination';
import { custodyOf } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { placeDestination } from '@/lib/places/place-detail-route';
import { firstContactReceivedDestination } from '@/services/contact/first-contact-notifier.service';
import { listingMatchDestination } from '@/services/demand/listing-match-notifier.service';
import { locatePlace } from '@/services/demand/place-interest.service';
import { mandateDecisionDestination } from '@/services/mandate/mandate-decision-notifier.service';
import { ownershipDecisionDestination } from '@/services/ownership/ownership-decision-notifier.service';
import { mandateRequestDestination } from '@/services/mandate/mandate-request-notifier.service';
import { holidayHoursQuestionDestination } from '@/services/mandate/holiday-hours-question-notifier';
import { cardEmailReturnedDestination } from '@/services/mandate/showcase-email-return.service';
import {
  stayRequestAnsweredDestination,
  stayRequestReceivedDestination,
} from '@/services/stay-calendar/stay-booking-notifier.service';
import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import { actTeamRefById } from '@/services/network-messaging/act-team-writer';
import { threadDestination } from '@/services/network-messaging/network-destination';
import { tourSubjectOfListing } from '@/lib/spatial-tour/tour-subject-of-listing';
import {
  readTourHost,
  tourAccessAnsweredDestination,
  tourAccessReceivedDestination,
} from '@/server/spatial-tour/tour-access-notifier';
import { readThreadTopic } from '@/services/network-messaging/thread-reader';
import type { NetworkActTeam } from '@/types/network-thread';
import {
  caseEngagementAnsweredDestination,
  caseEngagementChangedDestination,
} from '@/services/conveyance/conveyance-engagement-notifier';

import type {
  ExpectedDestination,
  StoredNotification,
  UnresolvableReason,
} from './notification-destination-drift';

/** Ένας κανόνας: η ειδοποίηση (με την οντότητά της) → ο προορισμός που θα έγραφε σήμερα ο παραγωγός. */
type DestinationRule = (
  db: AdminFirestore,
  notification: StoredNotification,
  entityId: string,
) => Promise<ExpectedDestination>;

const expected = (destination: NotificationDestination): ExpectedDestination => ({
  kind: 'expected',
  destination,
});

const unresolvable = (reason: UnresolvableReason): ExpectedDestination => ({
  kind: 'unresolvable',
  reason,
});

/** Ζήτηση: **σε ποια συλλογή ζει** το ακίνητο ορίζει την πόρτα — ποτέ το πρόθεμα. */
const demandInterestRule: DestinationRule = async (db, _notification, entityId) => {
  const location = await locatePlace(db, entityId);
  if (location.kind === 'absent') return unresolvable('entity-absent');
  if (location.kind === 'unscoped') return unresolvable('unscoped');
  return expected(placeDestination(location.source, entityId, location.holderId));
};

/**
 * Κανόνας για κάθε προορισμό που ορίζεται από τη **θεματοφυλακή** της αγγελίας (το ίδιο SSoT με τον παραγωγό):
 * απόφαση εντολής · αίτημα κράτησης (ADR-835 §23.6) · απόφαση κατοχής (ADR-900 §8 #2 Β3). Ένα σώμα, όχι τρίδυμα.
 */
function custodyRule(
  destinationOf: (ownerPropertyId: string, custody: ReturnType<typeof custodyOf>) => NotificationDestination,
): DestinationRule {
  return async (db, _notification, entityId) => {
    const snapshot = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(entityId).get();
    const property = ownerPropertyFromDocument(snapshot.data(), entityId);
    if (property === null) return unresolvable('entity-absent');
    return expected(destinationOf(entityId, custodyOf(property)));
  };
}

const mandateDecidedRule = custodyRule(mandateDecisionDestination);
const stayRequestReceivedRule = custodyRule(stayRequestReceivedDestination);
const ownershipDecisionRule = custodyRule(ownershipDecisionDestination);

/**
 * ADR-867 Β7 · §8 #9 · **Β9γ** — **νέο μήνυμα δικτύου**: η οντότητα είναι το νήμα, και το νήμα ανοίγει
 * στη **συνομιλία** — ο **ίδιος** πυρήνας με τον αποστολέα, χωρίς διακλάδωση πλευράς.
 */
const networkThreadMessageRule: DestinationRule = async (db, notification, entityId) => {
  const topic = await readThreadTopic(db, entityId);
  if (topic === null) return unresolvable('entity-absent');
  // ⚠️ Το θέμα διαβάζεται **μόνο** για το «υπάρχει το νήμα;» παραπάνω — ο προορισμός δεν το ρωτά πια
  //    (Β9γ): κάθε νήμα ανοίγει στη **συνομιλία**, στον ιδιωτικό χώρο του παραλήπτη.
  return expected(threadDestination(entityId, notification.userId));
};

/** ADR-867 Β7 · §8 #9 · **Β9γ** — **είσοδος στην ομάδα**: η συνομιλία της πράξης, όπου ζει και η ομάδα. */
const networkTeamJoinedRule: DestinationRule = async (db, notification, entityId) => {
  const team = (await actTeamRefById(db, entityId).get()).data() as NetworkActTeam | undefined;
  if (team === undefined) return unresolvable('entity-absent');
  return expected(threadDestination(generateDeterministicNetworkActThreadId(team.actSeed), notification.userId));
};

/**
 * ADR-901 Φ2 — «ανέλαβε / δεν ανέλαβε» προς τον οικοδεσπότη: ο χώρος είναι ο **μισθωτής του ακινήτου**
 * (ίδια πηγή με τον παραγωγό — η υπόθεση ζει στον χώρο που κατέχει το ακίνητο).
 */
const caseEngagementAnsweredRule: DestinationRule = async (db, _notification, entityId) => {
  const companyId: unknown = (await db.collection(COLLECTIONS.PROPERTIES).doc(entityId).get()).data()?.companyId;
  if (typeof companyId !== 'string' || companyId === '') return unresolvable('entity-absent');
  return expected(caseEngagementAnsweredDestination(entityId, companyId));
};

/** ADR-884 Κ3β — νέο αίτημα θέασης προς τον υπεύθυνο: ο χώρος είναι η θεματοφυλακή της **ρίζας**. */
const tourAccessRequestedRule: DestinationRule = async (db, _notification, entityId) => {
  const subject = tourSubjectOfListing(entityId);
  if (subject === null) return unresolvable('entity-absent');
  const host = await readTourHost(db, subject);
  if (host === null) return unresolvable('entity-absent');
  return expected(tourAccessReceivedDestination(subject, host.workspace));
};

const RULES: Readonly<Partial<Record<NotificationEventType, DestinationRule>>> = {
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_INTEREST]: demandInterestRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH]: async (_db, notification, entityId) =>
    expected(listingMatchDestination(entityId, notification.userId)),
  // ADR-777 §8.69 — η μείωση οδηγεί στην **ίδια** δημόσια αγγελία, με τον **ίδιο** κανόνα.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP]: async (_db, notification, entityId) =>
    expected(listingMatchDestination(entityId, notification.userId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_REQUEST_ANSWERED]: async (_db, notification, entityId) =>
    expected(mandateRequestDestination(entityId, notification.userId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED]: mandateDecidedRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_OWNERSHIP_VERIFICATION_DECIDED]: ownershipDecisionRule,
  [NOTIFICATION_EVENT_TYPES.SECURITY_OWNERSHIP_LOST]: ownershipDecisionRule,
  // ADR-841 §7 Α21.20 — η οντότητα είναι το γραφείο· η πόρτα, η κάρτα του στον χώρο του.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CARD_EMAIL_RETURNED]: async (_db, _notification, entityId) =>
    expected(cardEmailReturnedDestination(entityId)),
  // ADR-841 §7 Α21.21 Φάση Β — η ερώτηση αργιών οδηγεί στην ίδια κάρτα («Άλλο ωράριο» ⇒ φόρμα).
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_HOLIDAY_HOURS_QUESTION]: async (_db, _notification, entityId) =>
    expected(holidayHoursQuestionDestination(entityId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_RECEIVED]: stayRequestReceivedRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_ANSWERED]: async (_db, notification, entityId) =>
    expected(stayRequestAnsweredDestination(entityId, notification.userId)),
  // ADR-843 §10.20 — τα εισερχόμενα επαφών, στον ιδιωτικό χώρο του παραλήπτη (καμία ανάγνωση: η διαδρομή δεν
  //    εξαρτάται από την πράξη — ούτε από το αν αποσύρθηκε· αποσυρμένη πράξη απλώς δεν εμφανίζεται εκεί, ΠΕ6).
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_FIRST_CONTACT_RECEIVED]: async (_db, notification) =>
    expected(firstContactReceivedDestination(notification.userId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_TOUR_ACCESS_REQUESTED]: tourAccessRequestedRule,
  // ADR-884 §9.1 Α3′ — το άνοιγμα συνδέσμου οδηγεί στο ΙΔΙΟ πάνελ (εκεί ζουν οι σύνδεσμοι), με τον ΙΔΙΟ κανόνα.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_TOUR_LINK_OPENED]: tourAccessRequestedRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_TOUR_ACCESS_ANSWERED]: async (_db, notification, entityId) =>
    expected(tourAccessAnsweredDestination(entityId, notification.userId)),
  [NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE]: networkThreadMessageRule,
  [NOTIFICATION_EVENT_TYPES.NETWORK_TEAM_JOINED]: networkTeamJoinedRule,
  // ADR-901 Φ2 — η σελίδα της υπόθεσης στον ΙΔΙΩΤΙΚΟ χώρο του επαγγελματία (καμία ανάγνωση: η διαδρομή δεν
  //    εξαρτάται από την κατάσταση — ανακλημένη συμμετοχή ανοίγει την ίδια σελίδα με ονομασμένη άρνηση).
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_CHANGED]: async (_db, notification, entityId) =>
    expected(caseEngagementChangedDestination(entityId, notification.userId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_ANSWERED]: caseEngagementAnsweredRule,
  // ADR-901 Φ4 — λήξεις δικαιολογητικών: ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής (ακίνητο · σελίδα υπόθεσης).
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_HOST]: caseEngagementAnsweredRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_ENGAGED]: async (_db, notification, entityId) =>
    expected(caseEngagementChangedDestination(entityId, notification.userId)),
  // ADR-901 Φ4.4 — νέο έγγραφο: ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_HOST]: caseEngagementAnsweredRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_ENGAGED]: async (_db, notification, entityId) =>
    expected(caseEngagementChangedDestination(entityId, notification.userId)),
  // ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_REQUEST_HOST]: caseEngagementAnsweredRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_REQUEST_ENGAGED]: async (_db, notification, entityId) =>
    expected(caseEngagementChangedDestination(entityId, notification.userId)),
};

/** Οι τύποι που ο ανιχνευτής ξέρει να ξαναχτίσει — για την αναφορά και τις άγκυρες. */
export const RULED_EVENT_TYPES: readonly NotificationEventType[] = Object.keys(RULES).filter(
  isNotificationEventType,
);

/** **Ο προορισμός που θα έγραφε σήμερα ο παραγωγός** — ή ο ονομασμένος λόγος που δεν ξέρουμε. */
export async function expectedDestinationOf(
  db: AdminFirestore,
  notification: StoredNotification,
): Promise<ExpectedDestination> {
  if (!isNotificationEventType(notification.eventType)) return unresolvable('no-rule');
  const rule = RULES[notification.eventType];
  if (rule === undefined) return unresolvable('no-rule');
  if (notification.entityId === null) return unresolvable('no-entity');
  return rule(db, notification, notification.entityId);
}
