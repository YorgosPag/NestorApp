/**
 * @fileoverview Greek Text Normalization — Shared utility
 * @description Centralized accent-stripping and search normalization for Greek text.
 *
 * Promoted from duplicates in:
 *   - src/services/ai-pipeline/shared/greek-text-utils.ts (stripAccents, normalizeGreekText)
 *   - src/components/ui/searchable-combobox.tsx (normalizeGreek)
 *   - src/components/file-manager/FileManagerPageContent.tsx (inline NFD strip)
 *   - src/components/shared/files/EntityFilesManager.tsx (inline NFD strip)
 *
 * @version 1.0.0
 * @created 2026-03-12
 * @see ADR-217 Phase 11
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

/** Digraph mappings (checked first, order matters). */
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

/** Single-character Greek → Latin mapping. */
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
 *
 * Non-Greek input passes through unchanged (lowercased) — callers may hand it
 * mixed or already-Latin text.
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
// TITLE CASE (proper name casing)
// ============================================================================

/**
 * Convert text to Title Case, respecting Greek characters.
 * Each word: first letter uppercase, rest lowercase.
 * Handles hyphenated names: "ΠΑΠΑ-ΓΕΩΡΓΙΟΥ" → "Παπα-Γεωργίου"
 *
 * @example toGreekTitleCase("ΆχΙλλΕΑΣ") → "Αχιλλεας"
 * @example toGreekTitleCase("ΓΡΑΒΑΝΗΣ") → "Γραβανης"
 * @example toGreekTitleCase("παπα-γεωργίου") → "Παπα-Γεωργίου"
 */
export function toGreekTitleCase(text: string): string {
  if (!text) return '';
  return text
    .split(/(\s+)/)
    .map(segment =>
      segment
        .split('-')
        .map(part =>
          part.length > 0
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part
        )
        .join('-')
    )
    .join('');
}

// ============================================================================
// SEARCH NORMALIZATION
// ============================================================================

/**
 * Full normalization for search/filter operations.
 *
 * Applies:
 * 1. Accent stripping (NFD diacritics removal)
 * 2. Lowercase
 * 3. Punctuation removal (`.`, `-`, `_`, `/`, `\`, `(`, `)`)
 *
 * Use-case: matching "Δ.Ο.Υ." against "ΔΟΥ", "Πατρών" against "Πατρων", etc.
 */
export function normalizeForSearch(text: string): string {
  return normalizeGreekText(text).replace(/[.\-_/\\()]/g, '');
}
