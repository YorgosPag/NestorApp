/**
 * ADR-469 — Structural Component Visibility resolver (σώμα/σοβάς/οπλισμός).
 *
 * Επαληθεύει την Revit precedence: per-element override → per-view flag → default,
 * για τα 3 components, + ότι τα legacy aliases (isStructuralFinishVisible /
 * isReinforcementVisible) παραμένουν συνεπή.
 */

import { isStructuralComponentVisible } from '../structural-component-visibility';
import { isStructuralFinishVisible } from '../../finishes/structural-finish-visibility';
import { isReinforcementVisible } from '../../structural/reinforcement/rebar-visibility';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';

const show = (cv: Partial<Record<'core' | 'plaster' | 'reinforcement', boolean>>) =>
  ({ styleOverride: { componentVisibility: cv } });

describe('ADR-469 — isStructuralComponentVisible', () => {
  afterEach(() => {
    const s = useBimRenderSettingsStore.getState();
    s.setShowStructuralCore(true);
    s.setShowFinishSkin(true);
    s.setShowReinforcement(false);
  });

  describe('defaults (per-view, no element)', () => {
    it('core → ορατό', () => expect(isStructuralComponentVisible('core')).toBe(true));
    it('plaster → ορατό', () => expect(isStructuralComponentVisible('plaster')).toBe(true));
    it('reinforcement → κρυφό (opt-in)', () =>
      expect(isStructuralComponentVisible('reinforcement')).toBe(false));
  });

  describe('per-view flags', () => {
    it('setShowStructuralCore(false) → core κρυφό', () => {
      useBimRenderSettingsStore.getState().setShowStructuralCore(false);
      expect(isStructuralComponentVisible('core')).toBe(false);
    });
    it('setShowReinforcement(true) → reinforcement ορατό', () => {
      useBimRenderSettingsStore.getState().setShowReinforcement(true);
      expect(isStructuralComponentVisible('reinforcement')).toBe(true);
    });
  });

  describe('per-element override νικάει το per-view (Revit precedence)', () => {
    it('view core ON + element core=false → κρυφό', () => {
      expect(isStructuralComponentVisible('core', show({ core: false }))).toBe(false);
    });
    it('view reinforcement OFF + element reinforcement=true → ορατό', () => {
      expect(isStructuralComponentVisible('reinforcement', show({ reinforcement: true }))).toBe(true);
    });
    it('απών override key → πέφτει στο per-view flag', () => {
      useBimRenderSettingsStore.getState().setShowStructuralCore(false);
      // override μόνο για plaster — το core ακολουθεί το per-view (false).
      expect(isStructuralComponentVisible('core', show({ plaster: true }))).toBe(false);
    });
    it('«μόνο οπλισμός» συνδυασμός σε ένα στοιχείο', () => {
      const e = show({ core: false, plaster: false, reinforcement: true });
      expect(isStructuralComponentVisible('core', e)).toBe(false);
      expect(isStructuralComponentVisible('plaster', e)).toBe(false);
      expect(isStructuralComponentVisible('reinforcement', e)).toBe(true);
    });
  });

  describe('legacy aliases συνεπή με τον resolver', () => {
    it('isStructuralFinishVisible === component(plaster)', () => {
      expect(isStructuralFinishVisible()).toBe(isStructuralComponentVisible('plaster'));
      useBimRenderSettingsStore.getState().setShowFinishSkin(false);
      expect(isStructuralFinishVisible()).toBe(false);
    });
    it('isReinforcementVisible === component(reinforcement)', () => {
      expect(isReinforcementVisible()).toBe(isStructuralComponentVisible('reinforcement'));
      useBimRenderSettingsStore.getState().setShowReinforcement(true);
      expect(isReinforcementVisible()).toBe(true);
    });
  });
});
