/**
 * ADR-363 Phase 1G — `wall-hot-grip-fsm` pure decision tests.
 *
 * Coverage:
 *   - WALL_CORNER_GRIP_KINDS holds exactly the 4 corner kinds.
 *   - isWallCornerGripKind true για corners, false για κάθε άλλο wall grip + null/undefined.
 *   - resolveHotGripMouseDown: hotGrip→consume, corner+non-hot→enter, else→none.
 *   - resolveHotGripMouseUp: σειρά none → arm → stay(!moved) → advance|commit.
 *   - advanceHotGripStep: per-op step progression (corner/move/rotate 6-click).
 */

import {
  WALL_CORNER_GRIP_KINDS,
  isWallCornerGripKind,
  isWallHotGripKind,
  hotGripOpForKind,
  initialHotGripStep,
  advanceHotGripStep,
  resolveHotGripMouseDown,
  resolveHotGripMouseUp,
} from '../wall-hot-grip-fsm';
import type { WallGripKind } from '../../useGripMovement';
import type { UnifiedGripPhase } from '../unified-grip-types';

const NON_CORNER_KINDS: WallGripKind[] = [
  'wall-start',
  'wall-end',
  'wall-midpoint',
  'wall-thickness',
  'wall-rotation',
  'wall-curve',
  'wall-vertex-1',
];

describe('WALL_CORNER_GRIP_KINDS', () => {
  it('holds exactly the 4 corner kinds', () => {
    expect([...WALL_CORNER_GRIP_KINDS].sort()).toEqual(
      [
        'wall-corner-end-neg',
        'wall-corner-end-pos',
        'wall-corner-start-neg',
        'wall-corner-start-pos',
      ].sort(),
    );
  });
});

describe('isWallCornerGripKind', () => {
  it('true για κάθε corner kind', () => {
    for (const k of WALL_CORNER_GRIP_KINDS) {
      expect(isWallCornerGripKind(k)).toBe(true);
    }
  });

  it('false για non-corner wall grips', () => {
    for (const k of NON_CORNER_KINDS) {
      expect(isWallCornerGripKind(k)).toBe(false);
    }
  });

  it('false για null / undefined', () => {
    expect(isWallCornerGripKind(undefined)).toBe(false);
    expect(isWallCornerGripKind(null)).toBe(false);
  });
});

describe('hotGripOpForKind / isWallHotGripKind / initialHotGripStep', () => {
  it("corners → 'corner', wall-midpoint → 'move', wall-rotation → 'rotate'", () => {
    for (const k of WALL_CORNER_GRIP_KINDS) expect(hotGripOpForKind(k)).toBe('corner');
    expect(hotGripOpForKind('wall-midpoint')).toBe('move');
    expect(hotGripOpForKind('wall-rotation')).toBe('rotate');
  });

  it("non-hot wall grips → null", () => {
    for (const k of ['wall-start', 'wall-end', 'wall-thickness', 'wall-curve', 'wall-vertex-1'] as WallGripKind[]) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
    expect(hotGripOpForKind(undefined)).toBeNull();
  });

  it("isWallHotGripKind true για corner + move + rotate", () => {
    expect(isWallHotGripKind('wall-corner-end-neg')).toBe(true);
    expect(isWallHotGripKind('wall-midpoint')).toBe(true);
    expect(isWallHotGripKind('wall-rotation')).toBe(true);
  });

  it("initialHotGripStep: corner → tracking, move/rotate → await-base", () => {
    expect(initialHotGripStep('corner')).toBe('tracking');
    expect(initialHotGripStep('move')).toBe('await-base');
    expect(initialHotGripStep('rotate')).toBe('await-base');
  });
});

