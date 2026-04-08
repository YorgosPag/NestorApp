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

// SSoT: Re-export from centralized config (ADR-294)
export { SEARCH_INDEX_CONFIG, extractTitle, extractSubtitle, determineAudience } from '@/config/search-index-config';

// =============================================================================
// BACKFILL-SPECIFIC HELPERS (not in canonical config)
// =============================================================================

const GREEK_ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function generateSearchPrefixes(text: string, maxPrefixLength = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();
  for (const word of words) {
    for (let len = 3; len <= Math.min(maxPrefixLength, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }
  return Array.from(prefixes);
}

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
