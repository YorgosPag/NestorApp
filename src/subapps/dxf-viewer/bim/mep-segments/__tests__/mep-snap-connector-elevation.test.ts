/**
 * ADR-408 Φ-B1 (SSoT) — `resolveSnapConnectorElevationMm` tests.
 *
 * The shared helper turns a connector snap candidate into the elevation (mm) its
 * endpoint inherits, delegating the per-host resolution to
 * `resolveMepConnectorElevationMmAt`. It guards: non-connector snap, missing
 * entityId, host-not-found → all return null so the caller falls back to the
 * centreline default. Used by BOTH the 2D cursor pipeline and the 3D placement hook.
 */

import { ExtendedSnapType } from '../../../snapping/extended-types';
import type { Entity } from '../../../types/entities';

const mockResolveAt = jest.fn(() => 1234);
jest.mock('../mep-connector-elevation', () => ({
  resolveMepConnectorElevationMmAt: (...a: unknown[]) => mockResolveAt(...(a as [])),
}));

import { resolveSnapConnectorElevationMm } from '../mep-snap-connector-elevation';

const host = { id: 'h1', type: 'mep-manifold' } as unknown as Entity;
const findHost = (id: string): Entity | undefined => (id === 'h1' ? host : undefined);

describe('resolveSnapConnectorElevationMm', () => {
  beforeEach(() => mockResolveAt.mockClear());

  it('returns the resolved elevation for a connector snap with a known host', () => {
    const z = resolveSnapConnectorElevationMm(
      { type: ExtendedSnapType.BIM_MEP_CONNECTOR, entityId: 'h1' },
      10,
      20,
      findHost,
    );
    expect(z).toBe(1234);
    expect(mockResolveAt).toHaveBeenCalledWith(host, 10, 20);
  });

  it('returns null for a non-connector snap type (and never resolves)', () => {
    const z = resolveSnapConnectorElevationMm(
      { type: ExtendedSnapType.ENDPOINT, entityId: 'h1' },
      10,
      20,
      findHost,
    );
    expect(z).toBeNull();
    expect(mockResolveAt).not.toHaveBeenCalled();
  });

  it('returns null for a null / undefined candidate', () => {
    expect(resolveSnapConnectorElevationMm(null, 0, 0, findHost)).toBeNull();
    expect(resolveSnapConnectorElevationMm(undefined, 0, 0, findHost)).toBeNull();
    expect(mockResolveAt).not.toHaveBeenCalled();
  });

  it('returns null when the candidate carries no entityId', () => {
    const z = resolveSnapConnectorElevationMm(
      { type: ExtendedSnapType.BIM_MEP_CONNECTOR },
      0,
      0,
      findHost,
    );
    expect(z).toBeNull();
    expect(mockResolveAt).not.toHaveBeenCalled();
  });

  it('returns null when the host is not found (and never resolves)', () => {
    const z = resolveSnapConnectorElevationMm(
      { type: ExtendedSnapType.BIM_MEP_CONNECTOR, entityId: 'missing' },
      0,
      0,
      findHost,
    );
    expect(z).toBeNull();
    expect(mockResolveAt).not.toHaveBeenCalled();
  });
});
