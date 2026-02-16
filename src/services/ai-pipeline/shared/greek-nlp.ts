/**
 * =============================================================================
 * GREEK NLP UTILITIES — Keyword Extraction, Stemming & Matching
 * =============================================================================
 *
 * Lightweight Greek language processing for the AI self-improvement system.
 * Features:
 * - Keyword extraction with stopword removal
 * - Basic suffix-based Greek stemming
 * - Domain vocabulary boosting (real estate/construction)
 * - Greeklish transliteration
 * - Keyword overlap scoring
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
  '\u03BF', '\u03B7', '\u03C4\u03BF', '\u03BF\u03B9', '\u03C4\u03B1', '\u03C4\u03B9\u03C2', '\u03C4\u03BF\u03C5\u03C2', '\u03C4\u03C9\u03BD', '\u03C4\u03BF\u03BD', '\u03C4\u03B7\u03BD',
  // Prepositions
  '\u03C3\u03B5', '\u03C3\u03C4\u03BF', '\u03C3\u03C4\u03B7', '\u03C3\u03C4\u03BF\u03BD', '\u03C3\u03C4\u03B7\u03BD', '\u03C3\u03C4\u03B1', '\u03C3\u03C4\u03B9\u03C2', '\u03C3\u03C4\u03BF\u03C5\u03C2',
  '\u03B1\u03C0\u03CC', '\u03BC\u03B5', '\u03B3\u03B9\u03B1', '\u03C3\u03B1\u03BD', '\u03C9\u03C2', '\u03C0\u03C1\u03BF\u03C2', '\u03BA\u03B1\u03C4\u03AC', '\u03BC\u03B5\u03C4\u03AC', '\u03C7\u03C9\u03C1\u03AF\u03C2',
  '\u03BC\u03AD\u03C7\u03C1\u03B9', '\u03C0\u03AC\u03BD\u03C9', '\u03BA\u03AC\u03C4\u03C9', '\u03BC\u03AD\u03C3\u03B1', '\u03AD\u03BE\u03C9', '\u03B4\u03AF\u03C0\u03BB\u03B1', '\u03C0\u03C1\u03B9\u03BD',
  // Conjunctions
  '\u03BA\u03B1\u03B9', '\u03B1\u03BB\u03BB\u03AC', '\u03AE', '\u03BF\u03CD\u03C4\u03B5', '\u03BC\u03AE\u03C4\u03B5', '\u03B5\u03AF\u03C4\u03B5', '\u03B1\u03BD', '\u03B5\u03AC\u03BD',
  '\u03CC\u03C4\u03B9', '\u03C0\u03BF\u03C5', '\u03CC\u03C0\u03C9\u03C2', '\u03B5\u03C0\u03B5\u03B9\u03B4\u03AE', '\u03B5\u03BD\u03CE', '\u03B1\u03C6\u03BF\u03CD', '\u03B3\u03B9\u03B1\u03C4\u03AF',
  // Pronouns
  '\u03B5\u03B3\u03CE', '\u03B5\u03C3\u03CD', '\u03B1\u03C5\u03C4\u03CC\u03C2', '\u03B1\u03C5\u03C4\u03AE', '\u03B1\u03C5\u03C4\u03CC', '\u03B5\u03BC\u03B5\u03AF\u03C2', '\u03B5\u03C3\u03B5\u03AF\u03C2', '\u03B1\u03C5\u03C4\u03BF\u03AF', '\u03B1\u03C5\u03C4\u03AD\u03C2', '\u03B1\u03C5\u03C4\u03AC',
  '\u03BC\u03BF\u03C5', '\u03C3\u03BF\u03C5', '\u03C4\u03BF\u03C5', '\u03C4\u03B7\u03C2', '\u03BC\u03B1\u03C2', '\u03C3\u03B1\u03C2',
  // Auxiliaries & common verbs
  '\u03B5\u03AF\u03BD\u03B1\u03B9', '\u03B5\u03AF\u03BC\u03B1\u03B9', '\u03AD\u03C7\u03C9', '\u03AD\u03C7\u03B5\u03B9', '\u03B8\u03B1', '\u03BD\u03B1', '\u03B4\u03B5\u03BD', '\u03BC\u03B7\u03BD',
  '\u03B8\u03AD\u03BB\u03C9', '\u03BC\u03C0\u03BF\u03C1\u03CE', '\u03C0\u03C1\u03AD\u03C0\u03B5\u03B9', '\u03BA\u03AC\u03BD\u03C9', '\u03BA\u03AC\u03BD\u03B5\u03B9',
  // Question words
  '\u03C4\u03B9', '\u03C0\u03BF\u03B9\u03BF\u03C2', '\u03C0\u03BF\u03B9\u03B1', '\u03C0\u03BF\u03B9\u03BF', '\u03C0\u03BF\u03B9\u03BF\u03B9', '\u03C0\u03BF\u03B9\u03B5\u03C2',
  '\u03C0\u03CC\u03C3\u03BF', '\u03C0\u03CC\u03C3\u03B1', '\u03C0\u03CC\u03C4\u03B5', '\u03C0\u03BF\u03CD', '\u03C0\u03CE\u03C2',
  // Common adverbs
  '\u03C0\u03BF\u03BB\u03CD', '\u03BB\u03AF\u03B3\u03BF', '\u03C4\u03CE\u03C1\u03B1', '\u03B5\u03B4\u03CE', '\u03B5\u03BA\u03B5\u03AF', '\u03B1\u03BA\u03CC\u03BC\u03B1', '\u03AE\u03B4\u03B7', '\u03BC\u03CC\u03BD\u03BF',
  // Other
  '\u03AD\u03BD\u03B1', '\u03BC\u03B9\u03B1', '\u03AD\u03BD\u03B1\u03C2', '\u03BA\u03AC\u03C4\u03B9', '\u03BA\u03AC\u03C0\u03BF\u03B9\u03BF\u03C2', '\u03BA\u03AC\u03C0\u03BF\u03B9\u03B1', '\u03BA\u03AC\u03C0\u03BF\u03B9\u03BF', '\u03BA\u03B1\u03BD\u03AD\u03BD\u03B1\u03C2',
  '\u03CC\u03BB\u03B1', '\u03CC\u03BB\u03BF\u03B9', '\u03CC\u03BB\u03B5\u03C2', '\u03BA\u03AC\u03B8\u03B5',
]);

// ============================================================================
// DOMAIN VOCABULARY (Phase 3B)
// ============================================================================

/**
 * Domain-specific keywords for real estate, construction, and business.
 * These are never removed as stopwords and receive boosted weight in scoring.
 */
