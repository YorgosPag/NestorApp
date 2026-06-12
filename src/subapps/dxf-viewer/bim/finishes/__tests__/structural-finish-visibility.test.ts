/**
 * ADR-449 Slice 5 — master view gate «Σοβατισμένη όψη» (showFinishSkin).
 *
 * Επαληθεύει: default ON· setShowFinishSkin(false) → gate false· (true) → gate true.
 * Ο gate διαβάζεται event-time και από 2D orchestrator και από 3D converter.
 */

import { isStructuralFinishVisible } from '../structural-finish-visibility';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';

describe('ADR-449 Slice 5 — isStructuralFinishVisible', () => {
  afterEach(() => {
    // Επαναφορά στο default (ON) ώστε να μην διαρρέει state σε άλλα suites.
    useBimRenderSettingsStore.getState().setShowFinishSkin(true);
  });

  it('default → ορατός (true)', () => {
    expect(isStructuralFinishVisible()).toBe(true);
  });

  it('setShowFinishSkin(false) → gate false', () => {
    useBimRenderSettingsStore.getState().setShowFinishSkin(false);
    expect(isStructuralFinishVisible()).toBe(false);
  });

  it('setShowFinishSkin(true) → gate true ξανά', () => {
    useBimRenderSettingsStore.getState().setShowFinishSkin(false);
    useBimRenderSettingsStore.getState().setShowFinishSkin(true);
    expect(isStructuralFinishVisible()).toBe(true);
  });
});
