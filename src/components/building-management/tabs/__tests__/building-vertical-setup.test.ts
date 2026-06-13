/**
 * Unit tests — building-vertical-setup (ADR-451 Quick Setup generator)
 */

import {
  generateFloorStack,
  DEFAULT_TYPICAL_STOREY_HEIGHT_M,
} from '../building-vertical-setup';

describe('generateFloorStack — ADR-451', () => {
  it('always includes the ground floor (0) at elevation 0', () => {
    const stack = generateFloorStack({ basementCount: 0, upperCount: 0, typicalHeightM: 3 });
    expect(stack).toEqual([{ number: 0, elevation: 0, height: 3 }]);
  });

  it('builds basements below and uppers above, low → high', () => {
    const stack = generateFloorStack({ basementCount: 1, upperCount: 2, typicalHeightM: 3 });
    expect(stack.map((s) => s.number)).toEqual([-1, 0, 1, 2]);
    const byNum = Object.fromEntries(stack.map((s) => [s.number, s.elevation]));
    expect(byNum['-1']).toBe(-3);
    expect(byNum['0']).toBe(0);
    expect(byNum['1']).toBe(3);
    expect(byNum['2']).toBe(6);
  });

  it('supports double basement (−2,−1) for pilotis + basement', () => {
    const stack = generateFloorStack({ basementCount: 2, upperCount: 0, typicalHeightM: 3 });
    expect(stack.map((s) => s.number)).toEqual([-2, -1, 0]);
    expect(stack[0].elevation).toBe(-6);
  });

  it('uses the given typical height for every storey', () => {
    const stack = generateFloorStack({ basementCount: 0, upperCount: 2, typicalHeightM: 3.5 });
    expect(stack.every((s) => s.height === 3.5)).toBe(true);
    expect(stack.find((s) => s.number === 2)?.elevation).toBe(7);
  });

  it('rounds elevations to millimetre precision (no float drift)', () => {
    const stack = generateFloorStack({ basementCount: 0, upperCount: 3, typicalHeightM: 2.85 });
    expect(stack.find((s) => s.number === 3)?.elevation).toBe(8.55);
  });

  it('falls back to the default height on a non-positive value', () => {
    const stack = generateFloorStack({ basementCount: 0, upperCount: 1, typicalHeightM: 0 });
    expect(stack.find((s) => s.number === 1)?.elevation).toBe(DEFAULT_TYPICAL_STOREY_HEIGHT_M);
  });

  it('clamps negative / non-finite counts to zero', () => {
    const stack = generateFloorStack({ basementCount: -3, upperCount: Number.NaN, typicalHeightM: 3 });
    expect(stack.map((s) => s.number)).toEqual([0]);
  });
});
