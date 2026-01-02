/**
 * 🏢 ENTERPRISE: DXF Entity Converters
 *
 * Centralized converters for DXF entities to scene entities.
 * Extracted from dxf-entity-parser.ts for Single Responsibility Principle.
 *
 * Supports:
 * - LINE, LWPOLYLINE (geometry)
 * - CIRCLE, ARC, ELLIPSE (curves)
 * - TEXT, MTEXT (annotations)
 * - SPLINE, DIMENSION (complex)
 *
 * @see dxf-entity-parser.ts - Parsing orchestrator
 * @see AutoCAD DXF Reference for entity codes
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';

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
// 🏢 ENTERPRISE: HELPER FUNCTIONS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Parse vertices from DXF data codes
 *
 * Extracts Point2D array from DXF group codes 10/20.
 * Used by LWPOLYLINE, SPLINE converters.
 *
 * @param data - Raw DXF group codes
 * @returns Array of parsed vertices
 */
export function parseVerticesFromData(data: Record<string, string>): Point2D[] {
  const vertices: Point2D[] = [];
  let currentVertex: { x?: number; y?: number } = {};

  Object.keys(data).forEach(code => {
    if (code === '10') {
      // Add previous vertex if complete
      if (currentVertex.x !== undefined && currentVertex.y !== undefined) {
        vertices.push({ x: currentVertex.x, y: currentVertex.y });
      }
      // Start new vertex
      currentVertex = { x: parseFloat(data[code]) };
    } else if (code === '20' && currentVertex.x !== undefined) {
      currentVertex.y = parseFloat(data[code]);
    }
  });

  // Add final vertex
  if (currentVertex.x !== undefined && currentVertex.y !== undefined) {
    vertices.push({ x: currentVertex.x, y: currentVertex.y });
  }

  return vertices;
}

/**
 * 🏢 ENTERPRISE: Decode Greek text from DXF encoding
 *
 * Handles Windows-1253 and Unicode escape sequences.
 * Used by TEXT, MTEXT converters.
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

    // Handle common Windows-1253 to UTF-8 conversion issues
    const greekMappings: Readonly<Record<string, string>> = {
      'Ά': 'Ά', 'Έ': 'Έ', 'Ή': 'Ή', 'Ί': 'Ί', 'Ό': 'Ό', 'Ύ': 'Ύ', 'Ώ': 'Ώ',
      'ά': 'ά', 'έ': 'έ', 'ή': 'ή', 'ί': 'ί', 'ό': 'ό', 'ύ': 'ύ', 'ώ': 'ώ',
      'Α': 'Α', 'Β': 'Β', 'Γ': 'Γ', 'Δ': 'Δ', 'Ε': 'Ε', 'Ζ': 'Ζ', 'Η': 'Η',
      'Θ': 'Θ', 'Ι': 'Ι', 'Κ': 'Κ', 'Λ': 'Λ', 'Μ': 'Μ', 'Ν': 'Ν', 'Ξ': 'Ξ',
      'Ο': 'Ο', 'Π': 'Π', 'Ρ': 'Ρ', 'Σ': 'Σ', 'Τ': 'Τ', 'Υ': 'Υ', 'Φ': 'Φ',
      'Χ': 'Χ', 'Ψ': 'Ψ', 'Ω': 'Ω',
      'α': 'α', 'β': 'β', 'γ': 'γ', 'δ': 'δ', 'ε': 'ε', 'ζ': 'ζ', 'η': 'η',
      'θ': 'θ', 'ι': 'ι', 'κ': 'κ', 'λ': 'λ', 'μ': 'μ', 'ν': 'ν', 'ξ': 'ξ',
      'ο': 'ο', 'π': 'π', 'ρ': 'ρ', 'σ': 'σ', 'τ': 'τ', 'υ': 'υ', 'φ': 'φ',
      'χ': 'χ', 'ψ': 'ψ', 'ω': 'ω', 'ς': 'ς'
    };

    // Apply Greek mappings if needed
    for (const [encoded, greek] of Object.entries(greekMappings)) {
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
 * DXF Code 72 values:
 * - 0 = Left (default)
 * - 1 = Center
 * - 2 = Right
 * - 3 = Aligned (treated as Left)
 * - 4 = Middle (treated as Center)
 * - 5 = Fit (treated as Left)
 *
 * @see AutoCAD DXF Reference: TEXT Entity
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
 * DXF Code 71 values (3x3 grid):
 * - 1, 4, 7 = Left
 * - 2, 5, 8 = Center
 * - 3, 6, 9 = Right
 *
 * @see AutoCAD DXF Reference: MTEXT Entity
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
// 🏢 ENTERPRISE: GEOMETRY CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert LINE entity
 *
 * DXF Codes:
 * - 10, 20: Start point (X, Y)
 * - 11, 21: End point (X, Y)
 */
