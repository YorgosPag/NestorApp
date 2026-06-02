/**
 * ADR-363 Φ2 — beam I-shape volume (steel cross-section × length, ΟΧΙ bbox).
 */

import { computeBeamGeometry } from '../beam-geometry';
import { iShapeCrossSectionAreaMm2 } from '../shared/i-shape-profile';
import type { BeamParams } from '../../types/beam-types';

const baseParams: BeamParams = {
  kind: 'straight',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4, y: 0, z: 0 }, // 4m (sceneUnits='m')
  width: 200,
  depth: 400,
  topElevation: 3000,
  sceneUnits: 'm',
};

describe('computeBeamGeometry — I-shape volume', () => {
  it('uses the real I-section area × length (not width×depth×length)', () => {
    const params: BeamParams = {
      ...baseParams,
      sectionKind: 'I-shape',
      ishape: { flangeThickness: 20, webThickness: 15 },
    };
    const geo = computeBeamGeometry(params);
    const areaM2 = iShapeCrossSectionAreaMm2(200, 400, 20, 15) * 1e-6; // 13400mm² → 0.0134 m²
    expect(geo.volume).toBeCloseTo(areaM2 * 4, 6); // × 4m length
  });

  it('is strictly smaller than the bounding-box (rectangular) volume', () => {
    const iGeo = computeBeamGeometry({
      ...baseParams,
      sectionKind: 'I-shape',
      ishape: { flangeThickness: 20, webThickness: 15 },
    });
    const rcGeo = computeBeamGeometry(baseParams); // rectangular default
    expect(iGeo.volume).toBeLessThan(rcGeo.volume);
    expect(rcGeo.volume).toBeCloseTo(0.2 * 0.4 * 4, 6); // 0.32 m³
  });

  it('keeps rectangular volume unchanged when sectionKind absent (back-compat)', () => {
    const geo = computeBeamGeometry(baseParams);
    expect(geo.volume).toBeCloseTo(0.32, 6);
  });
});
