/**
 * ADR-402 §Sub-Phase 2 — 3D edit-gizmo key routing in the shortcut dispatcher.
 *
 * ADR-364 §10.13 (Φ2 Μηχ. 4): Escape LEFT this dispatcher. The gizmo teardown is now a
 * gated escape-bus slot (`use3DEscapeRegistrations`, ESC_PRIORITY.EDIT_GIZMO_3D), so the
 * Escape assertions below pin the INVERSE of what they used to: the dispatcher must keep
 * its hands off Escape, whatever the edit state. G / X / Z are unchanged.
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

  // ADR-364 §10.13 — ΦΥΛΑΚΑΣ: the dispatcher must NEVER claim Escape again.
  //
  // Before Μηχ. 4 this returned `handled: true` while editing, which made the dispatcher
  // the sole owner of the gizmo teardown — invisible to the escape bus, and the exact
  // reason Μηχ. 2 (`stopImmediatePropagation`) regressed the 3D gizmo (§10.11.Γ). If this
  // test goes red, someone re-added an Escape branch and Μηχ. 2 is unsafe again.
  it('Escape is NOT routed by the dispatcher — editing or not (bus owns it)', () => {
    const editing = dispatchShortcut(key('Escape'), makeCtx({ editActive: true }));
    expect(editing.handled).toBe(false);

    const idle = dispatchShortcut(key('Escape'), makeCtx({ editActive: false }));
    expect(idle.handled).toBe(false);
  });

  it('Escape does not reach ANY dispatcher branch, incl. focus-clear', () => {
    let focusSelect = 0;
    // `focusClear`'s registry key IS Escape; before §10.13 it returned HANDLED
    // unconditionally in 3D — an ungated consumer of every 3D Escape.
    const res = dispatchShortcut(
      key('Escape'),
      makeCtx({ is3D: true, onFocusSelect3D: () => { focusSelect++; } }),
    );
    expect(res.handled).toBe(false);
    expect(res.autoSwitched).toBe(false);
    expect(focusSelect).toBe(0);
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
