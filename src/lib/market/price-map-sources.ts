/**
 * @fileoverview **Οι τεμπέλικες πηγές του χάρτη τιμών στον browser** (ADR-890 §14) — γεωμετρία ανά βαθμίδα, τιμές
 * συμβολαίων (στατικό αρχείο), τιμές ζητούμενων (endpoint). Μία φόρτωση ανά σελίδα, με έλεγχο σχήματος.
 * @related `lib/geo/admin-overview-file.ts` · `lib/market/price-map.ts` · `hooks/market/usePriceMap.ts` (ο καταναλωτής)
 * @module lib/market/price-map-sources
 *
 * 🔑 **Καμία φόρτωση πριν ζητηθεί**: οι πηγές είναι `LazyJsonSnapshot` — ο επισκέπτης που δεν ανοίγει τη στρώση δεν
 * πληρώνει ούτε ένα byte, και οι Δ.Ε. (463 KB gzip) φορτώνονται μόνο όταν το zoom τις χρειαστεί.
 */

import { strictJsonShape } from '@/lib/data/json-shape';
import { createLazyJsonSnapshot, type LazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import {
  adminOverviewChildrenPath,
  adminOverviewPath,
  readAdminOverviewFile,
  type AdminOverviewFile,
  type AdminOverviewTier,
} from '@/lib/geo/admin-overview-file';
import { MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH } from '@/lib/market/market-transactions-file';
import {
  readAskingPriceMapResponse,
  readContractPriceMapFile,
  type AskingPriceMapResponse,
  type ContractPriceMapFile,
} from '@/lib/market/price-map';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('price-map');

/** Το δημόσιο endpoint της πηγής Α. */
export const ASKING_PRICE_MAP_URL = '/api/market/price-map';

const logFailure = (what: string) => (error: unknown) => {
  logger.warn('Δεν φορτώθηκε πηγή του χάρτη τιμών', { what, error: error instanceof Error ? error.message : String(error) });
};

const overviewSources = new Map<string, LazyJsonSnapshot<AdminOverviewFile>>();

/** Μία πηγή γεωμετρίας **ανά διεύθυνση**, με έλεγχο σχήματος — ίδια ταυτότητα σε κάθε κλήση (σταθερό `useLazySnapshot`). */
function overviewFileSource(url: string, label: string): LazyJsonSnapshot<AdminOverviewFile> {
  const existing = overviewSources.get(url);
  if (existing !== undefined) return existing;
  const source = createLazyJsonSnapshot({ url, build: strictJsonShape(readAdminOverviewFile, label), onFailure: logFailure(label) });
  overviewSources.set(url, source);
  return source;
}

/** Η γεωμετρία μιας βαθμίδας — μία φόρτωση ανά σελίδα. */
export function adminOverviewSource(tier: AdminOverviewTier): LazyJsonSnapshot<AdminOverviewFile> {
  return overviewFileSource(adminOverviewPath(tier), tier);
}

/**
 * Η γεωμετρία των **παιδιών ενός Δήμου** (ADR-890 §15) — λίγα KB, ίδια τόξα με το `municipal_unit.json`. Μία φόρτωση
 * ανά Δήμο και σελίδα· μια πηγή **ανά κλειδί**, όπως το όριο του ADR-883.
 */
export function adminOverviewChildrenSource(parentId: string): LazyJsonSnapshot<AdminOverviewFile> {
  return overviewFileSource(adminOverviewChildrenPath(parentId), parentId);
}

/** Πηγή Β — το συγκεντρωτικό των συμβολαίων (12 KB gzip). */
export const contractPriceMapSource: LazyJsonSnapshot<ContractPriceMapFile> = createLazyJsonSnapshot({
  url: `/${MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH.join('/')}`,
  build: strictJsonShape(readContractPriceMapFile, 'contracts'),
  onFailure: logFailure('contracts'),
});

/** Πηγή Α — ο χάρτης ζητούμενων της τελευταίας νύχτας. Ένα 503 δεν περνά τον έλεγχο σχήματος ⇒ «μη διαθέσιμο». */
export const askingPriceMapSource: LazyJsonSnapshot<AskingPriceMapResponse> = createLazyJsonSnapshot({
  url: ASKING_PRICE_MAP_URL,
  build: strictJsonShape(readAskingPriceMapResponse, 'asking'),
  onFailure: logFailure('asking'),
});
