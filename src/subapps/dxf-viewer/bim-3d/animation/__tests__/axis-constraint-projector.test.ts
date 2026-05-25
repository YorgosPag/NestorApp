import { applyAxisConstraint, AXIS_COLORS, AXIS_COLORS_DIM } from '../axis-constraint-projector';

describe('applyAxisConstraint', () => {
  const start = { x: 1, y: 2, z: 3 };
  const raw = { x: 10, y: 20, z: 30 };

  it('X lock: keeps raw.x, clamps y/z to startPos', () => {
    const r = applyAxisConstraint(raw, start, 'X');
    expect(r.x).toBe(10);
    expect(r.y).toBe(2);
    expect(r.z).toBe(3);
  });

  it('Y lock: keeps raw.y, clamps x/z to startPos', () => {
    const r = applyAxisConstraint(raw, start, 'Y');
    expect(r.x).toBe(1);
    expect(r.y).toBe(20);
    expect(r.z).toBe(3);
  });

  it('Z lock: keeps raw.z, clamps x/y to startPos', () => {
    const r = applyAxisConstraint(raw, start, 'Z');
    expect(r.x).toBe(1);
    expect(r.y).toBe(2);
    expect(r.z).toBe(30);
  });

  it('startPos at origin: locked axis = raw, others = 0', () => {
    const origin = { x: 0, y: 0, z: 0 };
    const r = applyAxisConstraint(raw, origin, 'Y');
    expect(r).toEqual({ x: 0, y: 20, z: 0 });
  });

  it('diagonal raw: only locked axis component passes through', () => {
    const diagonal = { x: 5, y: 5, z: 5 };
    const r = applyAxisConstraint(diagonal, start, 'Z');
    expect(r).toEqual({ x: 1, y: 2, z: 5 });
  });

  it('negative delta: works correctly for all axes', () => {
    const neg = { x: -5, y: -10, z: -15 };
    expect(applyAxisConstraint(neg, start, 'X').x).toBe(-5);
    expect(applyAxisConstraint(neg, start, 'Y').y).toBe(-10);
    expect(applyAxisConstraint(neg, start, 'Z').z).toBe(-15);
  });

  it('raw equals startPos: returns startPos unchanged', () => {
    const r = applyAxisConstraint(start, start, 'X');
    expect(r).toEqual(start);
  });

  it('large floating point values: no precision loss', () => {
    const big = { x: 1e6, y: 2e6, z: 3e6 };
    const bigStart = { x: 1.5e6, y: 2.5e6, z: 3.5e6 };
    const r = applyAxisConstraint(big, bigStart, 'X');
    expect(r.x).toBe(1e6);
    expect(r.y).toBe(2.5e6);
    expect(r.z).toBe(3.5e6);
  });
});

describe('AXIS_COLORS', () => {
  it('exports distinct colors for X/Y/Z', () => {
    const values = Object.values(AXIS_COLORS);
    expect(new Set(values).size).toBe(3);
  });

  it('exports dim colors for X/Y/Z', () => {
    const values = Object.values(AXIS_COLORS_DIM);
    expect(new Set(values).size).toBe(3);
  });
});
