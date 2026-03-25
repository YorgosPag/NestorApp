/**
 * SECTION FIELD UTILS — Shared field extraction for section configs
 *
 * Single source of truth for extracting field IDs from section configs.
 * Used by: ai-tab-mapping.ts (prompt generation), contact-tab-filter.ts (server-side filtering)
 *
 * @module config/section-field-utils
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SectionLike {
  id: string;
  fields: ReadonlyArray<{ id: string }>;
}

// ============================================================================
// HARDCODED ARRAY FIELDS (SSoT)
// ============================================================================

/**
 * Sections that use custom renderers (not Firestore document fields).
 * These sections have dummy trigger fields, but the actual data lives
 * in array fields on the contact document.
 */
export const ARRAY_FIELD_SECTIONS: Readonly<Record<string, readonly string[]>> = {
  communication: ['phones', 'emails', 'websites', 'socialMedia'],
} as const;

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

/**
 * Extract real (non-dummy) field IDs from a section config.
 *
 * Convention: dummy fields have field.id === section.id (trigger for custom renderer).
 * Returns empty array if section has no real fields.
 */
export function extractRealFieldIds(section: SectionLike): string[] {
  if (!section.fields || section.fields.length === 0) return [];
  return section.fields
    .filter(f => f.id !== section.id)
    .map(f => f.id);
}
