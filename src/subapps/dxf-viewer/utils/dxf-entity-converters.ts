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
  parseVerticesFromPairs,
  extractEntityColor,
  extractEntityLineweight
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
    layerId: layer,
    visible: true,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    ...(color && { color })
  };
}

/**
 * Build the `type:'polyline'` scene entity shared by LWPOLYLINE and old-style POLYLINE.
 * Single source for the closed-flag bitmask (70 bit 1 — AutoCAD emits e.g. 129 = 128|1),
 * color extraction and the emitted shape, so both converters stay identical downstream.
 */
function buildPolylineSceneEntity(
  vertices: Array<{ x: number; y: number }>,
  data: Record<string, string>,
  layer: string,
  index: number,
  label: 'POLYLINE' | 'LWPOLYLINE'
): AnySceneEntity | null {
  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping ${label} ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  const isClosed = ((parseInt(data['70'] ?? '0', 10) || 0) & 1) === 1;
  const color = extractEntityColor(data);

  return {
    id: `polyline_${index}`,
    type: 'polyline',
    layerId: layer,
    visible: true,
    vertices,
    closed: isClosed,
    ...(color && { color })
  };
}

/**
 * Convert LWPOLYLINE entity
 * DXF Codes: 10,20 = Vertex points (repeated); 70 = flags (bit 1 = closed)
 *
 * Vertices are read from ordered `pairs` (ADR-507) when available, because the flat
 * `data` map overwrites repeated 10/20 and keeps only the last vertex. Falls back to
 * `parseVerticesFromData` for callers that pass no pairs.
 */
export function convertLwPolyline(
  data: Record<string, string>,
  layer: string,
  index: number,
  pairs?: ReadonlyArray<readonly [string, string]>
): AnySceneEntity | null {
  const vertices = pairs && pairs.length > 0
    ? parseVerticesFromPairs(pairs).map(v => ({ x: v.x, y: v.y }))
    : parseVerticesFromData(data);
  return buildPolylineSceneEntity(vertices, data, layer, index, 'LWPOLYLINE');
}

/**
 * Convert old-style POLYLINE entity (AutoCAD R12/AC1009: POLYLINE + N×VERTEX + SEQEND).
 *
 * Vertices are pre-aggregated by DxfEntityParser.parsePolylineGroup into ordered `pairs`
 * (10/20/42, header elevation excluded). Emits the SAME scene entity as LWPOLYLINE so all
 * downstream (bounds, unit scaling, renderer) treats both identically.
 *
 * Bulge (code 42) is preserved on the parsed vertices but rendered as straight segments
 * for now (Φ1a) — bulge→arc tessellation is a follow-up (Φ1b).
 */
export function convertPolyline(
  entityData: EntityData,
  index: number
): AnySceneEntity | null {
  const { data, layer, pairs } = entityData;
  const vertices = parseVerticesFromPairs(pairs).map(v => ({ x: v.x, y: v.y }));
  return buildPolylineSceneEntity(vertices, data, layer, index, 'POLYLINE');
}

// ============================================================================
// 🏢 ENTERPRISE: CURVE CONVERTERS
// ============================================================================

/**
 * Parse + validate the shared center (10/20) + radius (40) triple for CIRCLE/ARC.
 * Single SSoT for the parse & NaN/positive-radius guard (jscpd twin removal, ADR-583).
 * Returns `null` (and warns) when the parameters are invalid.
 */
function parseValidCenterRadius(
  data: Record<string, string>,
  entityLabel: string,
  index: number,
): { centerX: number; centerY: number; radius: number } | null {
  const centerX = parseFloat(data['10']);
  const centerY = parseFloat(data['20']);
  const radius = parseFloat(data['40']);

  if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
    dwarn('EntityConverter', `⚠️ Skipping ${entityLabel} ${index}: invalid parameters`, {
      centerX, centerY, radius
    });
    return null;
  }

  return { centerX, centerY, radius };
}

/**
 * Convert CIRCLE entity
 * DXF Codes: 10,20 = Center; 40 = Radius
 */
