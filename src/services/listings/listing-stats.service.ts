import 'server-only';

/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΣΤΑΤΙΣΤΙΚΩΝ ΤΟΥ ΚΑΤΟΧΟΥ** — ένα χαρτοφυλάκιο, μία απάντηση (ADR-777 §8.72).
 * @related app/api/owner-properties/stats/route.ts (ο μόνος καλών) · lib/listings/listing-stats.ts
 * @module services/listings/listing-stats.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΙΣ ΠΗΓΕΣ, ΚΑΜΙΑ ΝΕΑ ΑΛΗΘΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Τι | Από πού | Νέος μετρητής; |
 * |---|---|---|
 * | ποια ακίνητα | `owner_properties` (`authorUserId`) + `mayAdminister` | όχι |
 * | προβολές (κλειστές μέρες) | `listing_stats` — η σύνοψη του cron | — |
 * | προβολές (σήμερα, χθες πριν τις 03:10) | `listing_view_shards` | — |
 * | επαφές | `first_contacts` μέσω `collectAddressedContacts` | **όχι** — ποτέ δεύτερος μετρητής |
 *
 * 🔴 **ΑΓΝΩΣΤΟ ≠ ΜΗΔΕΝ, ΑΝΑ ΠΗΓΗ** (N.12): αν αποτύχουν οι προβολές, οι επαφές **φαίνονται** — και
 * αντίστροφα. Κάθε πηγή έχει δικό της `null`. Μόνο αν δεν ξέρουμε **ποια ακίνητα** είναι δικά
 * σου, η απάντηση ολόκληρη είναι `null`.
 *
 * ⚠️ **Δηλωμένο όριο**: στο παράθυρο 03:10 της σύνοψης, μια ανάγνωση ανάμεσα στο «διάβασα τη
 * σύνοψη» και «διάβασα τα shards» μπορεί να δει μια ημέρα **δύο** φορές ή **καμία**, για ένα
 * αίτημα. Αυτοδιορθώνεται στην επόμενη φόρτωση· συναλλαγή ανάγνωσης γι' αυτό θα ήταν δυσανάλογη.
 */

import { COLLECTIONS, FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { chunkArray } from '@/lib/array-utils';
import {
  LISTING_STATS_SERIES_DAYS,
  LISTING_STATS_WINDOW_DAYS,
  countingSinceOf,
  dailyEventCounts,
  marketDayOf,
  mergeDaily,
  shiftMarketDay,
  trimDaily,
  windowSum,
  type ListingEventCounts,
  type ListingStatsSummary,
  type ListingViewDaily,
  type OwnerPortfolioStats,
} from '@/lib/listings/listing-stats';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { collectAddressedContacts } from '@/services/contact/first-contact-projection';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { readSavesOfListings } from '@/services/listings/saved-listing.service';
import {
  readStoredListingStats,
  readStoredListingViewShard,
  sumShards,
  type StoredListingStats,
  type StoredListingViewShard,
} from '@/services/listings/listing-stats-document';
import type { FirstContact } from '@/types/first-contact';
import type { SavedListing } from '@/types/saved-listing';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('listing-stats.service');

/** Οι προβολές όλων των ακινήτων — ή `null` αν δεν μπορέσαμε να ρωτήσουμε. */
interface ViewSources {
  readonly summaries: ReadonlyMap<string, StoredListingStats>;
  readonly live: ReadonlyMap<string, ListingViewDaily>;
}

/** Τα ακίνητα που **διαχειρίζεται** ο δρων — ίδιο ερώτημα με τη λίστα, ίδιος κριτής με την επεξεργασία. */
async function administeredProperties(adminDb: AdminFirestore, actor: ListingActor): Promise<readonly OwnerProperty[]> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where(FIELDS.AUTHOR_USER_ID, '==', actor.uid)
    .get();
  return snapshot.docs.flatMap((doc) => {
    const property = ownerPropertyFromDocument(doc.data(), doc.id);
    return property !== null && mayAdminister(custodyOf(property), actor) ? [property] : [];
  });
}

async function readSummaries(adminDb: AdminFirestore, ids: readonly string[]): Promise<ReadonlyMap<string, StoredListingStats>> {
  if (ids.length === 0) return new Map();
  const stats = adminDb.collection(COLLECTIONS.LISTING_STATS);
  const docs = await adminDb.getAll(
    ...ids.map((id) => stats.doc(enterpriseIdService.generateDeterministicListingStatsId(id))),
  );
  const byProperty = new Map<string, StoredListingStats>();
  for (const doc of docs) {
    const stored = readStoredListingStats(doc.data());
    if (stored !== null) byProperty.set(stored.propertyId, stored);
  }
  return byProperty;
}

