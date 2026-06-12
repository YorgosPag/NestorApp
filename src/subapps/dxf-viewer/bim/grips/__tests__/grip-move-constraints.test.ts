/**
 * Tests for grip whole-entity-move ORTHO (F8) constraints (ADR-363).
 *
 * `applyMoveConstraints` composes ORTHO (axis-lock) then SNAP-MODE step. With
 * SNAP-MODE OFF (the default here) the step layer is a no-op, so these tests
 * isolate the ORTHO behaviour through the real `cadToggleState` singleton.
 */

import { applyOrthoToDelta, applyMoveConstraints } from '../grip-move-constraints';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';

describe('grip-move-constraints (ORTHO on a move delta)', () => {
  afterEach(() => {
    // Reset both flags so each test starts ORTHO/SNAP-MODE OFF.
    cadToggleState.set(false, false);
    cadToggleState.setSnap(false, 0);
  });

  describe('applyOrthoToDelta', () => {
    it('1. returns the delta verbatim when ORTHO is OFF', () => {
      cadToggleState.set(false, false);
      expect(applyOrthoToDelta({ x: 30, y: 12 })).toEqual({ x: 30, y: 12 });
    });

    it('2. locks to the X axis when |dx| > |dy| (zeroes y)', () => {
      cadToggleState.set(true, false);
      expect(applyOrthoToDelta({ x: 40, y: 9 })).toEqual({ x: 40, y: 0 });
    });

    it('3. locks to the Y axis when |dy| > |dx| (zeroes x)', () => {
      cadToggleState.set(true, false);
      expect(applyOrthoToDelta({ x: 7, y: -55 })).toEqual({ x: 0, y: -55 });
    });

    it('4. ties (|dx| === |dy|) resolve to the X axis (AutoCAD ≥ rule)', () => {
      cadToggleState.set(true, false);
      expect(applyOrthoToDelta({ x: 20, y: -20 })).toEqual({ x: 20, y: 0 });
    });

    it('5. preserves the dominant sign (negative dx kept)', () => {
      cadToggleState.set(true, false);
      expect(applyOrthoToDelta({ x: -80, y: 3 })).toEqual({ x: -80, y: 0 });
    });
  });

  describe('applyMoveConstraints (ORTHO ⊕ step)', () => {
    it('6. ORTHO OFF + SNAP OFF → verbatim', () => {
      cadToggleState.set(false, false);
      cadToggleState.setSnap(false, 0);
      expect(applyMoveConstraints({ x: 13, y: 27 })).toEqual({ x: 13, y: 27 });
    });

    it('7. ORTHO ON + SNAP OFF → axis-locked (step is a no-op)', () => {
      cadToggleState.set(true, false);
      cadToggleState.setSnap(false, 0);
      expect(applyMoveConstraints({ x: 5, y: 90 })).toEqual({ x: 0, y: 90 });
    });
  });
});
