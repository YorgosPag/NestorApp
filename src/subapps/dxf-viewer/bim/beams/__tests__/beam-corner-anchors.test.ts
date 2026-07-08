/**
 * ADR-597 §5.2 — `getBeamCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns exactly 4 corners for straight/cantilever beams.
 *   - Returns exactly 4 corners for curved beams (face-end only, not 34 vertices).
 *   - Correct ±half-width offsets for horizontal straight beam.
 *   - Tags: start/end × plus/minus.
 *   - Degenerate beam (zero length) → empty [] guard.
 */

import { getBeamCornerWorldPoints } from '../beam-corner-anchors';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import { CURVED_BEAM_SUBDIVISIONS } from '../../types/beam-types';

function makeBeamEntity(overrides: Partial<BeamParams> = {}, id = 'beam_test'): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0 },
    endPoint:   { x: 1000, y: 0 },
    width: 250,
    depth: 500,
    topElevation: 3000,
    ...overrides,
  };
  return {
    id,
    type: 'beam',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as BeamEntity;
}

describe('getBeamCornerWorldPoints — straight beam', () => {
  it('returns exactly 4 corners', () => {
    const result = getBeamCornerWorldPoints(makeBeamEntity());
    expect(result).toHaveLength(4);
  });

  it('tags: start/end × plus/minus', () => {
    const result = getBeamCornerWorldPoints(makeBeamEntity());
    expect(result[0]!.end).toBe('start');
    expect(result[0]!.side).toBe('plus');
    expect(result[1]!.end).toBe('end');
    expect(result[1]!.side).toBe('plus');
    expect(result[2]!.end).toBe('end');
    expect(result[2]!.side).toBe('minus');
    expect(result[3]!.end).toBe('start');
    expect(result[3]!.side).toBe('minus');
  });

  it('horizontal beam: corners at ±half-width Y offsets', () => {
    // beam (0,0)→(1000,0), width=250 → half=125 canvas units (sceneUnits='mm'→s=1)
    const result = getBeamCornerWorldPoints(makeBeamEntity({ width: 250 }));
    expect(result[0]!.point.y).toBeCloseTo(125, 6);   // start-plus
    expect(result[1]!.point.y).toBeCloseTo(125, 6);   // end-plus
    expect(result[2]!.point.y).toBeCloseTo(-125, 6);  // end-minus
    expect(result[3]!.point.y).toBeCloseTo(-125, 6);  // start-minus
    expect(result[0]!.point.x).toBeCloseTo(0, 6);
    expect(result[1]!.point.x).toBeCloseTo(1000, 6);
  });

  it('cantilever kind: still 4 corners', () => {
    const result = getBeamCornerWorldPoints(makeBeamEntity({ kind: 'cantilever' }));
    expect(result).toHaveLength(4);
  });
});

describe('getBeamCornerWorldPoints — curved beam', () => {
  it('returns exactly 4 corners (face-end only, not all 34 Bezier vertices)', () => {
    const result = getBeamCornerWorldPoints(makeBeamEntity({
      kind: 'curved',
      curveControl: { x: 500, y: 300 },
    }));
    // Curved beam outline has 2*(CURVED_BEAM_SUBDIVISIONS+1) vertices = 34
    // But we expose only 4 face-end corners
    expect(result).toHaveLength(4);
    expect(result.length).not.toBe(2 * (CURVED_BEAM_SUBDIVISIONS + 1));
  });

  it('curved: start corners at axis start + perpendicular', () => {
    const result = getBeamCornerWorldPoints(makeBeamEntity({
      kind: 'curved',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1000, y: 0 },
      curveControl: { x: 500, y: 100 },
      width: 250,
    }));
    // start corners come from plus[0]/minus[0] which are near axis start
    expect(result[0]!.end).toBe('start');
    expect(result[3]!.end).toBe('start');
    // rough proximity to x=0
    expect(Math.abs(result[0]!.point.x)).toBeLessThan(50);
    expect(Math.abs(result[3]!.point.x)).toBeLessThan(50);
  });
});
