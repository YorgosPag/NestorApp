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
// 🏢 SSoT: 24-bit true-color (group code 420) → hex (ADR-507 Φ5, reused here for import)
import { trueColorToHex } from './dxf-true-color';
// 🏢 ADR: Centralized point validation
import { isValidPoint } from '../rendering/entities/shared/entity-validation-utils';
// ADR-635 Φ C.3/C.4 — per-entity lineweight/linetype/ltscale extractors live in a sibling
// module (file-size SRP split, N.7.1). Re-exported below so converters' import path stays stable.
export {
  extractEntityLineweight,
  extractEntityLinetype,
  extractEntityLtscale,
} from './dxf-entity-style-extract';

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
  /**
   * Ordered (code, value) pairs — διατηρεί τους ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΟΥΣ κωδικούς που
   * το flat `data` χάνει (π.χ. HATCH boundary loops: πολλαπλά 10/20 ανά path).
   * Additive (ADR-507) — οι υπάρχοντες converters συνεχίζουν να διαβάζουν `data`.
   */
  pairs?: ReadonlyArray<readonly [string, string]>;
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

/**
 * DXF polyline vertex — Point2D plus optional bulge (code 42, arc segment factor).
 */
export interface DxfPolyVertex {
  x: number;
  y: number;
  /** DXF code 42 — bulge of the arc segment STARTING at this vertex (0 = straight). */
  bulge?: number;
}

/**
 * 🏢 ENTERPRISE: Parse polyline vertices from ORDERED (code, value) pairs.
 *
 * The flat `Record<string,string>` in `EntityData.data` OVERWRITES repeated group
 * codes, so `parseVerticesFromData` keeps only the LAST 10/20 → any polyline with
 * >1 vertex collapses to a single point and is dropped. This reads the ordered
 * `pairs` (ADR-507, same mechanism HATCH uses) so every vertex survives.
 *
 * Used by both LWPOLYLINE (raw entity pairs) and old-style POLYLINE (VERTEX blocks
 * pre-aggregated by DxfEntityParser.parsePolylineGroup). Callers must pass ONLY
 * vertex-bearing 10/20 pairs — e.g. the POLYLINE header's dummy elevation 10/20/30
 * is excluded upstream.
 *
 * DXF Format: 10 = vertex X, 20 = vertex Y, 42 = bulge (optional, per vertex).
 *
 * @param pairs - Ordered (code, value) pairs from the entity/vertex stream
 * @returns Array of parsed vertices (with bulge when non-zero)
 */
export function parseVerticesFromPairs(
  pairs: ReadonlyArray<readonly [string, string]> | undefined
): DxfPolyVertex[] {
  const vertices: DxfPolyVertex[] = [];
  if (!pairs) return vertices;

  let current: { x?: number; y?: number; bulge?: number } = {};

  const flush = (): void => {
    // 🏢 ADR: Use centralized isValidPoint
    if (isValidPoint(current)) {
      vertices.push({
        x: current.x,
        y: current.y,
        ...(current.bulge ? { bulge: current.bulge } : {})
      });
    }
  };

  for (const [code, value] of pairs) {
    if (code === '10') {
      // New vertex begins — commit the previous one first.
      flush();
      current = { x: parseFloat(value) };
    } else if (code === '20' && current.x !== undefined) {
      current.y = parseFloat(value);
    } else if (code === '42' && current.x !== undefined) {
      const bulge = parseFloat(value);
      if (!Number.isNaN(bulge) && bulge !== 0) current.bulge = bulge;
    }
  }

  flush();
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
 * 🏢 ENTERPRISE: INVERSE of `mapHorizontalAlignment` — alignment → DXF code 72.
 *
 * Canonical H-justification for DXF export (TEXT group code 72):
 * - 'left'   → 0 (default)
 * - 'center' → 1
 * - 'right'  → 2
 *
 * SSoT companion to the import mapper above so the export writer never invents a
 * second alignment table. Any non-left value pairs with an 11/21 alignment point
 * per the DXF TEXT spec (the writer handles that).
 *
 * @see mapHorizontalAlignment - forward (code → alignment)
 * @param alignment - Text alignment ('left' | 'center' | 'right')
 * @returns DXF horizontal justification code (0-2)
 */
export function alignmentToHJust(alignment: TextAlignment | undefined): 0 | 1 | 2 {
  switch (alignment) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
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
// 🏢 ENTERPRISE: COLOR EXTRACTION (DXF GROUP CODES 420 + 62)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Extract entity color from DXF data
 *
 * DXF Color System, resolved in AutoCAD precedence order:
 * - **Group Code 420** — 24-bit true color (`0x00RRGGBB`). When present it WINS over
 *   the ACI code 62 (AutoCAD rule: an explicit RGB always overrides the palette index).
 * - **Group Code 62** — ACI (AutoCAD Color Index):
 *   - 0 = ByBlock (inherits from containing block → undefined here, resolved by the block expander)
 *   - 1-255 = ACI palette color
 *   - 256 = ByLayer (inherits from layer color → undefined here, resolved from the layer)
 *
 * @see AutoCAD DXF Reference: Common Entity Properties
 * @see settings/standards/aci.ts - ACI color palette
 * @see dxf-true-color.ts - 24-bit RGB ↔ hex SSoT
 * @see isByBlockColor - companion BYBLOCK detector used by the block expander
 *
 * @param data - Raw DXF group codes
 * @returns Hex color string or undefined (for ByBlock/ByLayer/no color)
 */
export function extractEntityColor(data: Record<string, string>): string | undefined {
  // True-color (code 420) has priority over the ACI index (code 62) — AutoCAD rule.
  const trueColorRaw = data['420'];
  if (trueColorRaw !== undefined) {
    const rgb = parseInt(trueColorRaw, 10);
    if (Number.isFinite(rgb)) {
      return trueColorToHex(rgb);
    }
  }

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
    // ByBlock - return undefined, block expander resolves from the containing INSERT
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

/**
 * 🏢 ENTERPRISE: True when the entity's DXF color is **BYBLOCK** (code 62 === 0).
 *
 * BYBLOCK means "take the color of the containing INSERT" — semantically distinct from a
 * missing color (implicit BYLAYER) or ByLayer (256), both of which resolve from the layer.
 * `extractEntityColor` collapses all three to `undefined`, so the block expander uses this
 * companion to tell BYBLOCK apart and apply INSERT-color inheritance (mirrors the BYBLOCK
 * layer '0' rule). An explicit true-color (code 420) overrides BYBLOCK → returns false.
 *
 * @see extractEntityColor - color resolution this complements
 * @param data - Raw DXF group codes
 * @returns true only when color is explicitly BYBLOCK
 */
export function isByBlockColor(data: Record<string, string>): boolean {
  if (data['420'] !== undefined) return false; // explicit true-color overrides BYBLOCK
  return parseInt(data['62'] ?? '', 10) === 0;
}

// ADR-635 Φ C.3/C.4 — `extractEntityLineweight` / `extractEntityLinetype` /
// `extractEntityLtscale` moved to `dxf-entity-style-extract.ts` (file-size SRP split, N.7.1)
// and re-exported at the top so converters' import path stays unchanged.
