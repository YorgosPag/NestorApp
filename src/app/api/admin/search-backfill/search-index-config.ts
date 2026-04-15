/**
 * =============================================================================
 * SEARCH BACKFILL HELPERS
 * =============================================================================
 *
 * Re-exports SEARCH_INDEX_CONFIG from centralized SSoT and provides
 * search-specific utility functions for the backfill engine.
 *
 * @module api/admin/search-backfill/search-index-config
 * @enterprise ADR-029 - Global Search v1
 */

import type { SearchIndexConfig } from '@/types/search';
// SSoT: canonical text normalization and prefix generation (ADR-029, ADR-294)
export { normalizeSearchText, generateSearchPrefixes } from '@/lib/search/search';

// SSoT: Re-export from centralized config (ADR-294)
export { SEARCH_INDEX_CONFIG, extractTitle, extractSubtitle, determineAudience } from '@/config/search-index-config';

export function extractSearchableText(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  const parts: string[] = [];
  for (const field of config.searchableFields) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }
  return parts.join(' ');
}

// =============================================================================
// FIRESTORE UTILITIES
// =============================================================================

/**
 * Remove undefined values recursively from object.
 * Firestore throws error on undefined values.
 */
export function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = removeUndefinedValues(value as Record<string, unknown>);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
