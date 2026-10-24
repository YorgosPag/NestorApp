/**
 * @fileoverview **DXF drawing → survey spot heights, without the DXF Viewer** (ADR-920 Β4.1β · ADR-650 M2).
 * @related ../../dxf/dxf-section-scan (structure) · ../../dxf/dxf-insunits (units) · dxf-viewer `topo-dxf-points` (delegates here)
 *
 * The viewer used to reach these points through `DxfEntityParser`, whose import graph is ~359 files of the subapp;
 * the owner's plot-listing form may not import the subapp (CHECK 3.62). This scanner walks the same group codes over
 * the same zero-import leaves the viewer's parser is built on — so there is ONE reading of the DXF structure, not two.
 *
 * ⚠️ WHY THE FILE AND NOT THE SCENE: the viewer's `PointEntity` is 2D — it has no Z. The elevation only exists in the
 * raw group codes:
 *
 *   POINT →  10 = X, 20 = Y, **30 = Z**            (a surveyed spot height)
 *   TEXT  →  10 = X, 20 = Y,   1 = "12.47"          (elevation written as a LABEL; its insertion Z is ignored)
 *
 * The DXF LAYER becomes the feature `code` (field-to-finish: the layer IS the feature), except the default layer `0`.
 *
 * 🔑 **TWO PHASES, ON PURPOSE**: {@link scanDxfSurvey} returns points in DRAWING units plus the `$INSUNITS` the file
 * declares; {@link scaleSurveyPoints} applies the scale. Deciding the scale is the CALLER's policy — the viewer keeps
 * its historic defaults, the owner's form asks the human when the file does not say (ADR-920 §13.2).
 */

import { collectDxfRecordPairs, findDxfSectionRange, type DxfCodePair } from '@/lib/dxf/dxf-section-scan';
import { isEmbeddedObjectCode } from '@/lib/dxf/dxf-embedded-object';
import { readDxfInsunits } from '@/lib/dxf/dxf-insunits';
import { splitDxfLines } from '@/lib/dxf/dxf-line-stream';
import { parseLocaleNumber } from '@/lib/number/locale-number';

import type { TopoPoint } from '../terrain-types';

/** Which DXF entities to harvest elevations from. */
export type DxfPointSource = 'point' | 'text' | 'both';

export interface DxfPointsResult {
  readonly points: readonly TopoPoint[];
  /** POINT entities found (before Z validation) — shown in the import preview. */
  readonly pointCount: number;
  /** TEXT entities whose label parsed as an elevation. */
  readonly textCount: number;
}

export interface DxfSurveyScan extends DxfPointsResult {
  /** The `$INSUNITS` code the HEADER declares; `null` = the file does not say. `0` = «unitless» (a value). */
  readonly declaredInsunits: number | null;
}

/**
 * A record's OWN tags, last value wins — the flat view `DxfEntityParser.parseEntity` builds. Reading stops at an
 * embedded object (group 101): what follows belongs to another namespace and would overwrite 10/20 (ADR-635).
 */
function ownTags(pairs: readonly DxfCodePair[]): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [code, value] of pairs) {
    if (isEmbeddedObjectCode(code)) break;
    tags.set(code, value);
  }
  return tags;
}

/**
 * A DXF REAL (group codes 10–39): always `.`-decimal, and writers such as ezdxf emit exponents (`1.5E+02`).
 * 🔴 ADR-920 §13.2 — `parseLocaleNumber` strips letters, so `1.5E+02` read as **1.502**: a wrong elevation, silently.
 * `Number` first; the locale reader stays only as the fallback for hand-edited files (`384512,345`).
 */
function dxfReal(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const exact = Number(value);
  return Number.isFinite(exact) ? exact : parseLocaleNumber(value);
}

/** Feature code from the entity layer — `0` (the default layer) or an empty layer means «no code». */
function codeFromLayer(layer: string | undefined): string | undefined {
  return layer && layer !== '0' ? layer : undefined;
}

/**
 * One entity → spot height in DRAWING units. X/Y always come from 10/20; only the elevation source differs:
 * POINT reads the surveyed Z (no 30 ⇒ a 2D point ⇒ skipped, never z = 0); TEXT reads its numeric LABEL.
 */
function spotHeightOf(tags: Map<string, string>, kind: 'POINT' | 'TEXT'): TopoPoint | null {
  const x = dxfReal(tags.get('10'));
  const y = dxfReal(tags.get('20'));
  const z = kind === 'POINT' ? dxfReal(tags.get('30')) : parseLocaleNumber(tags.get('1') ?? '');
  if (x === null || y === null || z === null) return null;

  const code = codeFromLayer(tags.get('8'));
  return { x, y, z, ...(code ? { code } : {}) };
}

/**
 * Scan raw DXF text for survey spot heights.
 *
 * Only the ENTITIES section is scanned — points inside BLOCK definitions are templates at block-local coordinates,
 * not surveyed ground (ADR-635 Φ2). A file without an ENTITIES section is scanned whole, like the viewer's parser.
 */
export function scanDxfSurvey(text: string, source: DxfPointSource = 'both'): DxfSurveyScan {
  const lines = splitDxfLines(text);
  const range = findDxfSectionRange(lines, 'ENTITIES') ?? { start: 0, end: lines.length };

  const points: TopoPoint[] = [];
  let pointCount = 0;
  let textCount = 0;

  for (let i = range.start; i < range.end; ) {
    const kind = lines[i]?.trim() === '0' ? lines[i + 1]?.trim() : undefined;
    const wanted = (kind === 'POINT' && source !== 'text') || (kind === 'TEXT' && source !== 'point');
    if (!wanted) { i += 2; continue; }

    const { pairs, next } = collectDxfRecordPairs(lines, i + 2, range.end);
    const spot = spotHeightOf(ownTags(pairs), kind === 'POINT' ? 'POINT' : 'TEXT');
    if (kind === 'POINT') pointCount++;
    else if (spot) textCount++; // a TEXT whose label is not a number is ordinary annotation
    if (spot) points.push(spot);
    i = next;
  }

  return { points, pointCount, textCount, declaredInsunits: readDxfInsunits(lines) };
}

/** Drawing units → canonical WORLD mm (ADR-462). The ONE place the scan's points are scaled. */
export function scaleSurveyPoints(points: readonly TopoPoint[], scaleToMm: number): TopoPoint[] {
  return points.map((p) => ({ ...p, x: p.x * scaleToMm, y: p.y * scaleToMm, ...(p.z !== undefined ? { z: p.z * scaleToMm } : {}) }));
}
