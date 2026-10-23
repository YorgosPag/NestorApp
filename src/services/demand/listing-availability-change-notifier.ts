/**
 * @fileoverview **«ΑΛΛΑΞΕ Η ΠΑΡΑΔΟΣΗ ΑΓΓΕΛΙΑΣ ΤΗΣ ΖΗΤΗΣΗΣ ΣΑΣ»**: η αποστολή μιας αλλαγής διαθεσιμότητας.
 * @related ADR-919 §10 · ADR-777 §8.99.4 (Δ3) · listing-price-drop-notifier.ts · lib/demand/availability-shift.ts
 * @module services/demand/listing-availability-change-notifier
 *
 * 🔑 **Καμία κρίση εδώ**, ίδιο σχήμα με τον ειδοποιητή μείωσης. Το «χάνει ή κερδίζει;» το απαντά η μηχανή
 * (`availability-shift.ts`), το «αξίζει να το πούμε;» το `availabilityChangeVerdict`, το «τι λέμε;» το
 * `listing-announcement-copy.ts`, και το «το έχουμε ήδη πει;» το καθολόγιο. Εδώ γίνεται μόνο η **αποστολή**,
 * με το **ίδιο** συμβόλαιο idempotency και προορισμού (`dispatchOutcomeOf`).
 *
 * 🏆 **Αυτό που δεν κάνει κανένα portal.** Τα idealista, ImmoScout24, Rightmove και Zoopla δεν ειδοποιούν για
 * μετάθεση. Ο NHQC του ΗΒ ζητά από τον κατασκευαστή να ενημερώνει τον αγοραστή για κάθε αλλαγή του completion
 * window. Εδώ γίνεται **αυτόματα**, από τη **δημόσια** τιμή, και **μόνο** σε όποιον άλλαξε πράγματι η απάντηση
 * της μηχανής για τη ζήτησή του.
 */

import { NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment } from '@/config/notification-events';
import {
  availabilityChangeVerdict,
  recipientAvailabilityChangeEventId,
  type AnnouncementReasons,
  type AvailabilityChangeVerdict,
  type AvailabilityShiftDirection,
  type MatchHistory,
} from '@/lib/demand/demand-announcement';
import type { NotificationDestination } from '@/lib/notifications/notification-destination';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { AvailabilityChange } from '@/types/availability-history';
import type { PublicListing } from '@/types/public-listing';

import { availabilityChangeCopy } from './listing-announcement-copy';
import { dispatchOutcomeOf, type DispatchOutcome } from './listing-price-drop-notifier';

/** Τι απέγινε **μία** αλλαγή: οι τρεις αποστολές **και** οι σιωπές, όλες ονομασμένες. */
export type AvailabilityChangeOutcome = DispatchOutcome | Exclude<AvailabilityChangeVerdict, 'announce'>;

/** Η λογιστική των αλλαγών σε ένα πέρασμα: **κάθε** κάδος, και οι σιωπές. */
export type AvailabilityChangeTally = Readonly<Record<AvailabilityChangeOutcome, number>>;

export const EMPTY_AVAILABILITY_CHANGE_TALLY: AvailabilityChangeTally = {
  announced: 0,
  'already-known': 0,
  'opted-out': 0,
  'never-known': 0,
  'left-to-match': 0,
  'predates-change': 0,
  stale: 0,
};

export function addAvailabilityChangeOutcome(
  tally: AvailabilityChangeTally,
  outcome: AvailabilityChangeOutcome,
): AvailabilityChangeTally {
  return { ...tally, [outcome]: tally[outcome] + 1 };
}

/** Ό,τι χρειάζεται **μία** αλλαγή για να κριθεί και, ίσως, να σταλεί, ανά (παραλήπτη, αγγελία). */
export interface AvailabilityChangeCandidate {
  readonly recipientId: string;
  readonly listing: PublicListing;
  readonly change: AvailabilityChange;
  readonly direction: AvailabilityShiftDirection;
  readonly reasons: AnnouncementReasons;
  readonly match: MatchHistory;
  /** Το καθολόγιο βρήκε **ήδη γραμμένη** αυτή την αλλαγή. */
  readonly alreadyAnnounced: boolean;
  readonly destination: NotificationDestination;
  readonly nowMs: number;
}

/**
 * **Κρίνει και, αν αξίζει, στέλνει την αλλαγή διαθεσιμότητας μιας αγγελίας σε έναν άνθρωπο**: μία φορά,
 * όσες ζητήσεις του κι αν άλλαξαν.
 *
 * ⚠️ **Idempotent**: το κλειδί περιέχει τη στιγμή της αλλαγής, οπότε κάθε ωριαίο πέρασμα που ξαναβρίσκει την
 * ίδια αλλαγή καταλήγει `already-known`, από το καθολόγιο ή από το `create()` του orchestrator.
 */
export async function announceAvailabilityChange(
  candidate: AvailabilityChangeCandidate,
): Promise<AvailabilityChangeOutcome> {
  const { listing, change, direction, reasons } = candidate;
  const verdict = availabilityChangeVerdict(change, direction, candidate.match, candidate.nowMs);
  if (verdict !== 'announce') return verdict;
  if (candidate.alreadyAnnounced) return 'already-known';

  const copy = availabilityChangeCopy(listing, change, direction, reasons);
  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_AVAILABILITY_CHANGE,
    recipientId: candidate.recipientId,
    tenantId: candidate.recipientId,
    title: copy.title,
    body: copy.body,
    titleKey: copy.titleKey,
    titleParams: copy.titleParams,
    eventId: recipientAvailabilityChangeEventId(listing.id, change),
    reasons: reasons.demandIds,
    entityId: listing.id,
    ...candidate.destination,
    source: {
      service: SOURCE_SERVICES.CRM,
      feature: 'demand-availability-change',
      env: getCurrentEnvironment(),
    },
  });

  return dispatchOutcomeOf(result);
}