export const DOMAIN_KEYWORDS: ReadonlySet<string> = new Set([
  // Real Estate
  '\u03AD\u03C1\u03B3\u03BF', '\u03BA\u03C4\u03AE\u03C1\u03B9\u03BF', '\u03BC\u03BF\u03BD\u03AC\u03B4\u03B1', '\u03CC\u03C1\u03BF\u03C6\u03BF\u03C2', 'parking', '\u03B1\u03C0\u03BF\u03B8\u03AE\u03BA\u03B7',
  '\u03B4\u03B9\u03B1\u03BC\u03AD\u03C1\u03B9\u03C3\u03BC\u03B1', '\u03BC\u03B5\u03B6\u03BF\u03BD\u03AD\u03C4\u03B1', '\u03BA\u03B1\u03C4\u03AC\u03C3\u03C4\u03B7\u03BC\u03B1', '\u03B3\u03C1\u03B1\u03C6\u03B5\u03AF\u03BF',
  '\u03BF\u03B9\u03BA\u03CC\u03C0\u03B5\u03B4\u03BF', '\u03B1\u03BA\u03AF\u03BD\u03B7\u03C4\u03BF',
  // Construction
  'gantt', '\u03C6\u03AC\u03C3\u03B7', '\u03B5\u03C1\u03B3\u03BF\u03C4\u03AC\u03BE\u03B9\u03BF',
  '\u03C0\u03C1\u03CC\u03BF\u03B4\u03BF\u03C2', '\u03C0\u03B1\u03C1\u03AC\u03B4\u03BF\u03C3\u03B7',
  // Business
  '\u03C0\u03B5\u03BB\u03AC\u03C4\u03B7\u03C2', '\u03C4\u03B9\u03BC\u03BF\u03BB\u03CC\u03B3\u03B9\u03BF', 'efka', '\u03C0\u03BB\u03B7\u03C1\u03C9\u03BC\u03AE',
  '\u03C1\u03B1\u03BD\u03C4\u03B5\u03B2\u03BF\u03CD', '\u03B5\u03C1\u03B3\u03B1\u03B6\u03CC\u03BC\u03B5\u03BD\u03BF\u03C2',
  // Financial / Tax
  '\u03C6\u03C0\u03B1', 'mydata', '\u03BA\u03B1\u03B4', '\u03B4\u03BF\u03C5',
  '\u03C0\u03C1\u03BF\u03CB\u03C0\u03BF\u03BB\u03BF\u03B3\u03B9\u03C3\u03BC\u03CC\u03C2',
  // English loanwords
  'budget', 'deadline', 'milestone', 'project', 'contact',
  'email', 'telegram', 'status',
]);