async function readLiveShards(adminDb: AdminFirestore, ids: readonly string[]): Promise<ReadonlyMap<string, ListingViewDaily>> {
  const shards: StoredListingViewShard[] = [];
  for (const chunk of chunkArray([...ids], FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS)) {
    // tenant-scope-exempt: κάδοι μετρητών χωρίς μισθωτή· τα `ids` είναι ΗΔΗ φιλτραρισμένα από τον
    // `mayAdminister` στο `administeredProperties` — ο δρων ζητά μόνο ό,τι αποδείχτηκε δικό του.
    const snapshot = await adminDb.collection(COLLECTIONS.LISTING_VIEW_SHARDS).where('propertyId', 'in', chunk).get();
    for (const doc of snapshot.docs) {
      const shard = readStoredListingViewShard(doc.data());
      if (shard !== null) shards.push(shard);
    }
  }
  return sumShards(shards);
}

async function readViewSources(adminDb: AdminFirestore, ids: readonly string[]): Promise<ViewSources | null> {
  try {
    const [summaries, live] = await Promise.all([readSummaries(adminDb, ids), readLiveShards(adminDb, ids)]);
    return { summaries, live };
  } catch (error) {
    logger.error('[LISTING-STATS] Οι προβολές δεν διαβάστηκαν — άγνωστο, όχι μηδέν', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Οι επαφές **ενός** ακινήτου, από τις ήδη διαβασμένες του χαρτοφυλακίου. */
export function contactCountsFor(contacts: readonly FirstContact[], propertyId: string, today: string): ListingEventCounts {
  const instants = contacts.flatMap((contact) =>
    contact.target.kind === 'listing' && contact.target.listingId === propertyId ? [contact.createdAt] : [],
  );
  return dailyEventCounts(instants, today);
}

/** Οι αποθηκεύσεις **ενός** ακινήτου (§8.74) — ίδιος υπολογισμός με τις επαφές, άλλη πηγή. */
export function saveCountsFor(saves: readonly SavedListing[], propertyId: string, today: string): ListingEventCounts {
  return dailyEventCounts(saves.flatMap((saved) => (saved.listingId === propertyId ? [saved.savedAt] : [])), today);
}

function viewsFor(sources: ViewSources, propertyId: string, today: string): NonNullable<ListingStatsSummary['views']> {
  const summary = sources.summaries.get(propertyId);
  const daily = mergeDaily(summary?.daily ?? {}, sources.live.get(propertyId) ?? {});
  const windowStart = shiftMarketDay(today, -(LISTING_STATS_WINDOW_DAYS - 1));
  const previousEnd = shiftMarketDay(windowStart, -1);
  return {
    lastWindow: windowSum(daily, windowStart, today),
    previousWindow: windowSum(daily, shiftMarketDay(previousEnd, -(LISTING_STATS_WINDOW_DAYS - 1)), previousEnd),
    total: (summary?.archivedViews ?? 0) + windowSum(daily, '0000-00-00', today),
    daily: trimDaily(daily, shiftMarketDay(today, -LISTING_STATS_SERIES_DAYS)),
  };
}

/**
 * **Τα στατιστικά ΟΛΟΥ του χαρτοφυλακίου του δρώντος** — μία απάντηση για κάρτες **και** λεπτομέρεια.
 * @returns `null` μόνο αν δεν μάθαμε **ποια** ακίνητα είναι δικά του.
 */
export async function readOwnerPortfolioStats(
  adminDb: AdminFirestore, actor: ListingActor, nowMs: number,
): Promise<OwnerPortfolioStats | null> {
  let properties: readonly OwnerProperty[];
  try {
    properties = await administeredProperties(adminDb, actor);
  } catch (error) {
    logger.error('[LISTING-STATS] Τα ακίνητα του κατόχου δεν διαβάστηκαν', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  const today = marketDayOf(nowMs);
  const ids = properties.map((property) => property.id);
  const [views, contacts, saves] = await Promise.all([
    readViewSources(adminDb, ids),
    collectAddressedContacts(adminDb, actor),
    readSavesOfListings(adminDb, ids),
  ]);
  const byProperty = Object.fromEntries(properties.map((property): [string, ListingStatsSummary] => [property.id, {
    propertyId: property.id,
    countingSince: countingSinceOf(property.listedAt),
    views: views === null ? null : viewsFor(views, property.id, today),
    contacts: contacts === null ? null : contactCountsFor(contacts, property.id, today),
    saves: saves === null ? null : saveCountsFor(saves, property.id, today),
  }]));
  return { today, byProperty };
}
