/**
 * Tests for grip whole-entity-move ORTHO (F8) constraints (ADR-363).
 *
 * `applyMoveConstraints` composes ORTHO (axis-lock) then SNAP-MODE step. With
 * SNAP-MODE OFF (the default here) the step layer is a no-op, so these tests
 * isolate the ORTHO behaviour through the real `cadToggleState` singleton.
 */

import {
  applyOrthoToDelta,
  applyMoveConstraints,
  applyResizeConstraints,
  applyMoveFineStep,
  applyMoveFineStepAboutAnchor,
  isMoveFineStepActive,
  MOVE_FINE_STEP_MM,
} from '../grip-move-constraints';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { immediateSceneScale } from '../../../systems/cursor/ImmediateSceneScaleStore';
import { ShiftKeyTracker } from '../../../keyboard/ShiftKeyTracker';

describe('grip-move-constraints (ORTHO on a move delta)', () => {
  afterEach(() => {
    // Reset all flags so each test starts ORTHO/SNAP-MODE/Shift OFF.
    cadToggleState.set(false, false);
    cadToggleState.setSnap(false, 0);
    ShiftKeyTracker._setForTest(false);
    immediateSceneScale.set(1);
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

  describe('applyResizeConstraints — ORTHO on a RESIZE grip (AutoCAD parity, no Shift fine)', () => {
    it('16. ORTHO OFF + SNAP OFF → verbatim (free reshape, regression)', () => {
      cadToggleState.set(false, false);
      cadToggleState.setSnap(false, 0);
      expect(applyResizeConstraints({ x: 13, y: 27 })).toEqual({ x: 13, y: 27 });
    });

    it('17. ORTHO ON → axis-locked exactly like a move (|dx|>|dy| → y zeroed)', () => {
      cadToggleState.set(true, false);
      cadToggleState.setSnap(false, 0);
      expect(applyResizeConstraints({ x: 90, y: 5 })).toEqual({ x: 90, y: 0 });
    });

    it('18. ORTHO ON → locks to Y when |dy|>|dx| (zeroes x)', () => {
      cadToggleState.set(true, false);
      cadToggleState.setSnap(false, 0);
      expect(applyResizeConstraints({ x: 6, y: -70 })).toEqual({ x: 0, y: -70 });
    });

    it('19. IGNORES the Shift fine step (unlike applyMoveConstraints)', () => {
      immediateSceneScale.set(1);
      cadToggleState.set(false, false);
      cadToggleState.setSnap(false, 0);
      ShiftKeyTracker._setForTest(true); // Shift held → move would quantize to 10; resize must not
      expect(applyResizeConstraints({ x: 47, y: -43 })).toEqual({ x: 47, y: -43 });
    });
  });

  describe('Shift fine 1 cm move step (Giorgio 2026-06-24)', () => {
    it('8. the increment is 1 cm = 10 mm', () => {
      expect(MOVE_FINE_STEP_MM).toBe(10);
    });

    it('9. isMoveFineStepActive tracks Shift only', () => {
      ShiftKeyTracker._setForTest(false);
      expect(isMoveFineStepActive()).toBe(false);
      ShiftKeyTracker._setForTest(true);
      expect(isMoveFineStepActive()).toBe(true);
    });

    it('10. applyMoveFineStep is a no-op when Shift is up', () => {
      ShiftKeyTracker._setForTest(false);
      expect(applyMoveFineStep({ x: 47, y: -43 })).toEqual({ x: 47, y: -43 });
    });

    it('11. Shift quantizes the DELTA to multiples of 10 (Option Α — step of the move)', () => {
      immediateSceneScale.set(1); // mm scene
      ShiftKeyTracker._setForTest(true);
      // raw move 47 mm → 50, raw 43 mm → 40 (the exact example shown to Giorgio).
      expect(applyMoveFineStep({ x: 47, y: -43 })).toEqual({ x: 50, y: -40 });
      expect(applyMoveFineStep({ x: 8, y: 23 })).toEqual({ x: 10, y: 20 });
    });

    it('12. converts the 1 cm step to scene units on a metre-scale drawing', () => {
      ShiftKeyTracker._setForTest(true);
      immediateSceneScale.set(0.001); // 1 canvas unit = 1 m → 10 mm = 0.01 units
      const r = applyMoveFineStep({ x: 0.047, y: -0.043 });
      expect(r.x).toBeCloseTo(0.05);
      expect(r.y).toBeCloseTo(-0.04);
    });

    it('13. applyMoveConstraints composes ORTHO then the Shift fine step (WYSIWYG)', () => {
      immediateSceneScale.set(1);
      cadToggleState.set(true, false); // ORTHO on
      ShiftKeyTracker._setForTest(true); // Shift fine step on
      // |dx|>|dy| → y zeroed, then x (47) quantized to 50.
      expect(applyMoveConstraints({ x: 47, y: 9 })).toEqual({ x: 50, y: 0 });
    });

    it('14. Shift OFF → applyMoveConstraints leaves the delta free (regression)', () => {
      immediateSceneScale.set(1);
      cadToggleState.set(false, false);
      cadToggleState.setSnap(false, 0);
      ShiftKeyTracker._setForTest(false);
      expect(applyMoveConstraints({ x: 47, y: -43 })).toEqual({ x: 47, y: -43 });
    });

    it('15. applyMoveFineStepAboutAnchor quantizes the point RELATIVE to the anchor', () => {
      immediateSceneScale.set(1);
      ShiftKeyTracker._setForTest(true);
      // anchor 1000; point 1047 → 1050, point 1043 → 1040 (delta stepped, offset kept).
      expect(applyMoveFineStepAboutAnchor({ x: 1047, y: -23 }, { x: 1000, y: 0 })).toEqual({ x: 1050, y: -20 });
      ShiftKeyTracker._setForTest(false);
      expect(applyMoveFineStepAboutAnchor({ x: 1047, y: -23 }, { x: 1000, y: 0 })).toEqual({ x: 1047, y: -23 });
    });
  });
});
