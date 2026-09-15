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
import { cardEmailReturnedDestination } from '@/services/mandate/showcase-email-return.service';

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
