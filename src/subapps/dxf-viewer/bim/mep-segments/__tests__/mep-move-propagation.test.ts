/**
 * ADR-408 Φ-C — connectivity-preserving MOVE propagation tests.
 *
 * `resolveHostMoveConnectedPipePatches` retargets pipe ends snapped to a moved
 * host's connectors (XY + Z + rotation); `resolveSegmentMoveConnectedPipePatches`
 * drags coincident neighbour ends when a pipe itself is moved. Both keep the run's
 * far end fixed (the pipe stretches, Revit-style) and never touch non-connected pipes.
 */

import {
  resolveHostMoveConnectedPipePatches,
  resolveSegmentMoveConnectedPipePatches,
} from '../mep-move-propagation';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../../types/mep-segment-types';
import type { Entity } from '../../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../../types/mep-segment-types';

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

/** Floor manifold with one outlet at host-local (50, 40), datum `mountingElevationMm`. */
function manifold(
  position: { x: number; y: number },
  rotation: number,
  mountingElevationMm: number,
): Entity {
  return {
    id: 'mfld-1',
    type: 'mep-manifold',
    kind: 'floor-manifold',
    params: {
      position: { x: position.x, y: position.y, z: 0 },
      rotation,
      mountingElevationMm,
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    },
  } as unknown as Entity;
}

/** Underfloor loop (identity host) — connectors already in world coords; datum = screed offset. */
function underfloor(world: { x: number; y: number }, screedOffsetMm: number): Entity {
  return {
    id: 'uhf-1',
    type: 'mep-underfloor',
    kind: 'mep-underfloor',
    params: {
      screedOffsetMm,
      connectors: [
        { connectorId: 'uf-supply', domain: 'pipe', flow: 'in', localPosition: { x: world.x, y: world.y, z: 0 } },
      ],
    },
  } as unknown as Entity;
}

/** Resolved (start, end) elevations of a patch's nextParams. */
function elev(p: { nextParams: MepSegmentParams }): { startMm: number; endMm: number } {
  return resolveSegmentEndpointElevationsMm(p.nextParams);
}

describe('resolveHostMoveConnectedPipePatches (host moves, pipes follow)', () => {
  it('follows a host XY translate — the snapped end moves, the far end stays', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    const prev = manifold({ x: 0, y: 0 }, 0, 400);
    const next = manifold({ x: 100, y: 0 }, 0, 400); // outlet (50,40) → (150,40)

    const patches = resolveHostMoveConnectedPipePatches([p, prev], prev, next);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.nextParams.startPoint).toMatchObject({ x: 150, y: 40 });
    expect(patches[0]!.nextParams.endPoint).toMatchObject({ x: 1000, y: 40 }); // untouched
  });

  it('follows a host Z move — only the elevation changes', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    const prev = manifold({ x: 0, y: 0 }, 0, 400);
    const next = manifold({ x: 0, y: 0 }, 0, 0); // datum 400 → 0

    const patches = resolveHostMoveConnectedPipePatches([p, prev], prev, next);

    expect(patches).toHaveLength(1);
    expect(elev(patches[0]!).startMm).toBe(0);
    expect(elev(patches[0]!).endMm).toBe(400); // free end untouched
    expect(patches[0]!.nextParams.startPoint).toMatchObject({ x: 50, y: 40 }); // xy unchanged
  });

  it('follows a host rotation — the connector sweeps and the pipe end tracks it', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    const prev = manifold({ x: 0, y: 0 }, 0, 400);
    const next = manifold({ x: 0, y: 0 }, 90, 400); // (50,40) rotated 90° → (-40,50)

    const patches = resolveHostMoveConnectedPipePatches([p, prev], prev, next);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.nextParams.startPoint.x).toBeCloseTo(-40, 6);
    expect(patches[0]!.nextParams.startPoint.y).toBeCloseTo(50, 6);
  });

  it('drags every pipe snapped to the same connector', () => {
    const p1 = pipe('p1', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    const p2 = pipe('p2', { x: 50, y: 40 }, { x: 50, y: 900 }, 400, 400);
    const prev = manifold({ x: 0, y: 0 }, 0, 400);
    const next = manifold({ x: 100, y: 0 }, 0, 400);

    const patches = resolveHostMoveConnectedPipePatches([p1, p2, prev], prev, next);

    expect(patches.map((q) => q.segment.id).sort()).toEqual(['p1', 'p2']);
    for (const q of patches) expect(q.nextParams.startPoint).toMatchObject({ x: 150, y: 40 });
  });

  it('leaves pipes not snapped to any connector alone', () => {
    const p = pipe('p', { x: 5000, y: 0 }, { x: 6000, y: 0 }, 400, 400);
    const prev = manifold({ x: 0, y: 0 }, 0, 400);
    const next = manifold({ x: 100, y: 0 }, 0, 400);

    expect(resolveHostMoveConnectedPipePatches([p, prev], prev, next)).toHaveLength(0);
  });

  it('follows an underfloor (identity host) move — datum is the screed offset', () => {
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 30, 30);
    const prev = underfloor({ x: 50, y: 40 }, 30);
    const next = underfloor({ x: 150, y: 40 }, 30);

    const patches = resolveHostMoveConnectedPipePatches([p, prev], prev, next);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.nextParams.startPoint).toMatchObject({ x: 150, y: 40, z: 30 });
  });

  it('emits a stable no-displacement patch for a coincident pipe when the host did not move', () => {
    // Drag-merge shape stability: a coincident pipe is always present in the patch
    // set so consecutive drag samples wrap the SAME CompoundCommand child shape.
    const p = pipe('p', { x: 50, y: 40 }, { x: 1000, y: 40 }, 400, 400);
    const host = manifold({ x: 0, y: 0 }, 0, 400);

    const patches = resolveHostMoveConnectedPipePatches([p, host], host, host);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.nextParams.startPoint).toMatchObject({ x: 50, y: 40, z: 400 });
  });
});

