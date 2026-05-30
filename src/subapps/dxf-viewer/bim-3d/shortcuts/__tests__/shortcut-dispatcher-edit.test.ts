/**
 * ADR-402 §Sub-Phase 2 — 3D edit-gizmo key routing in the shortcut dispatcher.
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
  // `key` mirrors a real event so fall-through branches (matchView3DShortcut) don't crash.
  const keyChar = code.startsWith('Key') ? code.slice(3) : code;
  return { code, key: keyChar, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods } as KeyboardEvent;
}

describe('dispatchShortcut — BIM edit gizmo keys', () => {
  it('G toggles the move gizmo and consumes the event (no 2D auto-switch)', () => {
    let toggled = 0;
    let switched = 0;
    const res = dispatchShortcut(
      key('KeyG'),
      makeCtx({ onMoveGizmoToggle3D: () => { toggled++; }, onSwitchTo2D: () => { switched++; } }),
    );
    expect(res.handled).toBe(true);
    expect(res.autoSwitched).toBe(false);
    expect(toggled).toBe(1);
    expect(switched).toBe(0);
  });

  it('G is ignored in 2D mode (falls through)', () => {
    let toggled = 0;
    const res = dispatchShortcut(
      key('KeyG'),
      makeCtx({ is3D: false, onMoveGizmoToggle3D: () => { toggled++; } }),
    );
    expect(toggled).toBe(0);
    expect(res.handled).toBe(false);
  });

  it('Ctrl+G is not a gizmo toggle', () => {
    let toggled = 0;
    dispatchShortcut(key('KeyG', { ctrlKey: true }), makeCtx({ onMoveGizmoToggle3D: () => { toggled++; } }));
    expect(toggled).toBe(0);
  });

  it('Escape tears down the gizmo only while editing', () => {
    let escaped = 0;
    const active = dispatchShortcut(key('Escape'), makeCtx({ editActive: true, onEditEscape3D: () => { escaped++; } }));
    expect(active.handled).toBe(true);
    expect(escaped).toBe(1);

    // Not editing → Escape is NOT routed to the gizmo (falls through to focus-clear).
    dispatchShortcut(key('Escape'), makeCtx({ editActive: false, onEditEscape3D: () => { escaped++; } }));
    expect(escaped).toBe(1);
  });

  it('X / Z toggle the axis lock only while editing', () => {
    const axes: string[] = [];
    const ctx = makeCtx({ editActive: true, onEditAxisLock3D: (a) => axes.push(a) });
    expect(dispatchShortcut(key('KeyX'), ctx).handled).toBe(true);
    expect(dispatchShortcut(key('KeyZ'), ctx).handled).toBe(true);
    expect(axes).toEqual(['X', 'Z']);
  });

  it('X / Z are NOT routed to the axis lock when not editing', () => {
    let locks = 0;
    dispatchShortcut(key('KeyX'), makeCtx({ editActive: false, onEditAxisLock3D: () => { locks++; } }));
    dispatchShortcut(key('KeyZ'), makeCtx({ editActive: false, onEditAxisLock3D: () => { locks++; } }));
    expect(locks).toBe(0);
  });
});
