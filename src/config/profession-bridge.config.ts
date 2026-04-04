/**
 * =============================================================================
 * Profession Bridge Config — Project Role → ESCO Occupation Mapping
 * =============================================================================
 *
 * 1:1 mapping from 7 project engineer roles to ESCO occupations.
 * URIs and labels verified against the EU ESCO API (2026-04-04).
 *
 * 5 roles have exact ESCO matches (with URI).
 * 2 roles (energy_inspector, supervising_engineer) are Greek TEE-specific
 * and have no exact ESCO equivalent — hardcoded without URI.
 *
 * @module config/profession-bridge.config
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import type { ProjectRole } from '@/types/entity-associations';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionBridgeEntry {
  /** Profession label as displayed (Greek, capitalized) */
  readonly profession: string;
  /** ESCO preferred label (lowercase, as in EU taxonomy) — null if no match */
  readonly escoLabel: string;
  /** ISCO-08 code (with sub-code where available) */
  readonly iscoCode: string;
  /** ESCO occupation URI — null if no exact ESCO match */
  readonly escoUri: string | null;
}

// ============================================================================
// VERIFIED MAPPING (EU ESCO API, 2026-04-04)
// ============================================================================

export const PROJECT_ROLE_BRIDGE: Record<string, ProfessionBridgeEntry> = {
  // ── ESCO-verified (5/7) ──────────────────────────────────────────────
  architect: {
    profession: 'Αρχιτέκτονας',
    escoLabel: 'αρχιτέκτονας',
    iscoCode: '2161',
    escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
  },
  structural_engineer: {
    profession: 'Πολιτικός Μηχανικός',
    escoLabel: 'πολιτικός μηχανικός',
    iscoCode: '2142',
    escoUri: 'http://data.europa.eu/esco/occupation/d7d986e1-7333-431b-9719-0c5c6939e360',
  },
  electrical_engineer: {
    profession: 'Ηλεκτρολόγος Μηχανικός',
    escoLabel: 'ηλεκτρολόγος μηχανικός',
    iscoCode: '2151',
    escoUri: 'http://data.europa.eu/esco/occupation/86ca306c-ab99-420a-9e2a-aa73c5c4de22',
  },
  mechanical_engineer: {
    profession: 'Μηχανολόγος Μηχανικός',
    escoLabel: 'μηχανολόγος μηχανικός',
    iscoCode: '2144',
    escoUri: 'http://data.europa.eu/esco/occupation/579254cf-6d69-4889-9000-9c79dc568644',
  },
  surveyor: {
    profession: 'Τοπογράφος Μηχανικός',
    escoLabel: 'αγρονόμος τοπογράφος μηχανικός',
    iscoCode: '2165',
    escoUri: 'http://data.europa.eu/esco/occupation/d8e502b4-1be6-4d10-a224-151688f8f0c8',
  },

  // ── Hardcoded — no exact ESCO match (2/7) ────────────────────────────
  energy_inspector: {
    profession: 'Ενεργειακός Επιθεωρητής',
    escoLabel: 'Ενεργειακός Επιθεωρητής',
    iscoCode: '2143',
    escoUri: null,
  },
  supervising_engineer: {
    profession: 'Επιβλέπων Μηχανικός',
    escoLabel: 'Επιβλέπων Μηχανικός',
    iscoCode: '2142',
    escoUri: null,
  },
};

/**
 * Returns the bridge entry for a given project role, or null.
 */
export function getBridgeEntry(role: string): ProfessionBridgeEntry | null {
  return PROJECT_ROLE_BRIDGE[role] ?? null;
}
