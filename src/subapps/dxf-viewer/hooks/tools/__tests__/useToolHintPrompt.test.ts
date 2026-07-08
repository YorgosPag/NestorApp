/**
 * ADR-589 — status-bar tool-hint prompt sync SSoT.
 *
 * Characterizes the shared prompt-sync contract the 5 modify-tool hooks depend
 * on: resolve to a key → set the `tool-hints:<key>` override; resolve to null
 * (inactive or idle phase) → clear it; clear on unmount.
 */
import { renderHook } from '@testing-library/react';
import { useToolHintPrompt } from '../useToolHintPrompt';
import { toolHintOverrideStore } from '../../toolHintOverrideStore';

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: (k: string) => `t(${k})` },
}));

interface Props {
  isActive: boolean;
  key: string | null;
}

function setup(initial: Props) {
  const spy = jest.spyOn(toolHintOverrideStore, 'setOverride');
  const { rerender, unmount } = renderHook(
    (p: Props) => useToolHintPrompt(p.isActive, p.key),
    { initialProps: initial },
  );
  return { spy, rerender, unmount };
}

describe('useToolHintPrompt', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    toolHintOverrideStore.setOverride(null);
  });

  it('clears the override when inactive', () => {
    const { spy } = setup({ isActive: false, key: 'trimTool.promptPick' });
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it('clears the override when active but key is null (idle phase)', () => {
    const { spy } = setup({ isActive: true, key: null });
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it('sets the tool-hints override when active with a key', () => {
    const { spy } = setup({ isActive: true, key: 'trimTool.promptPick' });
    expect(spy).toHaveBeenLastCalledWith('t(tool-hints:trimTool.promptPick)');
  });

  it('updates the override when the key changes', () => {
    const { spy, rerender } = setup({ isActive: true, key: 'trimTool.promptPick' });
    rerender({ isActive: true, key: 'trimTool.promptStandardEdges' });
    expect(spy).toHaveBeenLastCalledWith('t(tool-hints:trimTool.promptStandardEdges)');
  });

  it('clears the override on unmount', () => {
    const { spy, unmount } = setup({ isActive: true, key: 'offsetTool.promptSource' });
    spy.mockClear();
    unmount();
    expect(spy).toHaveBeenCalledWith(null);
  });

  it('clears when transitioning active→inactive', () => {
    const { spy, rerender } = setup({ isActive: true, key: 'chamferTool.promptFirst' });
    rerender({ isActive: false, key: 'chamferTool.promptFirst' });
    expect(spy).toHaveBeenLastCalledWith(null);
  });
});
