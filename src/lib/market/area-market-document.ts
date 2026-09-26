/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ της σύνοψης αγοράς** — αποθηκευμένο έγγραφο ⇒ τύπος, ή `null`
 * (ADR-890 §5.2). Το ίδιο ιδίωμα με το `public-listing-from-document.ts` (CHECK 3.74): ένας ισχυρισμός
 * τύπου, **μετά** από έλεγχο, σε ένα σημείο.
 * @related ADR-890 · `types/area-market.ts`
 * @module lib/market/area-market-document
 *
 * 🔑 **Έγγραφο άλλης εκδοχής σχήματος = απουσία, όχι βλάβη.** Όταν αλλάξει το σχήμα (κρίκος 2), τα παλιά
 * στιγμιότυπα διαβάζονται ως «δεν υπάρχει» μέχρι να ξαναγραφτούν, αντί να δώσουν `undefined` στην οθόνη.
 */

import {
  AREA_MARKET_SNAPSHOT_SCHEMA_VERSION,
  ASKING_OFFERS,
  type AreaMarketRun,
  type AreaMarketSnapshot,
} from '@/types/area-market';

type DocumentData = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is DocumentData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOfferSummary(value: unknown): boolean {
  return isRecord(value)
    && typeof value.listings === 'number'
    && typeof value.counted === 'number'
    && isRecord(value.excluded)
    && isRecord(value.segments);
}

/** Έγγραφο `area_market_snapshots` ⇒ σύνοψη, ή `null` όταν δεν έχει το σχήμα της τρέχουσας εκδοχής. */
export function areaMarketSnapshotFromDocument(data: unknown): AreaMarketSnapshot | null {
  if (!isRecord(data) || data.schemaVersion !== AREA_MARKET_SNAPSHOT_SCHEMA_VERSION) return null;
  if (typeof data.areaId !== 'string' || typeof data.day !== 'string' || typeof data.listingCount !== 'number') return null;
  const offers = data.offers;
  if (!isRecord(offers) || !ASKING_OFFERS.every((offer) => isOfferSummary(offers[offer]))) return null;
  // Ο ΜΟΝΟΣ ισχυρισμός τύπου της συλλογής — μετά τον έλεγχο του σχήματος.
  return data as unknown as AreaMarketSnapshot;
}

/** Έγγραφο `area_market_runs` ⇒ σημάδι εκτέλεσης, ή `null`. */
export function areaMarketRunFromDocument(data: unknown): AreaMarketRun | null {
  if (!isRecord(data) || data.schemaVersion !== AREA_MARKET_SNAPSHOT_SCHEMA_VERSION) return null;
  if (typeof data.day !== 'string' || typeof data.completedAt !== 'string') return null;
  if (typeof data.areas !== 'number' || typeof data.listings !== 'number' || typeof data.unassigned !== 'number') return null;
  if (typeof data.truncated !== 'boolean') return null;
  return data as unknown as AreaMarketRun;
}
