/**
 * ADR-650 M5α.2 / M8β/Γ — topo-world-point-math (pure ΕΓΣΑ mm + datum → Three.js world metres).
 *
 * The point of these tests is NOT that the arithmetic runs — it is that anything seated through
 * this chain (a QA marker, an auto-breakline candidate) lands on the SAME spot the terrain mesh
 * puts that ground at. So the assertions pin the three transforms `tin-to-three` applies, in the
 * same order, with the same sign conventions: geometry that is mirrored across the site, floating
 * at real ΕΓΣΑ altitude, or seated on the datum plane points the surveyor at the wrong place — and
 * every one of those is a single sign or a single missing subtraction away.
 */

import { topoWorldPointToThree } from '../topo-world-point-math';
import type { WorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';

/** A projector that shifts ΕΓΣΑ world mm by a fixed offset — enough to prove it is applied. */
function shiftProjector(dxMm: number, dyMm: number): WorldToDisplayProjector {
  return {
    isIdentity: false,
    project: (x: number, y: number) => ({ x: x + dxMm, y: y + dyMm }),
  } as WorldToDisplayProjector;
}

describe('topoWorldPointToThree', () => {
  it('maps plan-mm east→x, elevation→y, plan-mm north→−z, all in metres', () => {
    expect(topoWorldPointToThree({ x: 2000, y: 5000 }, 3000)).toEqual({ x: 2, y: 3, z: -5 });
  });

  it('subtracts the vertical datum so the marker seats ON the building, not at real altitude', () => {
    // A hilltop at 106 m with the project datum at 100 m sits 6 m above internal zero.
    const world = topoWorldPointToThree({ x: 0, y: 0 }, 106_000, { datumMm: 100_000 });
    expect(world?.y).toBeCloseTo(6, 9);
  });

  it('applies the geo projector to the plan coordinates before the axis swap', () => {
    const world = topoWorldPointToThree({ x: 1000, y: 1000 }, 0, { projector: shiftProjector(4000, 9000) });
    expect(world).toEqual({ x: 5, y: 0, z: -10 });
  });

  it('skips an identity projector entirely (same result as none)', () => {
    const identity = { isIdentity: true, project: () => ({ x: 0, y: 0 }) } as unknown as WorldToDisplayProjector;
    expect(topoWorldPointToThree({ x: 7000, y: 3000 }, 1000, { projector: identity }))
      .toEqual(topoWorldPointToThree({ x: 7000, y: 3000 }, 1000));
  });

  it('combines projector and datum in the order tin-to-three uses', () => {
    const world = topoWorldPointToThree({ x: 500_000_000, y: 4_200_000_000 }, 106_000, {
      projector: shiftProjector(-500_000_000, -4_200_000_000),
      datumMm: 100_000,
    });
    // z is +0, not −0: the `0 - north` form in the shared convention is what guarantees that.
    expect(world).toEqual({ x: 0, y: 6, z: 0 });
  });

  it('keeps plan-north zero at +0, never −0', () => {
    // −0 is equal to 0 but not identical to it: it survives serialization and breaks Object.is.
    expect(Object.is(topoWorldPointToThree({ x: 0, y: 0 }, 0)?.z, 0)).toBe(true);
  });

  it('returns null on a non-finite coordinate rather than emitting NaN', () => {
    // A NaN would position the DOM marker at translate(NaN,NaN) — invisible, which the user
    // reads as «nothing was found there». Hiding it deliberately is honest; that is not.
    expect(topoWorldPointToThree({ x: Number.NaN, y: 0 }, 0)).toBeNull();
    expect(topoWorldPointToThree({ x: 0, y: Number.POSITIVE_INFINITY }, 0)).toBeNull();
    expect(topoWorldPointToThree({ x: 0, y: 0 }, Number.NaN)).toBeNull();
  });

  it('returns null when the projector itself produces a non-finite result', () => {
    const broken = { isIdentity: false, project: () => ({ x: Number.NaN, y: 0 }) } as unknown as WorldToDisplayProjector;
    expect(topoWorldPointToThree({ x: 1000, y: 1000 }, 0, { projector: broken })).toBeNull();
  });
});
