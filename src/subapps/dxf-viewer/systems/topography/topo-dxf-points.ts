/**
 * ADR-650 Milestone 2 — DXF drawing → survey points (Q9, second import road).
 *
 * ADR-920 Β4.1β — the scan lives in `@/lib/terrain/survey-import/dxf-survey-points` (shared with the owner's
 * plot-listing survey import, which may not import from the subapp — CHECK 3.62). This file keeps only the VIEWER's
 * unit policy, so every existing importer reads exactly what it read before. See the lib file for why the elevation
 * comes from the raw group codes and never from the 2D scene.
 */

import { INSUNITS_TO_MM } from '@/lib/dxf/dxf-insunits';
import {
  scaleSurveyPoints,
  scanDxfSurvey,
  type DxfPointSource,
  type DxfPointsResult,
} from '@/lib/terrain/survey-import/dxf-survey-points';

export type { DxfPointSource, DxfPointsResult } from '@/lib/terrain/survey-import/dxf-survey-points';

/** `DxfEntityParser.parseHeader` reads an absent / non-integer `$INSUNITS` as 4 (millimetres). */
const PARSER_DEFAULT_INSUNITS = 4;

/**
 * The viewer's historic unit policy, unchanged (pinned by the characterisation suite):
 *   • `$INSUNITS 0` (unitless, frequent in instrument exports) → METRES, so a site does not collapse into a 1 m square;
 *   • an absent header → the parser default (millimetres);
 *   • otherwise the declared unit.
 * The owner's form does NOT inherit this: there an undeclared unit is a question for the human (ADR-920 §13.2).
 */
function viewerScaleToMm(declaredInsunits: number | null): number {
  const insunits = declaredInsunits ?? PARSER_DEFAULT_INSUNITS;
  return insunits ? INSUNITS_TO_MM[insunits] ?? 1 : 1000;
}

/**
 * Extract survey points from raw DXF text, in WORLD mm. Only the ENTITIES section is scanned — points inside BLOCK
 * definitions are templates, not surveyed ground (ADR-635 Φ2).
 */
export function extractTopoPointsFromDxf(
  text: string,
  source: DxfPointSource = 'both',
  unitScaleToMm?: number,
): DxfPointsResult {
  const scan = scanDxfSurvey(text, source);
  const scale = unitScaleToMm ?? viewerScaleToMm(scan.declaredInsunits);
  return { points: scaleSurveyPoints(scan.points, scale), pointCount: scan.pointCount, textCount: scan.textCount };
}
