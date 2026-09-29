import 'server-only';

/**
 * @fileoverview **ΟΙ ΤΙΜΕΣ ΣΥΜΒΟΛΑΙΩΝ, ΔΙΑΒΑΣΜΕΝΕΣ ΑΠΟ ΤΟΝ SERVER** (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `lib/market/market-transactions-file.ts` (σχήμα + αναγνώστες σχήματος) ·
 *   `services/places/admin-boundaries.reader.ts` (ίδιο ιδίωμα) · `lib/data/server-json-file.ts`
 *
 * 🔑 **ΤΑ ΙΔΙΑ ΑΡΧΕΙΑ ΤΟΥ `public/`**, με τους ΙΔΙΟΥΣ αναγνώστες σχήματος με τον γεννήτορα.
 *
 * 🔑 **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΔΥΟ.** «Η περιοχή δεν έχει συμβόλαια» (`none`: λείπει από το ευρετήριο — αληθές
 * γεγονός, δείχνεται) ≠ «δεν μπόρεσα να διαβάσω» (`null`: σφάλμα, **δεν** δείχνεται ως «κανένα συμβόλαιο»).
 * Γι' αυτό το ευρετήριο ρωτιέται **πρώτο**: ένα αρχείο που λείπει ενώ το ευρετήριο το υπόσχεται είναι σφάλμα.
 *
 * ⚠️ **Όριο μνήμης (LRU)**: οι γραμμές φτάνουν τα 2,2 MB (Αθήνα)· οι αγγελίες συγκεντρώνονται σε λίγες
 * περιοχές, άρα λίγα «ζεστά» αρχεία αρκούν.
 */

import { strictJsonShape } from '@/lib/data/json-shape';
import { createKeyedServerJsonFiles, createServerJsonFile, warnOnJsonFailure } from '@/lib/data/server-json-file';
import {
  MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH,
  MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH,
  marketTransactionsPublicPath,
  readAreaRowsFile,
  readAreaSummaryFile,
  readMarketTransactionsIndex,
  type AreaRowsFile,
  type AreaSummaryFile,
  type MarketTransactionsIndex,
} from '@/lib/market/market-transactions-file';
import { readContractPriceMapFile, type ContractPriceMapFile } from '@/lib/market/price-map';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('market-transactions.reader');

/** Στατιστικά: ~1 KB (διάμεσος) — χωρούν σχεδόν όλα. */
const MAX_CACHED_SUMMARIES = 512;
/** Γραμμές: ως 2,2 MB — λίγα, τα «ζεστά». */
const MAX_CACHED_ROWS = 48;

const INDEX = createServerJsonFile<MarketTransactionsIndex>({
  publicPath: MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH,
  build: strictJsonShape(readMarketTransactionsIndex, 'market-transactions/index.json'),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκε το ευρετήριο τιμών συμβολαίων'),
});

/** Το πανελλαδικό συγκεντρωτικό του χάρτη τιμών (~84 KB) — **το ίδιο** αρχείο που κατεβάζει ο χάρτης της αναζήτησης. */
const PRICE_MAP = createServerJsonFile<ContractPriceMapFile>({
  publicPath: MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH,
  build: strictJsonShape(readContractPriceMapFile, 'market-transactions/price-map.json'),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκε ο χάρτης τιμών συμβολαίων'),
});

const SUMMARIES = createKeyedServerJsonFiles<AreaSummaryFile>(MAX_CACHED_SUMMARIES, (areaId) => ({
  publicPath: marketTransactionsPublicPath('summary', areaId),
  build: strictJsonShape((payload) => readAreaSummaryFile(payload, areaId), areaId),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκαν στατιστικά συμβολαίων', { areaId }),
}));

const ROWS = createKeyedServerJsonFiles<AreaRowsFile>(MAX_CACHED_ROWS, (areaId) => ({
  publicPath: marketTransactionsPublicPath('rows', areaId),
  build: strictJsonShape((payload) => readAreaRowsFile(payload, areaId), areaId),
  onFailure: warnOnJsonFailure(logger, 'Δεν διαβάστηκαν γραμμές συμβολαίων', { areaId }),
}));

/** `none` = η περιοχή **δεν** έχει συμβόλαια στο παράθυρο (γεγονός). `null` = δεν μπόρεσα να ρωτήσω. */
export type MarketFileRead<T> =
  | { readonly kind: 'ready'; readonly file: T; readonly index: MarketTransactionsIndex }
  | { readonly kind: 'none'; readonly index: MarketTransactionsIndex };

export function readMarketTransactionsIndexFile(): Promise<MarketTransactionsIndex | null> {
  return INDEX.read();
}

/** Ποιο σύνολο του ευρετηρίου υπόσχεται το αρχείο: στατιστικά για κάθε περιοχή, γραμμές μόνο για Δήμο/Δ.Ε. (§16). */
type IndexedSet = 'areas' | 'rowAreas';

async function readKeyed<T>(
  areaId: string,
  files: { read: (key: string) => Promise<T | null> },
  indexed: IndexedSet,
): Promise<MarketFileRead<T> | null> {
  const index = await INDEX.read();
  if (index === null) return null;
  if (!index[indexed].has(areaId)) return { kind: 'none', index };
  const file = await files.read(areaId);
  return file === null ? null : { kind: 'ready', file, index };
}

/**
 * Ο χάρτης τιμών συμβολαίων (ADR-890 §14.4 · §15): ο χάρτης της σελίδας Δήμου διαβάζει **αυτό**, όχι τα `summary/`
 * των παιδιών, ώστε ο ίδιος αριθμός να βγαίνει από το ίδιο byte με τον χάρτη της αναζήτησης. `null` = δεν διαβάστηκε.
 */
export function readContractPriceMap(): Promise<ContractPriceMapFile | null> {
  return PRICE_MAP.read();
}

export function readAreaSummary(areaId: string): Promise<MarketFileRead<AreaSummaryFile> | null> {
  return readKeyed(areaId, SUMMARIES, 'areas');
}

export function readAreaRows(areaId: string): Promise<MarketFileRead<AreaRowsFile> | null> {
  return readKeyed(areaId, ROWS, 'rowAreas');
}
