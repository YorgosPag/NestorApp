import 'server-only';

/**
 * @fileoverview **Η ΝΥΧΤΕΡΙΝΗ ΣΥΝΟΨΗ ΑΓΟΡΑΣ ΑΝΑ ΠΕΡΙΟΧΗ** — ζωντανές αγγελίες ⇒ ένα έγγραφο ανά (περιοχή,
 * ημέρα) + ένα σημάδι ολοκλήρωσης (ADR-890 §5.2).
 * @related lib/cron/jobs/area-market-rollup.job.ts (ο καλών) · lib/market/area-market-summary.ts (ο υπολογισμός)
 * @module services/market/area-market-rollup.service
 *
 * 🔴 **ΤΟ ΣΗΜΑΔΙ ΓΡΑΦΕΤΑΙ ΤΕΛΕΥΤΑΙΟ.** Οι συνόψεις γράφονται σε batches· αν η εκτέλεση πέσει στη μέση, η
 * ημέρα **δεν** έχει σημάδι και η σελίδα συνεχίζει να διαβάζει την προηγούμενη ολοκληρωμένη ημέρα. Ποτέ
 * μισή Ελλάδα από σήμερα και μισή από χθες.
 *
 * 🔑 **Ιδεμποτικό εκ κατασκευής**: ταυτότητες ντετερμινιστικές (`amks` από περιοχή+ημέρα, `amkr` από ημέρα)
 * και `set()` ολόκληρου εγγράφου ⇒ η επανεκτέλεση της ίδιας ημέρας ξαναγράφει τα ίδια έγγραφα.
 *
 * 📈 **Η ΜΗΝΙΑΙΑ ΣΕΙΡΑ (ADR-890 §13)** γράφεται μαζί με τα στιγμιότυπα, **πριν** από το σημάδι: ανάγνωση της χθεσινής
 * σειράς κάθε περιοχής (`getAll`), συγχώνευση απόψε στο βιβλίο του μήνα (`nextAreaMarketSeries`), `set` ολόκληρου
 * εγγράφου. Ίδια νύχτα δύο φορές ⇒ ίδιο έγγραφο.
 *
 * 🗺️ **Ο ΧΑΡΤΗΣ ΤΙΜΩΝ (ADR-890 §14.4)** γράφεται κι αυτός **πριν** από το σημάδι: ένα έγγραφο `ammp_<ημέρα>` με ό,τι
 * δημοσιεύεται (`[n, διάμεσος]`) για όλες τις περιοχές — το endpoint του χάρτη αναζήτησης το διαβάζει με **1** ανάγνωση.
 *
 * ⚠️ **Ένας γραφέας**: το cron τρέχει με lease (`cron-lease`) — γι' αυτό η ανάγνωση-και-εγγραφή της σειράς δεν
 * χρειάζεται συναλλαγή.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { chunkArray } from '@/lib/array-utils';
import { nextAreaMarketSeries } from '@/lib/market/area-market-series';
import { groupListingsByArea, summarizeArea } from '@/lib/market/area-market-summary';
import { buildAreaMarketMap } from '@/lib/market/price-map';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { readLivePublicListings } from '@/services/listings/live-public-listings.reader';
import { readAreaMarketSeries } from '@/services/market/area-market-snapshot.reader';
import type { PublicListing } from '@/types/public-listing';
import {
  AREA_MARKET_MAP_SCHEMA_VERSION,
  AREA_MARKET_SNAPSHOT_SCHEMA_VERSION,
  type AreaMarketRun,
  type AreaMarketSnapshot,
} from '@/types/area-market';

const logger = createModuleLogger('area-market-rollup');

/** Κάτω από το όριο των 500 εγγραφών ανά batch του Firestore, με περιθώριο. */
const SNAPSHOTS_PER_BATCH = 400;

async function writeSnapshots(adminDb: AdminFirestore, snapshots: readonly AreaMarketSnapshot[]): Promise<void> {
  const collection = adminDb.collection(COLLECTIONS.AREA_MARKET_SNAPSHOTS);
  for (const chunk of chunkArray([...snapshots], SNAPSHOTS_PER_BATCH)) {
    const batch = adminDb.batch();
    for (const snapshot of chunk) {
      batch.set(collection.doc(enterpriseIdService.generateDeterministicAreaMarketSnapshotId(snapshot.areaId, snapshot.day)), snapshot);
    }
    await batch.commit();
  }
}

/** Η μηνιαία σειρά κάθε περιοχής με αγγελίες απόψε — ανάγνωση σε κομμάτια, εγγραφή σε batches. */
async function writeSeries(adminDb: AdminFirestore, day: string, byArea: ReadonlyMap<string, readonly PublicListing[]>): Promise<void> {
  const collection = adminDb.collection(COLLECTIONS.AREA_MARKET_SERIES);
  for (const areaIds of chunkArray([...byArea.keys()], SNAPSHOTS_PER_BATCH)) {
    const previous = await readAreaMarketSeries(adminDb, areaIds);
    const batch = adminDb.batch();
    for (const areaId of areaIds) {
      const series = nextAreaMarketSeries(previous.get(areaId) ?? null, areaId, day, byArea.get(areaId) ?? []);
      batch.set(collection.doc(enterpriseIdService.generateDeterministicAreaMarketSeriesId(areaId)), series);
    }
    await batch.commit();
  }
}

/**
 * **Μία νύχτα**: διαβάζει τις ζωντανές αγγελίες, γράφει τις συνόψεις και **μετά** το σημάδι.
 * @param day ημέρα αγοράς Αθήνας (`marketDayOf`) — το ρολόι διαβάζεται στον καλούντα
 */
export async function rollupAreaMarket(adminDb: AdminFirestore, day: string, now: Date): Promise<AreaMarketRun> {
  const pool = await readLivePublicListings(adminDb, 'area-market-rollup');
  const groups = groupListingsByArea(pool.listings);

  const snapshots = [...groups.byArea].map(([areaId, listings]) => summarizeArea(areaId, day, listings));
  await writeSnapshots(adminDb, snapshots);
  await writeSeries(adminDb, day, groups.byArea);
  await adminDb
    .collection(COLLECTIONS.AREA_MARKET_MAPS)
    .doc(enterpriseIdService.generateDeterministicAreaMarketMapId(day))
    .set(buildAreaMarketMap(AREA_MARKET_MAP_SCHEMA_VERSION, day, snapshots));

  const run: AreaMarketRun = {
    schemaVersion: AREA_MARKET_SNAPSHOT_SCHEMA_VERSION,
    day,
    areas: snapshots.length,
    listings: pool.listings.length,
    unassigned: groups.unassigned,
    truncated: pool.truncated,
    completedAt: now.toISOString(),
  };
  await adminDb
    .collection(COLLECTIONS.AREA_MARKET_RUNS)
    .doc(enterpriseIdService.generateDeterministicAreaMarketRunId(day))
    .set(run);

  if (groups.unassigned > 0) {
    // Αγγελίες χωρίς `adminArea` = παλιός κρίκος σχήματος (πριν τον 14) ή θέση εκτός ορίων.
    // Η θεραπεία είναι η επαναπροβολή (ADR-890 §9.3), όχι υπολογισμός εδώ.
    logger.warn('Αγγελίες χωρίς περιοχή δεν μέτρησαν στη σύνοψη', { data: { day, unassigned: String(groups.unassigned) } });
  }
  return run;
}
