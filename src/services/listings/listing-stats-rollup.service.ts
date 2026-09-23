import 'server-only';

/**
 * @fileoverview **Η ΝΥΧΤΕΡΙΝΗ ΣΥΝΟΨΗ ΠΡΟΒΟΛΩΝ** — ζεστά shards ⇒ ψυχρή σύνοψη (ADR-777 §8.72).
 * @related lib/cron/jobs/listing-stats-rollup.job.ts (ο καλών) · services/listings/listing-stats-document.ts
 * @module services/listings/listing-stats-rollup.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΣΥΝΟΨΗ ΚΑΙ ΔΙΑΓΡΑΦΗ ΣΤΟ ΙΔΙΟ BATCH — ΑΛΛΙΩΣ Η ΕΠΑΝΑΛΗΨΗ ΧΑΝΕΙ ΠΡΟΒΟΛΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προφανής σειρά *«γράψε όλες τις συνόψεις, μετά σβήσε τα shards»* έχει τρύπα: κρασάρισμα στη
 * μέση των διαγραφών ⇒ η επόμενη εκτέλεση βρίσκει **μισά** shards και **γράφει από πάνω** το
 * `daily[ημέρα]` με μικρότερο αριθμό. Εδώ, **ανά ακίνητο**, ένα batch κάνει και τα δύο: είτε
 * γράφτηκε η σύνοψη **και** σβήστηκαν τα shards του, είτε τίποτα. Επανάληψη ⇒ κανένα shard ⇒
 * καμία αλλαγή. **Ιδεμποτικό εκ κατασκευής**, όχι «συνήθως».
 *
 * 🔑 **Η τιμή της ημέρας ΠΡΟΣΤΙΘΕΤΑΙ (`+=`) στη σύνοψη — και είναι ασφαλές ΜΟΝΟ λόγω του
 * παραπάνω**: ό,τι συνοψίστηκε **δεν υπάρχει πια** ως shard, οπότε κανένα shard δεν μετριέται
 * δεύτερη φορά. Ένα `=` θα ήταν λάθος στη σπάνια περίπτωση όπου η ίδια μέρα συνοψίζεται σε δύο
 * νύχτες (αποτυχία ενός batch ⇒ τα shards του μένουν για αύριο): θα έσβηνε τα ήδη μετρημένα.
 *
 * ⚠️ **Ένας γραφέας**: το cron τρέχει με lease (`cron-lease`), άρα το read-then-set ανά ακίνητο
 * δεν έχει ανταγωνιστή.
 *
 * 🔑 **Τρεις ημέρες πίσω, όχι μία**: αν χαθούν έως δύο νύχτες, η επόμενη τις μαζεύει. Ό,τι είναι
 * παλαιότερο το πιάνει το TTL (`expiresAt`) των shards — μαζί με το αλάτι του, **χωρίς** σύνοψη.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import {
  LISTING_STATS_RETENTION_DAYS,
  LISTING_STATS_ROLLUP_LOOKBACK_DAYS,
  mergeDaily,
  shiftMarketDay,
  trimDaily,
  windowSum,
  type ListingViewDaily,
} from '@/lib/listings/listing-stats';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  readStoredListingStats,
  readStoredListingViewShard,
  sumShards,
  type StoredListingStats,
  type StoredListingViewShard,
} from '@/services/listings/listing-stats-document';

const logger = createModuleLogger('listing-stats-rollup');

export interface ListingStatsRollupReport {
  readonly days: readonly string[];
  readonly properties: number;
  readonly failed: number;
  readonly saltsDeleted: number;
}

interface ShardRef {
  readonly id: string;
  readonly shard: StoredListingViewShard;
}

async function readClosedShards(adminDb: AdminFirestore, days: readonly string[]): Promise<readonly ShardRef[]> {
  // tenant-scope-exempt: κάδοι μετρητών χωρίς μισθωτή· το κλειδί φέρει το ακίνητο, και ο μόνος
  // καλών είναι το cron της πλατφόρμας — καμία ανάγνωση ανθρώπου δεν περνά από εδώ.
  const snapshot = await adminDb.collection(COLLECTIONS.LISTING_VIEW_SHARDS).where('day', 'in', [...days]).get();
  return snapshot.docs.flatMap((doc) => {
    const shard = readStoredListingViewShard(doc.data());
    return shard === null ? [] : [{ id: doc.id, shard }];
  });
}

/** Η νέα σύνοψη από την παλιά + τα καινούργια — καθαρή, για να ελέγχεται χωρίς βάση. */
export function nextListingStats(
  previous: StoredListingStats | null, propertyId: string, fresh: ListingViewDaily, today: string,
): StoredListingStats {
  const merged = mergeDaily(previous?.daily ?? {}, fresh);
  const oldest = shiftMarketDay(today, -LISTING_STATS_RETENTION_DAYS);
  const kept = trimDaily(merged, oldest);
  const trimmedOut = windowSum(merged, '0000-00-00', shiftMarketDay(oldest, -1));
  const newest = Object.keys(fresh).sort().at(-1) ?? '';
  const rolledThrough = [previous?.rolledThrough ?? '', newest].sort().at(-1) ?? '';
  return { propertyId, daily: kept, archivedViews: (previous?.archivedViews ?? 0) + trimmedOut, rolledThrough };
}

