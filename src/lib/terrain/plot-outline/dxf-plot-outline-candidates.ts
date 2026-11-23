/**
 * @fileoverview **A surveyor's DXF → the closed polylines that could be the plot outline** (ADR-920 §14.11 Π4 · Ζ1).
 * @related ../../dxf/dxf-polylines · ../../dxf/dxf-text-labels · ../../geometry/closed-polyline-ring · ./plot-outline-ranking
 *
 * 🔑 **TWO PHASES, like the survey points** (ADR-920 §13.2): {@link scanDxfPlotDrawing} reads the file in DRAWING units
 *    and reports the `$INSUNITS` it declares; {@link dxfPlotOutlineCandidates} applies the scale the CALLER decided (the
 *    SAME policy as the points — so outline and relief cannot disagree on units by construction, Π6).
 * 🔑 **Every closed polyline is a candidate; nothing is dropped silently.** One that cannot enclose a plot is returned
 *    as REJECTED with its reason (`self-intersecting` · `zero-area` · `too-many-corners`); open ones are counted.
 * 🔑 **Closure is drawn, never invented**: the CLOSED flag, or an open polyline whose last vertex returns exactly onto
 *    its first (a common way to draft a boundary). A gap of any size stays open.
 */

import { closedRingWithArcs, samePlanarPoint } from '@/lib/geometry/closed-polyline-ring';
import { isPolygonSelfIntersecting, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { scanDxfPolylines, type DxfPolyline, type DxfPolylineScan } from '@/lib/dxf/dxf-polylines';
import { scanDxfTextLabels, type DxfTextLabel } from '@/lib/dxf/dxf-text-labels';
import { normalizeGreekHomoglyphs } from '@/utils/greek-text';

import { plotAreaStatementsIn } from './plot-area-statement';
import { ringAreaM2 } from './plot-outline-area';
import { CORNER_LABEL_PATTERN, CORNER_LABEL_REACH_FRACTION, PLOT_OUTLINE_MAX_CORNERS } from './plot-outline-config';
import type {
  PlotOutlineCandidate,
  PlotOutlineCorner,
  PlotOutlineOrigin,
  PlotOutlineRejection,
  RejectedPlotOutline,
} from './plot-outline-types';


/** Phase 1 — the drawing as written (DRAWING units). */
export interface DxfPlotDrawing {
  readonly polylines: DxfPolylineScan;
  /** Texts that look like corner labels (Α, Β, Κ1 …), DRAWING units. */
  readonly cornerLabels: readonly DxfTextLabel[];
  /** Areas written on the drawing («Ε = … τ.μ.»), m² — unit-free already, the surveyor wrote square metres. */
  readonly areaStatementsM2: readonly number[];
  /** Formatted MTEXT the scan could not read — a label or an area statement may hide there (see `dxf-text-labels`). */
  readonly formattedMtextSkipped: number;
  readonly declaredInsunits: number | null;
}

/** Phase 2 — the candidates, WORLD mm. */
export interface DxfPlotOutlineCandidates {
  readonly candidates: readonly PlotOutlineCandidate[];
  readonly rejected: readonly RejectedPlotOutline[];
  readonly openPolylines: number;
}

/** The comparable form of a label: homoglyphs folded, trimmed, upper case. */
export function cornerLabelKey(text: string): string {
  return normalizeGreekHomoglyphs(text).trim().toUpperCase();
}

/** Phase 1: read polylines, corner-like labels and written areas. Never throws. */
export function scanDxfPlotDrawing(text: string): DxfPlotDrawing {
  const polylines = scanDxfPolylines(text);
  const texts = scanDxfTextLabels(text);
  return {
    polylines,
    cornerLabels: texts.labels.filter((label) => CORNER_LABEL_PATTERN.test(cornerLabelKey(label.text))),
    areaStatementsM2: [...new Set(texts.labels.flatMap((label) => plotAreaStatementsIn(label.text)))],
    formattedMtextSkipped: texts.formattedMtextSkipped,
    declaredInsunits: polylines.declaredInsunits,
  };
}

interface ClosedOutline {
  readonly vertices: readonly PlanarPoint[];
  readonly bulges: readonly number[];
  readonly closure: 'flag' | 'coincident-ends';
}

/** The polyline as a closed outline, its repeated closing vertex removed — or `null` when it is open. */
function closedOutlineOf(polyline: DxfPolyline): ClosedOutline | null {
  const { vertices, bulges } = polyline;
  const n = vertices.length;
  const endsMeet = n >= 2 && samePlanarPoint(vertices[0], vertices[n - 1]);
  if (!polyline.closed && !(endsMeet && n >= 4)) return null;
  const closure = polyline.closed ? 'flag' : 'coincident-ends';
  return endsMeet
    ? { vertices: vertices.slice(0, n - 1), bulges: bulges.slice(0, n - 1), closure }
    : { vertices, bulges, closure };
}

const scalePoint = (p: PlanarPoint, scale: number): PlanarPoint => ({ x: p.x * scale, y: p.y * scale });

function idOf(polyline: DxfPolyline, index: number): string {
  return polyline.handle ? `dxf:${polyline.handle}` : `dxf#${index}`;
}

/** The nearest corner-like label within reach of each corner (reach relative to the corner's shorter edge). */
function labelCorners(corners: readonly PlanarPoint[], labels: readonly DxfTextLabel[], scale: number): PlotOutlineCorner[] {
  const placed = labels.map((label) => ({ text: label.text.trim(), at: scalePoint(label.at, scale) }));
  return corners.map((at, i) => {
    const prev = corners[(i - 1 + corners.length) % corners.length];
    const next = corners[(i + 1) % corners.length];
    const reach = CORNER_LABEL_REACH_FRACTION * Math.min(Math.hypot(at.x - prev.x, at.y - prev.y), Math.hypot(at.x - next.x, at.y - next.y));
    let best: { text: string; d: number } | null = null;
    for (const label of placed) {
      const d = Math.hypot(label.at.x - at.x, label.at.y - at.y);
      if (d <= reach && (best === null || d < best.d)) best = { text: label.text, d };
    }
    return { at, label: best?.text ?? null };
  });
}

type Built = { readonly candidate: PlotOutlineCandidate } | { readonly rejection: PlotOutlineRejection };

function buildCandidate(id: string, origin: PlotOutlineOrigin, outline: ClosedOutline, drawing: DxfPlotDrawing, scale: number): Built {
  if (outline.vertices.length > PLOT_OUTLINE_MAX_CORNERS) return { rejection: 'too-many-corners' };
  const cornersWorld = outline.vertices.map((p) => scalePoint(p, scale));
  const ring = closedRingWithArcs(cornersWorld, outline.bulges);
  if (ring === null) return { rejection: 'zero-area' };
  // Self-intersection FIRST: a bow-tie's signed lobes cancel to area 0, and «zero area» would name the wrong fault.
  if (isPolygonSelfIntersecting(ring)) return { rejection: 'self-intersecting' };
  const areaM2 = ringAreaM2(ring);
  if (!(areaM2 > 0)) return { rejection: 'zero-area' };
  const corners = labelCorners(cornersWorld, drawing.cornerLabels, scale);
  return { candidate: { id, origin, ringWorldMm: ring, corners, areaM2 } };
}

/**
 * Phase 2: every closed polyline → a candidate (WORLD mm) or a named rejection.
 * @param scaleToMm drawing units → mm, decided by the caller from `declaredInsunits` (the survey points' policy).
 */
export function dxfPlotOutlineCandidates(drawing: DxfPlotDrawing, scaleToMm: number): DxfPlotOutlineCandidates {
  const candidates: PlotOutlineCandidate[] = [];
  const rejected: RejectedPlotOutline[] = [];
  let openPolylines = 0;
  drawing.polylines.polylines.forEach((polyline, index) => {
    const outline = closedOutlineOf(polyline);
    if (outline === null) { openPolylines++; return; }
    const id = idOf(polyline, index);
    const origin: PlotOutlineOrigin = { source: 'dxf', handle: polyline.handle, layer: polyline.layer, closure: outline.closure };
    const built = buildCandidate(id, origin, outline, drawing, scaleToMm);
    if ('candidate' in built) candidates.push(built.candidate);
    else rejected.push({ id, origin, reason: built.rejection });
  });
  return { candidates, rejected, openPolylines };
}
