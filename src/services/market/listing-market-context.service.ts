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
 */

import { observeAsking } from '@/lib/market/area-market-summary';
import { findComparableSales, type ComparableSalesResult, type ComparableTarget } from '@/lib/market/comparable-sales';
import type { ListingMarketContext } from '@/lib/market/listing-market-context';
import { SEGMENT_METRIC, marketSegmentOfType, type MarketSegment } from '@/lib/market/market-segments';
import { readAreaRows, readAreaSummary } from '@/services/market/market-transactions.reader';
import { readAdminAreaDirectory } from '@/services/places/admin-boundaries.reader';
import type { PublicListing } from '@/types/public-listing';

const EMPTY_POOL: ComparableSalesResult = { kind: 'suppressed', pool: 0 };

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

/** **Οι τιμές συμβολαίων μιας αγγελίας.** */
export async function loadListingMarketContext(listing: PublicListing): Promise<ListingMarketContext | null> {
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
  return {
    kind: 'ready',
    area: { id: pick.areaId, name: directory.areas.get(pick.areaId)?.name ?? pick.areaId },
    segment,
    asOf: summary.index.asOf,
    window: summary.index.window,
    last12: figures?.last12 ?? { n: 0 },
    zone: figures?.zone ?? null,
    askingUnitPrice,
    target: { size: target.size, yearBuilt: target.yearBuilt, floor: target.floor },
    comparables: pick.comparables,
  };
}
