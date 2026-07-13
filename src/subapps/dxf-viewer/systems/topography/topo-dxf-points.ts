/**
 * ADR-650 Milestone 2 — DXF drawing → survey points (Q9, second import road).
 *
 * Reuses the DXF parser SSoT (`DxfEntityParser`) — no second DXF reader is written here.
 *
 * ⚠️ WHY WE PARSE THE FILE INSTEAD OF READING THE SCENE: the viewer's scene is 2D — its
 * `PointEntity` carries only `position: Point2D` and has **no Z at all**. Harvesting points
 * from already-imported entities would therefore silently produce a flat surface. The
 * elevation only exists in the raw DXF group codes, so that is where we read it from:
 *
 *   POINT →  10 = X, 20 = Y, **30 = Z**            (a surveyed spot height)
 *   TEXT  →  10 = X, 20 = Y,   1 = "12.47"          (elevation written as a LABEL)
 *
 * The TEXT road is the classic «drawing with spot heights but no 3D points» deliverable —
 * Civil 3D imports it the same way (elevation from text). Both roads yield WORLD mm points.
 *
 * The DXF LAYER of each entity becomes the feature `code` (field-to-finish convention: the
 * layer IS the feature — `EDGE`, `TREE`, `KERB`), except the default layer `0`.
 */

import { DxfEntityParser, type EntityData } from '../../utils/dxf-entity-parser';
import { parseLocaleNumber } from '@/lib/number/locale-number';
import type { TopoPoint } from './topo-types';

/** Which DXF entities to harvest elevations from. */
export type DxfPointSource = 'point' | 'text' | 'both';

export interface DxfPointsResult {
  readonly points: readonly TopoPoint[];
  /** POINT entities found (before Z validation) — shown in the wizard preview. */
  readonly pointCount: number;
  /** TEXT entities whose label parsed as an elevation. */
  readonly textCount: number;
}

/**
 * Survey DXFs are drawn in METRES. `$INSUNITS` is frequently 0 (unitless) in instrument
 * exports, so an unset/unitless header falls back to metres rather than to «1 mm per unit»,
 * which would collapse a whole site into a 1 m square.
 */
function resolveScaleToMm(lines: string[], override?: number): number {
  if (override !== undefined) return override;
  const insunits = DxfEntityParser.parseHeader(lines).insunits;
  return insunits ? DxfEntityParser.getUnitScale(insunits) : 1000;
}

/** Feature code from the entity layer — `0` (the default layer) means «no code». */
function codeFromLayer(layer: string): string | undefined {
  return layer && layer !== '0' ? layer : undefined;
}

/**
 * One entity → spot height. X/Y always come from groups 10/20; only the ELEVATION source
 * differs per entity kind, so it is a parameter rather than a second twin function:
 *
 *   `zCode = '30'` → POINT: the surveyed Z. A POINT without group 30 is 2D → skipped.
 *   `zCode = '1'`  → TEXT:  the LABEL is the measurement. The text's own insertion Z is a
 *                    drafting artefact (where the annotation sits) and is deliberately ignored.
 */
function pointFromEntity(e: EntityData, scale: number, zCode: '30' | '1'): TopoPoint | null {
  const x = parseLocaleNumber(e.data['10'] ?? '');
  const y = parseLocaleNumber(e.data['20'] ?? '');
  const z = parseLocaleNumber(e.data[zCode] ?? '');
  if (x === null || y === null || z === null) return null;

  const code = codeFromLayer(e.layer);
  return { x: x * scale, y: y * scale, z: z * scale, ...(code ? { code } : {}) };
}

/**
 * Extract survey points from raw DXF text.
 *
 * Only the ENTITIES section is scanned — points living inside BLOCK definitions are
 * templates, not surveyed ground, and would otherwise be harvested at their block-local
 * coordinates (ADR-635 Φ2, same reason the importer restricts its own entity sweep).
 */
export function extractTopoPointsFromDxf(
  text: string,
  source: DxfPointSource = 'both',
  unitScaleToMm?: number,
): DxfPointsResult {
  const lines = text.split(/\r?\n/);
  const scale = resolveScaleToMm(lines, unitScaleToMm);
  const range = DxfEntityParser.findSectionRange(lines, 'ENTITIES') ?? undefined;
  const entities = DxfEntityParser.parseEntities(lines, range);

  const points: TopoPoint[] = [];
  let pointCount = 0;
  let textCount = 0;

  for (const e of entities) {
    if (e.type === 'POINT' && source !== 'text') {
      pointCount++;
      const p = pointFromEntity(e, scale, '30');
      if (p) points.push(p);
    } else if (e.type === 'TEXT' && source !== 'point') {
      // A TEXT whose label is not a number is ordinary annotation, not a spot height.
      const p = pointFromEntity(e, scale, '1');
      if (p) {
        textCount++;
        points.push(p);
      }
    }
  }

  return { points, pointCount, textCount };
}
