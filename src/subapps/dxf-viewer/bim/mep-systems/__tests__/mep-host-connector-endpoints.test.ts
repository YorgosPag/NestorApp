/**
 * ADR-408 Φ-B2b EXT #2 — collectHostConnectorEndpoints tests.
 *
 * Verifies the pure point-host connector collector: world position (with rotation),
 * unit-aware elevation (`zScene`), domain filtering (only pipe connectors), and
 * determinism. These endpoints feed `derivePipeJunctions` so a pipe end at a
 * manifold outlet becomes a host node (no spurious cap).
 */

import type { Entity } from '../../../types/entities';
import { collectHostConnectorEndpoints } from '../mep-host-connector-endpoints';

interface ConnectorSpec {
  readonly connectorId: string;
  readonly domain: 'pipe' | 'electrical';
  readonly local: [number, number, number?];
  readonly diameterMm?: number;
}

/** A plumbing manifold fixture with arbitrary connectors. */
const manifold = (
  id: string,
  at: [number, number],
  connectors: ConnectorSpec[],
  opts: { rotation?: number; mountingElevationMm?: number; sceneUnits?: string } = {},
): Entity =>
  ({
    id,
    type: 'mep-manifold',
    params: {
      position: { x: at[0], y: at[1], z: 0 },
      rotation: opts.rotation ?? 0,
      mountingElevationMm: opts.mountingElevationMm ?? 0,
      sceneUnits: opts.sceneUnits ?? 'mm',
      connectors: connectors.map((c) => ({
        connectorId: c.connectorId,
        domain: c.domain,
        flow: c.domain === 'pipe' ? 'out' : 'in',
        localPosition: { x: c.local[0], y: c.local[1], z: c.local[2] ?? 0 },
        ...(c.domain === 'pipe'
          ? { pipe: { systemClassification: 'domestic-cold-water', diameterMm: c.diameterMm ?? 50 } }
          : { electrical: { systemClassification: 'lighting' } }),
      })),
    },
  } as unknown as Entity);

/** A bare pipe segment (a non-point-host entity — must be ignored). */
const seg = (id: string): Entity =>
  ({
    id,
    type: 'mep-segment',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 100, y: 0, z: 0 },
      diameter: 50,
      centerlineElevationMm: 0,
    },
  } as unknown as Entity);

describe('collectHostConnectorEndpoints', () => {
  it('returns [] when there are no point hosts', () => {
    expect(collectHostConnectorEndpoints([])).toEqual([]);
    expect(collectHostConnectorEndpoints([seg('p1')])).toEqual([]);
  });

  it('resolves a manifold outlet to its world position + elevation', () => {
    const eps = collectHostConnectorEndpoints([
      manifold('mfld-1', [100, 50], [{ connectorId: 'm-out-0', domain: 'pipe', local: [10, 0], diameterMm: 32 }], {
        mountingElevationMm: 300,
      }),
    ]);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({
      entityId: 'mfld-1',
      connectorId: 'm-out-0',
      diameterMm: 32,
      elevationMm: 300,
    });
    // local (10,0) at the host origin (100,50), rotation 0 → world (110,50).
    expect(eps[0]!.point.x).toBeCloseTo(110, 5);
    expect(eps[0]!.point.y).toBeCloseTo(50, 5);
    // mm scene → zScene == elevationMm.
    expect(eps[0]!.zScene).toBeCloseTo(300, 5);
  });

  it('rotates the connector offset by the host rotation', () => {
    const eps = collectHostConnectorEndpoints([
      manifold('mfld-1', [0, 0], [{ connectorId: 'm-out-0', domain: 'pipe', local: [10, 0] }], {
        rotation: 90,
      }),
    ]);
    // (10,0) rotated 90° CCW about origin → (0,10).
    expect(eps[0]!.point.x).toBeCloseTo(0, 5);
    expect(eps[0]!.point.y).toBeCloseTo(10, 5);
  });

  it('scales elevation to canvas units in a metre scene', () => {
    const eps = collectHostConnectorEndpoints([
      manifold('mfld-1', [0, 0], [{ connectorId: 'm-out-0', domain: 'pipe', local: [0, 0] }], {
        mountingElevationMm: 1000,
        sceneUnits: 'm',
      }),
    ]);
    // 1000mm → 1 metre-unit.
    expect(eps[0]!.zScene).toBeCloseTo(1, 5);
  });

  it('emits one endpoint per pipe connector, ignoring electrical connectors', () => {
    const eps = collectHostConnectorEndpoints([
      manifold('mfld-1', [0, 0], [
        { connectorId: 'm-out-0', domain: 'pipe', local: [0, 0] },
        { connectorId: 'm-out-1', domain: 'pipe', local: [10, 0] },
        { connectorId: 'c-power', domain: 'electrical', local: [0, 10] },
      ]),
    ]);
    expect(eps.map((e) => e.connectorId)).toEqual(['m-out-0', 'm-out-1']);
  });

  it('is deterministic — sorted by (entityId, connectorId)', () => {
    const a = collectHostConnectorEndpoints([
      manifold('b', [0, 0], [{ connectorId: 'm-out-1', domain: 'pipe', local: [0, 0] }]),
      manifold('a', [5, 0], [{ connectorId: 'm-out-0', domain: 'pipe', local: [0, 0] }]),
    ]);
    expect(a.map((e) => `${e.entityId}:${e.connectorId}`)).toEqual(['a:m-out-0', 'b:m-out-1']);
  });
});
