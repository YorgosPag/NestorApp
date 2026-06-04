/**
 * Generic layered build-up SSoT — pure helper coverage.
 *
 * jest globals (ΟΧΙ vitest).
 */

import {
  buildupBoundaryFractions,
  computeBuildupTotalThickness,
  type LayeredBuildup,
} from '../layered-buildup';

type Zone = 'a' | 'b';

function make(thicknesses: readonly number[]): LayeredBuildup<Zone> {
  const layers = thicknesses.map((t, i) => ({
    id: `l${i}`,
    name: `L${i}`,
    thickness: t,
    materialId: 'mat-x',
    zone: (i % 2 === 0 ? 'a' : 'b') as Zone,
  }));
  return { layers, totalThickness: computeBuildupTotalThickness(layers) };
}

describe('computeBuildupTotalThickness', () => {
  it('sums layer thicknesses', () => {
    expect(computeBuildupTotalThickness(make([10, 60, 180, 15]).layers)).toBe(265);
  });

  it('is 0 for an empty stack', () => {
    expect(computeBuildupTotalThickness([])).toBe(0);
  });
});

describe('buildupBoundaryFractions', () => {
  it('returns layers.length + 1 boundaries starting at 0 and ending at 1', () => {
    const fracs = buildupBoundaryFractions(make([100, 100, 200]));
    expect(fracs).toHaveLength(4);
    expect(fracs[0]).toBe(0);
    expect(fracs[fracs.length - 1]).toBeCloseTo(1, 9);
  });

  it('places boundaries at cumulative thickness fractions', () => {
    // total 400 → boundaries at 0, 0.25, 0.5, 1
    const fracs = buildupBoundaryFractions(make([100, 100, 200]));
    expect(fracs[1]).toBeCloseTo(0.25, 9);
    expect(fracs[2]).toBeCloseTo(0.5, 9);
  });

  it('clamps to 1 and never exceeds it', () => {
    const fracs = buildupBoundaryFractions(make([50, 50]));
    expect(Math.max(...fracs)).toBeLessThanOrEqual(1);
  });

  it('degrades to 1 when totalThickness is ~0 (no div-by-zero)', () => {
    const fracs = buildupBoundaryFractions({
      layers: [{ thickness: 0 }, { thickness: 0 }],
      totalThickness: 0,
    });
    expect(fracs).toEqual([0, 1, 1]);
  });
});
