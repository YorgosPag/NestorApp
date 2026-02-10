/**
 * =============================================================================
 * GREEK NLP UTILITIES — Keyword Extraction & Matching for AI Learning
 * =============================================================================
 *
 * Lightweight Greek language processing for the AI self-improvement system.
 * Extracts meaningful keywords from Greek text by removing stopwords.
 *
 * @module services/ai-pipeline/shared/greek-nlp
 * @see ADR-173 (AI Self-Improvement System)
 */

// ============================================================================
// GREEK STOPWORDS
// ============================================================================

/**
 * Common Greek stopwords to exclude from keyword extraction.
 * Includes articles, prepositions, conjunctions, and common auxiliaries.
 */
export const GREEK_STOPWORDS: ReadonlySet<string> = new Set([
  // Articles
  'ο', 'η', 'το', 'οι', 'τα', 'τις', 'τους', 'των', 'τον', 'την',
  // Prepositions
  'σε', 'στο', 'στη', 'στον', 'στην', 'στα', 'στις', 'στους',
  'από', 'με', 'για', 'σαν', 'ως', 'προς', 'κατά', 'μετά', 'χωρίς',
  'μέχρι', 'πάνω', 'κάτω', 'μέσα', 'έξω', 'δίπλα', 'πριν',
  // Conjunctions
  'και', 'αλλά', 'ή', 'ούτε', 'μήτε', 'είτε', 'αν', 'εάν',
  'ότι', 'που', 'όπως', 'επειδή', 'ενώ', 'αφού', 'γιατί',
  // Pronouns
  'εγώ', 'εσύ', 'αυτός', 'αυτή', 'αυτό', 'εμείς', 'εσείς', 'αυτοί', 'αυτές', 'αυτά',
  'μου', 'σου', 'του', 'της', 'μας', 'σας',
  // Auxiliaries & common verbs
  'είναι', 'είμαι', 'έχω', 'έχει', 'θα', 'να', 'δεν', 'μην',
  'θέλω', 'μπορώ', 'πρέπει', 'κάνω', 'κάνει',
  // Question words
  'τι', 'ποιος', 'ποια', 'ποιο', 'ποιοι', 'ποιες', 'ποια',
  'πόσο', 'πόσα', 'πότε', 'πού', 'πώς', 'γιατί',
  // Common adverbs
  'πολύ', 'λίγο', 'τώρα', 'εδώ', 'εκεί', 'ακόμα', 'ήδη', 'μόνο',
  // Other
  'ένα', 'μια', 'ένας', 'κάτι', 'κάποιος', 'κάποια', 'κάποιο', 'κανένας',
  'όλα', 'όλοι', 'όλες', 'κάθε',
]);

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Extract meaningful keywords from text by removing stopwords.
 * Works for both Greek and Latin-script text.
 *
 * @param text - Input text
 * @param minLength - Minimum keyword length (default: 2)
 * @returns Array of lowercased keywords
 */
export function extractKeywords(text: string, minLength: number = 2): string[] {
  if (!text) return [];

  // Normalize: lowercase, remove punctuation, split
  const normalized = text
    .toLowerCase()
    .replace(/[;.,!?:()"\[\]{}<>«»—–\-_/\\@#$%^&*+=~`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ');

  // Filter: remove stopwords, short words, numbers-only
  const keywords = words.filter(word => {
    if (word.length < minLength) return false;
    if (GREEK_STOPWORDS.has(word)) return false;
    if (/^\d+$/.test(word)) return false;
    return true;
  });

  // Deduplicate while preserving order
  return [...new Set(keywords)];
}

// ============================================================================
// KEYWORD MATCHING
// ============================================================================

/**
 * Compute overlap score between two keyword arrays.
 * Returns a value between 0 (no overlap) and 1 (complete overlap).
 *
 * Uses Jaccard-like similarity: |intersection| / |smaller set|
 * This ensures that short queries can still get high scores.
 *
 * @param kw1 - First keyword array
 * @param kw2 - Second keyword array
 * @returns Overlap score 0-1
 */
export function computeKeywordOverlap(kw1: string[], kw2: string[]): number {
  if (kw1.length === 0 || kw2.length === 0) return 0;

  const set1 = new Set(kw1);
  const set2 = new Set(kw2);

  let intersectionCount = 0;
  for (const word of set1) {
    if (set2.has(word)) {
      intersectionCount++;
    }
  }

  if (intersectionCount === 0) return 0;

  // Divide by the smaller set size for asymmetric matching
  const minSize = Math.min(set1.size, set2.size);
  return intersectionCount / minSize;
}
