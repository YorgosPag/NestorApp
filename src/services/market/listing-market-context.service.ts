import 'server-only';

/**
 * @fileoverview **ΤΙΜΕΣ ΣΥΜΒΟΛΑΙΩΝ ΓΙΑ ΜΙΑ ΑΓΓΕΛΙΑ** — διάμεσος της περιοχής, τιμή ζώνης, πού πέφτει η ζητούμενη
 * τιμή, και οι συγκρίσιμες πωλήσεις (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `lib/market/listing-market-context.ts` (το συμβόλαιο) · `lib/market/comparable-sales.ts` (η μηχανή) ·
 *   `lib/market/area-market-summary.ts` (`observeAsking` — ο ΙΔΙΟΣ κανόνας ζητούμενης τιμής με τη σελίδα περιοχής)
 * @module services/market/listing-market-context.service
 *
 * 🔑 **Η ΖΗΤΟΥΜΕΝΗ ΤΙΜΗ ΚΡΙΝΕΤΑΙ ΟΠΩΣ ΣΤΗ ΣΕΛΙΔΑ ΠΕΡΙΟΧΗΣ.** Ίδιο τμήμα, ίδιο εμβαδόν, ίδιος έλεγχος
 * αληθοφάνειας (`observeAsking`) — αλλιώς η αγγελία θα συγκρινόταν με άλλο μέτρο από εκείνο που μετρά τις
 * ζητούμενες της περιοχής. Αγγελία μόνο για ενοίκιο ⇒ καμία ζητούμενη τιμή πώλησης, οι συγκρίσιμες όμως μένουν.
 *
 * 🔑 **`null` = «δεν μπόρεσα να ρωτήσω»** (η διαδρομή απαντά 503) — ποτέ «δεν υπάρχουν συμβόλαια».
 *
 * 🔑 **Ο ΚΑΔΟΣ ΕΤΟΥΣ (ADR-890 §13.Α)**: ζητούμενη + συμβόλαιο του κάδου της αγγελίας, στην **ίδια** περιοχή με τα
 * συμβόλαια. Οι ζητούμενες έρχονται από τη νυχτερινή σύνοψη (Firestore)· αποτυχία τους ⇒ `asking: null` και η
 * απάντηση **μένει** 200: τα συμβόλαια είναι ο κορμός της ενότητας, ο κάδος είναι λεπτομέρεια.
 */

import type { AdminFirestore } from '@/lib/api/guarded-route';
import { observeAsking } from '@/lib/market/area-market-summary';
import { findComparableSales, type ComparableSalesResult, type ComparableTarget } from '@/lib/market/comparable-sales';
import type { ListingContractsContext, ListingMarketContext, ListingYearBuiltContext } from '@/lib/market/listing-market-context';
import { bucketOf, YEAR_BUILT_BUCKETS } from '@/lib/market/market-breakdowns';
import { SEGMENT_METRIC, marketSegmentOfType, type MarketSegment } from '@/lib/market/market-segments';
import { medianGapPct, type StatCell } from '@/lib/market/market-statistics';
import type { SegmentSummary } from '@/lib/market/market-transactions-file';
import { listingObjectiveValue } from '@/lib/objective-value/listing-objective-value';
import { createModuleLogger } from '@/lib/telemetry';
import { readLatestAreaMarket } from '@/services/market/area-market-snapshot.reader';
import { readAreaRows, readAreaSummary } from '@/services/market/market-transactions.reader';
import { readValueZoneAt } from '@/services/market/value-zones.reader';
import { readAdminAreaDirectory } from '@/services/places/admin-boundaries.reader';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('listing-market-context');

const EMPTY_POOL: ComparableSalesResult = { kind: 'suppressed', pool: 0 };

type AskingBuckets = Readonly<Record<string, StatCell>>;

/** Πού ρωτά ο κάδος έτους: η βάση και η ημέρα αγοράς (το ρολόι διαβάζεται στο σύνορο). */
interface AskingSource {
  readonly adminDb: AdminFirestore;
  readonly today: string;
}

/** Οι περιοχές κατά σειρά λεπτομέρειας: Δ.Ε., μετά Δήμος. */
function candidateAreas(listing: PublicListing): readonly string[] {
  const area = listing.adminArea;
  if (area === null) return [];
  return [...new Set([area.municipalUnitId, area.municipalityId].filter((id): id is string => id !== null))];
}

function targetOf(listing: PublicListing, segment: MarketSegment): ComparableTarget {
  const size = listing.areaSqm !== null && listing.areaSqm > 0 && SEGMENT_METRIC[segment] !== 'perUnit' ? listing.areaSqm : null;
  return { segment, size, yearBuilt: listing.constructionYear?.value ?? null, floor: listing.floor };
}

function askingUnitPriceOf(listing: PublicListing, segment: MarketSegment): number | null {
  const verdict = observeAsking(listing, 'sale');
  return verdict !== null && 'observed' in verdict && verdict.observed.segment === segment ? Math.round(verdict.observed.unitPrice) : null;
}

interface AreaPick {
  readonly areaId: string;
  readonly comparables: ComparableSalesResult;
}

