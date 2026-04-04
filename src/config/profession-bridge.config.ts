/**
 * =============================================================================
 * Profession Bridge Config — Project Role → ESCO Search Hints
 * =============================================================================
 *
 * Maps project association roles to ESCO search queries.
 * The service uses these hints to find the REAL ESCO occupation
 * from the Firestore cache. No hardcoded labels — only the cache
 * is the source of truth for profession data.
 *
 * @module config/profession-bridge.config
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import type { ProjectRole } from '@/types/entity-associations';

// ============================================================================
// MAPPING TABLE — Search hints only, NO hardcoded profession labels
// ============================================================================

/**
 * Maps project engineer roles to ESCO search queries.
 *
 * The bridge service will:
 * 1. Search the ESCO cache with these hints
 * 2. Use ONLY the real ESCO preferred label, URI, ISCO code
 * 3. If no match found → does NOT write anything (zero guessing)
 */
export const PROJECT_ROLE_ESCO_HINTS: Partial<Record<ProjectRole, string>> = {
  architect: 'Αρχιτέκτονας',
  structural_engineer: 'Πολιτικός Μηχανικός',
  electrical_engineer: 'Ηλεκτρολόγος',
  mechanical_engineer: 'Μηχανολόγος',
  surveyor: 'Τοπογράφος',
  energy_inspector: 'Ενεργειακός',
  supervising_engineer: 'Επιβλέπων Μηχανικός',
};

/**
 * Returns the ESCO search hint for a given project role, or null.
 */
export function getEscoSearchHint(role: string): string | null {
  return (PROJECT_ROLE_ESCO_HINTS as Record<string, string>)[role] ?? null;
}
