/**
 * =============================================================================
 * GREEK TEXT UTILITIES — Fuzzy Name Matching
 * =============================================================================
 *
 * Pure functions for Greek↔Latin text normalization, transliteration,
 * and stem-based fuzzy matching. Used by contact-lookup.ts for intelligent
 * name search that handles:
 *   - Accent variations ("Γιώργος" vs "Γιωργος")
 *   - Greek declension forms ("Γιάννη" → "Γιάννης")
 *   - Greeklish / Latin input ("Giorgos" → "Γιώργος")
 *
 * @module services/ai-pipeline/shared/greek-text-utils
 * @see ADR-145 (Super Admin AI Assistant)
 */

// ============================================================================
// ACCENT NORMALIZATION (NFD strip) — re-exported from centralized utils
// ============================================================================

// ADR-217: Centralized in src/utils/greek-text.ts
// Pure re-export form (ADR-314 Phase C.5.46) — avoids scanner dup-count on aliased const.
//
// ADR-668: `transliterateGreekToLatin` moved to the same SSoT. It was the odd one out —
// accent-stripping lived centrally while transliteration stayed buried in the AI pipeline,
// so a second (client-side) caller would have had to import from `services/ai-pipeline/*`
// or clone the tables. Callers here are unchanged: the name still resolves through this module.
import { stripAccents, normalizeGreekText, transliterateGreekToLatin } from '@/utils/greek-text';
export { stripAccents, normalizeGreekText, transliterateGreekToLatin };

// ============================================================================
// GREEK STEM MATCHING (declension tolerance)
// ============================================================================

/** Minimum stem length to prevent false positives */
const MIN_STEM_LENGTH = 3;

/**
 * Compare two strings by their stems (removing last 1-2 chars).
 * Handles Greek noun/adjective declension:
 *   "Γιάννη" (stem "Γιάνν") ⊃ "Γιάννης" (stem "Γιάνν") → match
 *   "Σοφίας" (stem "Σοφί")  ⊃ "Σοφία"  (stem "Σοφί")  → match
 *
 * @returns true if one stem is a prefix of the other
 */
export function greekStemMatch(a: string, b: string): boolean {
  const normA = normalizeGreekText(a);
  const normB = normalizeGreekText(b);

  // Both strings must have enough characters for stem comparison
  if (normA.length < MIN_STEM_LENGTH || normB.length < MIN_STEM_LENGTH) {
    return false;
  }

  // Try stems with 1 and 2 chars removed
  for (const trimLength of [1, 2]) {
    const stemA = normA.length > trimLength ? normA.slice(0, -trimLength) : normA;
    const stemB = normB.length > trimLength ? normB.slice(0, -trimLength) : normB;

    // Check if either stem contains the other
    if (stemA.length >= MIN_STEM_LENGTH && stemB.length >= MIN_STEM_LENGTH) {
      if (stemA.includes(stemB) || stemB.includes(stemA)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// COMBINED FUZZY MATCH — 4-level algorithm
// ============================================================================

/**
 * Fuzzy name matching with 4 strategies (fast → slow):
 *
 * 1. Direct substring match (cheapest — handles exact & partial)
 * 2. Accent-normalized match (NFD strip — handles missing/wrong accents)
 * 3. Stem match (declension tolerance — handles Γιάννη↔Γιάννης)
 * 4. Transliterated match (Greek↔Latin — handles Greeklish)
 *
 * @param candidateName - Name from database (e.g., "Γιώργος Παπαδόπουλος")
 * @param searchTerm - User's search input (e.g., "Giorgos" or "γιωργ")
 * @returns true if any matching strategy succeeds
 */
export function fuzzyGreekMatch(candidateName: string, searchTerm: string): boolean {
  const lowerName = candidateName.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();

  // 1. Direct substring match (fastest path)
  if (lowerName.includes(lowerSearch)) {
    return true;
  }

  // 2. Accent-normalized match
  const normName = normalizeGreekText(candidateName);
  const normSearch = normalizeGreekText(searchTerm);
  if (normName.includes(normSearch)) {
    return true;
  }

  // 3. Stem match — split into individual words and check each
  const nameWords = normName.split(/\s+/);
  const searchWords = normSearch.split(/\s+/);
  const stemMatched = searchWords.every(sw =>
    nameWords.some(nw => greekStemMatch(nw, sw))
  );
  if (stemMatched && searchWords.length > 0 && searchWords[0].length >= MIN_STEM_LENGTH) {
    return true;
  }

  // 4. Transliterated match (Greek↔Latin)
  const transName = transliterateGreekToLatin(candidateName);
  const transSearch = transliterateGreekToLatin(searchTerm);
  if (transName.includes(transSearch) && transSearch.length >= MIN_STEM_LENGTH) {
    return true;
  }

  return false;
}
