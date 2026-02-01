/**
 * 🏢 ENTERPRISE: DXF Converter Helpers
 *
 * Centralized types and helper functions for DXF entity conversion.
 * Extracted from dxf-entity-converters.ts for Single Responsibility Principle.
 *
 * Contains:
 * - Type definitions (EntityData, TextAlignment, EntityConverter)
 * - Vertex parsing (parseVerticesFromData)
 * - Greek text decoding (decodeGreekText)
 * - Alignment mappers (mapHorizontalAlignment, mapMTextAlignment)
 *
 * @see dxf-entity-converters.ts - Entity converter implementations
 * @see AutoCAD DXF Reference for entity codes
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';

// 🏢 ENTERPRISE: Import ACI color system for DXF color extraction
import { getAciColor } from '../settings/standards/aci';
// 🏢 ADR: Centralized point validation
import { isValidPoint } from '../rendering/entities/shared/entity-validation-utils';

// ============================================================================
// 🏢 ENTERPRISE: TYPE DEFINITIONS
// ============================================================================

/**
 * DXF entity raw data from parser
 */
export interface EntityData {
  type: string;
  layer: string;
  data: Record<string, string>;
}

/**
 * Text alignment options (mapped from DXF codes)
 */
export type TextAlignment = 'left' | 'center' | 'right';

/**
 * Converter function signature for entity conversion
 */
export type EntityConverter = (
  data: Record<string, string>,
  layer: string,
  index: number
) => AnySceneEntity | null;

// ============================================================================
// 🏢 ENTERPRISE: GREEK CHARACTER MAPPINGS
// ============================================================================

/**
 * Greek character mappings for Windows-1253 to UTF-8 conversion
 * Used by decodeGreekText for proper Greek text display
 */
const GREEK_CHARACTER_MAPPINGS: Readonly<Record<string, string>> = {
  // Accented capitals
  'Ά': 'Ά', 'Έ': 'Έ', 'Ή': 'Ή', 'Ί': 'Ί', 'Ό': 'Ό', 'Ύ': 'Ύ', 'Ώ': 'Ώ',
  // Accented lowercase
  'ά': 'ά', 'έ': 'έ', 'ή': 'ή', 'ί': 'ί', 'ό': 'ό', 'ύ': 'ύ', 'ώ': 'ώ',
  // Capital letters
  'Α': 'Α', 'Β': 'Β', 'Γ': 'Γ', 'Δ': 'Δ', 'Ε': 'Ε', 'Ζ': 'Ζ', 'Η': 'Η',
  'Θ': 'Θ', 'Ι': 'Ι', 'Κ': 'Κ', 'Λ': 'Λ', 'Μ': 'Μ', 'Ν': 'Ν', 'Ξ': 'Ξ',
  'Ο': 'Ο', 'Π': 'Π', 'Ρ': 'Ρ', 'Σ': 'Σ', 'Τ': 'Τ', 'Υ': 'Υ', 'Φ': 'Φ',
  'Χ': 'Χ', 'Ψ': 'Ψ', 'Ω': 'Ω',
  // Lowercase letters
  'α': 'α', 'β': 'β', 'γ': 'γ', 'δ': 'δ', 'ε': 'ε', 'ζ': 'ζ', 'η': 'η',
  'θ': 'θ', 'ι': 'ι', 'κ': 'κ', 'λ': 'λ', 'μ': 'μ', 'ν': 'ν', 'ξ': 'ξ',
  'ο': 'ο', 'π': 'π', 'ρ': 'ρ', 'σ': 'σ', 'τ': 'τ', 'υ': 'υ', 'φ': 'φ',
  'χ': 'χ', 'ψ': 'ψ', 'ω': 'ω', 'ς': 'ς'
} as const;

// ============================================================================
// 🏢 ENTERPRISE: VERTEX PARSING
// ============================================================================

/**
 * 🏢 ENTERPRISE: Parse vertices from DXF data codes
 *
 * Extracts Point2D array from DXF group codes 10/20.
 * Used by LWPOLYLINE, SPLINE converters.
 *
 * DXF Format:
 * - Code 10: X coordinate of vertex
 * - Code 20: Y coordinate of vertex
 * - Vertices appear in sequence (10, 20, 10, 20, ...)
 *
 * @param data - Raw DXF group codes
 * @returns Array of parsed vertices
 */
export function parseVerticesFromData(data: Record<string, string>): Point2D[] {
  const vertices: Point2D[] = [];
  let currentVertex: { x?: number; y?: number } = {};

  Object.keys(data).forEach(code => {
    if (code === '10') {
      // Add previous vertex if complete - 🏢 ADR: Use centralized isValidPoint
      if (isValidPoint(currentVertex)) {
        vertices.push({ x: currentVertex.x, y: currentVertex.y });
      }
      // Start new vertex
      currentVertex = { x: parseFloat(data[code]) };
    } else if (code === '20' && currentVertex.x !== undefined) {
      currentVertex.y = parseFloat(data[code]);
    }
  });

  // Add final vertex - 🏢 ADR: Use centralized isValidPoint
  if (isValidPoint(currentVertex)) {
    vertices.push({ x: currentVertex.x, y: currentVertex.y });
  }

  return vertices;
}

