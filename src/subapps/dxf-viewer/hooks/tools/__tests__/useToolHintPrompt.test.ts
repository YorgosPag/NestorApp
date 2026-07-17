/**
 * ADR-589 — status-bar tool-hint prompt sync SSoT.
 *
 * Characterizes the shared prompt-sync contract the modify-tool hooks depend on:
 * resolve to a key → set the `tool-hints:<key>` override; resolve to null
 * (inactive or idle phase) → clear it; clear on unmount.
 *
 * Two entry points, one effect: `useToolHintPrompt` (i18n key under `tool-hints:`)
 * and `useToolHintText` (already-resolved string — for the move/mirror/rotate/
 * schedule-pick tools, whose prompts come from other namespaces).
 */
import { renderHook } from '@testing-library/react';
import { useToolHintPrompt, useToolHintText } from '../useToolHintPrompt';
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

interface TextProps {
  active: boolean;
  text: string | null;
}

function setupText(initial: TextProps) {
  const spy = jest.spyOn(toolHintOverrideStore, 'setOverride');
  const { rerender, unmount } = renderHook(
    (p: TextProps) => useToolHintText(p.active, p.text),
    { initialProps: initial },
  );
  return { spy, rerender, unmount };
}

describe('useToolHintText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    toolHintOverrideStore.setOverride(null);
  });

  it('publishes the resolved text verbatim — no tool-hints: prefix, no i18n lookup', () => {
    // The whole point: these callers resolved from another namespace already.
    const { spy } = setupText({ active: true, text: 't(dxf-viewer-guides:moveTool.selectBasePoint)' });
    expect(spy).toHaveBeenLastCalledWith('t(dxf-viewer-guides:moveTool.selectBasePoint)');
  });

  it('clears when inactive', () => {
    const { spy } = setupText({ active: false, text: 'Κλικ: κέντρο περιστροφής' });
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it('clears when active but text is null', () => {
    const { spy } = setupText({ active: true, text: null });
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it('updates when the text changes', () => {
    const { spy, rerender } = setupText({ active: true, text: 'first' });
    rerender({ active: true, text: 'second' });
    expect(spy).toHaveBeenLastCalledWith('second');
  });

  it('clears on unmount (a tool unmounting mid-phase must not pin its prompt)', () => {
    const { spy, unmount } = setupText({ active: true, text: 'pinned?' });
    spy.mockClear();
    unmount();
    expect(spy).toHaveBeenCalledWith(null);
  });

  it('clears when transitioning active→inactive', () => {
    const { spy, rerender } = setupText({ active: true, text: 'x' });
    rerender({ active: false, text: 'x' });
    expect(spy).toHaveBeenLastCalledWith(null);
  });
});
