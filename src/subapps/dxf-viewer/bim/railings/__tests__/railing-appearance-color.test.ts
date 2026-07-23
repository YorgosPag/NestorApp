/**
 * ADR-407 Φ8 — `railingComponentColorHex` 2D plan color cascade (per-component → whole → null).
 * Αδελφό του 3D `resolveRailingMaterial`· ίδια προτεραιότητα, επιστρέφει CSS hex για τον 2D renderer.
 */

import { railingComponentColorHex } from '../railing-appearance-color';
import type { RailingParams } from '../../types/railing-types';

const p = (params: Partial<RailingParams>): RailingParams => params as RailingParams;

describe('railingComponentColorHex', () => {
  it('χωρίς appearance → null (default palette)', () => {
    expect(railingComponentColorHex(p({}), 'post')).toBeNull();
  });

  it('whole-railing appearance colorHex → όλα τα components', () => {
    const params = p({ appearance: { colorHex: '#654321' } });
    expect(railingComponentColorHex(params, 'post')).toBe('#654321');
    expect(railingComponentColorHex(params, 'baluster')).toBe('#654321');
    expect(railingComponentColorHex(params, 'rail')).toBe('#654321');
  });

  it('per-component colorHex ΚΕΡΔΙΖΕΙ της whole-railing στο ίδιο component', () => {
    const params = p({
      appearance: { colorHex: '#654321' },
      componentAppearance: { rail: { colorHex: '#C0392B' } },
    });
    expect(railingComponentColorHex(params, 'rail')).toBe('#C0392B');
    expect(railingComponentColorHex(params, 'post')).toBe('#654321');
  });

  it('component χωρίς πηγή χρώματος ({}) → πέφτει στο whole', () => {
    const params = p({ appearance: { colorHex: '#111' }, componentAppearance: { post: {} } });
    expect(railingComponentColorHex(params, 'post')).toBe('#111');
  });
});
