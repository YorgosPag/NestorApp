/**
 * ADR-408 Φ14 — a sanitary-drainage fitting earns its OWN V/G category
 * 'drain-pipe' (so it toggles + hides together with the drainage pipes it joins)
 * while staying domain:'pipe'. Pins the `resolveFittingBimCategory` SSoT used by
 * both the 2D renderer and the 3D scene sync — mirror of mep-segment-category.test.
 */

import { resolveFittingBimCategory } from '../mep-fitting-types';
import type { MepFittingParams } from '../mep-fitting-types';

function fitting(overrides: Partial<MepFittingParams> = {}): MepFittingParams {
  return {
    domain: 'pipe',
    kind: 'elbow',
    junctionKey: '0:0',
    position: { x: 0, y: 0, z: 0 },
    centerlineElevationMm: 0,
    incidents: [],
    primaryDiameterMm: 110,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('resolveFittingBimCategory (ADR-408 Φ14)', () => {
  it('a drainage fitting → "drain-pipe"', () => {
    expect(resolveFittingBimCategory(fitting({ classification: 'sanitary-drainage' }))).toBe('drain-pipe');
  });

  it('a plain water fitting (no classification) → "pipe"', () => {
    expect(resolveFittingBimCategory(fitting())).toBe('pipe');
  });

  it('a water fitting with a non-drainage classification → "pipe"', () => {
    expect(resolveFittingBimCategory(fitting({ classification: 'domestic-cold-water' }))).toBe('pipe');
  });

  it('a duct fitting → "duct" (classification ignored — drainage is pipe-only)', () => {
    expect(resolveFittingBimCategory(fitting({ domain: 'duct', classification: 'sanitary-drainage' }))).toBe('duct');
  });
});