describe('resolveHotGripMouseDown', () => {
  const NON_HOT: UnifiedGripPhase[] = ['idle', 'hovering', 'warm', 'dragging'];

  it("phase=hotGrip → 'consume' ανεξαρτήτως grip kind (επόμενο κλικ)", () => {
    expect(resolveHotGripMouseDown('hotGrip', 'wall-corner-start-pos')).toBe('consume');
    expect(resolveHotGripMouseDown('hotGrip', undefined)).toBe('consume');
    expect(resolveHotGripMouseDown('hotGrip', 'wall-midpoint')).toBe('consume');
  });

  it("hot grip kind (corner/move/rotate) + μη-hot phase → 'enter'", () => {
    for (const phase of NON_HOT) {
      for (const k of [...WALL_CORNER_GRIP_KINDS, 'wall-midpoint', 'wall-rotation'] as WallGripKind[]) {
        expect(resolveHotGripMouseDown(phase, k)).toBe('enter');
      }
    }
  });

  it("non-hot grip + μη-hot phase → 'none' (κανονικό drag)", () => {
    for (const phase of NON_HOT) {
      for (const k of NON_CORNER_KINDS.filter((k) => k !== 'wall-midpoint' && k !== 'wall-rotation')) {
        expect(resolveHotGripMouseDown(phase, k)).toBe('none');
      }
      expect(resolveHotGripMouseDown(phase, undefined)).toBe('none');
    }
  });
});

describe('advanceHotGripStep', () => {
  it("corner: tracking = terminal (self)", () => {
    expect(advanceHotGripStep('corner', 'tracking')).toBe('tracking');
  });

  it("move: await-base → tracking (terminal)", () => {
    expect(advanceHotGripStep('move', 'await-base')).toBe('tracking');
    expect(advanceHotGripStep('move', 'tracking')).toBe('tracking');
  });

  it("rotate: 6-click chain await-base → … → await-align-end (terminal)", () => {
    expect(advanceHotGripStep('rotate', 'await-base')).toBe('await-ref-start');
    expect(advanceHotGripStep('rotate', 'await-ref-start')).toBe('await-ref-end');
    expect(advanceHotGripStep('rotate', 'await-ref-end')).toBe('await-align-start');
    expect(advanceHotGripStep('rotate', 'await-align-start')).toBe('await-align-end');
    expect(advanceHotGripStep('rotate', 'await-align-end')).toBe('await-align-end');
  });
});

describe('resolveHotGripMouseUp', () => {
  it("μη-hotGrip phase → 'none' (ανεξαρτήτως flags)", () => {
    for (const phase of ['idle', 'hovering', 'warm', 'dragging'] as UnifiedGripPhase[]) {
      for (const awaiting of [true, false]) {
        for (const moved of [true, false]) {
          expect(resolveHotGripMouseUp('rotate', phase, awaiting, 'await-base', moved)).toBe('none');
        }
      }
    }
  });

  it("awaitingFirstRelease → 'arm' (1ο κλικ release, μένει hot, υπερισχύει step/moved)", () => {
    expect(resolveHotGripMouseUp('corner', 'hotGrip', true, 'tracking', false)).toBe('arm');
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', true, 'await-base', true)).toBe('arm');
  });

  it("!moved → 'stay' ανεξαρτήτως op/step (stray same-tick fire, ΔΕΝ καίει βήμα)", () => {
    expect(resolveHotGripMouseUp('move', 'hotGrip', false, 'await-base', false)).toBe('stay');
    expect(resolveHotGripMouseUp('move', 'hotGrip', false, 'tracking', false)).toBe('stay');
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, 'await-ref-end', false)).toBe('stay');
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, 'await-align-end', false)).toBe('stay');
  });

  it("move: await-base + moved → 'advance', tracking + moved → 'commit'", () => {
    expect(resolveHotGripMouseUp('move', 'hotGrip', false, 'await-base', true)).toBe('advance');
    expect(resolveHotGripMouseUp('move', 'hotGrip', false, 'tracking', true)).toBe('commit');
  });

  it("corner: tracking + moved → 'commit'", () => {
    expect(resolveHotGripMouseUp('corner', 'hotGrip', false, 'tracking', true)).toBe('commit');
  });

  it("rotate: non-terminal pick steps + moved → 'advance'", () => {
    for (const step of ['await-base', 'await-ref-start', 'await-ref-end', 'await-align-start'] as const) {
      expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, step, true)).toBe('advance');
    }
  });

  it("rotate: await-align-end + moved → 'commit' (terminal)", () => {
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, 'await-align-end', true)).toBe('commit');
  });

  it("op=null + moved → 'commit' (defensive)", () => {
    expect(resolveHotGripMouseUp(null, 'hotGrip', false, 'tracking', true)).toBe('commit');
  });
});