export function convertLine(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x1 = parseFloat(data['10']);
  const y1 = parseFloat(data['20']);
  const x2 = parseFloat(data['11']);
  const y2 = parseFloat(data['21']);

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
    console.warn(`⚠️ Skipping LINE ${index}: missing coordinates`, {
      x1, y1, x2, y2, available: Object.keys(data)
    });
    return null;
  }

  return {
    id: `line_${index}`,
    type: 'line',
    layer,
    visible: true,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 }
  };
}

/**
 * 🏢 ENTERPRISE: Convert LWPOLYLINE entity
 *
 * DXF Codes:
 * - 10, 20: Vertex points (repeated)
 * - 70: Polyline flag (1 = closed)
 */
export function convertLwPolyline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const isClosed = data['70'] === '1';
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    console.warn(`⚠️ Skipping LWPOLYLINE ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  return {
    id: `polyline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: isClosed
  };
}

// ============================================================================
// 🏢 ENTERPRISE: CURVE CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert CIRCLE entity
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 40: Radius
 */
export function convertCircle(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    console.warn(`⚠️ Skipping CIRCLE ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  return {
    id: `circle_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius
  };
}

/**
 * 🏢 ENTERPRISE: Convert ARC entity
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 40: Radius
 * - 50: Start angle (degrees)
 * - 51: End angle (degrees)
 */
