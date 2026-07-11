/**
 * ADR-637 Phase 2b — `buildEdgeOriginRun` SSoT unit tests.
 *
 * The edge-origin sibling of `buildRectilinearRun`: same run walk, but treads
 * span one width edge (`buildFlightFromEdge`) instead of the centreline. Locks
 * the two contract points a caller (L/U/Γ flight 2+) relies on:
 *   - empty schedule ⇒ a single sub-flight byte-identical to a bare
 *     `buildFlightFromEdge` (+ the run bookkeeping: split/cursor/walkline);
 *   - one rest landing ⇒ two sub-flights + one edge-spanning landing quad + one
 *     grip handle at the landing centroid, with the level z-model preserved.
 *
 * @see ../stair-flight-run-builder.ts
 */

import { buildEdgeOriginRun } from '../stair-flight-run-builder';
import { buildFlightFromEdge } from '../stair-geometry-generators';
import type { Vec2 } from '../stair-geometry-shared';

const RISE = 175;
const TREAD = 280;
const NOSING = 25;
const WIDTH = 1000;

const uAlong: Vec2 = { x: 1, y: 0 };
const vWidth: Vec2 = { x: 0, y: 1 };
const originXY: Vec2 = { x: 100, y: 50 };

const common = {
  originXY,
  uAlong,
  vWidth,
  startLevel: 6,
  baseZ: 0,
  rise: RISE,
  tread: TREAD,
  nosing: NOSING,
  width: WIDTH,
} as const;

describe('buildEdgeOriginRun', () => {
  it('empty schedule → single sub-flight identical to bare buildFlightFromEdge', () => {
    const run = buildEdgeOriginRun({ ...common, treadCount: 5, restLandings: [] });
    const bare = buildFlightFromEdge(
      originXY, uAlong, vWidth, RISE, TREAD, NOSING, WIDTH, 5, /* zFirstTread */ RISE * 6,
    );
    expect(run.treads).toEqual(bare.treads);
    expect(run.risers).toEqual(bare.risers);
    expect(run.landings).toHaveLength(0);
    expect(run.landingHandles).toHaveLength(0);
    expect(run.flightSplit).toEqual([5]);
    // Edge cursor advances tread·count along uAlong.
    expect(run.endXY.x).toBeCloseTo(originXY.x + TREAD * 5, 9);
    expect(run.endXY.y).toBeCloseTo(originXY.y, 9);
  });

  it('one rest landing → 2 sub-flights, 1 edge landing quad + 1 handle', () => {
    const run = buildEdgeOriginRun({
      ...common,
      treadCount: 5,
      restLandings: [{ id: 'r', at: 0.5, length: 'auto' }],
    });
    expect(run.flightSplit).toEqual([2, 2]); // level 2 becomes the landing
    expect(run.landings).toHaveLength(1);
    expect(run.landingHandles).toHaveLength(1);

    const handle = run.landingHandles[0];
    expect(handle.id).toBe('r');
    expect(handle.length).toBe(WIDTH); // 'auto' → width
    // Landing claims level 2 → z = baseZ + rise·(startLevel + 2) = 175·8 = 1400.
    expect(handle.center.z).toBeCloseTo(RISE * 8, 9);
    // Edge-origin centroid = corner + uAlong·(len/2) + vWidth·(width/2).
    // Corner x after 2 treads = 100 + 280·2 = 660; centroid x = 660 + 500 = 1160.
    expect(handle.center.x).toBeCloseTo(660 + WIDTH / 2, 6);
    expect(handle.center.y).toBeCloseTo(originXY.y + WIDTH / 2, 6);
  });

  it('landing plan length extends the edge cursor by the landing length', () => {
    const bare = buildEdgeOriginRun({ ...common, treadCount: 5, restLandings: [] });
    const withRest = buildEdgeOriginRun({
      ...common,
      treadCount: 5,
      restLandings: [{ id: 'r', at: 0.5, length: 1600 }],
    });
    // Same 4 treads (2+2), but the landing replaces one tread's `tread` advance
    // with a 1600 advance → cursor grows by (1600 − tread).
    expect(withRest.endXY.x).toBeCloseTo(bare.endXY.x + (1600 - TREAD), 6);
  });
});
