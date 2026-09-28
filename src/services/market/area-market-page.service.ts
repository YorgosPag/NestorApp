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
 * 🔑 **ΤΙΜΕΣ ΣΥΜΒΟΛΑΙΩΝ (ADR-890 Φ2)** από τα στατικά αρχεία του ADR-889 — περιοχή + Δήμος, για την ίδια αναγωγή.
 * Αποτυχία ανάγνωσής τους **δεν** ρίχνει τη σελίδα: η ενότητα λέει «δεν είναι διαθέσιμες» και τα υπόλοιπα μένουν.
 *
 * 🔑 **ΤΡΕΙΣ ΕΚΒΑΣΕΙΣ.** `not-found` (η ταυτότητα δεν είναι σελίδα περιοχής) ⇒ 404 · `unavailable` (δεν
 * μπορέσαμε να ρωτήσουμε) ⇒ 5xx, **ποτέ** 404 · `found`. Ίδιο ιδίωμα με το `/pro/[alias]`.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { adminAreaAncestors, isAdminAreaId, type AdminArea } from '@/lib/geo/admin-area-index-file';
import { adminAreaFieldOfLevel } from '@/lib/geo/admin-area-of-point';
import { compareListingsByListedAt } from '@/lib/listings/listing-results-order';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { readAreaMarketSeriesPoints, readLatestAreaMarket } from '@/services/market/area-market-snapshot.reader';
import { readAreaSummary } from '@/services/market/market-transactions.reader';
import { readValueZoneFileIds } from '@/services/market/value-zones.reader';
import { readAdminAreaDirectory } from '@/services/places/admin-boundaries.reader';
import {
  hasAreaMarketPage,
  type AreaContractsState,
  type AreaListingsPreview,
  type AreaMarketPage,
  type AreaMarketState,
} from '@/types/area-market';
import type { PublicListing } from '@/types/public-listing';

/** Πόσες αγγελίες διαβάζονται για την προεπισκόπηση (ταξινομούνται στη μνήμη, νεότερες πρώτα). */
const AREA_LISTINGS_READ_LIMIT = 200;

/** Πόσες αγγελίες δείχνει η σελίδα· οι υπόλοιπες είναι ένα κλικ μακριά, στον χάρτη αποτελεσμάτων. */
const AREA_LISTINGS_SHOWN = 12;

async function readMarket(adminDb: AdminFirestore, areaId: string, parentId: string | null, today: string): Promise<AreaMarketState> {
  const ids = parentId === null ? [areaId] : [areaId, parentId];
  const [latest, series] = await Promise.all([readLatestAreaMarket(adminDb, ids, today), readAreaMarketSeriesPoints(adminDb, [areaId])]);
  if (latest === null) return { kind: 'no-run' };
  const own = latest.snapshots.get(areaId) ?? null;
  const parent = parentId === null ? null : (latest.snapshots.get(parentId) ?? null);
  return { kind: 'ready', run: latest.run, snapshot: own, parent, series: series.get(areaId) ?? null };
}

async function readListings(adminDb: AdminFirestore, area: AdminArea): Promise<AreaListingsPreview> {
  const field = adminAreaFieldOfLevel(area.level);
  if (field === null) return { items: [], total: 0 };
  // tenant-scope-exempt: το `public_listings` είναι `published-projection` (tenant-config) — δημοσιευμένη
  // προβολή χωρίς ταυτότητα πελάτη· η ερώτηση «ποιες αγγελίες είναι σε αυτόν τον δήμο» είναι εξ ορισμού
  // πάνω από όλους τους μισθωτές, όπως η αναζήτηση.
  const query = adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).where(`adminArea.${field}`, '==', area.id);
  const [snapshot, count] = await Promise.all([query.limit(AREA_LISTINGS_READ_LIMIT).get(), query.count().get()]);
  const listings: PublicListing[] = [];
  for (const doc of snapshot.docs) {
    const listing = publicListingFromDocument(doc.data(), doc.id);
    if (listing !== null) listings.push(listing);
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

/** Ο γονέας της σύνοψης: μόνο όταν είναι κι αυτός σελίδα περιοχής (Δ.Ε. ⇒ Δήμος). */
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
  const [market, listings, contracts, valueZoneFiles] = await Promise.all([
    readMarket(adminDb, area.id, parentId, today),
    readListings(adminDb, area),
    readContracts(area.id, parentId),
    readValueZoneFileIds([area.id, ...children.map((child) => child.id)]),
  ]);
  return { kind: 'found', area, ancestors, children, market, listings, contracts, valueZoneFiles };
}
