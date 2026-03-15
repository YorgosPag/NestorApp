/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Code Configuration (ADR-233)
 * =============================================================================
 *
 * Centralized configuration for entity code generation.
 * Format: {Building}-{Type}-{Floor}.{Sequence}
 *
 * Type codes are 2-character Latin codes inspired by Greek words:
 * DI = Διαμέρισμα, GK = Γκαρσονιέρα, ST = Στούντιο, etc.
 *
 * @see ADR-233 — Entity Coding System
 * @module config/entity-code-config
 */

import type { UnitType } from '@/types/unit';
import type { ParkingLocationZone } from '@/types/parking';

// =============================================================================
// TYPE CODES — ADR-233 §4.1
// =============================================================================

/**
 * Maps UnitType → 2-character ADR-233 code.
 *
 * Residential (8): DI, GK, ST, ME, RE, LO, MO, BI
 * Commercial (3): KA, GR, AI
 * Auxiliary (1): AP
 */
export const UNIT_TYPE_TO_CODE: Partial<Record<UnitType, string>> = {
  // Residential
  studio: 'ST',
  apartment_1br: 'GK',
  apartment: 'DI',
  apartment_2br: 'DI',
  apartment_3br: 'DI',
  maisonette: 'ME',
  penthouse: 'RE',
  loft: 'LO',
  detached_house: 'MO',
  villa: 'BI',
  // Commercial
  shop: 'KA',
  office: 'GR',
  hall: 'AI',
  // Auxiliary
  storage: 'AP',
};

/**
 * Maps ParkingLocationZone → 2-character ADR-233 code.
 * PK = Κλειστό (underground), PY = Υπαίθριο (all others)
 */
export const PARKING_ZONE_TO_CODE: Record<ParkingLocationZone, string> = {
  underground: 'PK',
  pilotis: 'PY',
  open_space: 'PY',
  rooftop: 'PY',
  covered_outdoor: 'PY',
};

// =============================================================================
// FORMAT CONSTANTS — ADR-233 §6.1
// =============================================================================

/** Separator between code segments */
export const ENTITY_CODE_SEPARATOR = '-';

/** Zero-padding width for sequence numbers */
export const ENTITY_CODE_SEQUENCE_PADDING = 2;

// =============================================================================
// VALID TYPE CODES (for parsing/validation)
// =============================================================================

/** All valid 2-character type codes defined in ADR-233 */
export const VALID_TYPE_CODES = new Set([
  'DI', 'GK', 'ST', 'ME', 'RE', 'LO', 'MO', 'BI',
  'KA', 'GR', 'AI',
  'AP',
  'PK', 'PY',
]);

// =============================================================================
// REVERSE MAPPING (code → human-readable i18n key)
// =============================================================================

/** Maps ADR-233 code back to an i18n-friendly label key */
export const CODE_TO_LABEL_KEY: Record<string, string> = {
  DI: 'types.apartment',
  GK: 'types.apartment_1br',
  ST: 'types.studio',
  ME: 'types.maisonette',
  RE: 'types.penthouse',
  LO: 'types.loft',
  MO: 'types.detached_house',
  BI: 'types.villa',
  KA: 'types.shop',
  GR: 'types.office',
  AI: 'types.hall',
  AP: 'types.storage',
  PK: 'parking.closedParking',
  PY: 'parking.openParking',
};

// =============================================================================
// BUILDING LETTER EXTRACTION
// =============================================================================

/**
 * Greek-to-Latin uppercase mapping for building letter extraction.
 * Used when building names contain Greek letters (e.g. "Κτίριο Α" → "A").
 */
const GREEK_TO_LATIN: Record<string, string> = {
  'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z',
  'Η': 'H', 'Θ': 'TH', 'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M',
  'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P', 'Ρ': 'R', 'Σ': 'S',
  'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'CH', 'Ψ': 'PS', 'Ω': 'O',
};

/**
 * Extracts a single uppercase Latin letter from a building name.
 *
 * Handles patterns:
 * - "A", "B", "C" → direct
 * - "Κτίριο Α", "Building B" → extracts trailing letter
 * - "Α" (Greek) → converts to "A"
 * - "Block 1" → "1"
 * - Fallback: first character uppercased
 *
 * @param buildingName - Free-text building name from Firestore
 * @returns Single uppercase letter/digit for the code prefix
 */
export function extractBuildingLetter(buildingName: string): string {
  const trimmed = buildingName.trim();
  if (!trimmed) return '?';

  // Single character — use as-is (convert Greek if needed)
  if (trimmed.length === 1) {
    const upper = trimmed.toUpperCase();
    return GREEK_TO_LATIN[upper] ?? upper;
  }

  // Pattern: "Κτίριο Α", "Building B", "Block C", "Πολυκατοικία Γ"
  // Look for a trailing single letter (Latin or Greek) after a space
  const trailingMatch = trimmed.match(/\s([A-ZΑ-Ω])\s*$/i);
  if (trailingMatch) {
    const letter = trailingMatch[1].toUpperCase();
    return GREEK_TO_LATIN[letter] ?? letter;
  }

  // Pattern: "Block 1", "Building 2"
  const trailingNumberMatch = trimmed.match(/\s(\d+)\s*$/);
  if (trailingNumberMatch) {
    return trailingNumberMatch[1];
  }

  // Fallback: first character
  const first = trimmed[0].toUpperCase();
  return GREEK_TO_LATIN[first] ?? first;
}
