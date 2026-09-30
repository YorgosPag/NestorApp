import 'server-only';

/**
 * @fileoverview **ΤΑ ΔΕΔΟΜΕΝΑ ΤΗΣ ΣΕΛΙΔΑΣ ΠΕΡΙΟΧΗΣ** — ταυτότητα από το ευρετήριο, σύνοψη της τελευταίας
 * ολοκληρωμένης νύχτας, και οι ζωντανές αγγελίες της περιοχής (ADR-890 Φ1).
 * @related app/(light)/area/[id]/page.tsx (ο καλών) · area-market-rollup.service.ts (ο γραφέας)
 * @module services/market/area-market-page.service
 *
 * 🔑 **ΚΑΝΕΝΑ ΕΡΩΤΗΜΑ ΓΙΑ ΤΗ ΣΥΝΟΨΗ.** Σημάδι → στιγμιότυπα (περιοχή + γονέας) → μηνιαία σειρά, όλα με `getAll`
 * ντετερμινιστικών ταυτοτήτων μέσω του `area-market-snapshot.reader.ts` (κοινού με τη σελίδα αγγελίας).
 *
 * 🔑 **ΤΙΜΕΣ ΣΥΜΒΟΛΑΙΩΝ (ADR-890 Φ2)** από τα στατικά αρχεία του ADR-889 — περιοχή + γονέας με σελίδα, για την ίδια
 * αναγωγή (Δ.Ε. → Δήμος → Π.Ε. → Περιφέρεια, §16).
 * Αποτυχία ανάγνωσής τους **δεν** ρίχνει τη σελίδα: η ενότητα λέει «δεν είναι διαθέσιμες» και τα υπόλοιπα μένουν.
 *
 * 🔑 **ΤΡΕΙΣ ΕΚΒΑΣΕΙΣ.** `not-found` (η ταυτότητα δεν είναι σελίδα περιοχής) ⇒ 404 · `unavailable` (δεν
 * μπορέσαμε να ρωτήσουμε) ⇒ 5xx, **ποτέ** 404 · `found`. Ίδιο ιδίωμα με το `/pro/[alias]`.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { adminAreaAncestors, isAdminAreaId, type AdminArea } from '@/lib/geo/admin-area-index-file';
import { adminAreaFieldOfLevel } from '@/lib/geo/admin-area-of-point';
import { ADMIN_OVERVIEW_CHILDREN_MIN } from '@/lib/geo/admin-overview-file';
import { compareListingsByListedAt } from '@/lib/listings/listing-results-order';
import { pickPriceMapAreas } from '@/lib/market/price-map';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { readAreaMarketSeriesPoints, readLatestAreaMarket } from '@/services/market/area-market-snapshot.reader';
import { readAreaSummary, readContractPriceMap } from '@/services/market/market-transactions.reader';
import { readValueZoneFileIds } from '@/services/market/value-zones.reader';
import { readAdminAreaDirectory } from '@/services/places/admin-boundaries.reader';
import {
  hasAreaMarketPage,
  hasValueZoneMap,
  type AreaChildPricesState,
  type AreaContractsState,
  type AreaListingsPreview,
  type AreaMarketPage,
  type AreaMarketState,
} from '@/types/area-market';
import type { PublicListing } from '@/types/public-listing';

/** Πόσες αγγελίες δείχνει η σελίδα· οι υπόλοιπες είναι ένα κλικ μακριά, στον χάρτη αποτελεσμάτων. */
const AREA_LISTINGS_SHOWN = 12;

/** Πόσες αγγελίες **άγνωστης** ημερομηνίας διαβάζονται για συμπλήρωση (ταξινομούνται στη μνήμη, τίτλος → id). */
const UNKNOWN_LISTED_AT_READ_LIMIT = 200;

/**
 * **Ο δείκτης που ζητά η προεπισκόπηση αγγελιών** (ADR-890 §17): `adminArea.<πεδίο βαθμίδας> ↑` + `listedAt.at ↓`, ένας
 * ανά βαθμίδα με σελίδα. Το πεδίο του ερωτήματος είναι δυναμικό, άρα η πύλη 3.91 το βλέπει «μη αναλύσιμο»· τον δείκτη
 * τον φυλάει η άγκυρα `area-listings-index.test.ts`, που διαβάζει **αυτή** τη δήλωση — δύο αντίγραφα χωρίς απόκλιση.
 */
export const AREA_LISTINGS_INDEX = {
  orderBy: { field: 'listedAt.at', direction: 'desc' },
  unknown: { field: 'listedAt.kind', value: 'unknown' },
} as const;

async function readMarket(adminDb: AdminFirestore, areaId: string, parentId: string | null, today: string): Promise<AreaMarketState> {
  const ids = parentId === null ? [areaId] : [areaId, parentId];
  const [latest, series] = await Promise.all([readLatestAreaMarket(adminDb, ids, today), readAreaMarketSeriesPoints(adminDb, [areaId])]);
  if (latest === null) return { kind: 'no-run' };
  const own = latest.snapshots.get(areaId) ?? null;
  const parent = parentId === null ? null : (latest.snapshots.get(parentId) ?? null);
  return { kind: 'ready', run: latest.run, snapshot: own, parent, series: series.get(areaId) ?? null };
}

function listingsOf(snapshot: FirebaseFirestore.QuerySnapshot): PublicListing[] {
  const listings: PublicListing[] = [];
  for (const doc of snapshot.docs) {
    const listing = publicListingFromDocument(doc.data(), doc.id);
    if (listing !== null) listings.push(listing);
  }
  return listings;
}

