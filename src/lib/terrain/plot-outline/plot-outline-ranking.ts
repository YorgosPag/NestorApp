/**
 * @fileoverview **Π4 — which candidate is the plot? A proposal WITH its evidence, never a silent pick.** (ADR-920 §14.11)
 * @related ./dxf-plot-outline-candidates · ./pdf-coordinate-table · ./plot-outline-coverage (Π6, reused as evidence)
 *
 * Revit asks the user to «Pick Lines» by hand on the linked CAD; we propose — and show WHY — then the owner confirms or
 * picks another. Each piece of evidence is a named fact with a verdict (`for` · `against` · `unknown`):
 *
 *   layer-name     — the polyline's layer names a boundary (`ΟΡΙΟ`, `ΟΙΚΟΠΕΔΟ`, `PARCEL` … one config).
 *   declared-area  — its area agrees with an area someone declared: the surveyor on the drawing («Ε = …») or the
 *                    listing. The closest declaration is the one compared, and its source is named.
 *   relief-overlap — the relief covers it (Π6 coverage). Zero overlap is evidence AGAINST.
 *   corner-labels  — its corners carry letters (Α, Β, Γ …) the way a surveyor letters a plot.
 *
 * 🔑 **A proposal needs a unique leader with evidence FOR it.** Standing = #for − #against. Equal standings at the top
 *    ⇒ NO proposal (`tie`); a leader with nothing for it ⇒ NO proposal (`no-evidence`). The order of the list breaks
 *    ties for DISPLAY only (larger first — the plot usually encloses what is drawn inside it), never for the proposal.
 */

import { normalizeForLabelMatch } from '@/utils/greek-text';

import type { TinSurface } from '../terrain-types';
import {
  CORNER_LABELS_EVIDENCE_FRACTION,
  PLOT_AREA_AGREES_FRACTION,
  PLOT_AREA_DISAGREES_FRACTION,
  PLOT_COVERAGE_EVIDENCE_FRACTION,
  PLOT_OUTLINE_LAYER_STEMS,
} from './plot-outline-config';
import { plotOutlineCoverage } from './plot-outline-coverage';
import type {
  PlotOutlineCandidate,
  PlotOutlineEvidence,
  PlotOutlineRanking,
  PlotOutlineVerdict,
  RankedPlotOutline,
} from './plot-outline-types';

export interface PlotOutlineRankingInput {
  readonly candidates: readonly PlotOutlineCandidate[];
  /** The plot area the listing declares, m² (`null` / absent = not declared). */
  readonly listingAreaM2?: number | null;
  /** Areas written on the drawing itself, m² (`plotAreaStatementsIn`). */
  readonly drawingAreasM2?: readonly number[];
  /** The relief the outline will be drawn on, WORLD mm (`null` / absent = none yet). */
  readonly relief?: TinSurface | null;
}

const NORMALIZED_STEMS = PLOT_OUTLINE_LAYER_STEMS.map((stem) => ({ stem, key: normalizeForLabelMatch(stem) }));

function layerEvidence(candidate: PlotOutlineCandidate): PlotOutlineEvidence | null {
  if (candidate.origin.source !== 'dxf') return null; // a PDF table has no layer — the evidence does not apply
  const layer = candidate.origin.layer;
  const key = normalizeForLabelMatch(layer);
  const hit = NORMALIZED_STEMS.find((entry) => key.includes(entry.key));
  return { kind: 'layer-name', verdict: hit ? 'for' : 'unknown', layer, stem: hit?.stem ?? null };
}

function areaVerdict(relativeDifference: number): PlotOutlineVerdict {
  if (relativeDifference <= PLOT_AREA_AGREES_FRACTION) return 'for';
  return relativeDifference > PLOT_AREA_DISAGREES_FRACTION ? 'against' : 'unknown';
}

function areaEvidence(candidate: PlotOutlineCandidate, input: PlotOutlineRankingInput): PlotOutlineEvidence {
  const declared = [
    ...(input.drawingAreasM2 ?? []).map((m2) => ({ m2, by: 'drawing' as const })),
    ...(input.listingAreaM2 && input.listingAreaM2 > 0 ? [{ m2: input.listingAreaM2, by: 'listing' as const }] : []),
  ];
  let best: { m2: number; by: 'drawing' | 'listing'; diff: number } | null = null;
  for (const d of declared) {
    const diff = Math.abs(candidate.areaM2 - d.m2) / d.m2;
    if (best === null || diff < best.diff) best = { ...d, diff };
  }
  if (best === null) {
    return { kind: 'declared-area', verdict: 'unknown', declaredM2: null, declaredBy: null, relativeDifference: null };
  }
  return { kind: 'declared-area', verdict: areaVerdict(best.diff), declaredM2: best.m2, declaredBy: best.by, relativeDifference: best.diff };
}

function reliefEvidence(candidate: PlotOutlineCandidate, relief: TinSurface | null | undefined): PlotOutlineEvidence {
  if (!relief) return { kind: 'relief-overlap', verdict: 'unknown', coveredFraction: null };
  const { coveredFraction } = plotOutlineCoverage(relief, candidate.ringWorldMm);
  const verdict: PlotOutlineVerdict = coveredFraction <= 0 ? 'against' : coveredFraction >= PLOT_COVERAGE_EVIDENCE_FRACTION ? 'for' : 'unknown';
  return { kind: 'relief-overlap', verdict, coveredFraction };
}

function cornerEvidence(candidate: PlotOutlineCandidate): PlotOutlineEvidence {
  const corners = candidate.corners.length;
  const labelledCorners = candidate.corners.filter((corner) => corner.label !== null).length;
  const verdict: PlotOutlineVerdict = corners > 0 && labelledCorners / corners >= CORNER_LABELS_EVIDENCE_FRACTION ? 'for' : 'unknown';
  return { kind: 'corner-labels', verdict, labelledCorners, corners };
}

function standingOf(evidence: readonly PlotOutlineEvidence[]): number {
  return evidence.reduce((sum, e) => sum + (e.verdict === 'for' ? 1 : e.verdict === 'against' ? -1 : 0), 0);
}

function rankOne(candidate: PlotOutlineCandidate, input: PlotOutlineRankingInput): RankedPlotOutline {
  const layer = layerEvidence(candidate);
  const evidence = [
    ...(layer ? [layer] : []),
    areaEvidence(candidate, input),
    reliefEvidence(candidate, input.relief),
    cornerEvidence(candidate),
  ];
  return { candidate, evidence, standing: standingOf(evidence) };
}

function displayOrder(a: RankedPlotOutline, b: RankedPlotOutline): number {
  return b.standing - a.standing || b.candidate.areaM2 - a.candidate.areaM2 || a.candidate.id.localeCompare(b.candidate.id);
}

/** Rank the candidates and propose one only when the evidence singles it out (see the file header). */
export function rankPlotOutlines(input: PlotOutlineRankingInput): PlotOutlineRanking {
  const ranked = input.candidates.map((candidate) => rankOne(candidate, input)).sort(displayOrder);
  const [first, second] = ranked;
  if (first === undefined) return { ranked, proposedId: null, noProposalReason: 'no-candidates' };
  if (second !== undefined && second.standing === first.standing) return { ranked, proposedId: null, noProposalReason: 'tie' };
  if (!first.evidence.some((e) => e.verdict === 'for')) return { ranked, proposedId: null, noProposalReason: 'no-evidence' };
  return { ranked, proposedId: first.candidate.id, noProposalReason: null };
}
