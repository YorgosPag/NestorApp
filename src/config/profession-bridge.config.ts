/**
 * =============================================================================
 * Profession Bridge Config — Project Role → ESCO Mapping
 * =============================================================================
 *
 * Maps project association roles to ESCO search hints + hardcoded fallbacks.
 *
 * Strategy (hybrid):
 * 1. Search ESCO cache with hint → use real ESCO data (preferred label, URI, ISCO)
 * 2. If ESCO cache is empty/no match → fallback to hardcoded profession data
 *
 * @module config/profession-bridge.config
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import type { ProjectRole } from '@/types/entity-associations';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionBridgeEntry {
  /** Search query for ESCO cache lookup */
  readonly escoSearchHint: string;
  /** Fallback profession label if ESCO cache has no match */
  readonly fallbackProfession: string;
  /** Fallback ISCO-08 code */
  readonly fallbackIscoCode: string;
}

// ============================================================================
// MAPPING TABLE
// ============================================================================

/**
 * 7 project engineer roles → ESCO search hints + hardcoded fallbacks.
 *
 * The service tries ESCO cache first. If no match (e.g. cache not seeded),
 * falls back to the hardcoded values here.
 */
export const PROJECT_ROLE_BRIDGE: Partial<Record<ProjectRole, ProfessionBridgeEntry>> = {
  architect: {
    escoSearchHint: 'Αρχιτέκτονας',
    fallbackProfession: 'Αρχιτέκτονας',
    fallbackIscoCode: '2161',
  },
  structural_engineer: {
    escoSearchHint: 'Πολιτικός Μηχανικός',
    fallbackProfession: 'Πολιτικός Μηχανικός',
    fallbackIscoCode: '2142',
  },
  electrical_engineer: {
    escoSearchHint: 'Ηλεκτρολόγος',
    fallbackProfession: 'Ηλεκτρολόγος Μηχανικός',
    fallbackIscoCode: '2151',
  },
  mechanical_engineer: {
    escoSearchHint: 'Μηχανολόγος',
    fallbackProfession: 'Μηχανολόγος Μηχανικός',
    fallbackIscoCode: '2144',
  },
  surveyor: {
    escoSearchHint: 'Τοπογράφος',
    fallbackProfession: 'Τοπογράφος Μηχανικός',
    fallbackIscoCode: '2165',
  },
  energy_inspector: {
    escoSearchHint: 'Ενεργειακός',
    fallbackProfession: 'Ενεργειακός Επιθεωρητής',
    fallbackIscoCode: '2143',
  },
  supervising_engineer: {
    escoSearchHint: 'Επιβλέπων',
    fallbackProfession: 'Επιβλέπων Μηχανικός',
    fallbackIscoCode: '2142',
  },
};

/**
 * Returns the bridge entry for a given project role, or null.
 */
export function getBridgeEntry(role: string): ProfessionBridgeEntry | null {
  return (PROJECT_ROLE_BRIDGE as Record<string, ProfessionBridgeEntry>)[role] ?? null;
}
