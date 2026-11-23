/**
 * @fileoverview **The surveyor's drawing, read the SAME way by the device and by the door** (ADR-920 §14.11 Ζ4 · Π4 · Π5 · Π10).
 * @related server/listing-terrain/plot-drawing-upload.server (the door — calls `plotDrawingKindOf` and `dxfDrawingScaleToMm`) ·
 *   hooks/listings/usePlotDrawingImport (the device — I/O around this core) · ./dxf-plot-outline-candidates ·
 *   ./pdf-coordinate-table · ./plot-outline-ranking
 * @module lib/terrain/plot-outline/plot-drawing-read
 *
 * 🔴 **ONE reading, two places.** The browser shows candidates; the door re-reads the bytes and keeps ITS ring. If the two read
 *    differently (another kind rule, another unit rule, more PDF pages) the owner would confirm a candidate the door then
 *    refuses. So the decisions live here once: kind from the BYTES, unit from the file or the human (never a guess), pages
 *    up to `PLOT_DRAWING_MAX_PDF_PAGES`.
 * 🔑 **Relief evidence is the door's** (Π6): the device ranks with `relief: null` — the overlap evidence reads «unknown» until
 *    the `PUT`, where the server judges it on the relief it actually holds (`DISJOINT` · `partial` with its fraction).
 *
 * Pure: no I/O, importable by the browser.
 */

import type { TopographicDrawingKind } from '@/lib/listings/topographic-drawing-file-record';

import { surveyFileKindOf, SURVEY_FILE_SNIFF_BYTES } from '../survey-import/survey-file-kind';
import { declaredDxfScaleToMm } from '../survey-import/survey-points';
import { TOPO_UNIT_SCALE_TO_MM, type TopoUnit } from '../survey-import/topo-import-types';
import {
  dxfPlotOutlineCandidates,
  type DxfPlotDrawing,
  type DxfPlotOutlineCandidates,
} from './dxf-plot-outline-candidates';
import type { PdfPlotOutlineReading } from './pdf-coordinate-table';
import { PLOT_DRAWING_MAX_BYTES } from './plot-outline-config';
import { rankPlotOutlines } from './plot-outline-ranking';
import type { PlotOutlineRanking } from './plot-outline-types';

/**
 * The file dialog's `accept`: the two kinds the door reads, AND `.dwg` — offered so a DWG reaches the reader and gets its
 * named refusal («save as DXF»), instead of being greyed out with no reason (same choice as `.xls` for the points, Ζ1).
 */
export const PLOT_DRAWING_ACCEPT = '.dxf,.pdf,.dwg';

/** A file that is not a drawing the door accepts — each with its own message (never a silent grey). */
export type PlotDrawingRefusal = 'dwg' | 'unsupported' | 'empty' | 'too-large';

export type PlotDrawingKindVerdict =
  | { readonly ok: true; readonly kind: TopographicDrawingKind }
  | { readonly ok: false; readonly refusal: PlotDrawingRefusal };

/**
 * **Which drawing is this?** — from the first BYTES, never the name or `File.type` (a DXF renamed `.txt` is a DXF; a CSV whose
 * first cell is «AC1012» is a CSV). The ceiling is the one of ITS kind. DWG ⇒ its own refusal («save as DXF», Π10 until Ζ6).
 */
export function plotDrawingKindOf(fileName: string, bytes: Uint8Array): PlotDrawingKindVerdict {
  if (bytes.byteLength === 0) return { ok: false, refusal: 'empty' };
  const kind = surveyFileKindOf(fileName, bytes.subarray(0, SURVEY_FILE_SNIFF_BYTES));
  if (kind === 'dwg') return { ok: false, refusal: 'dwg' };
  if (kind !== 'dxf' && kind !== 'pdf') return { ok: false, refusal: 'unsupported' };
  if (bytes.byteLength > PLOT_DRAWING_MAX_BYTES[kind]) return { ok: false, refusal: 'too-large' };
  return { ok: true, kind };
}

/**
 * **DRAWING units → WORLD mm** for a DXF: the file's `$INSUNITS` when it declares a length unit, otherwise the unit the
 * human confirmed — `null` = ask (never a guess: a plot in feet read as metres is 3.28× too large and still «closes»).
 */
export function dxfDrawingScaleToMm(declaredInsunits: number | null, humanUnit: TopoUnit | null): number | null {
  return declaredDxfScaleToMm(declaredInsunits) ?? (humanUnit === null ? null : TOPO_UNIT_SCALE_TO_MM[humanUnit]);
}

/** Does the DXF say its own unit? (If yes, the human is not asked and the door is not told.) */
export function dxfDeclaresUnit(drawing: DxfPlotDrawing): boolean {
  return declaredDxfScaleToMm(drawing.declaredInsunits) !== null;
}

/** What the plot's listing says — feeds the «declared area» evidence (Π4). `null` = the listing declares none. */
export interface PlotDrawingContext {
  readonly listingAreaM2: number | null;
}

export interface RankedDxfDrawing {
  readonly found: DxfPlotOutlineCandidates;
  readonly ranking: PlotOutlineRanking;
}

/** DXF + scale → candidates (WORLD mm) and their ranking. */
export function rankedDxfDrawing(drawing: DxfPlotDrawing, scaleToMm: number, context: PlotDrawingContext): RankedDxfDrawing {
  const found = dxfPlotOutlineCandidates(drawing, scaleToMm);
  const ranking = rankPlotOutlines({
    candidates: found.candidates,
    listingAreaM2: context.listingAreaM2,
    drawingAreasM2: drawing.areaStatementsM2,
    relief: null,
  });
  return { found, ranking };
}

/** PDF reading → the ranking of its coordinate tables, or `null` when the PDF gives no table (Π5: shown, but no outline). */
export function rankedPdfReading(reading: PdfPlotOutlineReading, context: PlotDrawingContext): PlotOutlineRanking | null {
  if (reading.status !== 'tables') return null;
  return rankPlotOutlines({
    candidates: reading.tables.map((table) => table.candidate),
    listingAreaM2: context.listingAreaM2,
    drawingAreasM2: reading.areaStatementsM2,
    relief: null,
  });
}
