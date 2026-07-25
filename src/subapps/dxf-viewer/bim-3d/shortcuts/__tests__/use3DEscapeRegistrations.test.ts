/**
 * ADR-364 §10.13 (Φ2 Μηχανισμός 4) — the 3D Escape ladder, driven through the REAL bus.
 *
 * These tests exist because the previous owners of these four rungs lived as
 * `event.code === 'Escape'` branches inside `shortcut-dispatcher.ts` (Ζώνη Α), where the
 * bus could neither see nor order them. §10.11.Γ measured the consequence: enabling
 * Μηχανισμός 2 (`stopImmediatePropagation`) silenced Ζώνη Α and the 3D gizmo stopped
 * closing forever, because no slot existed to take it over.
 *
 * What is pinned here is therefore not «the hook calls the store» but the LADDER: one rung
 * per press, in the right order, and nothing consumed when there is nothing to do (the
 * §10.12 lesson — an ungated consumer at the bottom of a chain silently eats every ESC).
 *
 * Real stores, real bus, real `keydown` events. The only fake is the scene manager, which
 * cannot exist without WebGL.
 */

import { renderHook } from '@testing-library/react';
import { escapeBus } from '../../../systems/escape-bus/EscapeCommandBus';
import { ESC_PRIORITY } from '../../../systems/escape-bus';
import { use3DEscapeRegistrations } from '../use3DEscapeRegistrations';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { useSelection3DStore } from '../../stores/Selection3DStore';
import { useBim3DEditStore } from '../../stores/Bim3DEditStore';
import { useStairSubElementSelectionStore } from '../../../bim/stairs/stair-sub-element-selection-store';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

