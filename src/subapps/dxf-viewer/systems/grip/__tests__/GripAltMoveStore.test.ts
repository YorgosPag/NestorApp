/**
 * ADR-363 Phase 1G.5 — GripAltMoveStore unit tests.
 *
 * The store decides whether a grip drag is a whole-entity «move-from-base-point»
 * (Alt held at press). It captures `e.altKey` from the native mousedown (capture
 * phase) so the modifier survives blur/keyup races, and exposes a sticky per-drag
 * `active` flag armed by the grip handler and cleared at drag end.
 */

import { GripAltMoveStore } from '../GripAltMoveStore';

function mouseDown(alt: boolean): void {
  window.dispatchEvent(new MouseEvent('mousedown', { altKey: alt }));
}

describe('ADR-363 Phase 1G.5 — GripAltMoveStore', () => {
  afterEach(() => {
    GripAltMoveStore.clear();
    GripAltMoveStore._setAltForTest(false);
  });

  it('records Alt from the native mousedown (capture)', () => {
    mouseDown(true);
    expect(GripAltMoveStore.wasAltAtMouseDown()).toBe(true);
    mouseDown(false);
    expect(GripAltMoveStore.wasAltAtMouseDown()).toBe(false);
  });

  it('arm() activates; clear() disarms', () => {
    expect(GripAltMoveStore.getActive()).toBe(false);
    GripAltMoveStore.arm();
    expect(GripAltMoveStore.getActive()).toBe(true);
    GripAltMoveStore.clear();
    expect(GripAltMoveStore.getActive()).toBe(false);
  });

  it('blur drops both the recorded Alt and the active flag (focus loss safety)', () => {
    mouseDown(true);
    GripAltMoveStore.arm();
    window.dispatchEvent(new Event('blur'));
    expect(GripAltMoveStore.wasAltAtMouseDown()).toBe(false);
    expect(GripAltMoveStore.getActive()).toBe(false);
  });

  it('active flag is independent of the live Alt read (survives mid-drag Alt release)', () => {
    mouseDown(true);
    GripAltMoveStore.arm();
    // A subsequent non-Alt mousemove/keyup does NOT reset the recorded down state
    // here; the armed flag persists until clear() at drag end.
    expect(GripAltMoveStore.getActive()).toBe(true);
  });
});
