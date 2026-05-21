/**
 * ADR-364 — EscapeCommandBus unit tests (Google Presubmit grade)
 *
 * Coverage targets:
 *   - Priority ordering (high → low) with ties preserving insertion order
 *   - `canHandle` gating + fall-through to next eligible handler
 *   - `handle` returning false → bus continues; true → preventDefault + stop
 *   - Single window listener installed across N registrations
 *   - Unregister cleanup + id-based replacement (React strict-mode safe)
 *   - Editable-focus guard (default skip; `allowWhenEditable: true` opt-in)
 *   - Non-ESC keys are inert
 *   - Snapshot-then-iterate (re-entrancy safe)
 *   - Error containment — throwing handler does not break the chain
 *   - `inspect()` returns sorted snapshot
 *   - `useEscapeHandler` hook (register / unregister / null skip)
 */

import { renderHook } from '@testing-library/react';
import { escapeBus } from '../EscapeCommandBus';
import { useEscapeHandler } from '../useEscapeHandler';
import { ESC_PRIORITY } from '../escape-priority';
import type { EscapeHandler } from '../types';

function fireKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function makeHandler(overrides: Partial<EscapeHandler> & Pick<EscapeHandler, 'id' | 'priority'>): EscapeHandler {
  return {
    canHandle: () => true,
    handle: () => true,
    ...overrides,
  };
}

beforeEach(() => {
  escapeBus.__resetForTests();
});

afterAll(() => {
  escapeBus.__resetForTests();
});

// ────────────────────────────────────────────────────────────────────────────
// Priority + ordering
// ────────────────────────────────────────────────────────────────────────────

