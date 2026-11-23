/**
 * ADR-920 §14.11 Ζ1 — plot outline from a DXF: written areas, candidates, ranking (Π4).
 *
 *   Ε  «Ε = …» statements: Greek/Latin letter, Greek decimals, a unit is REQUIRED (the scale factor is no area)
 *   Υ  candidates: closed flag or coincident ends; open counted; self-intersecting / zero-area / too many corners
 *      rejected BY NAME; arcs kept; scale applied in phase 2 only
 *   Κ  ranking: named evidence; a unique leader with evidence FOR is proposed; a tie proposes nothing
 */

import { dxfPlotOutlineCandidates, scanDxfPlotDrawing } from '../dxf-plot-outline-candidates';
import { plotAreaStatementsIn } from '../plot-area-statement';
import { rankPlotOutlines } from '../plot-outline-ranking';
import type { PlotOutlineCandidate } from '../plot-outline-types';

const dxf = (...pairs: (string | number)[]): string =>
  ['0', 'SECTION', '2', 'ENTITIES', ...pairs, '0', 'ENDSEC', '0', 'EOF'].map(String).join('\n');

/** A closed LWPOLYLINE on `layer` through the given (x, y) pairs, drawing units (metres here). */
function lw(handle: string, layer: string, coords: readonly (readonly [number, number])[], closed = 1, bulges: number[] = []): (string | number)[] {
  const vertices = coords.flatMap(([x, y], i) => ['10', x, '20', y, ...(bulges[i] ? ['42', bulges[i]] : [])]);
  return ['0', 'LWPOLYLINE', '5', handle, '8', layer, '90', coords.length, '70', closed, ...vertices];
}

const text = (s: string, x: number, y: number): (string | number)[] => ['0', 'TEXT', '10', x, '20', y, '1', s];

const PLOT: readonly (readonly [number, number])[] = [[0, 0], [30, 0], [30, 20], [0, 20]];
const HOUSE: readonly (readonly [number, number])[] = [[10, 5], [20, 5], [20, 12], [10, 12]];
const M_TO_MM = 1000;

describe('Ε — written areas', () => {
  it.each([
    ['Ε = 13653.76 μ2', [13653.76]],
    ['E (Α,Β,Γ,Δ,Α) = 1.364,05 τ.μ.', [1364.05]],
    ['ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ: 1.364,05 m²', [1364.05]],
    ['Εμβαδόν γεωτεμαχίου 600,00 τμ', [600]],
    ['EΜΒΑΔΟΝ = 600 τ.μ. και Ε=600 τ.μ.', [600]],
  ])('%s → %j', (statement, expected) => {
    expect(plotAreaStatementsIn(statement)).toEqual(expected);
  });

  it.each(['k = 0.9996', 'E = 0.9996', 'ΕΓΣΑ 87', 'Ε = 600'])('%s → nothing (no unit, no area)', (statement) => {
    expect(plotAreaStatementsIn(statement)).toEqual([]);
  });
});

