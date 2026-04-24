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
  entityType: 'property' | 'parking' | 'storage';
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
 * Resolves the 2-character type code for a given entity type.
 */
export function resolveTypeCode(
  entityType: 'property' | 'parking' | 'storage',
  propertyType?: PropertyType,
  locationZone?: ParkingLocationZone
): string | null {
  switch (entityType) {
    case 'property':
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

