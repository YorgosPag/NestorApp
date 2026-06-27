/**
 * ADR-539 Φ3e — top-face → 2D plan fill SSoT tests (+ shared color resolution).
 */

import { topFacePlanFill } from '../bim-face-plan-fill';
import { faceAppearanceColorHex } from '../face-appearance-color';

describe('faceAppearanceColorHex (ADR-539 color SSoT)', () => {
  it('returns colorHex when set (wins over materialId)', () => {
    expect(faceAppearanceColorHex({ colorHex: '#abc123' })).toBe('#abc123');
    expect(faceAppearanceColorHex({ colorHex: '#abc123', materialId: 'paint-red' })).toBe('#abc123');
  });

  it('returns null when neither colorHex nor materialId is set', () => {
    expect(faceAppearanceColorHex({})).toBeNull();
  });

  it('resolves a catalog materialId to a hex', () => {
    const hex = faceAppearanceColorHex({ materialId: 'paint-red' });
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('topFacePlanFill (ADR-539 Φ3e)', () => {
  it('returns null when the entity has no faceAppearance', () => {
    expect(topFacePlanFill({})).toBeNull();
  });

  it('returns null when faceAppearance has no `top` face painted', () => {
    expect(topFacePlanFill({ faceAppearance: {} })).toBeNull();
    expect(topFacePlanFill({ faceAppearance: { 'side:0': { colorHex: '#ffffff' } } })).toBeNull();
  });

  it('returns a translucent rgba fill from the painted top face', () => {
    const fill = topFacePlanFill({ faceAppearance: { top: { colorHex: '#C0392B' } } });
    expect(fill).not.toBeNull();
    expect(fill).toMatch(/^rgba?\(/);
  });

  it('different top colours yield different fills', () => {
    const a = topFacePlanFill({ faceAppearance: { top: { colorHex: '#C0392B' } } });
    const b = topFacePlanFill({ faceAppearance: { top: { colorHex: '#123456' } } });
    expect(a).not.toBe(b);
  });

  it('falls back to the base "*" paint when there is no explicit top (Φ4b «βάψε όλο»)', () => {
    const fill = topFacePlanFill({ faceAppearance: { '*': { colorHex: '#C0392B' } } });
    expect(fill).not.toBeNull();
    expect(fill).toMatch(/^rgba?\(/);
  });

  it('an explicit top paint wins over the base "*"', () => {
    const base = topFacePlanFill({ faceAppearance: { '*': { colorHex: '#111111' } } });
    const top = topFacePlanFill({ faceAppearance: { '*': { colorHex: '#111111' }, top: { colorHex: '#C0392B' } } });
    expect(top).not.toBe(base);
  });
});
