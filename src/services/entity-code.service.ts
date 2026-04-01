/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Code Service (ADR-233)
 * =============================================================================
 *
 * Generates entity codes in format: {Building}-{Type}-{Floor}.{Sequence}
 * Example: A-DI-1.01 (Building A, Apartment, Floor 1, Unit 01)
 *
 * Architecture:
 * - Pure functions for formatting/parsing (shared client + server)
 * - Firestore query for sequence generation (server-side only)
 * - Follows ProjectCodeService pattern for atomic counters
 *
 * @see ADR-233 — Entity Coding System
 * @module services/entity-code.service
 */

import {
  ENTITY_CODE_SEPARATOR as SEP,
  ENTITY_CODE_SEQUENCE_PADDING,
  VALID_TYPE_CODES,
  PROPERTY_TYPE_TO_CODE,
  PARKING_ZONE_TO_CODE,
  extractBuildingLetter,
} from '@/config/entity-code-config';
import type { PropertyType } from '@/types/property';
import type { ParkingLocationZone } from '@/types/parking';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedEntityCode {
  building: string;
  typeCode: string;
  floorCode: string;
  sequence: number;
}

export interface EntityCodeSuggestionParams {
  entityType: 'unit' | 'parking' | 'storage';
  buildingName: string;
  floorLevel: number;
  propertyType?: PropertyType;
  locationZone?: ParkingLocationZone;
}

// =============================================================================
// PURE FUNCTIONS — Client + Server
// =============================================================================

/**
 * Encodes a floor level as an ADR-233 floor code.
 *
 * @example formatFloorCode(0) → "0"
 * @example formatFloorCode(1) → "1"
 * @example formatFloorCode(-1) → "Y1"
 * @example formatFloorCode(-2) → "Y2"
 */
export function formatFloorCode(level: number): string {
  if (level < 0) return `Y${Math.abs(level)}`;
  return String(level);
}

/**
 * Parses an ADR-233 floor code back to a numeric level.
 *
 * @example parseFloorCode("0") → 0
 * @example parseFloorCode("Y1") → -1
 * @example parseFloorCode("Y2") → -2
 * @example parseFloorCode("3") → 3
 */
export function parseFloorCode(code: string): number {
  const upper = code.toUpperCase();
  if (upper.startsWith('Y')) {
    const num = parseInt(upper.slice(1), 10);
    return isNaN(num) ? 0 : -num;
  }
  const num = parseInt(upper, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a complete entity code from components.
 *
 * @example formatEntityCode("A", "DI", "1", 1) → "A-DI-1.01"
 * @example formatEntityCode("B", "PK", "Y1", 3) → "B-PK-Y1.03"
 */
export function formatEntityCode(
  building: string,
  typeCode: string,
  floorCode: string,
  sequence: number
): string {
  const paddedSeq = String(sequence).padStart(ENTITY_CODE_SEQUENCE_PADDING, '0');
  return `${building}${SEP}${typeCode}${SEP}${floorCode}.${paddedSeq}`;
}

/**
 * Parses an entity code string into its components.
 *
 * @example parseEntityCode("A-DI-1.01") → { building: "A", typeCode: "DI", floorCode: "1", sequence: 1 }
 * @returns Parsed components or null if invalid
 */
export function parseEntityCode(code: string): ParsedEntityCode | null {
  // Pattern: {Building}-{Type}-{Floor}.{Seq}
  const match = code.match(/^([A-Z0-9?]+)-([A-Z]{2})-([A-Z]?\d+)\.(\d+)$/i);
  if (!match) return null;

  return {
    building: match[1].toUpperCase(),
    typeCode: match[2].toUpperCase(),
    floorCode: match[3].toUpperCase(),
    sequence: parseInt(match[4], 10),
  };
}

/**
 * Validates whether a code follows the ADR-233 format.
 * Returns true even if type code is unknown (allows custom codes).
 */
export function isValidEntityCodeFormat(code: string): boolean {
  return parseEntityCode(code) !== null;
}

/**
 * Validates whether a code follows ADR-233 format AND uses known type codes.
 */
export function isStandardEntityCode(code: string): boolean {
  const parsed = parseEntityCode(code);
  if (!parsed) return false;
  return VALID_TYPE_CODES.has(parsed.typeCode);
}

/**
 * Resolves the 2-character type code for a given entity type.
 */
export function resolveTypeCode(
  entityType: 'unit' | 'parking' | 'storage',
  propertyType?: PropertyType,
  locationZone?: ParkingLocationZone
): string | null {
  switch (entityType) {
    case 'unit':
      if (!propertyType) return null;
      return PROPERTY_TYPE_TO_CODE[propertyType] ?? null;
    case 'parking':
      if (!locationZone) return 'PK'; // default: closed parking
      return PARKING_ZONE_TO_CODE[locationZone] ?? 'PK';
    case 'storage':
      return 'AP';
    default:
      return null;
  }
}

/**
 * Builds a suggested entity code from parameters.
 * The sequence is provided externally (from Firestore query).
 */
export function buildSuggestedCode(params: EntityCodeSuggestionParams, sequence: number): string {
  const building = extractBuildingLetter(params.buildingName);
  const typeCode = resolveTypeCode(params.entityType, params.propertyType, params.locationZone);
  if (!typeCode) return '';

  const floorCode = formatFloorCode(params.floorLevel);
  return formatEntityCode(building, typeCode, floorCode, sequence);
}

// =============================================================================
// COUNTER KEY — Composite key for per-type-per-floor sequences
// =============================================================================

/**
 * Builds the Firestore counter key for sequence tracking.
 * Format: "{buildingId}_{typeCode}_{floorCode}"
 *
 * This ensures sequences are unique per building, type, and floor.
 */
export function buildCounterKey(buildingId: string, typeCode: string, floorCode: string): string {
  return `${buildingId}_${typeCode}_${floorCode}`;
}