async function rollupProperty(
  adminDb: AdminFirestore, propertyId: string, fresh: ListingViewDaily, shardIds: readonly string[], today: string,
): Promise<void> {
  const statsRef = adminDb
    .collection(COLLECTIONS.LISTING_STATS)
    .doc(enterpriseIdService.generateDeterministicListingStatsId(propertyId));
  const previous = readStoredListingStats((await statsRef.get()).data());
  const batch = adminDb.batch();
  batch.set(statsRef, nextListingStats(previous, propertyId, fresh, today));
  const shards = adminDb.collection(COLLECTIONS.LISTING_VIEW_SHARDS);
  for (const id of shardIds) batch.delete(shards.doc(id));
  await batch.commit();
}

/** Σβήσε τα αλάτια των κλειστών ημερών — κανείς δεν ξαναϋπολογίζει hash για χθες (Plausible). */
async function deleteClosedSalts(adminDb: AdminFirestore, days: readonly string[]): Promise<number> {
  const salts = adminDb.collection(COLLECTIONS.LISTING_VIEW_SALTS);
  const batch = adminDb.batch();
  for (const day of days) batch.delete(salts.doc(enterpriseIdService.generateDeterministicListingViewSaltId(day)));
  await batch.commit();
  return days.length;
}

function shardIdsByProperty(refs: readonly ShardRef[]): ReadonlyMap<string, string[]> {
  const byProperty = new Map<string, string[]>();
  for (const ref of refs) byProperty.set(ref.shard.propertyId, [...(byProperty.get(ref.shard.propertyId) ?? []), ref.id]);
  return byProperty;
}

/** **Συνόψισε τις κλειστές ημέρες** πριν από το `today` (ημέρα αγοράς). */
export async function rollupListingStats(adminDb: AdminFirestore, today: string): Promise<ListingStatsRollupReport> {
  const days = Array.from({ length: LISTING_STATS_ROLLUP_LOOKBACK_DAYS }, (_, i) => shiftMarketDay(today, -(i + 1)));
  const refs = await readClosedShards(adminDb, days);
  const sums = sumShards(refs.map((ref) => ref.shard));
  const ids = shardIdsByProperty(refs);
  let failed = 0;
  for (const [propertyId, fresh] of sums) {
    try {
      await rollupProperty(adminDb, propertyId, fresh, ids.get(propertyId) ?? [], today);
    } catch (error) {
      failed += 1;
      logger.error('[LISTING-STATS] Η σύνοψη ενός ακινήτου απέτυχε — τα shards του μένουν για αύριο', {
        propertyId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const saltsDeleted = await deleteClosedSalts(adminDb, days);
  return { days, properties: sums.size, failed, saltsDeleted };
}
