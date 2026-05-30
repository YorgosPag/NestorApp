/**
 * ADR-362 Phase D3 — useDimensionKeyboardRouting unit tests.
 *
 * Covers Q-C global-listener + dim-tool gate:
 *   - Tab / Space fire onKey when a dim tool is active
 *   - Escape is NOT routed here (ADR-364: ESC migrated to the centralized
 *     EscapeCommandBus via the DIM_TOOL slot in useDimToolRouting). The hook
 *     never calls onKey for Escape and never preventDefaults it.
 *   - Other keys are ignored
 *   - Listener removed (no dispatch) when activeTool flips away from dim
 *   - Editable focus (INPUT / TEXTAREA / contentEditable) suppresses dispatch
 *   - Tab + Space `preventDefault`
 */

import { renderHook } from '@testing-library/react';
import type { ToolType } from '../../../ui/toolbar/types';
import type { DimensionCreateKey } from '../useDimensionCreate';
import { useDimensionKeyboardRouting } from '../useDimensionKeyboardRouting';

function fireKey(key: string, code?: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key, code: code ?? key, bubbles: true, cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

const isDimTool = (tool: ToolType): boolean =>
  tool === 'dim-baseline' || tool === 'dim-linear' || tool === 'dim-smart';

describe('useDimensionKeyboardRouting — gate', () => {
  it('dispatches Tab / Space when a dim tool is active (Escape → EscapeCommandBus, ADR-364)', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-baseline', isDimTool, onKey }),
    );
    fireKey('Tab');
    fireKey(' ', 'Space');
    fireKey('Escape');
    expect(onKey).toHaveBeenNthCalledWith(1, 'Tab');
    expect(onKey).toHaveBeenNthCalledWith(2, 'Space');
    // ADR-364: Escape is no longer routed through this hook.
    expect(onKey).toHaveBeenCalledTimes(2);
  });

  it('ignores unrelated keys', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-linear', isDimTool, onKey }),
    );
    fireKey('a');
    fireKey('ArrowLeft');
    expect(onKey).not.toHaveBeenCalled();
  });

  it('dispatches Enter and prevents default (ADR-362 hotfix: early-commit)', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-linear', isDimTool, onKey }),
    );
    const ev = fireKey('Enter');
    expect(onKey).toHaveBeenCalledWith('Enter');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('does NOT attach the listener when activeTool is not a dim tool', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'select', isDimTool, onKey }),
    );
    fireKey('Tab');
    fireKey('Escape');
    expect(onKey).not.toHaveBeenCalled();
  });

  it('preventDefault fires for Tab + Space, but NOT for Escape', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-baseline', isDimTool, onKey }),
    );
    const tab = fireKey('Tab');
    const space = fireKey(' ', 'Space');
    const esc = fireKey('Escape');
    expect(tab.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(esc.defaultPrevented).toBe(false);
  });

  it('suppresses Tab / Space when an INPUT is focused (editable target)', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-smart', isDimTool, onKey }),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    try {
      fireKey('Tab');
      fireKey('Space', 'Space');
      expect(onKey).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it('dispatches Enter even when INPUT is focused — blurs input and prevents default', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-smart', isDimTool, onKey }),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    try {
      const ev = fireKey('Enter');
      expect(onKey).toHaveBeenCalledWith('Enter');
      expect(ev.defaultPrevented).toBe(true);
      // input should no longer be the active element after blur
      expect(document.activeElement).not.toBe(input);
    } finally {
      input.remove();
    }
  });

  it('ignores Escape even when INPUT is focused — ESC owned by EscapeCommandBus (ADR-364)', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-smart', isDimTool, onKey }),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    try {
      const ev = fireKey('Escape');
      // ADR-364: Escape is handled by the centralized EscapeCommandBus, not here.
      expect(onKey).not.toHaveBeenCalled();
      // No preventDefault → the EscapeCommandBus downstream still sees it.
      expect(ev.defaultPrevented).toBe(false);
    } finally {
      input.remove();
    }
  });

  it('tears down the listener when activeTool flips away from a dim tool', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    const { rerender } = renderHook(
      ({ tool }: { tool: ToolType }) =>
        useDimensionKeyboardRouting({ activeTool: tool, isDimTool, onKey }),
      { initialProps: { tool: 'dim-baseline' as ToolType } },
    );
    fireKey('Tab');
    expect(onKey).toHaveBeenCalledTimes(1);

    rerender({ tool: 'select' as ToolType });
    fireKey('Tab');
    expect(onKey).toHaveBeenCalledTimes(1);
  });
});
