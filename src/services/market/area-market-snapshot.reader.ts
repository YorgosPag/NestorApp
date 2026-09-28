import 'server-only';

/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΣΥΝΟΨΗΣ ΖΗΤΟΥΜΕΝΩΝ** — η τελευταία ολοκληρωμένη νύχτα + τα στιγμιότυπα των
 * περιοχών της, και η μηνιαία σειρά (ADR-890 §5.2 · §13).
 * @related `area-market-rollup.service.ts` (ο γραφέας) · `area-market-page.service.ts` (σελίδα περιοχής) ·
 *   `listing-market-context.service.ts` (σελίδα αγγελίας)
 * @module services/market/area-market-snapshot.reader
 *
 * 🔑 **ΕΝΑΣ αναγνώστης για δύο σελίδες** — μετακόμισε από το `area-market-page.service.ts` όταν τον χρειάστηκε και
 * η σελίδα αγγελίας (ADR-890 §13, N.0.2). Ο κανόνας «πρώτα το σημάδι, μετά η ημέρα του» ζει σε ΕΝΑ σημείο.
 *
 * 🔑 **ΚΑΝΕΝΑ ΕΡΩΤΗΜΑ.** Οι ταυτότητες είναι ντετερμινιστικές ⇒ `getAll` χωρίς `orderBy`, χωρίς δείκτη
 * (CHECK 3.15/3.91).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { shiftMarketDay } from '@/lib/listings/listing-stats';
import {
  AREA_MARKET_SERIES_PAGE_FIELDS,
  areaMarketMapFromDocument,
  areaMarketRunFromDocument,
  areaMarketSeriesFromDocument,
  areaMarketSeriesPointsFromDocument,
  areaMarketSnapshotFromDocument,
} from '@/lib/market/area-market-document';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type {
  AreaMarketMap,
  AreaMarketRun,
  AreaMarketSeries,
  AreaMarketSeriesPoints,
  AreaMarketSnapshot,
} from '@/types/area-market';

/** Πόσες νύχτες πίσω ψάχνεται ολοκληρωμένη σύνοψη. Πιο παλιά = «δεν υπάρχει πρόσφατη». */
const AREA_MARKET_LOOKBACK_DAYS = 7;

type ReadDoc = { readonly exists: boolean; data(): unknown };

/** Αποτελέσματα `getAll` (ίδια σειρά με τις ταυτότητες) ⇒ χάρτης `περιοχή → έγκυρο έγγραφο`. */
function parsedByArea<T>(areaIds: readonly string[], docs: readonly ReadDoc[], parse: (data: unknown) => T | null): ReadonlyMap<string, T> {
  const parsed = new Map<string, T>();
  docs.forEach((doc, index) => {
    const value = doc.exists ? parse(doc.data()) : null;
    if (value !== null) parsed.set(areaIds[index], value);
  });
  return parsed;
}

/** Η τελευταία ολοκληρωμένη νύχτα και τα στιγμιότυπα **εκείνης** της νύχτας (απόν = καμία αγγελία τότε). */
interface LatestAreaMarket {
  readonly run: AreaMarketRun;
  readonly snapshots: ReadonlyMap<string, AreaMarketSnapshot>;
}

async function readLatestRun(adminDb: AdminFirestore, today: string): Promise<AreaMarketRun | null> {
  const runs = adminDb.collection(COLLECTIONS.AREA_MARKET_RUNS);
  const refs = Array.from({ length: AREA_MARKET_LOOKBACK_DAYS }, (_, back) =>
    runs.doc(enterpriseIdService.generateDeterministicAreaMarketRunId(shiftMarketDay(today, -back))));
  const docs = await adminDb.getAll(...refs);
  // Τα `refs` είναι από το σήμερα προς τα πίσω ⇒ το πρώτο έγκυρο είναι το πιο πρόσφατο.
  for (const doc of docs) {
    const run = doc.exists ? areaMarketRunFromDocument(doc.data()) : null;
    if (run !== null) return run;
  }
  return null;
}

