/**
 * =============================================================================
 * Profession Bridge Config — Project Role → ESCO Mapping
 * =============================================================================
 *
 * Static mapping from project association roles to ESCO occupation data.
 * Used by ProfessionBridgeService to auto-fill contact profession
 * when assigned to a project.
 *
 * @module config/profession-bridge.config
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import type { ProjectRole } from '@/types/entity-associations';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionBridgeMapping {
  /** Greek human-readable profession label */
  readonly profession: string;
  /** Cached ESCO label (Greek) */
  readonly escoLabel: string;
  /** ISCO-08 4-digit code for grouping/filtering */
  readonly iscoCode: string;
  /** ESCO search query hint — used for runtime URI lookup */
  readonly escoSearchHint: string;
}

// ============================================================================
// MAPPING TABLE
// ============================================================================

/**
 * Maps project engineer roles to ESCO occupation data.
 *
 * Notes:
 * - `escoUri` is NOT hardcoded — resolved at runtime via EscoService search
 * - `iscoCode` follows ISCO-08 (ILO International Standard)
 * - Labels match the Firestore ESCO cache preferred labels (Greek)
 */
export const PROJECT_ROLE_TO_PROFESSION: Partial<Record<ProjectRole, ProfessionBridgeMapping>> = {
  architect: {
    profession: 'Αρχιτέκτονας',
    escoLabel: 'Αρχιτέκτονας',
    iscoCode: '2161',
    escoSearchHint: 'Αρχιτέκτονας',
  },
  structural_engineer: {
    profession: 'Πολιτικός Μηχανικός',
    escoLabel: 'Πολιτικός Μηχανικός',
    iscoCode: '2142',
    escoSearchHint: 'Πολιτικός Μηχανικός',
  },
  electrical_engineer: {
    profession: 'Ηλεκτρολόγος Μηχανικός',
    escoLabel: 'Ηλεκτρολόγος Μηχανικός',
    iscoCode: '2151',
    escoSearchHint: 'Ηλεκτρολόγος',
  },
  mechanical_engineer: {
    profession: 'Μηχανολόγος Μηχανικός',
    escoLabel: 'Μηχανολόγος Μηχανικός',
    iscoCode: '2144',
    escoSearchHint: 'Μηχανολόγος',
  },
  surveyor: {
    profession: 'Τοπογράφος Μηχανικός',
    escoLabel: 'Τοπογράφος Μηχανικός',
    iscoCode: '2165',
    escoSearchHint: 'Τοπογράφος',
  },
  energy_inspector: {
    profession: 'Ενεργειακός Επιθεωρητής',
    escoLabel: 'Ενεργειακός Επιθεωρητής',
    iscoCode: '2143',
    escoSearchHint: 'Ενεργειακός',
  },
  supervising_engineer: {
    profession: 'Επιβλέπων Μηχανικός',
    escoLabel: 'Επιβλέπων Μηχανικός',
    iscoCode: '2142',
    escoSearchHint: 'Επιβλέπων',
  },
};

/**
 * Returns the profession mapping for a given role, or null.
 */
export function getProfessionForRole(role: string): ProfessionBridgeMapping | null {
  return (PROJECT_ROLE_TO_PROFESSION as Record<string, ProfessionBridgeMapping>)[role] ?? null;
}
