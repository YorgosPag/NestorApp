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

import type { PropertyType } from '@/types/property';
import type { ParkingLocationZone } from '@/types/parking';

// =============================================================================
// TYPE CODES — ADR-233 §4.1
// =============================================================================

/**
 * Maps PropertyType → 2-character ADR-233 code.
 *
 * Residential (8): DI, GK, ST, ME, RE, LO, MO, BI
 * Commercial (3): KA, GR, AI
 * Auxiliary (1): AP
 */
export const PROPERTY_TYPE_TO_CODE: Partial<Record<PropertyType, string>> = {
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
 * Greek uppercase alphabet (24 letters, Α..Ω) — used for sequential building codes.
 * Order matches official Greek alphabet: Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω
 */
export const GREEK_UPPERCASE_LETTERS: readonly string[] = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
  'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω',
] as const;

/**
 * Canonical prefix for the locked building code field (e.g. "Κτήριο Α").
 * @see ADR-233 §3.4
 */
export const BUILDING_CODE_PREFIX = 'Κτήριο';

/**
 * Returns the Greek uppercase letter at a given index (0-based).
 * - Index 0..23 → Α..Ω
 * - Index ≥ 24  → numeric string (e.g. 24 → "25") for rare edge cases
 *   (projects with more than 24 buildings).
 *
 * @param index - Zero-based position in the sequence
 * @returns Greek letter (Α..Ω) or numeric fallback
 */
export function getGreekLetterAt(index: number): string {
  if (index < 0) return '?';
  if (index < GREEK_UPPERCASE_LETTERS.length) {
    return GREEK_UPPERCASE_LETTERS[index];
  }
  // Beyond Ω: fall through to numeric identifiers starting at 25
  return String(index + 1);
}

/**
 * Builds the canonical building code string for a given sequence index.
 *
 * @example buildBuildingCode(0) → "Κτήριο Α"
 * @example buildBuildingCode(1) → "Κτήριο Β"
 * @example buildBuildingCode(25) → "Κτήριο 26"
 */
export function buildBuildingCode(index: number): string {
  return `${BUILDING_CODE_PREFIX} ${getGreekLetterAt(index)}`;
}

/**
 * Suggests the next available building code for a project, based on the
 * codes already assigned to existing buildings. Gap-filling strategy:
 * if "Κτήριο Α" and "Κτήριο Γ" exist, proposes "Κτήριο Β".
 *
 * @param existingCodes - Array of `code` values from sibling buildings
 * @returns Next unused building code (e.g. "Κτήριο Α")
 */
export function suggestNextBuildingCode(existingCodes: readonly string[]): string {
  const usedTokens = new Set<string>();

  for (const raw of existingCodes) {
    if (!raw) continue;
    const trimmed = raw.trim();
    // Extract trailing token (letter or number) after last space
    const match = trimmed.match(/\s(\S+)\s*$/);
    const token = match ? match[1].toUpperCase() : trimmed.toUpperCase();
    usedTokens.add(token);
  }

  // Find first unused Greek letter (gap-filling)
  for (let i = 0; i < GREEK_UPPERCASE_LETTERS.length; i++) {
    if (!usedTokens.has(GREEK_UPPERCASE_LETTERS[i])) {
      return buildBuildingCode(i);
    }
  }

  // All 24 Greek letters taken → use next numeric index
  // Find the max numeric token used (if any)
  let maxNumeric = GREEK_UPPERCASE_LETTERS.length; // start at 24 (next = 25)
  for (const token of usedTokens) {
    const num = parseInt(token, 10);
    if (!isNaN(num) && num > maxNumeric) maxNumeric = num;
  }
  return `${BUILDING_CODE_PREFIX} ${maxNumeric + 1}`;
}

/**
 * Extracts a single uppercase Latin letter (or digit) from a building's
 * identifier — used to build unit codes (e.g. "A-DI-1.01").
 *
 * Priority (ADR-233 §3.4):
 *   1. `building.code` field — canonical, locked format "Κτήριο X"
 *   2. `building.name` field — legacy free-text (pre-migration buildings)
 *
 * Also accepts a plain string for backward compatibility with legacy callers.
 *
 * Handles patterns:
 * - "A", "B", "C" → direct
 * - "Κτίριο Α", "Κτήριο Α", "Building B" → extracts trailing letter
 * - "Α" (Greek) → converts to "A"
 * - "Block 1", "Κτήριο 25" → extracts trailing number
 * - Fallback: first character uppercased
 *
 * @param input - Building object `{ code?, name? }` or raw string
 * @returns Single uppercase letter/digit for the code prefix
 */
export function extractBuildingLetter(
  input: string | { code?: string | null; name?: string | null }
): string {
  // Resolve source string: prefer code, then name, then string input
  let source: string;
  if (typeof input === 'string') {
    source = input;
  } else {
    source = input.code?.trim() || input.name?.trim() || '';
  }

  const trimmed = source.trim();
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

  // Pattern: "Block 1", "Building 2", "Κτήριο 25"
  const trailingNumberMatch = trimmed.match(/\s(\d+)\s*$/);
  if (trailingNumberMatch) {
    return trailingNumberMatch[1];
  }

  // Fallback: first character
  const first = trimmed[0].toUpperCase();
  return GREEK_TO_LATIN[first] ?? first;
}
