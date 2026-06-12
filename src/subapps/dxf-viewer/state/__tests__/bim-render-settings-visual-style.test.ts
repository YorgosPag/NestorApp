/**
 * ADR-446 — `setVisualStyle` / legacy `setRealisticMaterials` store action tests.
 */

import { act } from '@testing-library/react';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';

jest.mock('../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

beforeEach(() => {
  act(() => {
    // Start from the default style each test.
    useBimRenderSettingsStore.getState().setVisualStyle('realistic-edges');
  });
});

describe('ADR-446 — setVisualStyle', () => {
  it('updates the resolved FACES/EDGES axes + derived realisticMaterials', () => {
    act(() => { useBimRenderSettingsStore.getState().setVisualStyle('wireframe'); });
    const s = useBimRenderSettingsStore.getState();
    expect(s.visualStyle).toBe('wireframe');
    expect(s.faceMode).toBe('none');
    expect(s.edgeMode).toBe('all');
    expect(s.realisticMaterials).toBe(false);
  });

  it('realistic preset → realisticMaterials derived true', () => {
    act(() => { useBimRenderSettingsStore.getState().setVisualStyle('realistic'); });
    expect(useBimRenderSettingsStore.getState().realisticMaterials).toBe(true);
  });

  it('is idempotent (no state churn for same preset)', () => {
    act(() => { useBimRenderSettingsStore.getState().setVisualStyle('shaded'); });
    const before = useBimRenderSettingsStore.getState();
    act(() => { useBimRenderSettingsStore.getState().setVisualStyle('shaded'); });
    const after = useBimRenderSettingsStore.getState();
    expect(after.visualStyle).toBe('shaded');
    expect(after.lastLocalMutationAt).toBe(before.lastLocalMutationAt);
  });

  it('legacy setRealisticMaterials(false) → shaded-edges preset', () => {
    act(() => { useBimRenderSettingsStore.getState().setRealisticMaterials(false); });
    expect(useBimRenderSettingsStore.getState().visualStyle).toBe('shaded-edges');
  });

  it('legacy setRealisticMaterials(true) → realistic-edges preset', () => {
    act(() => { useBimRenderSettingsStore.getState().setVisualStyle('wireframe'); });
    act(() => { useBimRenderSettingsStore.getState().setRealisticMaterials(true); });
    expect(useBimRenderSettingsStore.getState().visualStyle).toBe('realistic-edges');
  });
});