// ============================================================================
// 🏢 ENTERPRISE: GREEK TEXT DECODING
// ============================================================================

/**
 * 🏢 ENTERPRISE: Decode Greek text from DXF encoding
 *
 * Handles Windows-1253 and Unicode escape sequences.
 * Used by TEXT, MTEXT converters for proper Greek text display.
 *
 * Supports:
 * - Unicode escape sequences (\u03B1 → α)
 * - Windows-1253 to UTF-8 character mapping
 *
 * @param text - Raw text from DXF
 * @returns Decoded Unicode text
 */
export function decodeGreekText(text: string): string {
  if (!text) return text;

  let decoded = text;

  try {
    // Decode Unicode escape sequences like \u03B1 (α)
    decoded = decoded.replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Apply Greek character mappings for Windows-1253 conversion issues
    for (const [encoded, greek] of Object.entries(GREEK_CHARACTER_MAPPINGS)) {
      decoded = decoded.replace(new RegExp(encoded, 'g'), greek);
    }

  } catch (error) {
    console.warn('Greek text decoding error:', error);
  }

  return decoded;
}

// ============================================================================
// 🏢 ENTERPRISE: ALIGNMENT MAPPERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Map DXF horizontal justification code to alignment
 *
 * DXF Code 72 values (TEXT entity):
 * - 0 = Left (default)
 * - 1 = Center
 * - 2 = Right
 * - 3 = Aligned (treated as Left)
 * - 4 = Middle (treated as Center)
 * - 5 = Fit (treated as Left)
 *
 * @see AutoCAD DXF Reference: TEXT Entity
 * @param code - DXF horizontal justification code (0-5)
 * @returns Text alignment ('left' | 'center' | 'right')
 */
export function mapHorizontalAlignment(code: number): TextAlignment {
  switch (code) {
    case 1:
    case 4: // Middle = Center
      return 'center';
    case 2:
      return 'right';
    default:
      return 'left';
  }
}

/**
 * 🏢 ENTERPRISE: Map MTEXT attachment point to alignment
 *
 * DXF Code 71 values (3x3 grid for MTEXT):
 * ```
 * 1 (TL)  2 (TC)  3 (TR)
 * 4 (ML)  5 (MC)  6 (MR)
 * 7 (BL)  8 (BC)  9 (BR)
 * ```
 * Column calculation: (attachmentPoint - 1) % 3
 * - Column 0 = Left (1, 4, 7)
 * - Column 1 = Center (2, 5, 8)
 * - Column 2 = Right (3, 6, 9)
 *
 * @see AutoCAD DXF Reference: MTEXT Entity
 * @param attachmentPoint - DXF attachment point code (1-9)
 * @returns Text alignment ('left' | 'center' | 'right')
 */
export function mapMTextAlignment(attachmentPoint: number): TextAlignment {
  const column = (attachmentPoint - 1) % 3;
  switch (column) {
    case 1:
      return 'center';
    case 2:
      return 'right';
    default:
      return 'left';
  }
}

// ============================================================================
// 🏢 ENTERPRISE: COLOR EXTRACTION (DXF GROUP CODE 62)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Extract entity color from DXF data
 *
 * DXF Color System (Group Code 62):
 * - 0 = ByBlock (inherits from containing block)
 * - 1-255 = ACI (AutoCAD Color Index)
 * - 256 = ByLayer (inherits from layer color)
 *
 * @see AutoCAD DXF Reference: Common Entity Properties
 * @see settings/standards/aci.ts - ACI color palette
 *
 * @param data - Raw DXF group codes
 * @returns Hex color string or undefined (for ByBlock/ByLayer)
 */
export function extractEntityColor(data: Record<string, string>): string | undefined {
  const colorCode = data['62'];

  if (!colorCode) {
    // No color specified - will use default
    return undefined;
  }

  const colorIndex = parseInt(colorCode, 10);

  if (isNaN(colorIndex)) {
    return undefined;
  }

  // Handle special cases
  if (colorIndex === 0) {
    // ByBlock - return undefined, renderer will use default
    return undefined;
  }

  if (colorIndex === 256) {
    // ByLayer - return undefined, should be resolved from layer
    return undefined;
  }

  // Valid ACI index (1-255)
  if (colorIndex >= 1 && colorIndex <= 255) {
    return getAciColor(colorIndex);
  }

  // Invalid index - return undefined
  return undefined;
}