/**
 * **Τα στιγμιότυπα των περιοχών στην τελευταία ολοκληρωμένη νύχτα.** `null` = καμία ολοκληρωμένη νύχτα στο παράθυρο.
 * Ρίχνει ό,τι ρίχνει η Firestore — ο καλών αποφασίζει αν αυτό είναι 5xx ή «μη διαθέσιμο».
 */
export async function readLatestAreaMarket(
  adminDb: AdminFirestore,
  areaIds: readonly string[],
  today: string,
): Promise<LatestAreaMarket | null> {
  const run = await readLatestRun(adminDb, today);
  if (run === null) return null;
  if (areaIds.length === 0) return { run, snapshots: new Map() };
  const collection = adminDb.collection(COLLECTIONS.AREA_MARKET_SNAPSHOTS);
  const docs = await adminDb.getAll(
    ...areaIds.map((id) => collection.doc(enterpriseIdService.generateDeterministicAreaMarketSnapshotId(id, run.day))),
  );
  return { run, snapshots: parsedByArea(areaIds, docs, areaMarketSnapshotFromDocument) };
}

function seriesRefs(adminDb: AdminFirestore, areaIds: readonly string[]) {
  const collection = adminDb.collection(COLLECTIONS.AREA_MARKET_SERIES);
  return areaIds.map((id) => collection.doc(enterpriseIdService.generateDeterministicAreaMarketSeriesId(id)));
}

/**
 * **Τα σημεία της μηνιαίας σειράς, για τη σελίδα.** Με `fieldMask`: το βιβλίο του μήνα (ταυτότητες αγγελιών,
 * δεκάδες KB σε μεγάλο δήμο) **δεν** φεύγει ποτέ από τη βάση προς τη σελίδα. Απόν κλειδί = καμία σειρά ακόμη.
 */
export async function readAreaMarketSeriesPoints(
  adminDb: AdminFirestore,
  areaIds: readonly string[],
): Promise<ReadonlyMap<string, AreaMarketSeriesPoints>> {
  if (areaIds.length === 0) return new Map();
  const docs = await adminDb.getAll(...seriesRefs(adminDb, areaIds), { fieldMask: [...AREA_MARKET_SERIES_PAGE_FIELDS] });
  return parsedByArea(areaIds, docs, areaMarketSeriesPointsFromDocument);
}

/** **Ολόκληρες σειρές (με βιβλίο), για τον γραφέα.** Απόν κλειδί = νέα περιοχή ή έγγραφο άλλης εκδοχής. */
export async function readAreaMarketSeries(
  adminDb: AdminFirestore,
  areaIds: readonly string[],
): Promise<ReadonlyMap<string, AreaMarketSeries>> {
  if (areaIds.length === 0) return new Map();
  const docs = await adminDb.getAll(...seriesRefs(adminDb, areaIds));
  return parsedByArea(areaIds, docs, areaMarketSeriesFromDocument);
}

/**
 * **Ο χάρτης τιμών της τελευταίας ολοκληρωμένης νύχτας** (ADR-890 §14.4) — σημάδι, μετά **ένα** έγγραφο.
 * `null` = δεν υπάρχει (καμία νύχτα στο παράθυρο, ή νύχτα πριν από τον χάρτη) — γεγονός, όχι βλάβη.
 * Ρίχνει ό,τι ρίχνει η Firestore: ο καλών το κάνει «μη διαθέσιμο».
 */
export async function readLatestAreaMarketMap(adminDb: AdminFirestore, today: string): Promise<AreaMarketMap | null> {
  const run = await readLatestRun(adminDb, today);
  if (run === null) return null;
  const doc = await adminDb
    .collection(COLLECTIONS.AREA_MARKET_MAPS)
    .doc(enterpriseIdService.generateDeterministicAreaMarketMapId(run.day))
    .get();
  return doc.exists ? areaMarketMapFromDocument(doc.data()) : null;
}
