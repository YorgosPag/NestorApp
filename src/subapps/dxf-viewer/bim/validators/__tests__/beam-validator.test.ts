/**
 * ADR-363 Phase 5 — beam-validator unit tests.
 *
 * Coverage:
 *   - hard errors: width/depth ≤ 0, length < MIN_BEAM_LENGTH_MM, degenerate axis,
 *     curved without curveControl
 *   - code violations: width < MIN_BEAM_WIDTH_MM (Eurocode), span/depth > 20,
 *     cantilever-specific halved threshold (> 10)
 *   - happy path: zero hardErrors, no codeViolations
 */

import { validateBeamParams } from '../beam-validator';
import type { BeamParams } from '../../types/beam-types';

const goodBase: BeamParams = {
  kind: 'straight',
  startPoint: { x: 0, y: 0, z: 0 },
  endPoint: { x: 4000, y: 0, z: 0 },
  width: 250,
  depth: 500,
  elevation: 3000,
  supportType: 'simple',
};

describe('validateBeamParams — hard errors', () => {
  test('width ≤ 0', () => {
    const r = validateBeamParams({ ...goodBase, width: 0 });
    expect(r.hardErrors).toContain('beam.validation.hardErrors.nonPositiveWidth');
  });

  test('depth ≤ 0', () => {
    const r = validateBeamParams({ ...goodBase, depth: -100 });
    expect(r.hardErrors).toContain('beam.validation.hardErrors.nonPositiveDepth');
  });

  test('length too short (degenerate axis)', () => {
    const r = validateBeamParams({
      ...goodBase,
      endPoint: { x: 100, y: 0, z: 0 },
    });
    expect(r.hardErrors).toContain('beam.validation.hardErrors.lengthTooShort');
  });

  test('curved without curveControl', () => {
    const r = validateBeamParams({ ...goodBase, kind: 'curved' });
    expect(r.hardErrors).toContain('beam.validation.hardErrors.missingCurveControl');
  });
});

describe('validateBeamParams — code violations', () => {
  test('widthTooSmall < MIN_BEAM_WIDTH_MM (Eurocode 150mm)', () => {
    const r = validateBeamParams({ ...goodBase, width: 120 });
    expect(r.codeViolations).toContain('beam.validation.codeViolations.widthTooSmall');
  });

  test('spanDepthExceeded > 20 for straight beam', () => {
    // 10m span / 0.4m depth = 25 > 20
    const r = validateBeamParams({
      ...goodBase,
      endPoint: { x: 10000, y: 0, z: 0 },
      depth: 400,
    });
    expect(r.codeViolations).toContain('beam.validation.codeViolations.spanDepthExceeded');
  });

  test('cantileverSpanDepthExceeded > 10 for cantilever', () => {
    // 6m / 0.5m = 12 > 10 (cantilever halved threshold)
    const r = validateBeamParams({
      ...goodBase,
      kind: 'cantilever',
      supportType: 'cantilever',
      endPoint: { x: 6000, y: 0, z: 0 },
      depth: 500,
    });
    expect(r.codeViolations).toContain('beam.validation.codeViolations.cantileverSpanDepthExceeded');
  });
});

describe('validateBeamParams — happy path', () => {
  test('no hard errors, no code violations', () => {
    const r = validateBeamParams(goodBase);
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0);
    expect(r.bimValidation.hasCodeViolations).toBe(false);
  });
});
