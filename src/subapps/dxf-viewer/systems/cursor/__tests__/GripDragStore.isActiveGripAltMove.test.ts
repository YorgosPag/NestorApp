/**
 * ADR-560 — `isActiveGripAltMove` SSoT resolver unit tests.
 *
 * Regression guard for «OSNAP marks / neighbour pull vanish on a grip Alt-move».
 * ROOT CAUSE: the OSNAP corner-projection read the LIVE `GripAltMoveStore`, which
 * the Windows Alt→`blur` clears mid-drag, while the AutoAlign traces read the BAKED
 * `activeDragGrip.altMove`. The two paths disagreed → AutoAlign kept working but
 * OSNAP did not. The fix routes EVERY consumer through this ONE resolver, which
 * prefers the blur-proof baked flag (live store only as a fallback).
 */

import {
  setActiveDragGrip,
  clearActiveDragGrip,
  isActiveGripAltMove,
} from '../GripDragStore';
import { GripAltMoveStore } from '../../grip/GripAltMoveStore';

function blur(): void {
  window.dispatchEvent(new Event('blur')); // clears the live GripAltMoveStore
}

describe('ADR-560 — isActiveGripAltMove (blur-proof altMove SSoT)', () => {
  afterEach(() => {
    clearActiveDragGrip();
    GripAltMoveStore.clear();
    GripAltMoveStore._setAltForTest(false);
  });

  it('THE REGRESSION — baked altMove survives the Windows Alt→blur that clears the live store', () => {
    setActiveDragGrip({ entityId: 'col-1', gripKind: 'column-rotation', altMove: true });
    GripAltMoveStore.arm();
    expect(isActiveGripAltMove()).toBe(true);
    // Simulate the Alt→blur that nukes the live store MID-drag …
    blur();
    expect(GripAltMoveStore.getActive()).toBe(false); // live store gone
    expect(isActiveGripAltMove()).toBe(true);          // …baked flag still true → OSNAP keeps firing
  });

  it('falls back to the live store when no drag record is baked (pre-bake window)', () => {
    GripAltMoveStore.arm();
    expect(isActiveGripAltMove()).toBe(true);
  });

  it('non-Alt drag → false (baked false, live false)', () => {
    setActiveDragGrip({ entityId: 'col-1', gripKind: 'column-width', altMove: false });
    expect(isActiveGripAltMove()).toBe(false);
  });

  it('missing altMove field → false (undefined baked, live false)', () => {
    setActiveDragGrip({ entityId: 'col-1', gripKind: 'column-width' });
    expect(isActiveGripAltMove()).toBe(false);
  });

  it('drag end clears everything → false', () => {
    setActiveDragGrip({ entityId: 'col-1', gripKind: 'column-rotation', altMove: true });
    GripAltMoveStore.arm();
    clearActiveDragGrip();
    GripAltMoveStore.clear();
    expect(isActiveGripAltMove()).toBe(false);
  });
});
