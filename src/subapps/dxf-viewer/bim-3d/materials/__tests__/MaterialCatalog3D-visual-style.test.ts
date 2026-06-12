/**
 * ADR-446 — MaterialCatalog3D FACES axis (face mode variants) tests.
 *
 * The SOLE face-material factory must honour the current Visual Style face mode for
 * EVERY entry point: none → invisible, hidden-line → white occluder, consistent →
 * unlit, shaded/realistic → lit/textured (pass-through). Driven via the store's
 * `setVisualStyle` (the per-view SSoT).
 */

import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { getElementMaterial3D } from '../MaterialCatalog3D';

jest.mock('../../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

function setStyle(preset: Parameters<ReturnType<typeof useBimRenderSettingsStore.getState>['setVisualStyle']>[0]): void {
  useBimRenderSettingsStore.getState().setVisualStyle(preset);
}

afterAll(() => { setStyle('realistic-edges'); });

describe('ADR-446 — MaterialCatalog3D face mode variants', () => {
  it('faceMode none (Wireframe) → faces invisible (edges still render as children)', () => {
    setStyle('wireframe');
    expect(getElementMaterial3D('column').visible).toBe(false);
  });

  it('faceMode hidden-line → uniform white occluder', () => {
    setStyle('hidden-line');
    const mat = getElementMaterial3D('column');
    expect(mat.visible).toBe(true);
    expect(mat.color.getHex()).toBe(0xffffff);
    expect(mat.emissive.getHex()).toBe(0xffffff);
  });

  it('faceMode consistent → unlit (emissive carries the colour, base colour black)', () => {
    setStyle('consistent');
    const mat = getElementMaterial3D('column');
    expect(mat.color.getHex()).toBe(0x000000);
    expect(mat.emissiveIntensity).toBe(1);
    expect(mat.emissive.getHex()).not.toBe(0x000000); // the source colour moved to emissive
  });

  it('faceMode shaded → lit pass-through (visible, no emissive flooding, keeps polygon offset)', () => {
    setStyle('shaded');
    const mat = getElementMaterial3D('column');
    expect(mat.visible).toBe(true);
    expect(mat.emissive.getHex()).toBe(0x000000);
    expect(mat.polygonOffset).toBe(true); // ADR-375 shaded-with-edges depth bias preserved
  });

  it('faceMode realistic → pass-through keeps the depth-bias polygon offset', () => {
    setStyle('realistic');
    const mat = getElementMaterial3D('column');
    expect(mat.visible).toBe(true);
    expect(mat.polygonOffset).toBe(true);
  });
});