/** Η λεπτότερη περιοχή με αρκετές συγκρίσιμες — αλλιώς η πρώτη, με ό,τι βρέθηκε. `null` = σφάλμα ανάγνωσης. */
async function pickArea(areaIds: readonly string[], target: ComparableTarget, asking: number | null): Promise<AreaPick | null> {
  let fallback: AreaPick | null = null;
  for (const areaId of areaIds) {
    const rows = await readAreaRows(areaId);
    if (rows === null) return null;
    const comparables = rows.kind === 'ready'
      ? findComparableSales({ ...rows.file, categorySegments: rows.index.categorySegments, asOf: rows.index.asOf }, target, asking)
      : EMPTY_POOL;
    if (comparables.kind === 'ready') return { areaId, comparables };
    fallback ??= { areaId, comparables };
  }
  return fallback;
}

/**
 * Οι κάδοι έτους των ζητούμενων **πώλησης** του τμήματος στην τελευταία νύχτα. `{}` = μετρήθηκε, κανένας κάδος
 * (καμία αγγελία του τμήματος) · `null` = δεν μετρήθηκε (καμία νύχτα, στιγμιότυπο πριν από τον άξονα) ή σφάλμα.
 */
async function readAskingBuckets(source: AskingSource, areaId: string, segment: MarketSegment): Promise<AskingBuckets | null> {
  try {
    const latest = await readLatestAreaMarket(source.adminDb, [areaId], source.today);
    if (latest === null) return null;
    const summary = latest.snapshots.get(areaId)?.offers.sale.segments[segment];
    if (summary === undefined) return {};
    return summary.breakdowns.yearBuilt?.buckets ?? null;
  } catch (error) {
    logger.warn('Οι ζητούμενες του κάδου έτους δεν διαβάστηκαν — η ενότητα μένει χωρίς αυτές', { data: { areaId, error: String(error) } });
    return null;
  }
}

/** Ο κάδος έτους της αγγελίας — μόνο για τμήμα με κτίσμα και αγγελία που δηλώνει έτος. */
async function loadYearBuilt(
  source: AskingSource,
  listing: PublicListing,
  areaId: string,
  segment: MarketSegment,
  figures: SegmentSummary | undefined,
): Promise<ListingYearBuiltContext | null> {
  const year = listing.constructionYear?.value ?? null;
  if (SEGMENT_METRIC[segment] !== 'perSqmBuilding' || year === null) return null;
  const bucket = bucketOf(YEAR_BUILT_BUCKETS, year);
  if (bucket === null) return null;
  const buckets = await readAskingBuckets(source, areaId, segment);
  const asking = buckets === null ? null : (buckets[bucket.key] ?? { n: 0 });
  const contract = figures?.yearBuilt[bucket.key] ?? null;
  return { bucket: bucket.key, asking, contract, gapPct: medianGapPct(asking, contract) };
}

/** Τα συμβόλαια της περιοχής για την αγγελία. `null` = σφάλμα ανάγνωσης. */
async function loadContracts(listing: PublicListing, source: AskingSource): Promise<ListingContractsContext | null> {
  const areaIds = candidateAreas(listing);
  if (areaIds.length === 0) return { kind: 'no-area' };
  const segment = marketSegmentOfType(listing.type);
  if (segment === null) return { kind: 'no-segment' };

  const target = targetOf(listing, segment);
  const askingUnitPrice = askingUnitPriceOf(listing, segment);
  const [pick, directory] = await Promise.all([pickArea(areaIds, target, askingUnitPrice), readAdminAreaDirectory()]);
  if (pick === null || directory === null) return null;

  const summary = await readAreaSummary(pick.areaId);
  if (summary === null) return null;
  const figures = summary.kind === 'ready' ? summary.file.segments[segment] : undefined;
  const yearBuilt = await loadYearBuilt(source, listing, pick.areaId, segment, figures);
  return {
    kind: 'ready',
    area: { id: pick.areaId, name: directory.areas.get(pick.areaId)?.name ?? pick.areaId },
    segment,
    asOf: summary.index.asOf,
    window: summary.index.window,
    last12: figures?.last12 ?? { n: 0 },
    zone: figures?.zone ?? null,
    priceToZonePct: figures?.priceToZonePct ?? null,
    askingUnitPrice,
    target: { size: target.size, yearBuilt: target.yearBuilt, floor: target.floor },
    comparables: pick.comparables,
    yearBuilt,
  };
}

/**
 * **Οι τιμές συμβολαίων μιας αγγελίας, η ζώνη αντικειμενικής αξίας της θέσης της** (ADR-889 Φ2 + Φ5) **και η
 * αντικειμενική αξία της** (ADR-898 Φ3).
 *
 * 🔑 Η ζώνη **δεν** ρίχνει τα συμβόλαια: αποτυχία ανάγνωσης ζωνών ⇒ `valueZone: unavailable`, τα συμβόλαια μένουν. Το
 * αντίστροφο ισχύει ήδη (`null` ⇒ 503): χωρίς συμβόλαια η ενότητα δεν έχει κορμό.
 *
 * 🔑 **Η αντικειμενική υπολογίζεται εδώ, κατά την ανάγνωση** — ποτέ πεδίο της αγγελίας: οι τιμές ζωνών αναθεωρούνται
 * (ADR-889 §10.2). Καθαρή συνάρτηση πάνω στη ζώνη που μόλις διαβάστηκε, χωρίς δεύτερη ανάγνωση.
 */
export async function loadListingMarketContext(
  listing: PublicListing,
  adminDb: AdminFirestore,
  today: string,
): Promise<ListingMarketContext | null> {
  const [contracts, valueZone] = await Promise.all([loadContracts(listing, { adminDb, today }), readValueZoneAt(listing.position)]);
  if (contracts === null) return null;
  return { ...contracts, valueZone, objectiveValue: listingObjectiveValue(listing, valueZone, today) };
}