/** Fires a real Escape and reports whether the bus consumed it. */
function pressEscape(): boolean {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * Minimal scene-manager double — the keyboard-focus surface plus `selectBimEntity`, the
 * CANONICAL selection mutator. `selectBimEntity(null)` is what the real manager uses to keep
 * store + `selectionHighlighter` + `markSceneDirty` in lockstep; the double mirrors only the
 * store half, and `selectCalls` lets a test assert the canonical path was taken at all.
 */
function makeManager(focused: string | null) {
  let current = focused;
  const selectCalls: Array<string | null> = [];
  return {
    manager: {
      getKeyboardFocusManager: () => ({ getFocused: () => current }),
      clearKeyboardFocus: () => { current = null; },
      selectBimEntity: (id: string | null) => {
        selectCalls.push(id);
        if (id === null) useSelection3DStore.getState().clearSelection();
      },
    } as unknown as ThreeJsSceneManager,
    getFocused: () => current,
    selectCalls,
  };
}

function mount(managerValue: ThreeJsSceneManager | null, active = true) {
  return renderHook(() =>
    use3DEscapeRegistrations({ getManager: () => managerValue, active }),
  );
}

beforeEach(() => {
  escapeBus.__resetForTests();
  useViewMode3DStore.setState({ mode: '3d-raster' });
  useSelection3DStore.getState().clearSelection();
  useBim3DEditStore.getState().deactivate();
  useStairSubElementSelectionStore.getState().clear();
});

afterAll(() => {
  escapeBus.__resetForTests();
  useViewMode3DStore.setState({ mode: '2d' });
});

// ────────────────────────────────────────────────────────────────────────────
// The ladder — one rung per press (Revit «Modify» parity)
// ────────────────────────────────────────────────────────────────────────────

describe('the 3D Escape ladder — one step per press', () => {
  it('1st ESC closes the gizmo, 2nd deselects, 3rd consumes nothing', () => {
    const { manager, selectCalls } = makeManager(null);
    mount(manager);

    useSelection3DStore.getState().selectEntity('col-1', 'column');
    useBim3DEditStore.getState().activateMove(['col-1'], 'column');

    // 1st — gizmo down, selection deliberately INTACT so the next press has work to do.
    expect(pressEscape()).toBe(true);
    expect(useBim3DEditStore.getState().editToolActive).toBe(false);
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['col-1']);

    // 2nd — the rung that did not exist before §10.13 (measured gap, §10.11.Ε.2: the
    // element stayed selected forever once the gizmo had closed).
    expect(pressEscape()).toBe(true);
    expect(useSelection3DStore.getState().selectedBimIds).toEqual([]);

    // …and it went through the CANONICAL mutator, not a raw store write. Μετρημένο ζωντανά:
    // σκέτο `clearSelection()` άδειαζε το store αλλά ΑΦΗΝΕ το περίγραμμα στην οθόνη, επειδή
    // ο `selectionHighlighter` + το `markSceneDirty()` ζουν στο `selectBimEntity`.
    expect(selectCalls).toEqual([null]);

    // 3rd — nothing left to do ⇒ the bus must NOT consume, so lower/other owners still
    // get their chance and `defaultPrevented` stays false (the §10.12 invariant).
    expect(pressEscape()).toBe(false);
  });

  it('a drilled-in stair sub-element steps out between the gizmo and the deselect', () => {
    const { manager } = makeManager(null);
    mount(manager);

    useSelection3DStore.getState().selectEntity('stair-1', 'stair');
    useBim3DEditStore.getState().activateMove(['stair-1'], 'stair');
    useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair-1', part: 'tread', index: 3 });

    expect(pressEscape()).toBe(true);   // gizmo
    expect(useBim3DEditStore.getState().editToolActive).toBe(false);
    expect(useStairSubElementSelectionStore.getState().selected).not.toBeNull();

    expect(pressEscape()).toBe(true);   // step OUT of the tread, stair still selected
    expect(useStairSubElementSelectionStore.getState().selected).toBeNull();
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['stair-1']);

    expect(pressEscape()).toBe(true);   // deselect
    expect(useSelection3DStore.getState().selectedBimIds).toEqual([]);
  });

  it('clears the keyboard focus ring only when one exists', () => {
    const withFocus = makeManager('col-9');
    const { unmount } = mount(withFocus.manager);
    expect(pressEscape()).toBe(true);
    expect(withFocus.getFocused()).toBeNull();
    // …and now that it is cleared, the same press claims nothing.
    expect(pressEscape()).toBe(false);
    unmount();

    // The pre-§10.13 branch returned HANDLED unconditionally in 3D — this is the guard.
    const noFocus = makeManager(null);
    mount(noFocus.manager);
    expect(pressEscape()).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Gating — nothing must leak into 2D or into an unmounted viewport
// ────────────────────────────────────────────────────────────────────────────

describe('gating', () => {
  it('is completely inert in 2D — the 2D chain keeps owning deselect', () => {
    const { manager } = makeManager('col-9');
    mount(manager);
    useViewMode3DStore.setState({ mode: '2d' });
    useSelection3DStore.getState().selectEntity('col-1', 'column');
    useBim3DEditStore.getState().activateMove(['col-1'], 'column');

    expect(pressEscape()).toBe(false);
    expect(useBim3DEditStore.getState().editToolActive).toBe(true);
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['col-1']);
  });

  it('is inert when `active` is false', () => {
    const { manager } = makeManager(null);
    mount(manager, false);
    useSelection3DStore.getState().selectEntity('col-1', 'column');
    expect(pressEscape()).toBe(false);
    expect(useSelection3DStore.getState().selectedBimIds).toEqual(['col-1']);
  });

  it('survives a null manager (3D viewport torn down mid-session)', () => {
    mount(null);
    expect(() => pressEscape()).not.toThrow();
    expect(pressEscape()).toBe(false);
  });

  it('unregisters every rung on unmount', () => {
    const { manager } = makeManager(null);
    const { unmount } = mount(manager);
    expect(escapeBus.inspect().handlers.some((h) => h.id.startsWith('bim3d/'))).toBe(true);
    unmount();
    expect(escapeBus.inspect().handlers.some((h) => h.id.startsWith('bim3d/'))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// The structural constraint that makes the ladder reachable at all
// ────────────────────────────────────────────────────────────────────────────

describe('priority band (ADR-364 §10.13)', () => {
  // The whole reason these rungs are NOT in the 250-300 band: `BimViewport3D` mounts as a
  // leaf INSIDE `CanvasLayerStack`, so the 2D composite deselect (`canvas/fallback-deselect`
  // at DRAFT_POLYGON = 400) is live during 3D too — and since the gizmo is auto-on-selection,
  // a selection always exists while it is up, so that composite always claims first.
  // Anything below 400 would be unreachable. If someone "tidies" these constants downward,
  // this test is what tells them why they cannot.
  it('all three 3D rungs outrank the 2D composite deselect at DRAFT_POLYGON', () => {
    expect(ESC_PRIORITY.EDIT_GIZMO_3D).toBeGreaterThan(ESC_PRIORITY.DRAFT_POLYGON);
    expect(ESC_PRIORITY.STAIR_SUB_EXIT).toBeGreaterThan(ESC_PRIORITY.DRAFT_POLYGON);
    expect(ESC_PRIORITY.SELECTION_3D_CLEAR).toBeGreaterThan(ESC_PRIORITY.DRAFT_POLYGON);
  });

  it('an in-flight 3D marquee (BODY_DRAG) still aborts before the gizmo teardown', () => {
    expect(ESC_PRIORITY.EDIT_GIZMO_3D).toBeLessThan(ESC_PRIORITY.BODY_DRAG);
  });

  it('the focus ring clears last, exactly like its 2D twin', () => {
    expect(ESC_PRIORITY.FOCUS_CLEAR).toBeLessThan(ESC_PRIORITY.SELECTION_3D_CLEAR);
  });
});
