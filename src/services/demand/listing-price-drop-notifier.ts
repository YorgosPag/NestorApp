/**
 * @fileoverview **«ΜΕΙΩΘΗΚΕ Η ΤΙΜΗ ΑΓΓΕΛΙΑΣ ΤΗΣ ΖΗΤΗΣΗΣ ΣΑΣ»** — η αποστολή μιας μείωσης.
 * @related ADR-777 §8.69 · §8.69.12 · lib/demand/demand-announcement.ts · lib/listings/price-history.ts
 * @module services/demand/listing-price-drop-notifier
 *
 * 🔑 **Καμία κρίση εδώ.** Το *«μειώθηκε;»* το απαντά το `price-history.ts` (στην προβολή),
 * το *«αξίζει να το πούμε;»* το `priceDropVerdict`, το *«τι λέμε;»* το
 * `listing-announcement-copy.ts`, το *«το έχουμε ήδη πει;»* το καθολόγιο. Εδώ μόνο
 * **στέλνεται** — με το **ίδιο** συμβόλαιο idempotency και προορισμού με το email ταιριάσματος.
 *
 * ⚠️ **Ο προορισμός έρχεται ως όρισμα**, όχι με εισαγωγή του ειδοποιητή ταιριάσματος: εκείνος
 * καλεί αυτό το αρχείο, και η αντίστροφη εισαγωγή θα ήταν κύκλος (CHECK 3.80).
 */

import { NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment } from '@/config/notification-events';
import {
  priceDropVerdict,
  recipientPriceDropEventId,
  type AnnouncementReasons,
  type MatchHistory,
} from '@/lib/demand/demand-announcement';
import type { NotificationDestination } from '@/lib/notifications/notification-destination';
import {
  dispatchNotification,
  type DispatchResult,
} from '@/server/notifications/notification-orchestrator';
import type { PublicListing } from '@/types/public-listing';

import { priceDropCopy } from './listing-announcement-copy';

/** Τι απέγινε **μία** αποστολή. Ονομασμένο, ποτέ boolean. */
export type DispatchOutcome = 'announced' | 'already-known' | 'opted-out';

/** Τι απέγινε **μία** μείωση — οι τρεις αποστολές **και** οι δύο σιωπές. */
export type PriceDropOutcome = DispatchOutcome | 'predates-match' | 'stale';

/** Η λογιστική των μειώσεων σε ένα πέρασμα — **κάθε** κάδος, και οι σιωπές. */
export type PriceDropTally = Readonly<Record<PriceDropOutcome, number>>;

export const EMPTY_PRICE_DROP_TALLY: PriceDropTally = {
  announced: 0,
  'already-known': 0,
  'opted-out': 0,
  'predates-match': 0,
  stale: 0,
};

export function addPriceDropOutcome(tally: PriceDropTally, outcome: PriceDropOutcome): PriceDropTally {
  return { ...tally, [outcome]: tally[outcome] + 1 };
}

/**
 * **Η μία μετάφραση αποτελέσματος αποστολής** — κοινή με το email ταιριάσματος, ώστε
 * «διπλότυπο» και «κλειστός διακόπτης» να σημαίνουν το ίδιο και στις δύο ειδήσεις.
 */
export function dispatchOutcomeOf(result: DispatchResult): DispatchOutcome {
  if (!result.success) return 'opted-out';
  if (result.skipped) {
    return result.reason?.includes('Duplicate') === true ? 'already-known' : 'opted-out';
  }
  return 'announced';
}

/** Ό,τι χρειάζεται **μία** μείωση για να κριθεί και, ίσως, να σταλεί — ανά (παραλήπτη, αγγελία). */
export interface PriceDropCandidate {
  readonly recipientId: string;
  readonly listing: PublicListing;
  readonly reasons: AnnouncementReasons;
  readonly match: MatchHistory;
  /** Το καθολόγιο βρήκε **ήδη γραμμένη** αυτή τη μείωση — με νέο ή παλιό (ανά ζήτηση) κλειδί. */
  readonly alreadyAnnounced: boolean;
  readonly destination: NotificationDestination;
  readonly nowMs: number;
}

/**
 * **Κρίνει και, αν αξίζει, στέλνει τη μείωση μιας αγγελίας σε έναν άνθρωπο — μία φορά,
 * όσες ζητήσεις του κι αν ταιριάζουν.**
 *
 * ⚠️ **Idempotent**: το κλειδί περιέχει ποσό **και** στιγμή της μείωσης, οπότε κάθε ωριαίο
 * πέρασμα που ξαναβρίσκει την ίδια μείωση καταλήγει `already-known`. Μείωση γραμμένη με το
 * **παλιό** κλειδί (πριν το §8.69.12) σιωπά από το καθολόγιο, **χωρίς** απόπειρα `create()`.
 */
export async function announcePriceDrop(candidate: PriceDropCandidate): Promise<PriceDropOutcome> {
  const { listing, reasons } = candidate;
  const reduction = listing.priceReduction;
  if (reduction === null) return 'stale';

  const verdict = priceDropVerdict(reduction, candidate.match, candidate.nowMs);
  if (verdict !== 'announce') return verdict;
  if (candidate.alreadyAnnounced) return 'already-known';

  const copy = priceDropCopy(listing, reduction, reasons);
  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP,
    recipientId: candidate.recipientId,
    tenantId: candidate.recipientId,
    title: copy.title,
    body: copy.body,
    titleKey: copy.titleKey,
    titleParams: copy.titleParams,
    eventId: recipientPriceDropEventId(listing.id, reduction),
    reasons: reasons.demandIds,
    entityId: listing.id,
    ...candidate.destination,
    source: {
      service: SOURCE_SERVICES.CRM,
      feature: 'demand-price-drop',
      env: getCurrentEnvironment(),
    },
  });

  return dispatchOutcomeOf(result);
}