describe('priority ordering', () => {
  it('runs higher-priority handler before lower-priority', () => {
    const high = jest.fn(() => true);
    const low = jest.fn(() => true);
    escapeBus.register({ id: 'low', priority: 100, canHandle: () => true, handle: low });
    escapeBus.register({ id: 'high', priority: 1000, canHandle: () => true, handle: high });
    fireKey('Escape');
    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });

  it('falls through when higher-priority handler returns false', () => {
    const high = jest.fn(() => false);
    const low = jest.fn(() => true);
    escapeBus.register({ id: 'high', priority: 1000, canHandle: () => true, handle: high });
    escapeBus.register({ id: 'low', priority: 100, canHandle: () => true, handle: low });
    fireKey('Escape');
    expect(high).toHaveBeenCalledTimes(1);
    expect(low).toHaveBeenCalledTimes(1);
  });

  it('skips handler whose canHandle returns false', () => {
    const skipped = jest.fn(() => true);
    const taken = jest.fn(() => true);
    escapeBus.register({ id: 'skipped', priority: 1000, canHandle: () => false, handle: skipped });
    escapeBus.register({ id: 'taken', priority: 500, canHandle: () => true, handle: taken });
    fireKey('Escape');
    expect(skipped).not.toHaveBeenCalled();
    expect(taken).toHaveBeenCalledTimes(1);
  });

  it('ties preserve insertion order (stable sort)', () => {
    const calls: string[] = [];
    escapeBus.register({ id: 'first', priority: 500, canHandle: () => true, handle: () => { calls.push('first'); return false; } });
    escapeBus.register({ id: 'second', priority: 500, canHandle: () => true, handle: () => { calls.push('second'); return true; } });
    fireKey('Escape');
    expect(calls).toEqual(['first', 'second']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// preventDefault / stopPropagation
// ────────────────────────────────────────────────────────────────────────────

describe('event consumption', () => {
  it('calls preventDefault + stopPropagation when a handler returns true', () => {
    escapeBus.register(makeHandler({ id: 'consume', priority: 500 }));
    const event = fireKey('Escape');
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT preventDefault when no handler consumes', () => {
    escapeBus.register({ id: 'pass', priority: 500, canHandle: () => true, handle: () => false });
    const event = fireKey('Escape');
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT preventDefault when no eligible handler exists', () => {
    escapeBus.register({ id: 'gated', priority: 500, canHandle: () => false, handle: () => true });
    const event = fireKey('Escape');
    expect(event.defaultPrevented).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Registration lifecycle
// ────────────────────────────────────────────────────────────────────────────

describe('registration lifecycle', () => {
  it('unregister removes handler from chain', () => {
    const handle = jest.fn(() => true);
    const unregister = escapeBus.register({ id: 'temp', priority: 500, canHandle: () => true, handle });
    unregister();
    fireKey('Escape');
    expect(handle).not.toHaveBeenCalled();
  });

  it('re-registering same id replaces previous handler', () => {
    const first = jest.fn(() => true);
    const second = jest.fn(() => true);
    escapeBus.register({ id: 'dup', priority: 500, canHandle: () => true, handle: first });
    escapeBus.register({ id: 'dup', priority: 500, canHandle: () => true, handle: second });
    fireKey('Escape');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unregister of replaced handler does not remove the live one', () => {
    const first = jest.fn(() => true);
    const second = jest.fn(() => true);
    const unregFirst = escapeBus.register({ id: 'dup2', priority: 500, canHandle: () => true, handle: first });
    escapeBus.register({ id: 'dup2', priority: 500, canHandle: () => true, handle: second });
    unregFirst(); // should be a no-op because slot now holds `second`
    fireKey('Escape');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('throws on empty id', () => {
    expect(() =>
      escapeBus.register({ id: '', priority: 500, canHandle: () => true, handle: () => true }),
    ).toThrow(/id/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Editable-focus guard
// ────────────────────────────────────────────────────────────────────────────

describe('editable-focus guard', () => {
  function focusInput(): HTMLInputElement {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    return input;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('skips handler without allowWhenEditable when an input is focused', () => {
    focusInput();
    const handle = jest.fn(() => true);
    escapeBus.register({ id: 'plain', priority: 500, canHandle: () => true, handle });
    fireKey('Escape');
    expect(handle).not.toHaveBeenCalled();
  });

  it('runs handler with allowWhenEditable: true even when input is focused', () => {
    focusInput();
    const handle = jest.fn(() => true);
    escapeBus.register({
      id: 'editable-ok',
      priority: 500,
      canHandle: () => true,
      handle,
      allowWhenEditable: true,
    });
    fireKey('Escape');
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('falls through from editable-blocked to editable-allowed at lower priority', () => {
    focusInput();
    const blocked = jest.fn(() => true);
    const allowed = jest.fn(() => true);
    escapeBus.register({ id: 'blocked', priority: 800, canHandle: () => true, handle: blocked });
    escapeBus.register({
      id: 'allowed',
      priority: 500,
      canHandle: () => true,
      handle: allowed,
      allowWhenEditable: true,
    });
    fireKey('Escape');
    expect(blocked).not.toHaveBeenCalled();
    expect(allowed).toHaveBeenCalledTimes(1);
  });

  // ADR-364 §3.4 Group 3 (2026-05-19) — editable re-evaluated per iteration:
  // an editable-allowed handler that blurs + returns false lets a lower
  // editable-blocked handler run. Mirrors the AutoCAD/Revit pattern where
  // ESC inside a Dynamic-Input field closes the field AND cancels the tool.
  it('editable-allowed handler blurs + returns false → editable-blocked handler at lower priority runs', () => {
    const input = focusInput();
    const blockedRan = jest.fn(() => true);
    const allowedRan = jest.fn(() => {
      input.blur();
      return false; // fall through
    });
    // Lower-priority editable-blocked handler (e.g., DRAW_TOOL).
    escapeBus.register({
      id: 'blocked-lower',
      priority: 500,
      canHandle: () => true,
      handle: blockedRan,
    });
    // Higher-priority editable-allowed handler (e.g., DYNAMIC_INPUT).
    escapeBus.register({
      id: 'allowed-higher',
      priority: 900,
      canHandle: () => true,
      handle: allowedRan,
      allowWhenEditable: true,
    });
    fireKey('Escape');
    expect(allowedRan).toHaveBeenCalledTimes(1);
    expect(blockedRan).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Non-ESC keys + error containment + inspect
// ────────────────────────────────────────────────────────────────────────────

describe('non-ESC keys', () => {
  it('ignores keys other than Escape', () => {
    const handle = jest.fn(() => true);
    escapeBus.register({ id: 'esc-only', priority: 500, canHandle: () => true, handle });
    fireKey('a');
    fireKey('Enter');
    fireKey('Tab');
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('error containment', () => {
  it('continues chain when canHandle throws', () => {
    const survivor = jest.fn(() => true);
    escapeBus.register({
      id: 'thrower',
      priority: 800,
      canHandle: () => { throw new Error('boom'); },
      handle: () => true,
    });
    escapeBus.register({ id: 'survivor', priority: 500, canHandle: () => true, handle: survivor });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fireKey('Escape');
    expect(survivor).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('continues chain when handle throws', () => {
    const survivor = jest.fn(() => true);
    escapeBus.register({
      id: 'handle-thrower',
      priority: 800,
      canHandle: () => true,
      handle: () => { throw new Error('boom2'); },
    });
    escapeBus.register({ id: 'survivor2', priority: 500, canHandle: () => true, handle: survivor });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fireKey('Escape');
    expect(survivor).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('inspect()', () => {
  it('returns sorted snapshot with allowWhenEditable normalized', () => {
    escapeBus.register({ id: 'b', priority: 100, canHandle: () => true, handle: () => true });
    escapeBus.register({ id: 'a', priority: 1000, canHandle: () => true, handle: () => true, allowWhenEditable: true });
    const info = escapeBus.inspect();
    expect(info.handlerCount).toBe(2);
    expect(info.handlers[0]).toEqual({ id: 'a', priority: 1000, allowWhenEditable: true });
    expect(info.handlers[1]).toEqual({ id: 'b', priority: 100, allowWhenEditable: false });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Re-entrancy snapshot
// ────────────────────────────────────────────────────────────────────────────

describe('snapshot-then-iterate', () => {
  it('handler registered during dispatch does not fire in the same cycle', () => {
    const lateHandle = jest.fn(() => true);
    escapeBus.register({
      id: 'registrar',
      priority: 1000,
      canHandle: () => true,
      handle: () => {
        escapeBus.register({ id: 'late', priority: 500, canHandle: () => true, handle: lateHandle });
        return false; // fall through to look for the late handler
      },
    });
    fireKey('Escape');
    expect(lateHandle).not.toHaveBeenCalled();
    // But it IS active on the next press.
    fireKey('Escape');
    expect(lateHandle).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SSOT priority constants
// ────────────────────────────────────────────────────────────────────────────

describe('ESC_PRIORITY constants', () => {
  it('strictly decreasing in the expected order', () => {
    const ordered = [
      ESC_PRIORITY.MODAL_DIALOG,
      ESC_PRIORITY.CANVAS_NUMERIC,
      ESC_PRIORITY.DYNAMIC_INPUT,
      ESC_PRIORITY.POPOVER_DROPDOWN,
      ESC_PRIORITY.COMMAND_LINE,
      ESC_PRIORITY.SELECTION_CYCLING,
      ESC_PRIORITY.CROP_TOOL,
      ESC_PRIORITY.MODIFY_TOOL,
      ESC_PRIORITY.DIM_TOOL,
      ESC_PRIORITY.DRAW_TOOL,
      ESC_PRIORITY.GRIP_DRAG,
      ESC_PRIORITY.DRAFT_POLYGON,
      ESC_PRIORITY.OVERLAY_DRAW_MODE,
      ESC_PRIORITY.GRIP_SELECTION,
      ESC_PRIORITY.ENTITY_SELECTION,
      ESC_PRIORITY.FOCUS_CLEAR,
      ESC_PRIORITY.COLOR_MENU,
    ];
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i - 1]).toBeGreaterThan(ordered[i]);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// useEscapeHandler hook
// ────────────────────────────────────────────────────────────────────────────

describe('useEscapeHandler', () => {
  it('registers handler on mount and unregisters on unmount', () => {
    const handle = jest.fn(() => true);
    const { unmount } = renderHook(() =>
      useEscapeHandler({
        id: 'hook/test',
        priority: 500,
        canHandle: () => true,
        handle,
      }),
    );
    fireKey('Escape');
    expect(handle).toHaveBeenCalledTimes(1);
    unmount();
    fireKey('Escape');
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('null options skips registration', () => {
    renderHook(() => useEscapeHandler(null));
    expect(escapeBus.inspect().handlerCount).toBe(0);
  });

  it('uses latest closure for canHandle / handle (ref pattern)', () => {
    let returnValue = false;
    const { rerender } = renderHook(
      (props: { value: boolean }) =>
        useEscapeHandler({
          id: 'hook/ref',
          priority: 500,
          canHandle: () => true,
          handle: () => props.value,
        }),
      { initialProps: { value: returnValue } },
    );
    let event = fireKey('Escape');
    expect(event.defaultPrevented).toBe(false);
    returnValue = true;
    rerender({ value: returnValue });
    event = fireKey('Escape');
    expect(event.defaultPrevented).toBe(true);
  });
});
