/**
 * ADR-633 — turn-point pure logic: parieta pick + insert + flight axes.
 *
 * These pin the "brain" of the click-a-side-to-turn feature independently of
 * the React tool (which is verified in-app): where a click lands (which flight /
 * side / param) and how a turn promotes/extends the variant. Geometry roundtrips
 * through `computeStairGeometry` confirm tread conservation.
 *
 * @see ../stair-parieta-pick.ts ../stair-turn-insert.ts ../stair-flight-axes.ts
 */

import type { StairParams } from '../../types/stair-types';
import { computeStairGeometry } from '../../geometry/stairs/StairGeometryService';
import { pickStairParieta } from '../stair-parieta-pick';
import { insertTurnAtParieta } from '../stair-turn-insert';
import { stairFlightAxes } from '../stair-flight-axes';

const RISE = 175;
const TREAD = 280;
const WIDTH = 1000;

function makeStraight(stepCount: number): StairParams {
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: RISE,
    tread: TREAD,
    nosing: 25,
    nosingSide: 'front',
    width: WIDTH,
    stepCount,
    totalRise: RISE * stepCount,
    totalRun: TREAD * (stepCount - 1),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant: { kind: 'straight' },
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function treadCount(params: StairParams): number {
  const g = computeStairGeometry(params);
  return g.treadsBelowCut.length + g.treadsAboveCut.length;
}

describe('ADR-633 — parieta pick', () => {
  it('left half of a +X straight run → side "left", param 0.5', () => {
    const pick = pickStairParieta({ x: 560, y: 300 }, makeStraight(5));
    expect(pick).not.toBeNull();
    expect(pick?.side).toBe('left');
    expect(pick?.flightIndex).toBe(0);
    expect(pick?.param).toBeCloseTo(560 / (TREAD * 4), 6);
  });

  it('right half → side "right"', () => {
    const pick = pickStairParieta({ x: 560, y: -300 }, makeStraight(5));
    expect(pick?.side).toBe('right');
  });

  it('click beyond halfW band → null', () => {
    expect(pickStairParieta({ x: 560, y: 700 }, makeStraight(5))).toBeNull();
  });

  it('tolWorld widens the band', () => {
    expect(pickStairParieta({ x: 560, y: 700 }, makeStraight(5), 300)).not.toBeNull();
  });

  it('picks the correct flight of a multi-flight run', () => {
    const turned = insertTurnAtParieta(makeStraight(6), {
      flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90,
    });
    if (!turned) throw new Error('expected turn');
    // Quarter-turn corner (gamma SSoT): flight-2 centreline starts at
    // pk(840,0) + u·halfW(500,0) + uNext·halfW(0,-500) = (1340,-500), running
    // downward (dir (0,-1)); click on its side.
    const pick = pickStairParieta({ x: 1600, y: -900 }, turned);
    expect(pick?.flightIndex).toBe(1);
  });
});

describe('ADR-633 — insert turn', () => {
  it('straight → multi-flight, tread count preserved', () => {
    const out = insertTurnAtParieta(makeStraight(6), {
      flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90,
    });
    if (!out) throw new Error('expected turn');
    expect(out.variant.kind).toBe('multi-flight');
    if (out.variant.kind !== 'multi-flight') throw new Error('narrow');
    expect(out.variant.flights).toEqual([3, 3]);
    expect(out.variant.turns).toHaveLength(1);
    expect(out.variant.turns[0].turnDirection).toBe('right');
    expect(out.variant.turns[0].turnAngleDeg).toBe(90);
    expect(out.variant.turns[0].cornerStyle).toBe('landing');
    expect(treadCount(out)).toBe(6);
  });

  it('split rounds param to the nearest tread', () => {
    const out = insertTurnAtParieta(makeStraight(6), {
      flightIndex: 0, param: 0.34, side: 'left', turnAngleDeg: 90,
    });
    if (out?.variant.kind !== 'multi-flight') throw new Error('expected multi-flight');
    expect(out.variant.flights).toEqual([2, 4]);
  });

  it('single-tread run cannot be split → null', () => {
    expect(
      insertTurnAtParieta(makeStraight(1), { flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90 }),
    ).toBeNull();
  });

  it('appends a second turn to an existing multi-flight run', () => {
    const first = insertTurnAtParieta(makeStraight(6), {
      flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90,
    });
    if (!first) throw new Error('first');
    const second = insertTurnAtParieta(first, {
      flightIndex: 1, param: 0.5, side: 'left', turnAngleDeg: 90,
    });
    if (second?.variant.kind !== 'multi-flight') throw new Error('expected multi-flight');
    expect(second.variant.flights).toEqual([3, 2, 1]); // flight 2 (3) split at round(0.5·3)=2
    expect(second.variant.turns).toHaveLength(2);
    expect(second.variant.turns[1].turnDirection).toBe('left');
    expect(treadCount(second)).toBe(6);
  });

  it('non-straight / non-multi-flight variant → null', () => {
    const spiralish: StairParams = {
      ...makeStraight(6),
      variant: { kind: 'winder', turnAngle: 90, winderCount: 3, winderMethod: 'equal-going' },
    };
    expect(
      insertTurnAtParieta(spiralish, { flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90 }),
    ).toBeNull();
  });
});

describe('ADR-633 — flight axes', () => {
  it('straight → one axis along +X', () => {
    const axes = stairFlightAxes(makeStraight(5));
    expect(axes).toHaveLength(1);
    expect(axes[0].dir.x).toBeCloseTo(1, 9);
    expect(axes[0].dir.y).toBeCloseTo(0, 9);
    expect(axes[0].end.x).toBeCloseTo(TREAD * 4, 6);
  });

  it('multi-flight → one axis per flight, second rotated by the turn', () => {
    const turned = insertTurnAtParieta(makeStraight(6), {
      flightIndex: 0, param: 0.5, side: 'right', turnAngleDeg: 90,
    });
    if (!turned) throw new Error('expected turn');
    const axes = stairFlightAxes(turned);
    expect(axes).toHaveLength(2);
    expect(axes[1].dir.x).toBeCloseTo(0, 6);
    expect(axes[1].dir.y).toBeCloseTo(-1, 6); // right turn 90° from +X → (0,-1)
  });

  it('unsupported variant → no axes', () => {
    const winder: StairParams = {
      ...makeStraight(6),
      variant: { kind: 'winder', turnAngle: 90, winderCount: 3, winderMethod: 'equal-going' },
    };
    expect(stairFlightAxes(winder)).toHaveLength(0);
  });
});
