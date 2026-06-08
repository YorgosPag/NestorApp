/**
 * ADR-408 Φ-B2a — connected elevation propagation tests.
 *
 * `resolveConnectedElevationPatches` makes a network node move together: editing
 * one pipe endpoint's z propagates to every coincident pipe endpoint (so the run
 * does not tear apart), with a manifold / fixture outlet acting as an anchor that
 * the node cannot drag away from.
 */

import {
  resolveConnectedElevationPatches,
  resolveManifoldConnectedPipePatches,
} from '../mep-elevation-propagation';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../../types/mep-segment-types';
import type { Entity } from '../../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../../types/mep-segment-types';
import type { MepManifoldParams } from '../../types/mep-manifold-types';

/** Build a pipe segment between two plan points at the given endpoint z's (mm). */
function pipe(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  startZ: number,
  endZ: number,
): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: start.x, y: start.y, z: startZ },
      endPoint: { x: end.x, y: end.y, z: endZ },
      diameter: 50,
      centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
    },
  } as unknown as MepSegmentEntity;
}

/** A floor manifold whose single outlet sits at world (50, 40), datum 400mm. */
function manifold(): Entity {
  return {
    id: 'mfld-1',
    type: 'mep-manifold',
    kind: 'floor-manifold',
    params: {
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      mountingElevationMm: 400,
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    },
  } as unknown as Entity;
}

/** Set an endpoint elevation the way the bridge's `buildElevationParams` does. */
function editEndpoint(
  seg: MepSegmentEntity,
  which: 'start' | 'end',
  z: number,
): MepSegmentParams {
  const cur = resolveSegmentEndpointElevationsMm(seg.params);
  const startZ = which === 'start' ? z : cur.startMm;
  const endZ = which === 'end' ? z : cur.endMm;
  return {
    ...seg.params,
    startPoint: { ...seg.params.startPoint, z: startZ },
    endPoint: { ...seg.params.endPoint, z: endZ },
    centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
  };
}

/** Resolved (start, end) elevations of a patch's nextParams. */
function elev(p: { nextParams: MepSegmentParams }): { startMm: number; endMm: number } {
  return resolveSegmentEndpointElevationsMm(p.nextParams);
}

