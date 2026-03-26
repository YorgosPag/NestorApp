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
