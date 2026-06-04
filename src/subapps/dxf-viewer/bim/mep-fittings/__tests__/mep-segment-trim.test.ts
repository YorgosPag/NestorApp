/**
 * ADR-408 Φ11 — resolveSegmentTrims tests (pipes butt against their fitting).
 *
 * Each pipe end that meets a fitting is shortened by the body half-extent from the
 * shared SSoT, so the run stops at the connector face instead of crossing it. Pins
 * the per-kind extent (elbow tangent / coupling / reducer / tee arm), the cap = 0
 * (untrimmed) case, the correct start/end mapping, and idempotency.
 */

import type { Entity } from '../../../types/entities';
import { resolveSegmentTrims } from '../mep-segment-trim';

/** Build a minimal pipe MepSegmentEntity fixture (round). */
const seg = (
  id: string,
  start: [number, number],
  end: [number, number],
  diameter = 50,
): Entity =>
  ({
    id,
    type: 'mep-segment',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: start[0], y: start[1], z: 0 },
      endPoint: { x: end[0], y: end[1], z: 0 },
      diameter,
      centerlineElevationMm: 0,
      sceneUnits: 'mm',
    },
  } as unknown as Entity);

describe('resolveSegmentTrims — per-kind body half-extent', () => {
  it('elbow → tangent length (1.5·D for a 90° bend), on the meeting ends', () => {
    // a ends at (100,0); b starts at (100,0) heading up → a 90° elbow.
    const trims = resolveSegmentTrims([seg('a', [0, 0], [100, 0]), seg('b', [100, 0], [100, 100])]);
    expect(trims.get('a')!.endMm).toBeCloseTo(75);
    expect(trims.get('a')!.startMm).toBe(0); // the (0,0) dead end is a cap → untrimmed
    expect(trims.get('b')!.startMm).toBeCloseTo(75);
  });

  it('coupling → body half-length (0.75·D)', () => {
    const trims = resolveSegmentTrims([seg('c1', [0, 0], [100, 0]), seg('c2', [100, 0], [200, 0])]);
    expect(trims.get('c1')!.endMm).toBeCloseTo(37.5);
    expect(trims.get('c2')!.startMm).toBeCloseTo(37.5);
  });

  it('reducer → taper half-length (1.0·primary Ø)', () => {
    const trims = resolveSegmentTrims([seg('r1', [0, 0], [100, 0], 50), seg('r2', [100, 0], [200, 0], 30)]);
    expect(trims.get('r1')!.endMm).toBeCloseTo(50);
    expect(trims.get('r2')!.startMm).toBeCloseTo(50);
  });

  it('tee → arm half-extent (0.6·D) on all three legs', () => {
    const trims = resolveSegmentTrims([
      seg('t1', [0, 0], [100, 0]),
      seg('t2', [100, 0], [200, 0]),
      seg('t3', [100, 0], [100, 100]),
    ]);
    expect(trims.get('t1')!.endMm).toBeCloseTo(30);
    expect(trims.get('t2')!.startMm).toBeCloseTo(30);
    expect(trims.get('t3')!.startMm).toBeCloseTo(30);
  });

  it('cap (lone dead end) → no trim entry', () => {
    const trims = resolveSegmentTrims([seg('solo', [0, 0], [100, 0])]);
    // Both endpoints are 1-incident caps → nothing trimmed.
    expect(trims.get('solo')).toBeUndefined();
  });
});

describe('resolveSegmentTrims — idempotency', () => {
  it('yields an identical trim map on a second resolve', () => {
    const scene = [seg('a', [0, 0], [100, 0]), seg('b', [100, 0], [100, 100])];
    const first = resolveSegmentTrims(scene);
    const second = resolveSegmentTrims(scene);
    expect([...second.entries()]).toEqual([...first.entries()]);
  });
});
