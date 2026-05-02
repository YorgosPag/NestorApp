/**
 * 🏢 ENTERPRISE SEARCH v1
 *
 * Type-safe, Greek-friendly search utilities
 * Based on local_4.log architecture specification
 *
 * @version 1.0.0
 * @compliance ISO/IEC 25010 - Software Quality Standards
 */

// =============================================================================
// TYPES
// =============================================================================

export type Searchable = string | number | boolean | null | undefined | Date;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Strips diacritics from Greek and Latin text
 * Normalizes final sigma (ς → σ)
 *
 * @param input - Text to normalize
 * @returns Normalized text without diacritics
 */
function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritical marks
    .replace(/ς/g, "σ");             // Normalize final sigma
}

/**
 * Normalizes any value to searchable lowercase string
 * Handles all primitive types safely
 *
 * @param value - Value to normalize (any type)
 * @returns Normalized lowercase string
 */
export function normalizeSearchText(value: Searchable): string {
  if (value == null) return "";

  const raw =
    value instanceof Date ? value.toISOString()
    : typeof value === "boolean" ? String(value)
    : String(value);

  return stripDiacritics(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Collapse multiple spaces
}

// =============================================================================
// PREFIX GENERATION (SSoT — used by search-indexer + /api/search)
// =============================================================================

/** Max prefix length (must match SEARCH_CONFIG.MAX_PREFIX_LENGTH in types/search.ts) */
const MAX_PREFIX_LENGTH = 5;

/**
 * Generate search prefixes (3-MAX chars) from normalized text.
 * Each word produces prefixes of length 3..MAX for Firestore array-contains-any.
 *
 * @param text - Already-normalized text (run through normalizeSearchText first)
 * @returns Deduplicated prefix array
 */
export function generateSearchPrefixes(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes = new Set<string>();
  for (const rawWord of words) {
    // Strip leading/trailing non-alphanumeric chars (e.g. quotes, punctuation)
    // so "ΩΝΑΣΕΙΟ" → ΩΝΑΣΕΙΟ, PRJ-001 stays intact (internal hyphens kept)
    const word = rawWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (word.length < 3) continue;
    for (let len = 3; len <= Math.min(MAX_PREFIX_LENGTH, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }
  return Array.from(prefixes);
}

// =============================================================================
// CLIENT-SIDE MATCHING
// =============================================================================

/**
 * Checks if item fields match search term
 * Empty term returns true (show all)
 *
 * @param itemFields - Array of field values to search
 * @param term - Search term
 * @returns true if any field matches
 */
export function matchesSearchTerm(
  itemFields: readonly Searchable[],
  term: string
): boolean {
  const normalizedTerm = normalizeSearchText(term);

  // Empty search = show all
  if (!normalizedTerm) return true;

  // Check if any field contains the search term
  for (const field of itemFields) {
    const normalizedField = normalizeSearchText(field);
    if (normalizedField.includes(normalizedTerm)) {
      return true;
    }
  }

  return false;
}