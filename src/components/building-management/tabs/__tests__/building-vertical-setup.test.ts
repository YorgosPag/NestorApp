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
    expect(stack).toEqual([{ number: 0, elevation: 0, height: 3, kind: 'ground' }]);
  });

  it('tags each storey with its inferred kind', () => {
    const stack = generateFloorStack({ basementCount: 1, upperCount: 2, typicalHeightM: 3 });
    const byNum = Object.fromEntries(stack.map((s) => [s.number, s.kind]));
    expect(byNum['-1']).toBe('basement');
    expect(byNum['0']).toBe('ground');
    expect(byNum['1']).toBe('standard');
    expect(byNum['2']).toBe('standard');
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

describe('generateFloorStack — ADR-461 special levels (foundation + stair penthouse)', () => {
  it('omits both special levels when the toggles are off (back-compat)', () => {
    const stack = generateFloorStack({ basementCount: 0, upperCount: 2, typicalHeightM: 3 });
    expect(stack.map((s) => s.kind)).toEqual(['ground', 'standard', 'standard']);
    expect(stack.some((s) => s.kind === 'foundation' || s.kind === 'stair-penthouse')).toBe(false);
  });

  it('prepends a foundation level below the lowest storey', () => {
    const stack = generateFloorStack({
      basementCount: 0, upperCount: 2, typicalHeightM: 3,
      hasFoundation: true, foundationDepthM: 1,
    });
    const foundation = stack[0];
    expect(foundation.kind).toBe('foundation');
    expect(foundation.number).toBe(-1); // lowest storey (ground=0) − 1
    expect(foundation.elevation).toBe(-1); // ground elevation 0 − depth 1
    expect(foundation.height).toBe(1);
  });

  it('places the foundation below the lowest basement when basements exist', () => {
    const stack = generateFloorStack({
      basementCount: 1, upperCount: 1, typicalHeightM: 3,
      hasFoundation: true, foundationDepthM: 1.2,
    });
    const foundation = stack[0];
    expect(foundation.number).toBe(-2); // lowest storey (−1) − 1
    expect(foundation.elevation).toBe(-4.2); // basement elev −3 − depth 1.2
  });

  it('appends a stair-penthouse level above the top storey at default 2.40 m', () => {
    const stack = generateFloorStack({
      basementCount: 0, upperCount: 2, typicalHeightM: 3,
      hasStairPenthouse: true,
    });
    const penthouse = stack[stack.length - 1];
    expect(penthouse.kind).toBe('stair-penthouse');
    expect(penthouse.number).toBe(3); // top storey (2) + 1
    expect(penthouse.elevation).toBe(9); // top elev 6 + top height 3
    expect(penthouse.height).toBe(2.4); // default
  });

  it('honours an explicit stair-penthouse height', () => {
    const stack = generateFloorStack({
      basementCount: 0, upperCount: 1, typicalHeightM: 3,
      hasStairPenthouse: true, stairPenthouseHeightM: 2.8,
    });
    expect(stack[stack.length - 1].height).toBe(2.8);
  });

  it('builds the full Giorgio example (0 basements + ground + 2 → 5 levels)', () => {
    const stack = generateFloorStack({
      basementCount: 0, upperCount: 2, typicalHeightM: 3,
      hasFoundation: true, foundationDepthM: 1, hasStairPenthouse: true,
    });
    expect(stack.map((s) => s.kind)).toEqual([
      'foundation', 'ground', 'standard', 'standard', 'stair-penthouse',
    ]);
    // Ordered low → high.
    expect(stack.map((s) => s.elevation)).toEqual([-1, 0, 3, 6, 9]);
  });
});
