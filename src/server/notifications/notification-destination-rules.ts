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
 * | `properties.stayRequestAnswered` | `stayRequestAnsweredDestination` | `announceStayBookingNotice` |
 * | `network.threadMessage` | `readThreadTopic` + `threadMessageDestination` | `announceNetworkMessage` |
 * | `network.teamJoined` | `actTeamRefById` + `actHostDestination` | `announceTeamArrivals` |
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
import { listingMatchDestination } from '@/services/demand/listing-match-notifier.service';
import { locatePlace } from '@/services/demand/place-interest.service';
import { mandateDecisionDestination } from '@/services/mandate/mandate-decision-notifier.service';
import { mandateRequestDestination } from '@/services/mandate/mandate-request-notifier.service';
import { holidayHoursQuestionDestination } from '@/services/mandate/holiday-hours-question-notifier';
import { cardEmailReturnedDestination } from '@/services/mandate/showcase-email-return.service';
import {
  stayRequestAnsweredDestination,
  stayRequestReceivedDestination,
} from '@/services/stay-calendar/stay-booking-notifier.service';
import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import { actTeamRefById } from '@/services/network-messaging/act-team-writer';
import {
  actHostDestination,
  threadMessageDestination,
} from '@/services/network-messaging/network-destination';
import { readThreadTopic } from '@/services/network-messaging/thread-reader';
import type { NetworkActTeam } from '@/types/network-thread';

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

/** Απόφαση εντολής: ο χώρος είναι η **θεματοφυλακή** της αγγελίας (το ίδιο SSoT με τον παραγωγό). */
const mandateDecidedRule: DestinationRule = async (db, _notification, entityId) => {
  const snapshot = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(entityId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), entityId);
  if (property === null) return unresolvable('entity-absent');
  return expected(mandateDecisionDestination(entityId, custodyOf(property)));
};

/** Αίτημα κράτησης προς τον οικοδεσπότη: ο χώρος είναι η **θεματοφυλακή** της αγγελίας (ADR-835 §23.6). */
const stayRequestReceivedRule: DestinationRule = async (db, _notification, entityId) => {
  const snapshot = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(entityId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), entityId);
  if (property === null) return unresolvable('entity-absent');
  return expected(stayRequestReceivedDestination(entityId, custodyOf(property)));
};

/**
 * ADR-867 Β7 · §8 #9 — **νέο μήνυμα δικτύου**: η οντότητα είναι το νήμα· η πλευρά του παραλήπτη βγαίνει
 * από το **θέμα** (ο αντισυμβαλλόμενος είναι γραμμένος εκεί) — ο **ίδιος** πυρήνας με τον αποστολέα.
 */
const networkThreadMessageRule: DestinationRule = async (db, notification, entityId) => {
  const topic = await readThreadTopic(db, entityId);
  if (topic === null) return unresolvable('entity-absent');
  const destination = threadMessageDestination(topic, entityId, notification.userId);
  return destination === null ? unresolvable('no-surface') : expected(destination);
};

/** ADR-867 Β7 · §8 #9 — **είσοδος στην ομάδα**: η εντολή, στο νήμα της, στον χώρο του γραφείου. */
const networkTeamJoinedRule: DestinationRule = async (db, _notification, entityId) => {
  const team = (await actTeamRefById(db, entityId).get()).data() as NetworkActTeam | undefined;
  if (team === undefined) return unresolvable('entity-absent');
  const destination = actHostDestination(team, generateDeterministicNetworkActThreadId(team.actSeed));
  return destination === null ? unresolvable('no-surface') : expected(destination);
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
  // ADR-841 §7 Α21.20 — η οντότητα είναι το γραφείο· η πόρτα, η κάρτα του στον χώρο του.
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_CARD_EMAIL_RETURNED]: async (_db, _notification, entityId) =>
    expected(cardEmailReturnedDestination(entityId)),
  // ADR-841 §7 Α21.21 Φάση Β — η ερώτηση αργιών οδηγεί στην ίδια κάρτα («Άλλο ωράριο» ⇒ φόρμα).
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_HOLIDAY_HOURS_QUESTION]: async (_db, _notification, entityId) =>
    expected(holidayHoursQuestionDestination(entityId)),
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_RECEIVED]: stayRequestReceivedRule,
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_STAY_REQUEST_ANSWERED]: async (_db, notification, entityId) =>
    expected(stayRequestAnsweredDestination(entityId, notification.userId)),
  [NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE]: networkThreadMessageRule,
  [NOTIFICATION_EVENT_TYPES.NETWORK_TEAM_JOINED]: networkTeamJoinedRule,
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
