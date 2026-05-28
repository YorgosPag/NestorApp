/**
 * ADR-363 Phase 1G — `wall-hot-grip-fsm` pure decision tests.
 *
 * Coverage:
 *   - WALL_CORNER_GRIP_KINDS holds exactly the 4 corner kinds.
 *   - isWallCornerGripKind true για corners, false για κάθε άλλο wall grip + null/undefined.
 *   - resolveHotGripMouseDown: hotGrip→consume, corner+non-hot→enter, else→none.
 *   - resolveHotGripMouseUp: σειρά none → arm → stay(!moved) → set-base(await-base) → commit.
 */

import {
  WALL_CORNER_GRIP_KINDS,
  isWallCornerGripKind,
  isWallHotGripKind,
  hotGripOpForKind,
  initialHotGripStep,
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

describe('resolveHotGripMouseUp', () => {
  it("μη-hotGrip phase → 'none' (ανεξαρτήτως flags)", () => {
    for (const phase of ['idle', 'hovering', 'warm', 'dragging'] as UnifiedGripPhase[]) {
      for (const awaiting of [true, false]) {
        for (const step of ['await-base', 'tracking'] as const) {
          for (const moved of [true, false]) {
            expect(resolveHotGripMouseUp(phase, awaiting, step, moved)).toBe('none');
          }
        }
      }
    }
  });

  it("awaitingFirstRelease → 'arm' (1ο κλικ release, μένει hot, υπερισχύει step/moved)", () => {
    expect(resolveHotGripMouseUp('hotGrip', true, 'tracking', false)).toBe('arm');
    expect(resolveHotGripMouseUp('hotGrip', true, 'await-base', true)).toBe('arm');
  });

  it("await-base + moved → 'set-base' (αληθινό 2ο κλικ ορίζει βάση/κέντρο)", () => {
    expect(resolveHotGripMouseUp('hotGrip', false, 'await-base', true)).toBe('set-base');
  });

  it("await-base + !moved → 'stay' (stray same-tick fire του 1ου κλικ, ΔΕΝ ορίζει base)", () => {
    expect(resolveHotGripMouseUp('hotGrip', false, 'await-base', false)).toBe('stay');
  });

  it("tracking + moved → 'commit'", () => {
    expect(resolveHotGripMouseUp('hotGrip', false, 'tracking', true)).toBe('commit');
  });

  it("tracking + !moved → 'stay' (stray release, ΔΕΝ κάνει reset)", () => {
    expect(resolveHotGripMouseUp('hotGrip', false, 'tracking', false)).toBe('stay');
  });

  it("σειρά αξιολόγησης: stay υπερισχύει του set-base/commit όταν !moved", () => {
    // !moved → 'stay' ανεξαρτήτως step (λύνει το διπλό-fire του 1ου κλικ).
    for (const step of ['await-base', 'tracking'] as const) {
      expect(resolveHotGripMouseUp('hotGrip', false, step, false)).toBe('stay');
    }
    // arm υπερισχύει όλων (1ο κλικ release).
    expect(resolveHotGripMouseUp('hotGrip', true, 'await-base', true)).toBe('arm');
  });
});
