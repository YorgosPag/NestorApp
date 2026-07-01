/**
 * ADR-510 Φ4 — line-geometry-edit pure helper tests.
 */

import {
  lineLength,
  lineAngleDeg,
  endForLength,
  endForAngleDeg,
  withCoord,
  endForDelta,
} from '../line-geometry-edit';

const P = (x: number, y: number) => ({ x, y });

describe('line-geometry-edit — reads', () => {
  it('lineLength = Euclidean distance', () => {
    expect(lineLength(P(0, 0), P(3, 4))).toBe(5);
  });

  it('lineAngleDeg: horizontal = 0, vertical = 90, diagonal = 45', () => {
    expect(lineAngleDeg(P(0, 0), P(10, 0))).toBeCloseTo(0, 6);
    expect(lineAngleDeg(P(0, 0), P(0, 10))).toBeCloseTo(90, 6);
    expect(lineAngleDeg(P(0, 0), P(10, 10))).toBeCloseTo(45, 6);
  });

  it('lineAngleDeg: negative Y gives negative angle; flat-left normalises to 180', () => {
    expect(lineAngleDeg(P(0, 0), P(10, -10))).toBeCloseTo(-45, 6);
    expect(lineAngleDeg(P(0, 0), P(-10, 0))).toBeCloseTo(180, 6);
  });

  it('lineAngleDeg: degenerate segment reports 0', () => {
    expect(lineAngleDeg(P(5, 5), P(5, 5))).toBe(0);
  });
});

describe('line-geometry-edit — endForLength', () => {
  it('moves end along the current axis to the requested length', () => {
    const end = endForLength(P(0, 0), P(10, 0), 25);
    expect(end).toEqual({ x: 25, y: 0 });
  });

  it('keeps the bearing on a diagonal segment', () => {
    const end = endForLength(P(0, 0), P(3, 4), 10); // unit (0.6,0.8) × 10
    expect(end?.x).toBeCloseTo(6, 6);
    expect(end?.y).toBeCloseTo(8, 6);
  });

  it('returns null for non-positive / non-finite length', () => {
    expect(endForLength(P(0, 0), P(10, 0), 0)).toBeNull();
    expect(endForLength(P(0, 0), P(10, 0), -5)).toBeNull();
    expect(endForLength(P(0, 0), P(10, 0), Number.NaN)).toBeNull();
  });
});

describe('line-geometry-edit — endForAngleDeg', () => {
  it('rotates end about start keeping the length', () => {
    const end = endForAngleDeg(P(0, 0), P(10, 0), 90); // len 10 → straight up
    expect(end?.x).toBeCloseTo(0, 6);
    expect(end?.y).toBeCloseTo(10, 6);
  });

  it('returns null for a degenerate segment (no length to rotate)', () => {
    expect(endForAngleDeg(P(2, 2), P(2, 2), 45)).toBeNull();
  });

  it('returns null for non-finite angle', () => {
    expect(endForAngleDeg(P(0, 0), P(10, 0), Number.NaN)).toBeNull();
  });
});

describe('line-geometry-edit — withCoord', () => {
  it('replaces a single axis', () => {
    expect(withCoord(P(1, 2), 'x', 9)).toEqual({ x: 9, y: 2 });
    expect(withCoord(P(1, 2), 'y', -3)).toEqual({ x: 1, y: -3 });
  });

  it('returns null for non-finite value', () => {
    expect(withCoord(P(1, 2), 'x', Number.NaN)).toBeNull();
  });
});

describe('line-geometry-edit — endForDelta', () => {
  it('sets end so end-start equals the requested delta', () => {
    expect(endForDelta(P(10, 20), P(0, 0), 'x', 5)).toEqual({ x: 15, y: 0 });
    expect(endForDelta(P(10, 20), P(0, 0), 'y', -4)).toEqual({ x: 0, y: 16 });
  });

  it('returns null for non-finite delta', () => {
    expect(endForDelta(P(0, 0), P(1, 1), 'x', Number.NaN)).toBeNull();
  });
});