describe('resolveSegmentMoveConnectedPipePatches (pipe moves, neighbours follow)', () => {
  it('drags a coincident neighbour end when a pipe is translated', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400); // b.start == a.end
    // Translate `a` by +500 x (both endpoints).
    const next: MepSegmentParams = {
      ...a.params,
      startPoint: { x: 500, y: 0, z: 400 },
      endPoint: { x: 1500, y: 0, z: 400 },
    };

    const patches = resolveSegmentMoveConnectedPipePatches([a, b], a, next);

    expect(patches).toHaveLength(1);
    expect(patches[0]!.segment.id).toBe('b');
    expect(patches[0]!.nextParams.startPoint).toMatchObject({ x: 1500, y: 0 }); // followed a.end
    expect(patches[0]!.nextParams.endPoint).toMatchObject({ x: 2000, y: 0 }); // far end stays
  });

  it('carries the per-endpoint Z onto the followed neighbour end', () => {
    const a = pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400);
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400);
    const next: MepSegmentParams = {
      ...a.params,
      startPoint: { x: 0, y: 0, z: 400 },
      endPoint: { x: 1000, y: 0, z: 900 }, // a.end raised to 900
    };

    const patches = resolveSegmentMoveConnectedPipePatches([a, b], a, next);

    expect(patches).toHaveLength(1);
    expect(elev(patches[0]!).startMm).toBe(900); // b.start followed to a.end z
  });

  it('does not propagate when the moved segment is a duct', () => {
    const a = {
      ...pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400),
      params: { ...pipe('a', { x: 0, y: 0 }, { x: 1000, y: 0 }, 400, 400).params, domain: 'duct' },
    } as unknown as MepSegmentEntity;
    const b = pipe('b', { x: 1000, y: 0 }, { x: 2000, y: 0 }, 400, 400);
    const next: MepSegmentParams = { ...a.params, startPoint: { x: 500, y: 0, z: 400 }, endPoint: { x: 1500, y: 0, z: 400 } };

    expect(resolveSegmentMoveConnectedPipePatches([a, b], a, next)).toHaveLength(0);
  });
});