/**
 * Domain keyword boost multiplier for relevance scoring.
 */
const DOMAIN_BOOST_FACTOR = 2.0;

// ============================================================================
// GREEK STEMMING (Phase 3A)
// ============================================================================

/**
 * Greek suffixes ordered from longest to shortest for greedy matching.
 * Only applied to words > 4 characters to avoid over-stemming.
 */
const GREEK_SUFFIXES: readonly string[] = [
  // Noun suffixes (compound)
  '\u03B9\u03C3\u03BC\u03BF\u03CD', '\u03B9\u03C3\u03BC\u03CC\u03C2',
  '\u03BF\u03CD\u03BC\u03B5', '\u03BF\u03CD\u03C3\u03B5', '\u03AE\u03C3\u03B5\u03B9',
  '\u03B9\u03BA\u03CC', '\u03B9\u03BA\u03AE', '\u03B9\u03BA\u03AC',
  '\u03B9\u03AD\u03C2',
  // Verb suffixes
  '\u03BF\u03CD\u03BD', '\u03B5\u03AF',
  // Noun case endings
  '\u03BF\u03C5\u03C2', '\u03C9\u03BD', '\u03B9\u03AC',
  // Common endings
  '\u03BF\u03C2', '\u03B7\u03C2', '\u03B1\u03C2', '\u03B5\u03C2',
  '\u03BF\u03B9', '\u03BF\u03C5',
  '\u03AC', '\u03AE',
] as const;

const MIN_WORD_LENGTH_FOR_STEMMING = 4;

/**
 * Apply basic suffix-based Greek stemming.
 * Removes common Greek suffixes to normalize word forms.
 *
 * Examples:
 * - "\u03BA\u03C4\u03AE\u03C1\u03B9\u03BF" / "\u03BA\u03C4\u03AE\u03C1\u03B9\u03B1" / "\u03BA\u03C4\u03B7\u03C1\u03AF\u03BF\u03C5" -> stemmed forms will overlap better
 * - "\u03C0\u03BB\u03B7\u03C1\u03C9\u03BC\u03AE" / "\u03C0\u03BB\u03B7\u03C1\u03C9\u03BC\u03AD\u03C2" -> common stem
 *
 * @param word - Lowercased Greek word
 * @returns Stemmed word
 */
export function stemGreekWord(word: string): string {
  if (word.length <= MIN_WORD_LENGTH_FOR_STEMMING) return word;

  for (const suffix of GREEK_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 2) {
      return word.slice(0, -suffix.length);
    }
  }

  return word;
}

// ============================================================================
// GREEKLISH TRANSLITERATION (Phase 3C)
// ============================================================================

/**
 * Greeklish digraph mappings (checked first, before single chars).
 */
const GREEKLISH_DIGRAPHS: ReadonlyMap<string, string> = new Map([
  ['th', '\u03B8'],
  ['ph', '\u03C6'],
  ['ch', '\u03C7'],
  ['ps', '\u03C8'],
  ['ks', '\u03BE'],
  ['ou', '\u03BF\u03C5'],
  ['ei', '\u03B5\u03B9'],
  ['oi', '\u03BF\u03B9'],
  ['ai', '\u03B1\u03B9'],
  ['mp', '\u03BC\u03C0'],
  ['nt', '\u03BD\u03C4'],
  ['gk', '\u03B3\u03BA'],
]);

/**
 * Greeklish single character mappings.
 */
