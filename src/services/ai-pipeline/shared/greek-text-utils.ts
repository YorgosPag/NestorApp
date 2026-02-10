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
// ACCENT NORMALIZATION (NFD strip)
// ============================================================================

/**
 * Remove Unicode diacritics (accents) from text.
 * "Γιώργος" → "Γιωργος", "Σοφία" → "Σοφια"
 */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize Greek text: lowercase + accent strip.
 */
export function normalizeGreekText(text: string): string {
  return stripAccents(text.toLowerCase());
}

// ============================================================================
// GREEK → LATIN TRANSLITERATION
// ============================================================================

/** Digraph mappings (checked first, order matters) */
const GREEK_DIGRAPHS: ReadonlyArray<readonly [string, string]> = [
  // Diphthongs
  ['ου', 'ou'],
  ['αι', 'ai'],
  ['ει', 'ei'],
  ['οι', 'oi'],
  ['αυ', 'av'],
  ['ευ', 'ev'],
  // Consonant clusters
  ['μπ', 'b'],
  ['ντ', 'd'],
  ['γκ', 'g'],
  ['γγ', 'ng'],
  ['τσ', 'ts'],
  ['τζ', 'tz'],
];

/** Single-character Greek → Latin mapping */
const GREEK_TO_LATIN: ReadonlyMap<string, string> = new Map([
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'],
  ['ζ', 'z'], ['η', 'i'], ['θ', 'th'], ['ι', 'i'], ['κ', 'k'],
  ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'], ['ο', 'o'],
  ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'],
  ['υ', 'y'], ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
]);

/**
 * Transliterate Greek text to Latin characters.
 * "Γιώργος" → "giorgos", "Σοφία" → "sofia"
 *
 * Steps:
 * 1. Lowercase + strip accents
 * 2. Replace digraphs (ου→ou, μπ→b, etc.)
 * 3. Replace remaining single characters
 */
export function transliterateGreekToLatin(text: string): string {
  let normalized = normalizeGreekText(text);

  // Replace digraphs first (longer sequences before single chars)
  for (const [greek, latin] of GREEK_DIGRAPHS) {
    normalized = normalized.split(greek).join(latin);
  }

  // Replace remaining single Greek characters
  let result = '';
  for (const char of normalized) {
    const mapped = GREEK_TO_LATIN.get(char);
    result += mapped ?? char;
  }

  return result;
}

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
