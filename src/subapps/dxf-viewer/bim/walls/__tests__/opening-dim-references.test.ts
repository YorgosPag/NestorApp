/**
 * ADR-363 Φ1G.5 Slice 2f — resolveOpeningDimReferences (pure mm reference maths).
 */

import { resolveOpeningDimReferences } from '../opening-dim-references';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';

const params = (offset: number, width: number): OpeningParams =>
  ({ offsetFromStart: offset, width }) as unknown as OpeningParams;
// 5 m wall → 5000 mm.
const host: WallEntity = { geometry: { length: 5 } } as unknown as WallEntity;
const sib = (offset: number, width: number): OpeningEntity =>
  ({ id: `s-${offset}`, params: { wallId: 'w', offsetFromStart: offset, width } }) as unknown as OpeningEntity;

describe('resolveOpeningDimReferences', () => {
  it('measures to the wall ends when there are no siblings', () => {
    const r = resolveOpeningDimReferences(params(1000, 1000), host, []);
    expect(r.startJambOffsetMm).toBe(1000);
    expect(r.endJambOffsetMm).toBe(2000);
    expect(r.prevRefOffsetMm).toBe(0);
    expect(r.nextRefOffsetMm).toBe(5000);
    expect(r.leftDistMm).toBe(1000);
    expect(r.rightDistMm).toBe(3000);
    expect(r.prevIsWallEnd).toBe(true);
    expect(r.nextIsWallEnd).toBe(true);
  });

  it('measures to the nearest sibling jamb on each side', () => {
    // left sibling ends at 800, right sibling starts at 3000.
    const r = resolveOpeningDimReferences(params(1000, 1000), host, [sib(0, 800), sib(3000, 500)]);
    expect(r.prevRefOffsetMm).toBe(800);
    expect(r.nextRefOffsetMm).toBe(3000);
    expect(r.leftDistMm).toBe(200);
    expect(r.rightDistMm).toBe(1000);
    expect(r.prevIsWallEnd).toBe(false);
    expect(r.nextIsWallEnd).toBe(false);
  });

  it('picks the CLOSEST sibling when several lie on the same side', () => {
    // two left siblings (end 300, end 800) → nearest is 800.
    const r = resolveOpeningDimReferences(params(1000, 1000), host, [sib(0, 300), sib(500, 300)]);
    expect(r.prevRefOffsetMm).toBe(800);
    expect(r.leftDistMm).toBe(200);
  });

  it('clamps a flush jamb to a zero distance', () => {
    const r = resolveOpeningDimReferences(params(0, 1000), host, []);
    expect(r.leftDistMm).toBe(0);
    expect(r.rightDistMm).toBe(4000);
  });

  it('insets a wall-END reference to the transverse wall face at a junction', () => {
    // Host with axis (junction-aware needs params); transverse vertical wall at the start.
    const junctionHost = {
      id: 'host', kind: 'straight', geometry: { length: 5 },
      params: { start: { x: 0, y: 0, z: 0 }, end: { x: 5000, y: 0, z: 0 }, thickness: 200, sceneUnits: 'mm' },
    } as unknown as WallEntity;
    const transverse = {
      id: 'tv', kind: 'straight', geometry: { length: 4 },
      params: { start: { x: 0, y: -2000, z: 0 }, end: { x: 0, y: 2000, z: 0 }, thickness: 300, sceneUnits: 'mm' },
    } as unknown as WallEntity;
    // No siblings → prev reference is the wall start, now inset to the transverse face (300/2).
    const r = resolveOpeningDimReferences(params(1000, 1000), junctionHost, [], [junctionHost, transverse]);
    expect(r.prevIsWallEnd).toBe(true);
    expect(r.prevRefOffsetMm).toBeCloseTo(150, 6);
    expect(r.leftDistMm).toBeCloseTo(850, 6); // 1000 − 150
    expect(r.nextRefOffsetMm).toBe(5000); // free end → unchanged
  });
});