const GREEKLISH_CHARS: ReadonlyMap<string, string> = new Map([
  ['a', '\u03B1'],
  ['b', '\u03B2'],
  ['g', '\u03B3'],
  ['d', '\u03B4'],
  ['e', '\u03B5'],
  ['z', '\u03B6'],
  ['h', '\u03B7'],
  ['i', '\u03B9'],
  ['k', '\u03BA'],
  ['l', '\u03BB'],
  ['m', '\u03BC'],
  ['n', '\u03BD'],
  ['x', '\u03BE'],
  ['o', '\u03BF'],
  ['p', '\u03C0'],
  ['r', '\u03C1'],
  ['s', '\u03C3'],
  ['t', '\u03C4'],
  ['u', '\u03C5'],
  ['f', '\u03C6'],
  ['w', '\u03C9'],
  ['v', '\u03B2'],
  ['y', '\u03C5'],
]);

/**
 * Check if text contains any Greek characters.
 */
export function containsGreek(text: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(text);
}

/**
 * Transliterate Greeklish text to Greek.
 * Only applied when input does NOT contain Greek characters.
 *
 * @param text - Greeklish text (e.g., "ktirio", "pliromi")
 * @returns Greek transliteration (e.g., "\u03BA\u03C4\u03B9\u03C1\u03B9\u03BF", "\u03C0\u03BB\u03B9\u03C1\u03BF\u03BC\u03B9")
 */
export function transliterateGreeklish(text: string): string {
  if (containsGreek(text)) return text;

  const lower = text.toLowerCase();
  let result = '';
  let i = 0;

  while (i < lower.length) {
    // Try digraphs first
    if (i < lower.length - 1) {
      const digraph = lower.substring(i, i + 2);
      const mapped = GREEKLISH_DIGRAPHS.get(digraph);
      if (mapped) {
        result += mapped;
        i += 2;
        continue;
      }
    }

    // Try single character
    const char = lower[i];
    const mapped = GREEKLISH_CHARS.get(char);
    result += mapped ?? char;
    i++;
  }

  return result;
}

// ============================================================================
// KEYWORD EXTRACTION (Enhanced)
// ============================================================================

/**
 * Extract meaningful keywords from text by removing stopwords.
 * Enhanced with stemming, domain boosting, and Greeklish support.
 *
 * @param text - Input text
 * @param minLength - Minimum keyword length (default: 2)
 * @returns Array of lowercased keywords (stemmed)
 */
export function extractKeywords(text: string, minLength: number = 2): string[] {
  if (!text) return [];

  // Normalize: lowercase, remove punctuation, split
  let normalized = text
    .toLowerCase()
    .replace(/[;.,!?:()"\[\]{}<>\u00AB\u00BB\u2014\u2013\-_/\\@#$%^&*+=~`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Phase 3C: Transliterate Greeklish words
  if (!containsGreek(normalized)) {
    normalized = transliterateGreeklish(normalized);
  }

  const words = normalized.split(' ');

  // Filter: remove stopwords, short words, numbers-only
  const keywords = words
    .filter(word => {
      if (word.length < minLength) return false;
      if (GREEK_STOPWORDS.has(word)) return false;
      if (/^\d+$/.test(word)) return false;
      return true;
    })
    // Phase 3A: Apply stemming (skip domain keywords to preserve them)
    .map(word => {
      if (DOMAIN_KEYWORDS.has(word)) return word;
      return stemGreekWord(word);
    });

  // Deduplicate while preserving order
  return [...new Set(keywords)];
}

// ============================================================================
// KEYWORD MATCHING (Enhanced)
// ============================================================================

/**
 * Compute overlap score between two keyword arrays.
 * Enhanced with domain keyword boosting.
 *
 * Uses weighted Jaccard-like similarity where domain keywords
 * contribute more to the score (x2.0 boost).
 *
 * @param kw1 - First keyword array (query keywords)
 * @param kw2 - Second keyword array (pattern keywords)
 * @returns Overlap score 0-1+
 */
export function computeKeywordOverlap(kw1: string[], kw2: string[]): number {
  if (kw1.length === 0 || kw2.length === 0) return 0;

  const set1 = new Set(kw1);
  const set2 = new Set(kw2);

  let weightedIntersection = 0;
  let totalWeight = 0;

  for (const word of set1) {
    // Phase 3B: Domain keywords get boosted weight
    const weight = DOMAIN_KEYWORDS.has(word) ? DOMAIN_BOOST_FACTOR : 1.0;
    totalWeight += weight;

    if (set2.has(word)) {
      weightedIntersection += weight;
    }
  }

  if (weightedIntersection === 0) return 0;

  // Normalize by total weight of query keywords
  return weightedIntersection / totalWeight;
}
