/**
 * ADR-398 §Column→Beam axis snap — `beam-axis-projection` SSoT (pure).
 *
 * Επαληθεύει: clamped nearest foot στον centerline (mirror `projectPointOnWallAxis`)·
 * `distance` (κάθετη)· `atEndpoint` flag (cursor πέρα από το μέλος)· curved (tessellated
 * axisPolyline)· defensive null. Fixtures: canvas = mm.
 */

import {
  projectPointOnBeamAxis,
  projectPointOnBeamAxisDetailed,
} from '../beam-axis-projection';
import type { BeamEntity } from '../../types/beam-types';

function beam(points: Array<{ x: number; y: number }>): BeamEntity {
  return {
    id: 'b1', type: 'beam', kind: 'straight',
    params: { kind: 'straight', width: 250, sceneUnits: 'mm' },
    geometry: { axisPolyline: { points: points.map((p) => ({ ...p, z: 0 })) } },
  } as unknown as BeamEntity;
}

describe('projectPointOnBeamAxis — clamped nearest', () => {
  it('cursor δίπλα στον άξονα → foot στον centerline (κάθετη προβολή)', () => {
    const p = projectPointOnBeamAxis(beam([{ x: 0, y: 0 }, { x: 10000, y: 0 }]), { x: 4000, y: 120 });
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(4000, 6);
    expect(p!.y).toBeCloseTo(0, 6);
  });

  it('cursor πέρα από το άκρο → foot clamped στο endpoint (όχι προέκταση)', () => {
    const p = projectPointOnBeamAxis(beam([{ x: 0, y: 0 }, { x: 10000, y: 0 }]), { x: 12000, y: 0 });
    expect(p!.x).toBeCloseTo(10000, 6);
  });

  it('λείπει axisPolyline → null (defensive)', () => {
    const degenerate = { id: 'b', type: 'beam', params: {}, geometry: {} } as unknown as BeamEntity;
    expect(projectPointOnBeamAxis(degenerate, { x: 0, y: 0 })).toBeNull();
  });
});

describe('projectPointOnBeamAxisDetailed — distance + atEndpoint', () => {
  it('εντός segment → distance = κάθετη, atEndpoint false', () => {
    const d = projectPointOnBeamAxisDetailed(beam([{ x: 0, y: 0 }, { x: 10000, y: 0 }]), { x: 4000, y: 90 });
    expect(d!.distance).toBeCloseTo(90, 6);
    expect(d!.atEndpoint).toBe(false);
  });

  it('πέρα από το άκρο → atEndpoint true', () => {
    const d = projectPointOnBeamAxisDetailed(beam([{ x: 0, y: 0 }, { x: 10000, y: 0 }]), { x: 11000, y: 0 });
    expect(d!.atEndpoint).toBe(true);
  });

  it('curved (tessellated polyline) → foot στο πλησιέστερο segment', () => {
    // L-shaped tessellation: (0,0)→(5000,0)→(5000,5000)
    const d = projectPointOnBeamAxisDetailed(
      beam([{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }]),
      { x: 5100, y: 2500 },
    );
    expect(d!.foot.x).toBeCloseTo(5000, 0);
    expect(d!.foot.y).toBeCloseTo(2500, 0);
    expect(d!.atEndpoint).toBe(false);
  });
});
