/**
 * ADR-358 Q19 — stair «click-into» sub-element key routing in the shortcut dispatcher.
 * Tab cycles treads/risers ONLY while a sub-element is selected; otherwise it falls through
 * to the whole-entity focus navigation.
 *
 * ADR-364 §10.13 (Φ2 Μηχ. 4): the Escape «step out one level» rung LEFT this dispatcher and
 * became a gated escape-bus slot (ESC_PRIORITY.STAIR_SUB_EXIT, below EDIT_GIZMO_3D so the
 * gizmo still wins first — the legacy branch order is preserved by priority instead of by
 * statement order). The Escape assertions below pin that the dispatcher stays out of it.
 */

import { dispatchShortcut, type ShortcutDispatchContext } from '../shortcut-dispatcher';
import { ESC_PRIORITY } from '../../../systems/escape-bus';

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

  // ADR-364 §10.13 — ΦΥΛΑΚΑΣ: Escape belongs to the bus, drilled in or not.
  it('Escape is NOT routed by the dispatcher — drilled in or not (bus owns it)', () => {
    expect(dispatchShortcut(key('Escape'), makeCtx({ hasStairSubSelection: true })).handled).toBe(false);
    expect(dispatchShortcut(key('Escape'), makeCtx({ hasStairSubSelection: false })).handled).toBe(false);
  });

  // The «gizmo wins over sub-element» ordering did not disappear — it moved from statement
  // order in `dispatchShortcut` to priority order on the bus. Pinned here so the two facts
  // stay tied together: whoever changes the constants sees this test.
  it('the gizmo→sub-element→deselect ladder is encoded in the ESC priorities', () => {
    expect(ESC_PRIORITY.EDIT_GIZMO_3D).toBeGreaterThan(ESC_PRIORITY.STAIR_SUB_EXIT);
    expect(ESC_PRIORITY.STAIR_SUB_EXIT).toBeGreaterThan(ESC_PRIORITY.SELECTION_3D_CLEAR);
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
