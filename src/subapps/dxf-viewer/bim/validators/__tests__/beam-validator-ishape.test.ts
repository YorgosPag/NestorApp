/**
 * ADR-363 Φ2 — beam I-shape validation (mirror column-validator).
 */

import { validateBeamParams } from '../beam-validator';
import type { BeamParams } from '../../types/beam-types';

function params(over: Partial<BeamParams>): BeamParams {
  return {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 4000, y: 0, z: 0 }, // valid length (mm scene)
    width: 200,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    sectionKind: 'I-shape',
    ...over,
  } as BeamParams;
}

describe('validateBeamParams — I-shape', () => {
  it('accepts a valid catalog-like I-shape (no I-shape hard errors)', () => {
    const r = validateBeamParams(params({ ishape: { flangeThickness: 10.7, webThickness: 7.1 } }));
    expect(r.hardErrors.filter((k) => k.includes('IShape'))).toHaveLength(0);
  });

  it('flags plate thickness below the 5mm minimum', () => {
    const r = validateBeamParams(params({ ishape: { flangeThickness: 3, webThickness: 7 } }));
    expect(r.hardErrors).toContain('beam.validation.hardErrors.invalidIShapePlateThickness');
  });

  it('flags flange overlap when 2·tf ≥ depth', () => {
    const r = validateBeamParams(params({ depth: 300, ishape: { flangeThickness: 200, webThickness: 7 } }));
    expect(r.hardErrors).toContain('beam.validation.hardErrors.invalidIShapeFlangeOverlap');
  });

  it('flags web overflow when tw ≥ width', () => {
    const r = validateBeamParams(params({ width: 200, ishape: { flangeThickness: 10, webThickness: 250 } }));
    expect(r.hardErrors).toContain('beam.validation.hardErrors.invalidIShapeWebOverflow');
  });

  it('does NOT run I-shape checks for rectangular beams (back-compat)', () => {
    const r = validateBeamParams(params({ sectionKind: 'rectangular', ishape: { flangeThickness: 1 } }));
    expect(r.hardErrors.filter((k) => k.includes('IShape'))).toHaveLength(0);
  });
});
