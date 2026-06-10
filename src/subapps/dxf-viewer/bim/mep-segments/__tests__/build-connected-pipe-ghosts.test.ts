/**
 * ADR-408 Φ-C — tests for `buildConnectedPipeGhosts` (SSoT ghost builder).
 *
 * Produces the ghost segment entities for pipe ends snapped to a moving host's
 * connectors: each retargeted segment with a FRESHLY computed `geometry` (renderers
 * paint from geometry, not params). Empty for a non-plumbing host or an unconnected
 * pipe. Shares the SAME resolver as the connectivity-preserving commit.
 */

import { buildConnectedPipeGhosts } from '../build-connected-pipe-ghosts';
import { deriveCenterlineElevationMm } from '../../types/mep-segment-types';
import type { Entity } from '../../../types/entities';
import type { MepSegmentEntity } from '../../types/mep-segment-types';

/** Floor manifold with one pipe outlet at host-local (50, 40). */
function manifold(position: { x: number; y: number }, mountingElevationMm: number): Entity {
  return {
    id: 'mfld-1',
    type: 'mep-manifold',
    kind: 'floor-manifold',
    params: {
      position: { x: position.x, y: position.y, z: 0 },
      rotation: 0,
      mountingElevationMm,
      connectors: [
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    },
  } as unknown as Entity;
}

/** A non-plumbing entity (no mounting datum). */
function wall(): Entity {
  return { id: 'wall-1', type: 'wall', params: {} } as unknown as Entity;
}

/** Pipe segment between two plan points. */
function pipe(id: string, start: { x: number; y: number }, end: { x: number; y: number }): MepSegmentEntity {
  return {
    id,
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: start.x, y: start.y, z: 400 },
      endPoint: { x: end.x, y: end.y, z: 400 },
      diameter: 50,
      centerlineElevationMm: deriveCenterlineElevationMm(400, 400),
    },
  } as unknown as MepSegmentEntity;
}

describe('buildConnectedPipeGhosts', () => {
  it('returns a ghost segment with retargeted params AND recomputed geometry', () => {
    const prev = manifold({ x: 0, y: 0 }, 400); // outlet world (50,40)
    const next = manifold({ x: 100, y: 0 }, 400); // outlet → (150,40)
    const connectedPipe = pipe('p1', { x: 50, y: 40 }, { x: 1000, y: 40 });

    const ghosts = buildConnectedPipeGhosts([prev, connectedPipe], prev, next);

    expect(ghosts).toHaveLength(1);
    // Endpoint followed the moved connector.
    expect(ghosts[0]!.params.startPoint).toMatchObject({ x: 150, y: 40 });
    expect(ghosts[0]!.params.endPoint).toMatchObject({ x: 1000, y: 40 });
    // Geometry was recomputed (present, and not the stale original reference).
    expect(ghosts[0]!.geometry).toBeDefined();
    expect(ghosts[0]!.geometry).not.toBe(connectedPipe.geometry);
  });

  it('returns [] for a non-plumbing host', () => {
    expect(buildConnectedPipeGhosts([wall(), pipe('p1', { x: 0, y: 0 }, { x: 10, y: 0 })], wall(), wall())).toEqual([]);
  });

  it('returns [] when no pipe is snapped to the host', () => {
    const prev = manifold({ x: 0, y: 0 }, 400);
    const next = manifold({ x: 100, y: 0 }, 400);
    const farPipe = pipe('p2', { x: 5000, y: 0 }, { x: 6000, y: 0 });

    expect(buildConnectedPipeGhosts([prev, farPipe], prev, next)).toEqual([]);
  });
});
