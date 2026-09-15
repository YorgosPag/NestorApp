/**
 * @fileoverview **ΕΝΑ ΘΕΜΑ, ΠΟΛΛΟΙ ΛΟΓΟΙ** — ομαδοποίηση ταιριασμάτων ανά (παραλήπτη, αγγελία) και
 * η κλειστή λογιστική του περάσματος.
 * @related ADR-777 §8.69.12 · services/demand/listing-match-notifier.service.ts
 * @module services/demand/listing-match-topics
 *
 * 🔴 **Γιατί υπάρχει**: η μηχανή ταιριάσματος απαντά ανά **ζήτηση**, αλλά ένας άνθρωπος με δύο
 * ζητήσεις που ταιριάζουν στην ίδια αγγελία πρέπει να ακούσει **μία** είδηση. Η ομαδοποίηση γίνεται
 * **πριν** την αποστολή — ποτέ διόρθωση μετά, στη σύνοψη (εκεί ζει μόνο το δίχτυ).
 *
 * **Layering**: καθαρό — καμία εξάρτηση από Firestore/δίκτυο/ρολόι.
 */

import type { AnnouncementReasons } from '@/lib/demand/demand-announcement';
import type { PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';

import { EMPTY_PRICE_DROP_TALLY, type DispatchOutcome, type PriceDropTally } from './listing-price-drop-notifier';

/** Τα ταιριάσματα **μίας** ζήτησης — η έξοδος της μηχανής ταιριάσματος. */
export interface DemandMatches {
  readonly demand: PropertyDemand;
  readonly matched: readonly PublicListing[];
}

/** **Ένα θέμα**: μία αγγελία, και οι ζητήσεις του ίδιου ανθρώπου που ταιριάζουν σε αυτή. */
export interface ListingTopic {
  readonly listing: PublicListing;
  readonly reasons: AnnouncementReasons;
}

/** Όλα τα θέματα **ενός** παραλήπτη, με το πλήθος ζευγών (ζήτηση, αγγελία) που τα γέννησαν. */
export interface RecipientTopics {
  readonly recipientId: string;
  readonly topics: readonly ListingTopic[];
  readonly pairs: number;
}

interface TopicDraft {
  readonly listing: PublicListing;
  readonly demands: PropertyDemand[];
}

function reasonsOf(demands: readonly PropertyDemand[]): AnnouncementReasons {
  // 🔑 Ταξινόμηση κατά ζήτηση: ίδια είσοδος σε άλλη σειρά ⇒ ΙΔΙΟΙ λόγοι στο έγγραφο.
  const sorted = [...demands].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    demandIds: sorted.map((demand) => demand.id),
    priceMaxes: sorted.map((demand) => demand.features.priceMax),
  };
}

/**
 * **Ανά παραλήπτη → ανά αγγελία.** Η σειρά είναι της πρώτης εμφάνισης (ζήτηση, μετά αγγελία),
 * ώστε το όριο νέων ανακοινώσεων να κόβει με την **ίδια** σειρά που έκοβε πριν.
 */
export function groupTopicsByRecipient(matches: readonly DemandMatches[]): readonly RecipientTopics[] {
  const byRecipient = new Map<string, { drafts: Map<string, TopicDraft>; pairs: number }>();

  for (const { demand, matched } of matches) {
    const recipientId = demand.authorUserId;
    const group = byRecipient.get(recipientId) ?? { drafts: new Map<string, TopicDraft>(), pairs: 0 };
    byRecipient.set(recipientId, group);
    for (const listing of matched) {
      const draft = group.drafts.get(listing.id);
      if (draft) draft.demands.push(demand);
      else group.drafts.set(listing.id, { listing, demands: [demand] });
      group.pairs += 1;
    }
  }

  return [...byRecipient].map(([recipientId, group]) => ({
    recipientId,
    topics: [...group.drafts.values()].map((draft) => ({ listing: draft.listing, reasons: reasonsOf(draft.demands) })),
    pairs: group.pairs,
  }));
}

// =============================================================================
// ΛΟΓΙΣΤΙΚΗ
// =============================================================================

/** Ό,τι μαζεύει ο βρόχος — πριν αποκτήσει το `demandsConsidered`/`truncated` του περάσματος. */
export interface MatchTally {
  readonly announced: number;
  readonly alreadyKnown: number;
  readonly optedOut: number;
  /** Θέματα (παραλήπτης, αγγελία) που κρίθηκαν — ο παρονομαστής. */
  readonly considered: number;
  /** Ζεύγη (ζήτηση, αγγελία) που **απορροφήθηκαν** σε κοινό θέμα — «και οι σιωπές μετριούνται». */
  readonly collapsedReasons: number;
  readonly recipientsTruncated: number;
  readonly priceDrops: PriceDropTally;
}

export const EMPTY_TALLY: MatchTally = {
  announced: 0,
  alreadyKnown: 0,
  optedOut: 0,
  considered: 0,
  collapsedReasons: 0,
  recipientsTruncated: 0,
  priceDrops: EMPTY_PRICE_DROP_TALLY,
};

const OUTCOME_FIELD: Readonly<Record<DispatchOutcome, 'announced' | 'alreadyKnown' | 'optedOut'>> = {
  announced: 'announced',
  'already-known': 'alreadyKnown',
  'opted-out': 'optedOut',
};

export function countMatch(tally: MatchTally, outcome: DispatchOutcome): MatchTally {
  const field = OUTCOME_FIELD[outcome];
  return { ...tally, [field]: tally[field] + 1, considered: tally.considered + 1 };
}

export function mergeTallies(a: MatchTally, b: MatchTally): MatchTally {
  const priceDrops = { ...a.priceDrops };
  for (const key of Object.keys(b.priceDrops) as (keyof PriceDropTally)[]) {
    priceDrops[key] = a.priceDrops[key] + b.priceDrops[key];
  }
  return {
    announced: a.announced + b.announced,
    alreadyKnown: a.alreadyKnown + b.alreadyKnown,
    optedOut: a.optedOut + b.optedOut,
    considered: a.considered + b.considered,
    collapsedReasons: a.collapsedReasons + b.collapsedReasons,
    recipientsTruncated: a.recipientsTruncated + b.recipientsTruncated,
    priceDrops,
  };
}
