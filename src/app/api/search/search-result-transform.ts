/**
 * search-result-transform — αποθηκευμένο έγγραφο ευρετηρίου → σχήμα απάντησης του API.
 *
 * Εξήχθη από το `./route.ts` (όριο 300 γραμμών για API routes). Κρατά τη μία απόφαση που
 * αλλιώς θα ήταν σκορπισμένη μέσα στον handler: **ποια πεδία του `SearchDocument` βγαίνουν
 * προς τα έξω** — και, κυρίως, ότι τα `stats` παράγονται από το κεντρικό
 * `search-index-config` ανά τύπο οντότητας, όχι από κάποιον πίνακα εδώ.
 *
 * @see ./route.ts — ο μοναδικός καταναλωτής
 * @see @/config/search-index-config — ο SSoT για το ποια metadata γίνονται stats
 */

import { getSearchIndexConfig, extractStats } from '@/config/search-index-config';
import type {
  SearchDocument,
  SearchEntityType,
  SearchResult,
  SearchResultStat,
} from '@/types/search';

/** Response data type for search API. */
export interface SearchResponseData {
  results: SearchResult[];
  query: {
    normalized: string;
    types?: SearchEntityType[];
  };
}

/**
 * Transform SearchDocument to SearchResult.
 * 🏢 ENTERPRISE: Includes stats and status for card display
 *
 * @param doc - SearchDocument from Firestore
 * @returns SearchResult for API response
 */
export function transformToSearchResult(doc: SearchDocument): SearchResult {
  // 🏢 ENTERPRISE: Extract stats from metadata if available
  let stats: SearchResultStat[] | undefined;

  if (doc.metadata) {
    const config = getSearchIndexConfig(doc.entityType);
    if (config) {
      // Convert metadata to Record<string, unknown> for extractStats
      const metadataRecord: Record<string, unknown> = {
        floor: doc.metadata.floor,
        area: doc.metadata.area,
        price: doc.metadata.price,
        type: doc.metadata.type,
      };
      const extractedStats = extractStats(metadataRecord, config);
      if (extractedStats.length > 0) {
        stats = extractedStats;
      }
    }
  }

  return {
    entityType: doc.entityType,
    entityId: doc.entityId,
    title: doc.title,
    subtitle: doc.subtitle,
    href: doc.links.href,
    status: doc.status, // 🏢 ENTERPRISE: Include status for badge display
    stats,
  };
}
