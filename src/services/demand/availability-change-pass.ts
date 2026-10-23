/**
 * @fileoverview **ΤΟ ΠΕΡΑΣΜΑ ΤΩΝ ΑΛΛΑΓΩΝ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ**: μέσα στο ίδιο ωριαίο πέρασμα με το ταίριασμα.
 * @related ADR-919 §10 · services/demand/listing-match-notifier.service.ts · lib/demand/availability-shift.ts
 * @module services/demand/availability-change-pass
 *
 * 🔑 **Καμία δεύτερη ανάγνωση της αγοράς.** Ζητήσεις, αγγελίες, «σήμερα» και `nowMs` έρχονται από το πέρασμα
 * ταιριάσματος (`tallyMatches`), ώστε οι δύο ειδήσεις να μιλούν για **την ίδια** εικόνα της αγοράς.
 *
 * 🔑 **Ένας άνθρωπος, μία αγγελία, μία είδηση** (ADR-777 §8.69.12): η ομαδοποίηση είναι η **υπάρχουσα**
 * `groupTopicsByRecipient`, και οι ζητήσεις ταξιδεύουν ως λόγοι.
 *
 * ⚠️ **Χωρίς όριο ανά παραλήπτη**, αντίθετα με τα νέα ταιριάσματα (`MAX_NEW_MATCHES_PER_RECIPIENT`). Εδώ ειδοποιείται
 * μόνο όποιος **ήδη ξέρει** την αγγελία (`never-known` ⇒ σιωπή), άρα το πλήθος φράσσεται από όσα του είπαμε ήδη.
 * Ένα backfill εκατοντάδων αγγελιών δεν μπορεί να συμβεί εδώ.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AvailabilityShiftDirection } from '@/lib/demand/demand-announcement';
import { availabilityShiftsOf, judgeableChangeOf } from '@/lib/demand/availability-shift';
import { listingFactsFrom, type ListingKnowledge } from '@/lib/demand/demand-answer';
import type { NotificationDestination } from '@/lib/notifications/notification-destination';
import type { PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';

import { readRecipientLedger } from './demand-match-ledger';
import { loadDemandNamer } from './demand-name-server';
import {
  EMPTY_AVAILABILITY_CHANGE_TALLY,
  addAvailabilityChangeOutcome,
  announceAvailabilityChange,
  type AvailabilityChangeTally,
} from './listing-availability-change-notifier';
import { groupTopicsByRecipient, sumBuckets, type ListingTopic, type RecipientTopics } from './listing-match-topics';

/** Ο κανόνας της πόρτας: **ο ίδιος** με το ταίριασμα. Εγχέεται, ώστε να μην εισαχθεί ο ειδοποιητής (CHECK 3.80). */
export type ListingDestinationOf = (listingId: string, recipientId: string) => NotificationDestination;

/** Ό,τι μοιράζεται το πέρασμα με το ταίριασμα. */
export interface AvailabilityChangePassInput {
  readonly demands: readonly PropertyDemand[];
  readonly listings: readonly PublicListing[];
  /** Η **ίδια** γνώση με το ταίριασμα (`knowledgeFromListings`): ίδιες θέσεις, ίδια απάντηση. */
  readonly knowledge: ListingKnowledge;
  readonly todayDate: string;
  readonly nowMs: number;
  readonly destinationOf: ListingDestinationOf;
}

/** Οι ειδήσεις ενός ανθρώπου προς μία κατεύθυνση. */
async function announceForRecipient(
  db: AdminFirestore,
  group: RecipientTopics,
  direction: AvailabilityShiftDirection,
  input: AvailabilityChangePassInput,
): Promise<AvailabilityChangeTally> {
  const changed = group.topics.flatMap((topic) => {
    const change = judgeableChangeOf(topic.listing.availabilityTrack?.lastChange ?? null, input.nowMs);
    return change === null ? [] : [{ topic, change }];
  });
  const ledger = await readRecipientLedger(
    db,
    group.recipientId,
    changed.map(({ topic, change }) => ledgerTopicOf(topic, change)),
  );

  let tally = EMPTY_AVAILABILITY_CHANGE_TALLY;
  for (const { topic, change } of changed) {
    const known = ledger.get(topic.listing.id);
    const outcome = await announceAvailabilityChange({
      recipientId: group.recipientId,
      listing: topic.listing,
      change,
      direction,
      reasons: topic.reasons,
      match: known?.match ?? { kind: 'never-announced' },
      alreadyAnnounced: known?.availabilityChangeKnown ?? false,
      destination: input.destinationOf(topic.listing.id, group.recipientId),
      nowMs: input.nowMs,
    });
    tally = addAvailabilityChangeOutcome(tally, outcome);
  }
  return tally;
}

function ledgerTopicOf(topic: ListingTopic, change: { readonly at: string }) {
  return {
    listingId: topic.listing.id,
    demandIds: topic.reasons.demandIds,
    reduction: null,
    availabilityChange: change,
  };
}

/**
 * **Πες σε όποιον έχασε ή κέρδισε ταίρι εξαιτίας αλλαγής της δημόσιας υπόσχεσης.** Καμία αλλαγή στην αγορά
 * ⇒ καμία ανάγνωση, κανένα όνομα, κανένα καθολόγιο.
 */
export async function announceAvailabilityChanges(
  db: AdminFirestore,
  input: AvailabilityChangePassInput,
): Promise<AvailabilityChangeTally> {
  // 🔑 Πρώτα οι αγγελίες με κρίσιμη αλλαγή: συνήθως καμία ⇒ μηδέν δουλειά, μηδέν ανάγνωση.
  const changed = input.listings.filter(
    (listing) => judgeableChangeOf(listing.availabilityTrack?.lastChange ?? null, input.nowMs) !== null,
  );
  if (changed.length === 0) return EMPTY_AVAILABILITY_CHANGE_TALLY;

  const candidates = listingFactsFrom(changed, input.knowledge);
  const shifts = availabilityShiftsOf(input.demands, candidates, input.todayDate, input.nowMs);
  const authors = [...shifts.lost, ...shifts.gained].map(({ demand }) => demand.authorUserId);
  if (authors.length === 0) return EMPTY_AVAILABILITY_CHANGE_TALLY;

  const nameOf = await loadDemandNamer(authors);
  let tally = EMPTY_AVAILABILITY_CHANGE_TALLY;
  for (const direction of ['lost', 'gained'] as const) {
    for (const group of groupTopicsByRecipient(shifts[direction], nameOf)) {
      tally = sumBuckets(tally, await announceForRecipient(db, group, direction, input));
    }
  }
  return tally;
}
