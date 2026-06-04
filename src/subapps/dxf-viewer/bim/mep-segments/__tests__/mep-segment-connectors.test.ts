/**
 * ADR-408 Φ9 — segment endpoint connector world-position resolver tests.
 *
 * A linear segment has no host transform: `startPoint`/`endPoint` ARE its
 * transform, so the endpoint connectors resolve directly from those points
 * (NOT via the point-host `connectorWorldPosition`). `z` carries the centreline
 * elevation (mm).
 */

import { segmentConnectorWorldPosition } from '../mep-segment-connectors';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import type { MepSegmentParams } from '../../types/mep-segment-types';

const params = (): MepSegmentParams =>
  ({
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 10, y: 20, z: 0 },
    endPoint: { x: 110, y: 20, z: 0 },
    centerlineElevationMm: 2500,
  } as unknown as MepSegmentParams);

describe('segmentConnectorWorldPosition', () => {
  it('resolves seg-start from startPoint, z = centreline elevation', () => {
    expect(segmentConnectorWorldPosition(SEGMENT_START_CONNECTOR_ID, params())).toEqual({
      x: 10,
      y: 20,
      z: 2500,
    });
  });

  it('resolves seg-end from endPoint, z = centreline elevation', () => {
    expect(segmentConnectorWorldPosition(SEGMENT_END_CONNECTOR_ID, params())).toEqual({
      x: 110,
      y: 20,
      z: 2500,
    });
  });

  it('returns null for an unknown connector id', () => {
    expect(segmentConnectorWorldPosition('c1', params())).toBeNull();
  });

  // ── ADR-408 Φ-A: per-endpoint elevation (sloped run / riser) ──────────────
  describe('per-endpoint elevation (riser)', () => {
    const riser = (): MepSegmentParams =>
      ({
        domain: 'pipe',
        sectionKind: 'round',
        startPoint: { x: 10, y: 20, z: 0 }, // start at floor
        endPoint: { x: 110, y: 20, z: 2800 }, // end at ceiling
        centerlineElevationMm: 1400, // derived midpoint
      } as unknown as MepSegmentParams);

    it('seg-start reports the start endpoint own z (floor), not the centreline', () => {
      expect(segmentConnectorWorldPosition(SEGMENT_START_CONNECTOR_ID, riser())).toEqual({
        x: 10,
        y: 20,
        z: 0,
      });
    });

    it('seg-end reports the end endpoint own z (ceiling), not the centreline', () => {
      expect(segmentConnectorWorldPosition(SEGMENT_END_CONNECTOR_ID, riser())).toEqual({
        x: 110,
        y: 20,
        z: 2800,
      });
    });
  });
});
