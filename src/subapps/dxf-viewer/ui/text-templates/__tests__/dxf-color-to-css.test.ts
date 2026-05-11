/**
 * ADR-344 Phase 7.D — Colour mapping smoke tests.
 */
import { dxfColorToCss } from '../preview/dxf-color-to-css';

describe('dxfColorToCss', () => {
  it('returns inherit for ByLayer / ByBlock', () => {
    expect(dxfColorToCss({ kind: 'ByLayer' }, '#abcabc')).toBe('#abcabc');
    expect(dxfColorToCss({ kind: 'ByBlock' }, '#abcabc')).toBe('#abcabc');
  });

  it('maps known ACI indices to their palette entries', () => {
    expect(dxfColorToCss({ kind: 'ACI', index: 1 })).toBe('#ff0000');
    expect(dxfColorToCss({ kind: 'ACI', index: 5 })).toBe('#0000ff');
  });

  it('falls back to inherit for unknown ACI', () => {
    expect(dxfColorToCss({ kind: 'ACI', index: 200 }, '#123456')).toBe('#123456');
  });

  it('serializes TrueColor as rgb()', () => {
    expect(dxfColorToCss({ kind: 'TrueColor', r: 10, g: 20, b: 30 })).toBe('rgb(10, 20, 30)');
  });
});
