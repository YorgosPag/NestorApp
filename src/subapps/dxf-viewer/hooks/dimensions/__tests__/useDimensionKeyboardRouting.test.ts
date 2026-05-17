/**
 * ADR-362 Phase D3 — useDimensionKeyboardRouting unit tests.
 *
 * Covers Q-C global-listener + dim-tool gate:
 *   - Tab / Space / Escape fire onKey when a dim tool is active
 *   - Other keys are ignored
 *   - Listener removed (no dispatch) when activeTool flips away from dim
 *   - Editable focus (INPUT / TEXTAREA / contentEditable) suppresses dispatch
 *   - Tab + Space `preventDefault`, Escape does not (cooperates with the
 *     legacy useKeyboardShortcuts ESC handler downstream)
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
  it('dispatches Tab / Space / Escape when a dim tool is active', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-baseline', isDimTool, onKey }),
    );
    fireKey('Tab');
    fireKey(' ', 'Space');
    fireKey('Escape');
    expect(onKey).toHaveBeenNthCalledWith(1, 'Tab');
    expect(onKey).toHaveBeenNthCalledWith(2, 'Space');
    expect(onKey).toHaveBeenNthCalledWith(3, 'Escape');
  });

  it('ignores unrelated keys', () => {
    const onKey = jest.fn<void, [DimensionCreateKey]>();
    renderHook(() =>
      useDimensionKeyboardRouting({ activeTool: 'dim-linear', isDimTool, onKey }),
    );
    fireKey('a');
    fireKey('Enter');
    expect(onKey).not.toHaveBeenCalled();
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

  it('suppresses dispatch when an INPUT is focused (editable target)', () => {
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
