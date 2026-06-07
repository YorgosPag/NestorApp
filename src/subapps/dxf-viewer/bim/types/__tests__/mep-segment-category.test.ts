/**
 * ADR-408 Φ14 — a sanitary drainage pipe earns its OWN V/G category 'drain-pipe'
 * (so it toggles independently of water pipes) while staying domain:'pipe'. Pins
 * the `resolveSegmentBimCategory` SSoT used by both the 2D renderer and 3D sync.
 */

import { resolveSegmentBimCategory } from '../mep-segment-types';
import type { MepSegmentParams } from '../mep-segment-types';

function seg(overrides: Partial<MepSegmentParams> = {}): MepSegmentParams {
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    centerlineElevationMm: 0,
    diameter: 110,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('resolveSegmentBimCategory (ADR-408 Φ14)', () => {
  it('a drainage pipe → "drain-pipe"', () => {
    expect(resolveSegmentBimCategory(seg({ classification: 'sanitary-drainage' }))).toBe('drain-pipe');
  });

  it('a plain water pipe (no classification) → "pipe"', () => {
    expect(resolveSegmentBimCategory(seg())).toBe('pipe');
  });

  it('a water pipe with a non-drainage classification → "pipe"', () => {
    expect(resolveSegmentBimCategory(seg({ classification: 'domestic-cold-water' }))).toBe('pipe');
  });

  it('a duct → "duct" (classification ignored — drainage is pipe-only)', () => {
    expect(resolveSegmentBimCategory(seg({ domain: 'duct', sectionKind: 'rectangular', classification: 'sanitary-drainage' }))).toBe('duct');
  });
});