/**
 * **Οι νεότερες αγγελίες της περιοχής — ίδια σειρά με το `compareListingsByListedAt`, σε οποιοδήποτε μέγεθος.**
 *
 * 🔴 Το `orderBy('listedAt.at')` **εξαιρεί** όσες δεν έχουν το πεδίο, δηλαδή τις άγνωστης ημερομηνίας (μετρημένο
 * 2026-09-30: **9 από 15**). Γι' αυτό δύο ερωτήματα: οι γνωστές ταξινομημένες από τον δείκτη, και —μόνο αν δεν γέμισαν
 * τη σελίδα— οι άγνωστες, που ο συγκριτής βάζει έτσι κι αλλιώς **στο τέλος**. Το άθροισμα είναι ακριβώς η σειρά του
 * συγκριτή· καμία αγγελία δεν χάνεται σιωπηλά.
 */
async function readListings(adminDb: AdminFirestore, area: AdminArea): Promise<AreaListingsPreview> {
  const field = adminAreaFieldOfLevel(area.level);
  if (field === null) return { items: [], total: 0 };
  // tenant-scope-exempt: το `public_listings` είναι `published-projection` (tenant-config) — δημοσιευμένη
  // προβολή χωρίς ταυτότητα πελάτη· η ερώτηση «ποιες αγγελίες είναι σε αυτόν τον δήμο» είναι εξ ορισμού
  // πάνω από όλους τους μισθωτές, όπως η αναζήτηση.
  const query = adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).where(`adminArea.${field}`, '==', area.id);
  const { orderBy, unknown } = AREA_LISTINGS_INDEX;
  const [known, count] = await Promise.all([
    query.orderBy(orderBy.field, orderBy.direction).limit(AREA_LISTINGS_SHOWN).get(),
    query.count().get(),
  ]);
  const listings = listingsOf(known);
  if (known.size < AREA_LISTINGS_SHOWN) {
    const rest = await query.where(unknown.field, '==', unknown.value).limit(UNKNOWN_LISTED_AT_READ_LIMIT).get();
    listings.push(...listingsOf(rest));
  }
  listings.sort(compareListingsByListedAt);
  return { items: listings.slice(0, AREA_LISTINGS_SHOWN), total: count.data().count };
}

async function readContracts(areaId: string, parentId: string | null): Promise<AreaContractsState> {
  const [own, parent] = await Promise.all([
    readAreaSummary(areaId),
    parentId === null ? Promise.resolve(null) : readAreaSummary(parentId),
  ]);
  if (own === null) return { kind: 'unavailable' };
  const window = own.index.window;
  if (own.kind === 'none') return { kind: 'none', window };
  return { kind: 'ready', window, summary: own.file, parent: parent?.kind === 'ready' ? parent.file : null };
}

/**
 * Οι τιμές των **παιδιών** για τον χάρτη σύγκρισης (ADR-890 §15 · §16: Περιφέρεια → Π.Ε. → Δήμοι → Δ.Ε.) — **μόνο** όταν
 * η περιοχή έχει αρχείο παιδιών (ίδιος κανόνας με τον γεννήτορα, `ADMIN_OVERVIEW_CHILDREN_MIN`). Κρατά και την ίδια την
 * περιοχή: αναγωγή κάτω από το κατώφλι.
 */
async function readChildPrices(area: AdminArea, children: readonly AdminArea[]): Promise<AreaChildPricesState> {
  if (children.length < ADMIN_OVERVIEW_CHILDREN_MIN) return { kind: 'none' };
  const file = await readContractPriceMap();
  if (file === null) return { kind: 'unavailable' };
  return { kind: 'ready', asOf: file.asOf, areas: pickPriceMapAreas(file.areas, [area.id, ...children.map((child) => child.id)]) };
}

/** Ο γονέας της σύνοψης: μόνο όταν είναι κι αυτός σελίδα περιοχής (Δ.Ε. ⇒ Δήμος ⇒ Π.Ε. ⇒ Περιφέρεια, §16). */
function marketParentOf(area: AdminArea, ancestors: readonly AdminArea[]): string | null {
  const parent = ancestors[0];
  return parent !== undefined && hasAreaMarketPage(parent.level) && parent.level < area.level ? parent.id : null;
}

/**
 * **Η σελίδα μιας περιοχής.** Ρίχνει μόνο ό,τι ρίχνει η Firestore· ο καλών το αποδίδει ως 5xx.
 * @param today ημέρα αγοράς Αθήνας (`marketDayOf`) — το ρολόι διαβάζεται στο σύνορο
 */
export async function loadAreaMarketPage(adminDb: AdminFirestore, areaId: string, today: string): Promise<AreaMarketPage> {
  if (!isAdminAreaId(areaId)) return { kind: 'not-found' };
  const directory = await readAdminAreaDirectory();
  if (directory === null) return { kind: 'unavailable' };

  const area = directory.areas.get(areaId);
  if (area === undefined || !hasAreaMarketPage(area.level)) return { kind: 'not-found' };

  const ancestors = adminAreaAncestors(directory.areas, area.id);
  const children = directory.childrenOf(area.id).filter((child) => hasAreaMarketPage(child.level));
  const parentId = marketParentOf(area, ancestors);
  const [market, listings, contracts, valueZoneFiles, childPrices] = await Promise.all([
    readMarket(adminDb, area.id, parentId, today),
    readListings(adminDb, area),
    readContracts(area.id, parentId),
    hasValueZoneMap(area.level) ? readValueZoneFileIds([area.id, ...children.map((child) => child.id)]) : Promise.resolve([]),
    readChildPrices(area, children),
  ]);
  return { kind: 'found', area, ancestors, children, market, listings, contracts, valueZoneFiles, childPrices };
}
