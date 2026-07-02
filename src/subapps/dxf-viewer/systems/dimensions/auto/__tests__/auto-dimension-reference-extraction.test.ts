/**
 * ADR-563 — reference extraction unit tests.
 */

import { extractReferencePoints } from '../auto-dimension-reference-extraction';
import { AUTO_DIMENSION_DEFAULTS, type AutoDimensionOptions, type Bounds2D } from '../auto-dimension-types';
import { makeBimMock } from './auto-dim-test-mocks';

const OVERALL: Bounds2D = { min: { x: 0, y: 0 }, max: { x: 2400, y: 400 } };

/** Defaults but restricted to the south side for deterministic assertions. */
function southOnly(overrides: Partial<AutoDimensionOptions> = {}): AutoDimensionOptions {
  return {
    ...AUTO_DIMENSION_DEFAULTS,
    sides: { south: true, north: false, west: false, east: false },
    ...overrides,
  };
}

const c1 = makeBimMock('column', 'c1', 0, 0, 400, 400); // center 200, edges 0/400
const c2 = makeBimMock('column', 'c2', 2000, 0, 2400, 400); // center 2200, edges 2000/2400

function coordsFor(points: ReturnType<typeof extractReferencePoints>, tier: string): number[] {
  return points
    .filter((p) => p.tier === tier && p.side === 'south')
    .map((p) => p.coord)
    .sort((a, b) => a - b);
}

describe('extractReferencePoints', () => {
  it('detail tier (smart basis) emits both extent edges of each element', () => {
    const pts = extractReferencePoints([c1, c2], southOnly(), OVERALL);
    expect(coordsFor(pts, 'detail')).toEqual([0, 400, 2000, 2400]);
  });

  it('axes tier emits element centers only', () => {
    const pts = extractReferencePoints([c1, c2], southOnly(), OVERALL);
    expect(coordsFor(pts, 'axes')).toEqual([200, 2200]);
  });

  it('overall tier spans the global min→max on the measured axis', () => {
    const pts = extractReferencePoints([c1, c2], southOnly(), OVERALL);
    expect(coordsFor(pts, 'overall')).toEqual([0, 2400]);
  });

  it('axes basis collapses the detail tier to centers', () => {
    const pts = extractReferencePoints([c1, c2], southOnly({ referenceBasis: 'axes' }), OVERALL);
    expect(coordsFor(pts, 'detail')).toEqual([200, 2200]);
  });

  it('respects disabled tiers', () => {
    const opts = southOnly({ tiers: { detail: false, axes: true, overall: false } });
    const pts = extractReferencePoints([c1, c2], opts, OVERALL);
    expect(coordsFor(pts, 'detail')).toEqual([]);
    expect(coordsFor(pts, 'overall')).toEqual([]);
    expect(coordsFor(pts, 'axes')).toEqual([200, 2200]);
  });

  it('excludes openings when includeOpenings is false', () => {
    const op = makeBimMock('opening', 'o1', 1000, 0, 1200, 400); // center 1100
    const withOpening = extractReferencePoints([c1, op], southOnly({ includeOpenings: true }), OVERALL);
    const withoutOpening = extractReferencePoints([c1, op], southOnly({ includeOpenings: false }), OVERALL);
    expect(coordsFor(withOpening, 'detail')).toContain(1100);
    expect(coordsFor(withoutOpening, 'detail')).not.toContain(1100);
  });

  it('ignores non-BIM entities', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Parameters<typeof extractReferencePoints>[0][number];
    const pts = extractReferencePoints([line], southOnly(), OVERALL);
    // only the overall tier (source-less) remains
    expect(pts.every((p) => p.tier === 'overall')).toBe(true);
  });
});