describe('Υ — candidates', () => {
  it('closed flag + coincident ends are candidates; an open line is counted, not proposed', () => {
    const drawing = scanDxfPlotDrawing(dxf(
      ...lw('P', 'ΟΡΙΟ', PLOT),
      ...lw('H', 'ΚΤΙΡΙΑ', [...HOUSE, HOUSE[0]], 0),
      ...lw('R', 'ΔΡΟΜΟΣ', [[0, -5], [30, -5]], 0),
    ));
    const out = dxfPlotOutlineCandidates(drawing, M_TO_MM);
    expect(out.candidates.map((c) => [c.id, c.origin.source === 'dxf' && c.origin.closure])).toEqual([['dxf:P', 'flag'], ['dxf:H', 'coincident-ends']]);
    expect(out.openPolylines).toBe(1);
    expect(out.candidates[0].areaM2).toBeCloseTo(600, 9);
    expect(out.candidates[0].ringWorldMm[1]).toEqual({ x: 30_000, y: 0 }); // scale applied in phase 2
  });

  it('rejects by name: self-intersecting (bow-tie) and zero-area', () => {
    const out = dxfPlotOutlineCandidates(scanDxfPlotDrawing(dxf(
      ...lw('X', '0', [[0, 0], [10, 10], [10, 0], [0, 10]]),
      ...lw('Z', '0', [[0, 0], [5, 0], [10, 0]]),
    )), 1);
    expect(out.rejected.map((r) => [r.id, r.reason])).toEqual([['dxf:X', 'self-intersecting'], ['dxf:Z', 'zero-area']]);
  });

  it('an arc edge is part of the outline (bulge on the top edge, outward)', () => {
    const out = dxfPlotOutlineCandidates(scanDxfPlotDrawing(dxf(...lw('A', '0', [[0, 0], [20, 0], [20, 20], [0, 20]], 1, [0, 0, 1, 0]))), 1);
    const halfDisc = (Math.PI * 100) / 2;
    expect(Math.abs(out.candidates[0].areaM2 * 1e6 - (400 + halfDisc))).toBeLessThan(1);
  });

  it('letters next to the corners become corner labels; bare point numbers do not', () => {
    const drawing = scanDxfPlotDrawing(dxf(
      ...lw('P', '0', PLOT),
      ...text('Α', -0.5, -0.5), ...text('B', 30.5, -0.5), ...text('Γ', 30.5, 20.5), ...text('17', -0.5, 20.5),
    ));
    const [candidate] = dxfPlotOutlineCandidates(drawing, 1).candidates;
    expect(candidate.corners.map((c) => c.label)).toEqual(['Α', 'B', 'Γ', null]);
  });
});

describe('Κ — ranking (Π4)', () => {
  const candidatesOf = (...pairs: (string | number)[]): readonly PlotOutlineCandidate[] =>
    dxfPlotOutlineCandidates(scanDxfPlotDrawing(dxf(...pairs)), M_TO_MM).candidates;

  it('the boundary layer + the declared area single out the plot, with every evidence named', () => {
    const ranking = rankPlotOutlines({ candidates: candidatesOf(...lw('P', 'ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ', PLOT), ...lw('H', 'ΚΤΙΡΙΟ', HOUSE)), listingAreaM2: 610 });
    expect(ranking.proposedId).toBe('dxf:P');
    const plot = ranking.ranked[0];
    expect(plot.evidence.find((e) => e.kind === 'layer-name')).toMatchObject({ verdict: 'for', stem: 'ΟΡΙΑ' });
    expect(plot.evidence.find((e) => e.kind === 'declared-area')).toMatchObject({ verdict: 'for', declaredBy: 'listing' });
    expect(ranking.ranked[1].evidence.find((e) => e.kind === 'declared-area')).toMatchObject({ verdict: 'against' });
  });

  it('the drawing\'s own «Ε = …» counts as a declaration, named as the drawing\'s', () => {
    const ranking = rankPlotOutlines({ candidates: candidatesOf(...lw('P', '0', PLOT), ...lw('H', '0', HOUSE)), drawingAreasM2: [600] });
    expect(ranking.proposedId).toBe('dxf:P');
    expect(ranking.ranked[0].evidence.find((e) => e.kind === 'declared-area')).toMatchObject({ declaredBy: 'drawing', relativeDifference: 0 });
  });

  it('a tie proposes nothing — never a hidden tie-break', () => {
    const ranking = rankPlotOutlines({ candidates: candidatesOf(...lw('P', 'ΟΡΙΟ', PLOT), ...lw('Q', 'PARCEL', HOUSE)) });
    expect(ranking.proposedId).toBeNull();
    expect(ranking.noProposalReason).toBe('tie');
    expect(ranking.ranked[0].candidate.id).toBe('dxf:P'); // display order only: the larger first
  });

  it('no evidence for anything proposes nothing', () => {
    const ranking = rankPlotOutlines({ candidates: candidatesOf(...lw('P', '0', PLOT)) });
    expect(ranking).toMatchObject({ proposedId: null, noProposalReason: 'no-evidence' });
  });

  it('no candidates is said, not thrown', () => {
    expect(rankPlotOutlines({ candidates: [] })).toMatchObject({ proposedId: null, noProposalReason: 'no-candidates' });
  });
});
