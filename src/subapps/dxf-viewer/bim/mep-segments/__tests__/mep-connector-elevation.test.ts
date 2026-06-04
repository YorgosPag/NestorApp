/**
 * ADR-408 Φ-B1 — connector-mate elevation resolver tests.
 *
 * `resolveMepConnectorElevationMmAt` recovers the TRUE 3D elevation (mm) of the
 * MEP connector a snap landed on, so a `mep-segment` endpoint can inherit it. The
 * elevation source differs per host: a segment reports the matched endpoint's own
 * z (per-endpoint, Φ-A); a manifold/fixture reports its `mountingElevationMm`
 * datum (NOT `position.z`, which stays 0).
 */

import { resolveMepConnectorElevationMmAt } from '../mep-connector-elevation';
import type { Entity } from '../../../types/entities';

const segment = (): Entity =>
  ({
    id: 'seg-1',
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: 0, y: 0, z: 0 }, // floor
      endPoint: { x: 1000, y: 0, z: 2800 }, // ceiling
      diameter: 50,
      centerlineElevationMm: 1400,
    },
  } as unknown as Entity);

const manifold = (): Entity =>
  ({
    id: 'mfld-1',
    type: 'mep-manifold',
    kind: 'floor-manifold',
    params: {
      position: { x: 0, y: 0, z: 0 }, // position.z is NOT the datum
      rotation: 0,
      mountingElevationMm: 400, // the real outlet elevation
      connectors: [
        { connectorId: 'm-in', domain: 'pipe', flow: 'in', localPosition: { x: -200, y: 0, z: 0 } },
        { connectorId: 'm-out-0', domain: 'pipe', flow: 'out', localPosition: { x: 50, y: 40, z: 0 } },
      ],
    },
  } as unknown as Entity);

const fixture = (): Entity =>
  ({
    id: 'fix-1',
    type: 'mep-fixture',
    kind: 'light',
    params: {
      position: { x: 500, y: 500, z: 0 },
      rotation: 0,
      mountingElevationMm: 2700,
      connectors: [{ connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0, z: 0 } }],
    },
  } as unknown as Entity);

const panel = (): Entity =>
  ({ id: 'pnl-1', type: 'electrical-panel', kind: 'panel', params: { position: { x: 0, y: 0, z: 0 } } } as unknown as Entity);

describe('resolveMepConnectorElevationMmAt', () => {
  it('segment start endpoint → its own elevation (floor, 0)', () => {
    expect(resolveMepConnectorElevationMmAt(segment(), 0, 0)).toBe(0);
  });

  it('segment end endpoint → its own elevation (ceiling, 2800)', () => {
    expect(resolveMepConnectorElevationMmAt(segment(), 1000, 0)).toBe(2800);
  });

  it('manifold outlet → mountingElevationMm (400), NOT position.z (0)', () => {
    expect(resolveMepConnectorElevationMmAt(manifold(), 50, 40)).toBe(400);
  });

  it('manifold inlet → mountingElevationMm (400)', () => {
    expect(resolveMepConnectorElevationMmAt(manifold(), -200, 0)).toBe(400);
  });

  it('fixture connector → mountingElevationMm (2700)', () => {
    expect(resolveMepConnectorElevationMmAt(fixture(), 500, 500)).toBe(2700);
  });

  it('electrical panel → null (pipes do not connect to it)', () => {
    expect(resolveMepConnectorElevationMmAt(panel(), 0, 0)).toBeNull();
  });

  it('non-MEP host → null', () => {
    const wall = { id: 'w', type: 'wall', params: {} } as unknown as Entity;
    expect(resolveMepConnectorElevationMmAt(wall, 0, 0)).toBeNull();
  });
});
