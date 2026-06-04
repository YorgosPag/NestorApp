/**
 * ADR-408 Φ-A — per-endpoint elevation SSoT resolver tests.
 *
 * `resolveSegmentEndpointElevationsMm` is the single source of truth for a
 * segment's two endpoint elevations. The authoritative input is
 * `startPoint.z`/`endPoint.z` (mm); `centerlineElevationMm` is the derived
 * back-compat midpoint. The resolver self-heals legacy/horizontal docs (both ends
 * at z=0 ⇒ the centreline is the single elevation) WITHOUT corrupting a riser
 * whose start sits at floor (z=0, end≠0).
 */

import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
  isSegmentInclined,
} from '../../types/mep-segment-types';
import type { MepSegmentParams } from '../../types/mep-segment-types';

const make = (
  startZ: number | undefined,
  endZ: number | undefined,
  centerlineElevationMm: number,
): MepSegmentParams =>
  ({
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, ...(startZ !== undefined ? { z: startZ } : {}) },
    endPoint: { x: 100, y: 0, ...(endZ !== undefined ? { z: endZ } : {}) },
    centerlineElevationMm,
  } as unknown as MepSegmentParams);

describe('resolveSegmentEndpointElevationsMm', () => {
  it('legacy horizontal (both z=0, centreline≠0) ⇒ both ends lift to the centreline', () => {
    expect(resolveSegmentEndpointElevationsMm(make(0, 0, 2800))).toEqual({
      startMm: 2800,
      endMm: 2800,
    });
  });

  it('legacy horizontal with z undefined ⇒ both ends lift to the centreline', () => {
    expect(resolveSegmentEndpointElevationsMm(make(undefined, undefined, 1500))).toEqual({
      startMm: 1500,
      endMm: 1500,
    });
  });

  it('new horizontal at floor (both z=0, centreline=0) ⇒ stays at floor (no-op)', () => {
    expect(resolveSegmentEndpointElevationsMm(make(0, 0, 0))).toEqual({
      startMm: 0,
      endMm: 0,
    });
  });

  it('riser from floor (start z=0) to ceiling (end z=2800) ⇒ NOT re-migrated', () => {
    expect(resolveSegmentEndpointElevationsMm(make(0, 2800, 1400))).toEqual({
      startMm: 0,
      endMm: 2800,
    });
  });

  it('downward slope (start z=2800, end z=0) ⇒ each end keeps its own z', () => {
    expect(resolveSegmentEndpointElevationsMm(make(2800, 0, 1400))).toEqual({
      startMm: 2800,
      endMm: 0,
    });
  });

  it('partial: one end set (z=500), other undefined ⇒ undefined falls back to centreline', () => {
    expect(resolveSegmentEndpointElevationsMm(make(500, undefined, 1000))).toEqual({
      startMm: 500,
      endMm: 1000,
    });
  });

  it('is idempotent — feeding the resolved values back yields the same result', () => {
    const first = resolveSegmentEndpointElevationsMm(make(0, 2800, 1400));
    const round2 = resolveSegmentEndpointElevationsMm(
      make(first.startMm, first.endMm, deriveCenterlineElevationMm(first.startMm, first.endMm)),
    );
    // start=0 falls into the "both-unset?" check (start=0) but end≠0 ⇒ second branch.
    expect(round2).toEqual({ startMm: 0, endMm: 2800 });
  });
});

describe('deriveCenterlineElevationMm', () => {
  it('returns the midpoint of the two endpoint elevations', () => {
    expect(deriveCenterlineElevationMm(0, 2800)).toBe(1400);
    expect(deriveCenterlineElevationMm(2800, 2800)).toBe(2800);
  });
});

describe('isSegmentInclined', () => {
  it('false for a horizontal run', () => {
    expect(isSegmentInclined(make(2800, 2800, 2800))).toBe(false);
  });

  it('true for a riser', () => {
    expect(isSegmentInclined(make(0, 2800, 1400))).toBe(true);
  });

  it('false for sub-millimetre noise', () => {
    expect(isSegmentInclined(make(2800, 2800.5, 2800.25))).toBe(false);
  });
});
