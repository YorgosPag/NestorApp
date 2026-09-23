import 'server-only';

/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΕΓΓΡΑΦΩΝ ΠΡΟΒΟΛΩΝ** — ένας αναγνώστης ανά σχήμα (ADR-777 §8.72).
 * @related services/listings/listing-stats-rollup.service.ts (γράφει τη σύνοψη) ·
 *   services/listings/listing-stats.service.ts (τη διαβάζει) · services/listings/listing-view-recorder.ts (γράφει shards)
 * @module services/listings/listing-stats-document
 *
 * 🔑 **Ζει χωριστά επειδή το ζητούν ΔΥΟ** — ο συνοψιστής και ο αναγνώστης. Δύο αντίγραφα του
 * «πώς διαβάζεται μια σύνοψη» θα ήταν ελεύθερα να αποκλίνουν, και η απόκλιση θα φαινόταν ως
 * **χαμένες προβολές** — σφάλμα που κανένα test ενός μόνο αρχείου δεν βλέπει.
 *
 * ⚠️ **Η βάση ΔΕΝ υπόσχεται σχήμα** (ίδιο δόγμα με το `readPriceHistory`): κάθε ανάγνωση
 * περνά από εδώ, και ό,τι δεν ταιριάζει **απορρίπτεται** αντί να γίνει `NaN` σε άθροισμα.
 */

import type { ListingViewDaily } from '@/lib/listings/listing-stats';

/** `listing_stats/{lsta_*}` — η ψυχρή σύνοψη. Γράφει **μόνο** το cron. */
export interface StoredListingStats {
  readonly propertyId: string;
  /** Προβολές ανά ημέρα αγοράς, το πολύ `LISTING_STATS_RETENTION_DAYS`. */
  readonly daily: ListingViewDaily;
  /**
   * Άθροισμα των ημερών που **κόπηκαν** από το `daily`. Χωρίς αυτό, το «σύνολο» θα **μειωνόταν**
   * με τον χρόνο — ένας αριθμός που πέφτει χωρίς να έχει συμβεί τίποτα είναι ψέμα.
   */
  readonly archivedViews: number;
  /** Η τελευταία ημέρα αγοράς που συνοψίστηκε. */
  readonly rolledThrough: string;
}

/** `listing_view_shards/{lvsh_*}` — ο ζεστός κάδος. */
export interface StoredListingViewShard {
  readonly propertyId: string;
  readonly day: string;
  readonly views: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Κράτα μόνο καθαρά ζεύγη (ημέρα, πλήθος) — ό,τι άλλο πετιέται, ποτέ δεν αθροίζεται. */
function readDaily(value: unknown): ListingViewDaily {
  const record = asRecord(value);
  if (record === null) return {};
  return Object.fromEntries(Object.entries(record).filter(([day, views]) => DAY.test(day) && isCount(views)));
}

/** Διάβασε μια σύνοψη, ή `null` αν το έγγραφο δεν είναι σύνοψη. */
export function readStoredListingStats(raw: unknown): StoredListingStats | null {
  const record = asRecord(raw);
  if (record === null || typeof record.propertyId !== 'string') return null;
  return {
    propertyId: record.propertyId,
    daily: readDaily(record.daily),
    archivedViews: isCount(record.archivedViews) ? record.archivedViews : 0,
    rolledThrough: typeof record.rolledThrough === 'string' ? record.rolledThrough : '',
  };
}

/** Διάβασε ένα shard, ή `null` αν δεν είναι shard. */
export function readStoredListingViewShard(raw: unknown): StoredListingViewShard | null {
  const record = asRecord(raw);
  if (record === null) return null;
  const { propertyId, day, views } = record;
  if (typeof propertyId !== 'string' || typeof day !== 'string' || !DAY.test(day) || !isCount(views)) return null;
  return { propertyId, day, views };
}

/** Άθροισε shards σε `{ ακίνητο → { ημέρα → προβολές } }`. */
export function sumShards(shards: readonly StoredListingViewShard[]): ReadonlyMap<string, ListingViewDaily> {
  const byProperty = new Map<string, Record<string, number>>();
  for (const shard of shards) {
    const daily = byProperty.get(shard.propertyId) ?? {};
    daily[shard.day] = (daily[shard.day] ?? 0) + shard.views;
    byProperty.set(shard.propertyId, daily);
  }
  return byProperty;
}
