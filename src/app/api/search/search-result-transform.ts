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

import {
  getSearchIndexConfig,
  extractStats,
  isSearchResultAdmissible,
} from '@/config/search-index-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  SearchDocument,
  SearchEntityType,
  SearchResult,
  SearchResultStat,
} from '@/types/search';

const logger = createModuleLogger('SearchRoute');

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

/** Ό,τι φέρνει το ερώτημα ενός τύπου: τα έγγραφά του, ή η αιτία που απέτυχε. */
export type SearchTypeQueryOutcome = PromiseSettledResult<{
  readonly docs: ReadonlyArray<{ data(): unknown }>;
}>;

function logFailedType(entityType: SearchEntityType, reason: unknown): void {
  const error = getErrorMessage(reason);
  if (error.includes('FAILED_PRECONDITION') || error.includes('index')) {
    logger.warn('[Search] Index building or missing — degraded results for type', {
      entityType,
      error,
      hint: 'Run: firebase deploy --only firestore:indexes',
    });
    return;
  }
  logger.error('[Search] Query failed for entity type', { entityType, error });
}

/** Περνά μια αποθηκευμένη εγγραφή στα αποτελέσματα αυτού του ερωτήματος; */
function isDeliverable(doc: SearchDocument, normalizedQuery: string): boolean {
  // Ταφόπλακα (ADR-873 §9.1.2): η οντότητα έχει διαγραφεί και η εγγραφή ζει μόνο ως φορέας
  // έκδοσης. Δεν φτάνει ως εδώ — τα `prefixes` της είναι κενά — αλλά ο φράχτης δεν στηρίζεται
  // σε ένα μόνο σκαλί.
  if (doc.deleted === true) return false;
  const config = getSearchIndexConfig(doc.entityType);
  // ADR-829 §7: κλειστό σε αμφιβολία. Παλιό έγγραφο αρχείου δεν έχει σφραγίδα εμβέλειας.
  if (!config || !isSearchResultAdmissible(doc, config)) return false;
  return doc.search.normalized.includes(normalizedQuery);
}

/**
 * Τα αποτελέσματα όλων των τύπων, ένας πίνακας.
 *
 * Τύπος που απέτυχε καταγράφεται και παραλείπεται: ένας δείκτης που χτίζεται δεν ρίχνει τους
 * υπόλοιπους (`Promise.allSettled`, σταδιακή υποβάθμιση).
 */
export function collectSearchResults(
  outcomes: readonly SearchTypeQueryOutcome[],
  searchedTypes: readonly SearchEntityType[],
  normalizedQuery: string,
): SearchResult[] {
  const results: SearchResult[] = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'rejected') {
      logFailedType(searchedTypes[index], outcome.reason);
      return;
    }
    for (const stored of outcome.value.docs) {
      const doc = stored.data() as SearchDocument;
      if (isDeliverable(doc, normalizedQuery)) results.push(transformToSearchResult(doc));
    }
  });
  return results;
}