describe('resolveConnectedElevationPatches', () => {
  it('propagates to a coincident pipe endpoint (the screenshot fix)', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400); // b.start == a.end
    const next = editEndpoint(a, 'end', 0); // user drops a's joined end 400 → 0

    const patches = resolveConnectedElevationPatches([a, b], a, next);

    expect(patches).toHaveLength(2);
    const pa = patches.find((p) => p.segment.id === 'a')!;
    const pb = patches.find((p) => p.segment.id === 'b')!;
    expect(elev(pa)).toEqual({ startMm: 400, endMm: 0 });
    expect(elev(pb)).toEqual({ startMm: 0, endMm: 400 }); // b.start followed to 0
  });

  it('keeps the derived centreline as the midpoint of the new z\'s', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const next = editEndpoint(a, 'end', 0);

    const [pa] = resolveConnectedElevationPatches([a], a, next);

    expect(pa!.nextParams.centerlineElevationMm).toBe(200); // (400 + 0) / 2
  });

  it('does not propagate to non-coincident pipes', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const b = pipe('b', { x: 5000, y: 0 }, { x: 6000, y: 0 }, 400, 400); // far away
    const next = editEndpoint(a, 'end', 0);

    const patches = resolveConnectedElevationPatches([a, b], a, next);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.segment.id).toBe('a');
  });

  it('anchors a node to a manifold outlet — the source wins', () => {
    // a's start sits on the manifold outlet (50, 40, datum 400).
    const a = pipe('a', { x: 50, y: 40 }, { x: 1000, y: 0 }, 400, 400);
    const next = editEndpoint(a, 'start', 0); // user tries to drop the manifold end to 0

    const [pa] = resolveConnectedElevationPatches([manifold(), a], a, next);

    expect(elev(pa!).startMm).toBe(400); // clamped back to the manifold datum
  });

  it('moves every endpoint of a 3-way node together', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400);
    const c = pipe('c', { x: 1000, y: 0 }, { x: 1000, y: 1000 }, 400, 400);
    const next = editEndpoint(a, 'end', 0);

    const patches = resolveConnectedElevationPatches([a, b, c], a, next);

    expect(patches).toHaveLength(3);
    expect(elev(patches.find((p) => p.segment.id === 'b')!).startMm).toBe(0);
    expect(elev(patches.find((p) => p.segment.id === 'c')!).startMm).toBe(0);
  });

  it('tee on a body: editing the MAIN drags a branch tapping its middle (interpolated)', () => {
    // Main flat at 2800 along x; branch taps its MIDDLE at (1000,0).
    const main = pipe('m', { x: 0, y: 0 }, { x: 2000, y: 0 }, 2800, 2800);
    const branch = pipe('b', { x: 1000, y: 0 }, { x: 1000, y: 1000 }, 2800, 2800);
    // Drop the main's end 2800 → 0: the main is now sloped, tap sits at t=0.5.
    const next = editEndpoint(main, 'end', 0);

    const patches = resolveConnectedElevationPatches([main, branch], main, next);

    expect(patches).toHaveLength(2);
    const pb = patches.find((p) => p.segment.id === 'b')!;
    // Interpolated main z at the tap = 2800 + 0.5·(0 − 2800) = 1400.
    expect(elev(pb).startMm).toBe(1400);
    expect(elev(pb).endMm).toBe(2800); // the far (fixture) end is untouched
  });

  it('tee on a body: editing the BRANCH tap-end snaps it back to the main (anchor)', () => {
    // Main flat at 2800; branch taps its middle at (1000,0), same elevation.
    const main = pipe('m', { x: 0, y: 0 }, { x: 2000, y: 0 }, 2800, 2800);
    const branch = pipe('b', { x: 1000, y: 0 }, { x: 1000, y: 1000 }, 2800, 2800);
    // User tries to drop the branch's tap end to 0 — the main is the anchor.
    const next = editEndpoint(branch, 'start', 0);

    const patches = resolveConnectedElevationPatches([main, branch], branch, next);

    expect(patches).toHaveLength(1); // only the branch; the main never tears
    expect(elev(patches[0]!).startMm).toBe(2800); // clamped back to the main
  });

  it('does not propagate for a duct segment', () => {
    const duct = {
      ...pipe('d', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400),
      params: { ...pipe('d', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400).params, domain: 'duct' },
    } as unknown as MepSegmentEntity;
    const neighbour = pipe('n', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400);
    const next = editEndpoint(duct, 'end', 0);

    const patches = resolveConnectedElevationPatches([duct, neighbour], duct, next);

    expect(patches).toHaveLength(1);
  });

  it('is idempotent — a coincident endpoint already at the target z is left alone', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 0); // a.end already 0
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 0, 400); // b.start already 0
    const next = editEndpoint(a, 'end', 0); // re-apply the same z

    const patches = resolveConnectedElevationPatches([a, b], a, next);

    // a's end did not actually change → no changed node → edited-only patch.
    expect(patches).toHaveLength(1);
    expect(patches[0]!.segment.id).toBe('a');
  });
});

describe('resolveManifoldConnectedPipePatches (host moves, pipes follow)', () => {
  /** Manifold at origin, one outlet at world (50, 40), datum `mountingElevationMm`. */
  function manifoldParams(mountingElevationMm: number): MepManifoldParams {
    return {
      kind: 'floor-manifold',
      shape: 'rectangular',
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      width: 400,
      length: 80,
      bodyHeightMm: 60,
      mountingElevationMm,
      outletCount: 1,
      inletDiameterMm: 25,
      outletDiameterMm: 16,
      sceneUnits: 'mm',
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    } as unknown as MepManifoldParams;
  }

  it('moves a pipe end snapped to an outlet to the new manifold elevation', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400); // start on the outlet
    const patches = resolveManifoldConnectedPipePatches([p], 'mfld-1', manifoldParams(0));

    expect(patches).toHaveLength(1);
    expect(resolveSegmentEndpointElevationsMm(patches[0]!.nextParams).startMm).toBe(0);
    // The free end is untouched.
    expect(resolveSegmentEndpointElevationsMm(patches[0]!.nextParams).endMm).toBe(400);
  });

  it('leaves pipes not on any outlet alone', () => {
    const p = pipe('p', { x: 5000, y: 0 }, { x: 6000, y: 0 }, 400, 400);
    expect(resolveManifoldConnectedPipePatches([p], 'mfld-1', manifoldParams(0))).toHaveLength(0);
  });

  it('is a no-op when the pipe end is already at the outlet elevation', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    expect(resolveManifoldConnectedPipePatches([p], 'mfld-1', manifoldParams(400))).toHaveLength(0);
  });
});
