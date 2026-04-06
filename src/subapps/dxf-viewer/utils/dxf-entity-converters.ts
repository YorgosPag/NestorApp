/**
 * 🏢 ENTERPRISE: DXF Entity Converters
 *
 * Centralized converters for DXF entities to scene entities.
 * Uses helpers from dxf-converter-helpers.ts.
 *
 * Split into 2 files for SRP compliance (ADR-065 Phase 4):
 * - dxf-dimension-converter.ts — DIMENSION entity converter (complex, DIMSTYLE-aware)
 * - dxf-entity-converters.ts   — All other converters + master router (this file)
 *
 * Supports:
 * - LINE, LWPOLYLINE (geometry)
 * - CIRCLE, ARC, ELLIPSE (curves)
 * - TEXT, MTEXT (annotations)
 * - SPLINE (complex)
 * - DIMENSION (via dxf-dimension-converter.ts)
 *
 * @see dxf-converter-helpers.ts - Types and helper functions
 * @see dxf-dimension-converter.ts - DIMENSION converter
 * @see dxf-entity-parser.ts - Parsing orchestrator
 */

import type { AnySceneEntity } from '../types/scene';
import type { DxfHeaderData, DimStyleMap } from './dxf-entity-parser';
import { vectorMagnitude } from '../rendering/entities/shared/geometry-rendering-utils';

import {
  type EntityData,
  parseVerticesFromData,
  decodeGreekText,
  mapHorizontalAlignment,
  mapMTextAlignment,
  extractEntityColor
} from './dxf-converter-helpers';

import { dwarn } from '../debug';

// Re-export types for backward compatibility
export type { EntityData, TextAlignment, EntityConverter } from './dxf-converter-helpers';
// Re-export dimension converter for backward compatibility
export { convertDimension } from './dxf-dimension-converter';

import { convertDimension } from './dxf-dimension-converter';

// ============================================================================
// 🏢 ENTERPRISE: GEOMETRY CONVERTERS
// ============================================================================

/**
 * Convert LINE entity
 * DXF Codes: 10,20 = Start point; 11,21 = End point
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
    dwarn('EntityConverter', `⚠️ Skipping LINE ${index}: missing coordinates`, {
      x1, y1, x2, y2, available: Object.keys(data)
    });
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `line_${index}`,
    type: 'line',
    layer,
    visible: true,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    ...(color && { color })
  };
}

/**
 * Convert LWPOLYLINE entity
 * DXF Codes: 10,20 = Vertex points (repeated); 70 = Closed flag
 */
export function convertLwPolyline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const isClosed = data['70'] === '1';
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping LWPOLYLINE ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `polyline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: isClosed,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: CURVE CONVERTERS
// ============================================================================

/**
 * Convert CIRCLE entity
 * DXF Codes: 10,20 = Center; 40 = Radius
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
    dwarn('EntityConverter', `⚠️ Skipping CIRCLE ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `circle_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius,
    ...(color && { color })
  };
}

/**
 * Convert ARC entity
 * DXF Codes: 10,20 = Center; 40 = Radius; 50 = Start angle; 51 = End angle
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
    dwarn('EntityConverter', `⚠️ Skipping ARC ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `arc_${index}`,
    type: 'arc',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius,
    startAngle,
    endAngle,
    ...(color && { color })
  };
}

/**
 * Convert ELLIPSE entity to circle approximation
 * DXF Codes: 10,20 = Center; 11,21 = Major axis endpoint; 40 = Minor/major ratio
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
    dwarn('EntityConverter', `⚠️ Skipping ELLIPSE ${index}: invalid center`, { centerX, centerY });
    return null;
  }

  const majorRadius = vectorMagnitude({ x: majorAxisX, y: majorAxisY });
  const minorRadius = majorRadius * ratio;
  const approxRadius = (majorRadius + minorRadius) / 2;

  if (approxRadius <= 0) {
    dwarn('EntityConverter', `⚠️ Skipping ELLIPSE ${index}: invalid radius`, { approxRadius });
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `ellipse_${index}`,
    type: 'circle',
    layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius: approxRadius,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: TEXT CONVERTERS
// ============================================================================

/**
 * Convert TEXT entity with full CAD property extraction
 * DXF Codes: 10,20 = Position; 1 = Content; 40 = Height; 50 = Rotation; 72 = H-justification
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
  const horizontalJustification = parseInt(data['72']) || 0;
  const alignment = mapHorizontalAlignment(horizontalJustification);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping TEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  text = decodeGreekText(text);
  const color = extractEntityColor(data);

  return {
    id: `text_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    height,
    rotation,
    alignment,
    ...(color && { color })
  };
}

/**
 * Convert MTEXT/MULTILINETEXT entity
 * DXF Codes: 10,20 = Position; 1/3 = Content; 40 = Height; 50 = Rotation; 71 = Attachment
 */
export function convertMText(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);
  let text = data['1'] || data['3'] || '';
  const height = parseFloat(data['40']) || 1;
  const rotation = parseFloat(data['50']) || 0;
  const attachmentPoint = parseInt(data['71']) || 1;
  const alignment = mapMTextAlignment(attachmentPoint);

  if (isNaN(x) || isNaN(y) || text.trim() === '') {
    dwarn('EntityConverter', `⚠️ Skipping MTEXT ${index}: missing position or text`, { x, y, text });
    return null;
  }

  text = decodeGreekText(text);
  const color = extractEntityColor(data);

  return {
    id: `mtext_${index}`,
    type: 'text',
    layer,
    visible: true,
    position: { x, y },
    text: text.trim(),
    fontSize: height,
    height,
    rotation,
    alignment,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: SPLINE CONVERTER
// ============================================================================

/**
 * Convert SPLINE entity to polyline approximation
 * DXF Codes: 10,20 = Control points (repeated)
 */
export function convertSpline(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const vertices = parseVerticesFromData(data);

  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping SPLINE ${index}: insufficient control points`, vertices.length);
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `spline_${index}`,
    type: 'polyline',
    layer,
    visible: true,
    vertices,
    closed: false,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: MASTER CONVERTER
// ============================================================================

/**
 * Master converter function — routes entity types to appropriate converters.
 *
 * @param entityData - Parsed entity data from DxfEntityParser
 * @param index - Entity index for unique ID generation
 * @param header - Optional DXF header data for DIMSCALE normalization
 * @param dimStyles - Optional parsed DIMSTYLE map with real DIMTXT values
 */
export function convertEntityToScene(
  entityData: EntityData,
  index: number,
  header?: DxfHeaderData,
  dimStyles?: DimStyleMap
): AnySceneEntity | AnySceneEntity[] | null {
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
      return convertDimension(data, layer, index, header, dimStyles);
    default:
      return null;
  }
}
