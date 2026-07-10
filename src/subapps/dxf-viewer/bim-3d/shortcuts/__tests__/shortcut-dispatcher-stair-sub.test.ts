/**
 * ADR-358 Q19 — stair «click-into» sub-element key routing in the shortcut dispatcher.
 * Tab cycles treads/risers and Escape steps out, but ONLY while a sub-element is selected;
 * otherwise the events fall through to the whole-entity focus navigation.
 */

import { dispatchShortcut, type ShortcutDispatchContext } from '../shortcut-dispatcher';

function makeCtx(over: Partial<ShortcutDispatchContext>): ShortcutDispatchContext {
  return {
    is3D: true,
    onSnapToView: () => {},
    onSnapHome: () => {},
    onFitFrame3D: () => {},
    onSwitchTo2D: () => {},
    onAutoSwitchToast: () => {},
    onPan3D: () => {},
    onFocusNext3D: () => {},
    onFocusPrev3D: () => {},
    onFocusSelect3D: () => {},
    onFocusClear3D: () => {},
    ...over,
  };
}

function key(code: string, mods: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const keyChar = code.startsWith('Key') ? code.slice(3) : code;
  return { code, key: keyChar, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods } as KeyboardEvent;
}

describe('dispatchShortcut — stair sub-element keys (ADR-358 Q19)', () => {
  it('Tab cycles the sub-element (wins over whole-entity focusNext) when drilled in', () => {
    let cycled = 0;
    let focusNext = 0;
    const res = dispatchShortcut(
      key('Tab'),
      makeCtx({ hasStairSubSelection: true, onStairSubCycle: () => { cycled++; }, onFocusNext3D: () => { focusNext++; } }),
    );
    expect(res.handled).toBe(true);
    expect(cycled).toBe(1);
    expect(focusNext).toBe(0);
  });

  it('Tab falls through to focusNext with no sub-selection', () => {
    let cycled = 0;
    let focusNext = 0;
    dispatchShortcut(
      key('Tab'),
      makeCtx({ hasStairSubSelection: false, onStairSubCycle: () => { cycled++; }, onFocusNext3D: () => { focusNext++; } }),
    );
    expect(cycled).toBe(0);
    expect(focusNext).toBe(1);
  });

  it('Escape steps out of the sub-element (wins over focusClear) when drilled in', () => {
    let cleared = 0;
    let focusClear = 0;
    const res = dispatchShortcut(
      key('Escape'),
      makeCtx({ hasStairSubSelection: true, onStairSubClear: () => { cleared++; }, onFocusClear3D: () => { focusClear++; } }),
    );
    expect(res.handled).toBe(true);
    expect(cleared).toBe(1);
    expect(focusClear).toBe(0);
  });

  it('Escape falls through to focusClear with no sub-selection', () => {
    let cleared = 0;
    let focusClear = 0;
    dispatchShortcut(
      key('Escape'),
      makeCtx({ hasStairSubSelection: false, onStairSubClear: () => { cleared++; }, onFocusClear3D: () => { focusClear++; } }),
    );
    expect(cleared).toBe(0);
    expect(focusClear).toBe(1);
  });

  it('an active edit gizmo Escape wins over the sub-element clear (edit branch runs first)', () => {
    let escaped = 0;
    let cleared = 0;
    dispatchShortcut(
      key('Escape'),
      makeCtx({
        editActive: true, onEditEscape3D: () => { escaped++; },
        hasStairSubSelection: true, onStairSubClear: () => { cleared++; },
      }),
    );
    expect(escaped).toBe(1);
    expect(cleared).toBe(0);
  });

  it('Ctrl+Tab is not a sub-element cycle (modifier not owned)', () => {
    let cycled = 0;
    dispatchShortcut(key('Tab', { ctrlKey: true }), makeCtx({ hasStairSubSelection: true, onStairSubCycle: () => { cycled++; } }));
    expect(cycled).toBe(0);
  });

  it('sub-element keys are inert in 2D mode (branch gated by is3D)', () => {
    let cycled = 0;
    dispatchShortcut(
      key('Tab'),
      makeCtx({ is3D: false, hasStairSubSelection: true, onStairSubCycle: () => { cycled++; } }),
    );
    expect(cycled).toBe(0);
  });
});