export function convertArc(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);
  const startAngle = parseFloat(data['50']) || 0;
  const endAngle = parseFloat(data['51']) || 360;

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    console.warn(`⚠️ Skipping ARC ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  return {
    id: `arc_${index}`,
    type: 'arc',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius,
    startAngle,
    endAngle
  };
}

/**
 * 🏢 ENTERPRISE: Convert ELLIPSE entity to circle approximation
 *
 * DXF Codes:
 * - 10, 20: Center point (X, Y)
 * - 11, 21: Major axis endpoint relative to center
 * - 40: Ratio of minor to major axis
 */
export function convertEllipse(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const majorAxisX = parseFloat(data['11']) || 0;
  const majorAxisY = parseFloat(data['21']) || 0;
  const ratio = parseFloat(data['40']) || 1;

  if (isNaN(centerX) || isNaN(centerY)) {
    console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid center`, { centerX, centerY });
    return null;
  }

  // Calculate radius as average of major and minor axes
  const majorRadius = Math.sqrt(majorAxisX * majorAxisX + majorAxisY * majorAxisY);
  const minorRadius = majorRadius * ratio;
  const approxRadius = (majorRadius + minorRadius) / 2;

  if (approxRadius <= 0) {
    console.warn(`⚠️ Skipping ELLIPSE ${index}: invalid radius`, { approxRadius });
    return null;
  }

  return {
    id: `ellipse_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius: approxRadius
  };
}

// ============================================================================
// 🏢 ENTERPRISE: TEXT CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert TEXT entity with full CAD property extraction
 *
 * DXF Codes:
 * - 10, 20: Position (X, Y)
 * - 1: Text content
 * - 40: Text height (fontSize)
 * - 50: Rotation angle in degrees
 * - 72: Horizontal justification
 *
 * @see AutoCAD DXF Reference: TEXT Entity
 */
export function convertText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  let text = data['1'] || '';
  const height = parseFloat(data['40']) || 1;
  const rotation = parseFloat(data['50']) || 0;

  // Extract horizontal alignment (DXF code 72)
  const horizontalJustification = parseInt(data['72']) || 0;
  const alignment = mapHorizontalAlignment(horizontalJustification);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    console.warn(`⚠️ Skipping TEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  // Decode Greek text
  text = decodeGreekText(text);

  return {
    id: `text_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    rotation,
    alignment
  };
}

/**
 * 🏢 ENTERPRISE: Convert MTEXT/MULTILINETEXT entity
 *
 * DXF Codes:
 * - 10, 20: Insertion point (X, Y)
 * - 1 or 3: Text content
 * - 40: Text height (fontSize)
 * - 50: Rotation angle in degrees
 * - 71: Attachment point (determines alignment)
 *
 * @see AutoCAD DXF Reference: MTEXT Entity
 */
export function convertMText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  let text = data['1'] || data['3'] || ''; // MTEXT can use code 1 or 3
  const height = parseFloat(data['40']) || 1;
  const rotation = parseFloat(data['50']) || 0;

  // Extract attachment point (DXF code 71) for alignment
  const attachmentPoint = parseInt(data['71']) || 1;
  const alignment = mapMTextAlignment(attachmentPoint);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    console.warn(`⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  // Decode Greek text
  text = decodeGreekText(text);

  return {
    id: `mtext_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    rotation,
    alignment
  };
}

// ============================================================================
// 🏢 ENTERPRISE: COMPLEX ENTITY CONVERTERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Convert SPLINE entity to polyline approximation
 *
 * DXF Codes:
 * - 10, 20: Control points (repeated)
 */
export function convertSpline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    console.warn(`⚠️ Skipping SPLINE ${index}: insufficient control points`, vertices.length);
    return null;
  }

  return {
    id: `spline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: false
  };
}

/**
 * 🏢 ENTERPRISE: Convert DIMENSION entity to polyline
 *
 * DXF Codes:
 * - 13, 23: First definition point
 * - 14, 24: Second definition point
 * - 15, 25: Third definition point (dimension line)
 * - Fallback to 10, 20, 11, 21 if above not present
 */
export function convertDimension(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x1 = parseFloat(data['13']) || parseFloat(data['10']);
  const y1 = parseFloat(data['23']) || parseFloat(data['20']);
  const x2 = parseFloat(data['14']) || parseFloat(data['11']);
  const y2 = parseFloat(data['24']) || parseFloat(data['21']);
  const x3 = parseFloat(data['15']);
  const y3 = parseFloat(data['25']);

  if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
    const vertices: Point2D[] = [
      { x: x1, y: y1 },
      { x: x2, y: y2 }
    ];

    // Add third point if available
    if (!isNaN(x3) && !isNaN(y3)) {
      vertices.push({ x: x3, y: y3 });
    }

    return {
      id: `dimension_${index}`,
      type: 'polyline',
      layer,
      visible: true,
      vertices,
      closed: false
    };
  }

  console.warn(`⚠️ Skipping DIMENSION ${index}: insufficient coordinate data`);
  return null;
}

// ============================================================================
// 🏢 ENTERPRISE: CONVERTER REGISTRY
// ============================================================================

/**
 * 🏢 ENTERPRISE: Master converter function
 *
 * Routes entity types to appropriate converter functions.
 * Single point of entry for all entity conversions.
 *
 * @param entityData - Parsed entity data from DxfEntityParser
 * @param index - Entity index for unique ID generation
 * @returns Converted scene entity or null
 */
export function convertEntityToScene(
  entityData: EntityData,
  index: number
): AnySceneEntity | null {
  const { type, layer, data } = entityData;

  switch (type) {
    case 'LINE':
      return convertLine(data, layer, index);
    case 'LWPOLYLINE':
      return convertLwPolyline(data, layer, index);
    case 'CIRCLE':
      return convertCircle(data, layer, index);
    case 'ARC':
      return convertArc(data, layer, index);
    case 'ELLIPSE':
      return convertEllipse(data, layer, index);
    case 'TEXT':
      return convertText(data, layer, index);
    case 'MTEXT':
    case 'MULTILINETEXT':
      return convertMText(data, layer, index);
    case 'SPLINE':
      return convertSpline(data, layer, index);
    case 'DIMENSION':
      return convertDimension(data, layer, index);
    default:
      return null;
  }
}