export function convertCircle(
  data: Record<string, string>,
  layer: string,
  index: number
): AnySceneEntity | null {
  const parsed = parseValidCenterRadius(data, 'CIRCLE', index);
  if (!parsed) return null;
  const { centerX, centerY, radius } = parsed;

  const color = extractEntityColor(data);

  return {
    id: `circle_${index}`,
    type: 'circle',
    layerId: layer,
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
  const parsed = parseValidCenterRadius(data, 'ARC', index);
  if (!parsed) return null;
  const { centerX, centerY, radius } = parsed;
  const startAngle = parseFloat(data['50']) || 0;
  const endAngle = parseFloat(data['51']) || 360;

  const color = extractEntityColor(data);

  return {
    id: `arc_${index}`,
    type: 'arc',
    layerId: layer,
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
    layerId: layer,
    visible: true,
    center: { x: centerX, y: centerY },
    radius: approxRadius,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: TEXT CONVERTERS (extracted → dxf-text-converters.ts, N.7.1 SRP)
// ============================================================================
// TEXT / MTEXT live in their own module (mirror dimension / hatch / xline-ray
// splits below); re-exported here for backward-compatible import paths.
export { convertText, convertMText, convertAttrib, convertAttdef } from './dxf-text-converters';

// Local binding for the master router below — a bare `export … from` re-exports but
// does NOT create a local name, so `convertEntityToScene` calling `convertText` threw
// `convertText is not defined` (empty import). Mirrors the hatch/xline-ray split pattern.
import { convertText, convertMText, convertAttrib, convertAttdef } from './dxf-text-converters';

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
    layerId: layer,
    visible: true,
    vertices,
    closed: false,
    ...(color && { color })
  };
}

// ============================================================================
// 🏢 ENTERPRISE: HATCH CONVERTER (ADR-507 Φ1a)
// ============================================================================
// Moved to dxf-hatch-converter.ts (Google SRP, N.7.1 500-line cap).
// Re-exported here so all existing importers keep working unchanged.
export { convertHatch } from './dxf-hatch-converter';

import { convertHatch } from './dxf-hatch-converter';

// ============================================================================
// 🏢 ENTERPRISE: AUXILIARY GEOMETRY CONVERTERS (ADR-359 Phase 8)
// ============================================================================
// XLINE/RAY converters moved to dxf-xline-ray-converter.ts (Google SRP).
export { convertXLine, convertRay } from './dxf-xline-ray-converter';

import { convertXLine, convertRay } from './dxf-xline-ray-converter';

// ============================================================================
// 🏢 ENTERPRISE: SOLID / 3DFACE / TRACE / POINT / MLINE CONVERTERS (ADR-635 Φάση B)
// ============================================================================
// Extracted σε δικά τους modules (Google SRP, N.7.1). SOLID/3DFACE/TRACE → HatchEntity
// (filled poché, HatchRenderer)· POINT → PointEntity· MLINE → reference polyline.
export { convertSolid, convert3dFace, convertTrace } from './dxf-quad-fill-converter';
export { convertPoint } from './dxf-point-converter';
export { convertMline } from './dxf-mline-converter';
// ADR-635 Φάση B Batch 2 Part B — LEADER (annotation callout: path + tip arrowhead).
export { convertLeader } from './dxf-leader-converter';

import { convertSolid, convert3dFace, convertTrace } from './dxf-quad-fill-converter';
import { convertPoint } from './dxf-point-converter';
import { convertMline } from './dxf-mline-converter';
import { convertLeader } from './dxf-leader-converter';

// ============================================================================
// 🏢 ENTERPRISE: MASTER CONVERTER
// ============================================================================

/**
 * Master converter function — routes entity types to appropriate converters, then
 * bakes the imported per-entity lineweight (DXF group 370) onto the result (ADR-635
 * Φ C.3). The `data['370']` read is centralized HERE so every converter (and every
 * block-expanded child, which also routes through this fn) inherits it uniformly —
 * one place, no copy-paste across ~10 converter modules (N.0.2).
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
  const result = routeEntityToConverter(entityData, index, header, dimStyles);
  return applyImportedLineweight(result, entityData.data);
}

/**
 * Bake a concrete per-entity lineweight (DXF group 370) onto the converted result.
 *
 * Absent/ByLayer/ByBlock/Default 370 ⇒ `extractEntityLineweight` returns undefined ⇒
 * the result is returned UNCHANGED (native/Tekton/bare paths carry no 370 → zero
 * regression). A concrete mm value is spread onto the entity (or each entity of an
 * array) as `lineweightMm`, the same field the render style cascade + LWDISPLAY gate
 * already consume (ADR-510 Φ2G). Lineweight is zoom-independent mm — never scaled.
 */
function applyImportedLineweight(
  result: AnySceneEntity | AnySceneEntity[] | null,
  data: Record<string, string>
): AnySceneEntity | AnySceneEntity[] | null {
  if (result === null) return null;
  const lineweightMm = extractEntityLineweight(data);
  if (lineweightMm === undefined) return result;
  return Array.isArray(result)
    ? result.map(entity => ({ ...entity, lineweightMm }))
    : { ...result, lineweightMm };
}

/**
 * Per-type converter dispatch (the raw routing switch). Kept separate from
 * `convertEntityToScene` so the public entry point can apply the shared lineweight
 * post-pass without threading it through every branch.
 */
function routeEntityToConverter(
  entityData: EntityData,
  index: number,
  header?: DxfHeaderData,
  dimStyles?: DimStyleMap
): AnySceneEntity | AnySceneEntity[] | null {
  const { type, layer, data } = entityData;

  switch (type) {
    case 'LINE':
      return convertLine(data, layer, index);
    case 'HATCH':
      // ADR-507 Φ1a — χρειάζεται ordered pairs (boundary loops με επαναλαμβανόμενα 10/20).
      return convertHatch(entityData.pairs ?? [], layer, index);
    case 'LWPOLYLINE':
      // ADR-507 pairs → survive repeated 10/20 that the flat `data` map overwrites.
      return convertLwPolyline(data, layer, index, entityData.pairs);
    case 'POLYLINE':
      // Old-style POLYLINE (R12): vertices pre-aggregated into pairs by parsePolylineGroup.
      return convertPolyline(entityData, index);
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
    // ADR-635 Φάση B Batch 2 — block attribute value (visible) + definition template.
    case 'ATTRIB':
      return convertAttrib(data, layer, index);
    case 'ATTDEF':
      return convertAttdef(data, layer, index);
    case 'SPLINE':
      return convertSpline(data, layer, index);
    case 'DIMENSION':
      return convertDimension(data, layer, index, header, dimStyles);
    case 'XLINE':
      return convertXLine(data, layer, index);
    case 'RAY':
      return convertRay(data, layer, index);
    // ADR-635 Φάση B — filled quads (bowtie-corrected → solid hatch), point, multiline.
    case 'POINT':
      return convertPoint(data, layer, index, header);
    case 'SOLID':
      return convertSolid(data, layer, index);
    case '3DFACE':
      return convert3dFace(data, layer, index);
    case 'TRACE':
      return convertTrace(data, layer, index);
    case 'MLINE':
      return convertMline(entityData.pairs ?? [], layer, index);
    // ADR-635 Φάση B Batch 2 Part B — annotation callout (ordered 10/20 vertices via pairs).
    case 'LEADER':
      return convertLeader(entityData, index);
    default:
      return null;
  }
}
