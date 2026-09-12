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
 * Καθαρίζει `undefined` **αναδρομικά, σε ΚΑΘΕ αντικείμενο** (σκέτο ή όχι). Κλειδί του
 * οποίου η αναδρομή δίνει κενό αντικείμενο πετιέται. Το Firestore απορρίπτει `undefined`.
 *
 * 🔴 **ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ ΠΡΟΕΙΔΟΠΟΙΗΣΗ (ADR-852 §4.7).** Αυτό είναι **κατά λέξη** ο κώδικας
 * που προκάλεσε το περιστατικό **ADR-438**: χωρίς φρουρό `isPlainObject`, ένα `Date` ή ένα
 * `FieldValue.serverTimestamp()` γίνεται `{}` (`Object.entries(new Date())` === `[]`) και
 * μετά **εξαφανίζεται** από τον κλάδο «κενό ⇒ πέτα το κλειδί».
 *
 * ✅ **Σήμερα είναι ΛΑΝΘΑΝΟΝ, μετρημένα**: ο **μόνος** καλών είναι το `backfill-engine.ts`,
 * το `SearchDocumentInput` **δεν** έχει `Date`/`Timestamp`, και τα τρία `serverTimestamp()`
 * sentinels προστίθενται **ΜΕΤΑ** αυτόν τον καθαριστή. Αν ποτέ φτάσει εδώ sentinel ή
 * `Timestamp` από `doc.data()`, το λανθάνον γίνεται **ζωντανό**.
 *
 * ⛔ **ΜΗΝ προσθέσεις φρουρό εδώ χωρίς απόφαση**: θα το έκανε **ταυτόσημο** με το
 * `stripUndefinedDeepPlainOnly` (`lib/auth/audit-core.ts`) ⇒ γνήσιο διπλότυπο που ζητά
 * **ενοποίηση** — καταγεγραμμένο στο `.claude-rules/pending-ratchet-work.md`, όχι μπάλωμα.
 */
export function stripUndefinedDeepAnyObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = stripUndefinedDeepAnyObject(value as Record<string, unknown>);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
