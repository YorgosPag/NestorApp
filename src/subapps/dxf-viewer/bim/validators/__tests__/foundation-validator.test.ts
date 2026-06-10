/**
 * ADR-436 Slice 1 — validateFoundationParams tests.
 */

import { validateFoundationParams } from '../foundation-validator';
import {
  buildDefaultFoundationParams,
  type PadFootingParams,
  type StripFootingParams,
} from '../../types/foundation-types';

const pad = (over: Partial<PadFootingParams> = {}): PadFootingParams => ({
  ...(buildDefaultFoundationParams('pad') as PadFootingParams),
  ...over,
});

describe('validateFoundationParams — hard errors', () => {
  it('flags non-positive width', () => {
    const r = validateFoundationParams(pad({ width: 0 }));
    expect(r.hardErrors).toContain('foundation.validation.hardErrors.nonPositiveWidth');
  });

  it('flags non-positive length (pad)', () => {
    const r = validateFoundationParams(pad({ length: -10 }));
    expect(r.hardErrors).toContain('foundation.validation.hardErrors.nonPositiveLength');
  });

  it('flags non-positive thickness', () => {
    const r = validateFoundationParams(pad({ thicknessMm: 0 }));
    expect(r.hardErrors).toContain('foundation.validation.hardErrors.nonPositiveThickness');
  });

  it('flags zero-length axis (strip)', () => {
    const strip: StripFootingParams = {
      ...(buildDefaultFoundationParams('strip') as StripFootingParams),
      start: { x: 5, y: 5, z: 0 },
      end: { x: 5, y: 5, z: 0 },
    };
    const r = validateFoundationParams(strip);
    expect(r.hardErrors).toContain('foundation.validation.hardErrors.zeroLengthAxis');
  });
});

describe('validateFoundationParams — code violations', () => {
  it('flags width below minimum (non-blocking)', () => {
    const r = validateFoundationParams(pad({ width: 50 }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toContain('foundation.validation.codeViolations.widthTooSmall');
    expect(r.bimValidation.hasCodeViolations).toBe(true);
  });

  it('accepts valid defaults with no errors/violations', () => {
    const r = validateFoundationParams(pad());
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0);
    expect(r.bimValidation.hasCodeViolations).toBe(false);
  });
});
