/**
 * ADR-397 §15b — `resolveNeighborAxisAngle` pure tests (corner-angle arc inputs).
 */
import { resolveNeighborAxisAngle } from '../wall-rotation-neighbor-angle';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../types/wall-types';

function makeWall(start: { x: number; y: number }, end: { x: number; y: number }, id: string): WallEntity {
  const params = buildDefaultWallParams(start, end);
  const overrideParams: WallParams = { ...params, thickness: 200, dna: undefined };
  const result = buildWallEntity(overrideParams, '0', 'straight');
  if (!result.ok) throw new Error('build fail: ' + result.hardErrors.join(', '));
  return { ...result.entity, id };
}

const R = 1000;

describe('resolveNeighborAxisAngle', () => {
  it('90° L-corner (rotating +x, neighbour +y, shared start) → |sweep| ≈ 90°', () => {
    const rot = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'ROT');
    const nb = makeWall({ x: 0, y: 0 }, { x: 0, y: 4000 }, 'NB');

    const arc = resolveNeighborAxisAngle(rot, [nb], 'mm', R, { x: 0, y: 0 });
    expect(arc).not.toBeNull();
    expect(Math.abs(arc!.sweepDeg)).toBeCloseTo(90, 3);
    // Junction at the shared corner.
    expect(arc!.pivotW.x).toBeCloseTo(0, 6);
    expect(arc!.pivotW.y).toBeCloseTo(0, 6);
    // Reference edge points OUT along the neighbour (+y); cursor edge along the rotating wall (+x).
    expect(arc!.anchorW.x).toBeCloseTo(0, 6);
    expect(arc!.anchorW.y).toBeCloseTo(R, 6);
    expect(arc!.cursorW.x).toBeCloseTo(R, 6);
    expect(arc!.cursorW.y).toBeCloseTo(0, 6);
  });

  it('30° acute corner → |sweep| ≈ 30°', () => {
    const rad = (30 * Math.PI) / 180;
    const rot = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'ROT');
    const nb = makeWall({ x: 0, y: 0 }, { x: 4000 * Math.cos(rad), y: 4000 * Math.sin(rad) }, 'NB');

    const arc = resolveNeighborAxisAngle(rot, [nb], 'mm', R, { x: 0, y: 0 });
    expect(Math.abs(arc!.sweepDeg)).toBeCloseTo(30, 3);
  });

  it('sign: neighbour +x, rotating +y (CCW) → positive sweep (🟢)', () => {
    const rot = makeWall({ x: 0, y: 0 }, { x: 0, y: 4000 }, 'ROT'); // +y
    const nb = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'NB');   // +x
    const arc = resolveNeighborAxisAngle(rot, [nb], 'mm', R, { x: 0, y: 0 });
    expect(arc!.sweepDeg).toBeCloseTo(90, 3); // CCW from +x to +y
  });

  it('free wall (no neighbour within join threshold) → null', () => {
    const rot = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'ROT');
    const far = makeWall({ x: 9000, y: 9000 }, { x: 9000, y: 13000 }, 'FAR');
    expect(resolveNeighborAxisAngle(rot, [far], 'mm', R, { x: 0, y: 0 })).toBeNull();
  });

  it('joined at BOTH ends → picks the junction nearest the rotation pivot', () => {
    const rot = makeWall({ x: 0, y: 0 }, { x: 5000, y: 0 }, 'ROT');
    const nbStart = makeWall({ x: 0, y: 0 }, { x: 0, y: 4000 }, 'NB0');       // corner at (0,0)
    const nbEnd = makeWall({ x: 5000, y: 0 }, { x: 5000, y: 4000 }, 'NB5');   // corner at (5000,0)

    // Prefer the (5000,0) corner.
    const arc = resolveNeighborAxisAngle(rot, [nbStart, nbEnd], 'mm', R, { x: 5000, y: 0 });
    expect(arc!.pivotW.x).toBeCloseTo(5000, 6);
    expect(arc!.pivotW.y).toBeCloseTo(0, 6);
  });

  it('no refRadius (≤0) → null (guard)', () => {
    const rot = makeWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'ROT');
    const nb = makeWall({ x: 0, y: 0 }, { x: 0, y: 4000 }, 'NB');
    expect(resolveNeighborAxisAngle(rot, [nb], 'mm', 0, { x: 0, y: 0 })).toBeNull();
  });
});
