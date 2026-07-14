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
  hotGripKindOf,
  initialHotGripStep,
  advanceHotGripStep,
  resolveHotGripMouseDown,
  resolveHotGripMouseUp,
  isReferenceFlowKey,
} from '../wall-hot-grip-fsm';
import type { WallGripKind } from '../../useGripMovement';
import type { UnifiedGripInfo, UnifiedGripPhase } from '../unified-grip-types';

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

describe('ADR-513 §grip-parity — endpoint-stretch op (plain-line endpoint click-move-click)', () => {
  it("initialHotGripStep('endpoint-stretch') → 'tracking' (2-click, like corner)", () => {
    expect(initialHotGripStep('endpoint-stretch')).toBe('tracking');
  });

  it("advanceHotGripStep: tracking = terminal (self → commit on the next moved click)", () => {
    expect(advanceHotGripStep('endpoint-stretch', 'tracking')).toBe('tracking');
  });

  it("resolveHotGripMouseUp: arm (1st release) → stay (stray) → commit (moved terminal)", () => {
    // 1st-click release arms, stays hot.
    expect(resolveHotGripMouseUp('endpoint-stretch', 'hotGrip', true, 'tracking', false)).toBe('arm');
    // Stray same-tick release with no move → stay (never burns the commit).
    expect(resolveHotGripMouseUp('endpoint-stretch', 'hotGrip', false, 'tracking', false)).toBe('stay');
    // Deliberate (moved) click on the terminal tracking step → commit.
    expect(resolveHotGripMouseUp('endpoint-stretch', 'hotGrip', false, 'tracking', true)).toBe('commit');
  });
});

describe('ADR-397 — column hot-grip kinds (shared registry)', () => {
  it("column-center → 'move', column-rotation → 'rotate'", () => {
    expect(hotGripOpForKind('column-center')).toBe('move');
    expect(hotGripOpForKind('column-rotation')).toBe('rotate');
  });

  it('column resize/variant grips stay drag (null op)', () => {
    for (const k of ['column-width', 'column-depth', 'column-arm-length', 'column-i-web-thickness']) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
  });

  it("column-center/rotation enter hot-grip on mousedown", () => {
    expect(resolveHotGripMouseDown('idle', 'column-center')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'column-rotation')).toBe('enter');
  });

  it('hotGripKindOf reads the set discriminator regardless of entity', () => {
    const wall = {
      gripKind: { on: 'wall', kind: 'wall-midpoint' },
    } as unknown as UnifiedGripInfo;
    const col = {
      gripKind: { on: 'column', kind: 'column-rotation' },
    } as unknown as UnifiedGripInfo;
    const stair = {
      gripKind: { on: 'stair', kind: 'stair-base' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(wall)).toBe('wall-midpoint');
    expect(hotGripKindOf(col)).toBe('column-rotation');
    expect(hotGripKindOf(stair)).toBe('stair-base');
    expect(hotGripKindOf(null)).toBeUndefined();
    expect(hotGripKindOf({} as UnifiedGripInfo)).toBeUndefined();
  });
});

describe('ADR-363 Phase 5.5d — beam hot-grip kinds (axis-based wall parity)', () => {
  it("beam-midpoint → 'move', beam-rotation → 'rotate'", () => {
    expect(hotGripOpForKind('beam-midpoint')).toBe('move');
    expect(hotGripOpForKind('beam-rotation')).toBe('rotate');
  });

  it('beam start/end/curve/width/depth stay press-drag (null op)', () => {
    for (const k of ['beam-start', 'beam-end', 'beam-curve', 'beam-width', 'beam-depth']) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
  });

  it('beam-midpoint/rotation enter hot-grip on mousedown', () => {
    expect(resolveHotGripMouseDown('idle', 'beam-midpoint')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'beam-rotation')).toBe('enter');
  });

  it('hotGripKindOf reads the beamGripKind discriminator', () => {
    const beam = {
      gripKind: { on: 'beam', kind: 'beam-rotation' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(beam)).toBe('beam-rotation');
  });
});

describe('ADR-406 — MEP fixture hot-grip kinds (full wall parity)', () => {
  it("mep-fixture-move → 'move', mep-fixture-rotation → 'rotate', corners → 'corner'", () => {
    expect(hotGripOpForKind('mep-fixture-move')).toBe('move');
    expect(hotGripOpForKind('mep-fixture-rotation')).toBe('rotate');
    for (const k of [
      'mep-fixture-corner-ne',
      'mep-fixture-corner-nw',
      'mep-fixture-corner-sw',
      'mep-fixture-corner-se',
    ]) {
      expect(hotGripOpForKind(k)).toBe('corner');
      expect(isWallHotGripKind(k)).toBe(true);
    }
  });

  it('mep-fixture-diameter (circular) stays press-drag (null op)', () => {
    expect(hotGripOpForKind('mep-fixture-diameter')).toBeNull();
    expect(isWallHotGripKind('mep-fixture-diameter')).toBe(false);
  });

  it('mep-fixture move/rotation/corner enter hot-grip on mousedown', () => {
    expect(resolveHotGripMouseDown('idle', 'mep-fixture-move')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'mep-fixture-rotation')).toBe('enter');
    expect(resolveHotGripMouseDown('idle', 'mep-fixture-corner-ne')).toBe('enter');
  });

  it('hotGripKindOf reads the mepFixtureGripKind discriminator', () => {
    const fix = {
      gripKind: { on: 'mep-fixture', kind: 'mep-fixture-rotation' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(fix)).toBe('mep-fixture-rotation');
  });
});

describe('ADR-408 Φ3 — electrical panel hot-grip kinds (full wall parity)', () => {
  it("electrical-panel-move → 'move', -rotation → 'rotate', corners → 'corner'", () => {
    expect(hotGripOpForKind('electrical-panel-move')).toBe('move');
    expect(hotGripOpForKind('electrical-panel-rotation')).toBe('rotate');
    for (const k of [
      'electrical-panel-corner-ne',
      'electrical-panel-corner-nw',
      'electrical-panel-corner-sw',
      'electrical-panel-corner-se',
    ]) {
      expect(hotGripOpForKind(k)).toBe('corner');
      expect(isWallHotGripKind(k)).toBe(true);
    }
  });

  it('electrical panel move/rotation/corner enter hot-grip on mousedown', () => {
    expect(resolveHotGripMouseDown('idle', 'electrical-panel-move')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'electrical-panel-rotation')).toBe('enter');
    expect(resolveHotGripMouseDown('idle', 'electrical-panel-corner-ne')).toBe('enter');
  });

  it('hotGripKindOf reads the electricalPanelGripKind discriminator', () => {
    const panel = {
      gripKind: { on: 'electrical-panel', kind: 'electrical-panel-rotation' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(panel)).toBe('electrical-panel-rotation');
  });
});

describe('ADR-408 Φ8 — MEP segment hot-grip kinds (axis-based beam parity)', () => {
  it("mep-segment-midpoint → 'move', mep-segment-rotation → 'rotate'", () => {
    expect(hotGripOpForKind('mep-segment-midpoint')).toBe('move');
    expect(hotGripOpForKind('mep-segment-rotation')).toBe('rotate');
  });

  it('mep-segment start/end/section stay press-drag (null op)', () => {
    for (const k of ['mep-segment-start', 'mep-segment-end', 'mep-segment-section']) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
  });

  it('mep-segment midpoint/rotation enter hot-grip on mousedown', () => {
    expect(resolveHotGripMouseDown('idle', 'mep-segment-midpoint')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'mep-segment-rotation')).toBe('enter');
  });

  // Regression: hotGripKindOf MUST surface mepSegmentGripKind, else the segment
  // rotation/move never arms the 6-/3-click FSM and falls back to a wrong-anchor
  // press-drag that reverts on release.
  it('hotGripKindOf reads the mepSegmentGripKind discriminator', () => {
    const seg = {
      gripKind: { on: 'mep-segment', kind: 'mep-segment-rotation' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(seg)).toBe('mep-segment-rotation');
  });
});

describe('ADR-557 — text/mtext hot-grip kinds (rect-box column parity)', () => {
  it("text-move → 'move', text-rotation → 'rotate'", () => {
    expect(hotGripOpForKind('text-move')).toBe('move');
    expect(hotGripOpForKind('text-rotation')).toBe('rotate');
  });

  it('text corner + edge resize grips stay press-drag (null op)', () => {
    for (const k of [
      'text-corner-ne', 'text-corner-nw', 'text-corner-sw', 'text-corner-se',
      'text-edge-e', 'text-edge-w', 'text-edge-n', 'text-edge-s',
    ]) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
  });

  it('text-move/rotation enter hot-grip on mousedown', () => {
    expect(resolveHotGripMouseDown('idle', 'text-move')).toBe('enter');
    expect(resolveHotGripMouseDown('warm', 'text-rotation')).toBe('enter');
  });

  // Regression: hotGripKindOf MUST surface textGripKind, else the text move/rotation
  // never arms the 3-/6-click FSM and falls back to a press-drag WITHOUT the pivot
  // pick + rotation/alignment overlays (the exact gap this ADR closes).
  it('hotGripKindOf reads the textGripKind discriminator', () => {
    const move = {
      gripKind: { on: 'text', kind: 'text-move' },
    } as unknown as UnifiedGripInfo;
    const rot = {
      gripKind: { on: 'text', kind: 'text-rotation' },
    } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(move)).toBe('text-move');
    expect(hotGripKindOf(rot)).toBe('text-rotation');
  });
});

describe('ADR-654 — raster image / entourage rotation hot-grip (wall parity)', () => {
  it("image-rotation → 'rotate' (opts into the click-armed centre-pick + reference flow)", () => {
    expect(hotGripOpForKind('image-rotation')).toBe('rotate');
    expect(isWallHotGripKind('image-rotation')).toBe(true);
  });

  it('image move / corners / mid-edges stay press-drag (null op)', () => {
    for (const k of [
      'image-move',
      'image-corner-ne', 'image-corner-nw', 'image-corner-sw', 'image-corner-se',
      'image-edge-e', 'image-edge-s', 'image-edge-w',
    ]) {
      expect(hotGripOpForKind(k)).toBeNull();
      expect(isWallHotGripKind(k)).toBe(false);
    }
  });

  // Regression: hotGripKindOf MUST surface the image gripKind, else the rotation never arms the
  // 6-click FSM → falls back to press-drag WITHOUT the pivot pick + reference arcs (this ADR closes it).
  it('image-rotation enters hot-grip on mousedown + hotGripKindOf reads the discriminator', () => {
    const rot = { gripKind: { on: 'image', kind: 'image-rotation' } } as unknown as UnifiedGripInfo;
    expect(hotGripKindOf(rot)).toBe('image-rotation');
    expect(resolveHotGripMouseDown('warm', 'image-rotation')).toBe('enter');
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

  it("rotate: await-base → rotate-free (terminal — ADR-397 free rotate default)", () => {
    expect(advanceHotGripStep('rotate', 'await-base')).toBe('rotate-free');
    expect(advanceHotGripStep('rotate', 'rotate-free')).toBe('rotate-free');
  });

  it("rotate «R» reference flow: await-ref-start → … → await-align-end (terminal)", () => {
    expect(advanceHotGripStep('rotate', 'await-ref-start')).toBe('await-ref-end');
    expect(advanceHotGripStep('rotate', 'await-ref-end')).toBe('await-align-start');
    expect(advanceHotGripStep('rotate', 'await-align-start')).toBe('await-align-end');
    expect(advanceHotGripStep('rotate', 'await-align-end')).toBe('await-align-end');
  });
});

describe('ADR-397 Σ2 — isReferenceFlowKey («R» → reference flow)', () => {
  it('true για «r» / «R»', () => {
    expect(isReferenceFlowKey('r')).toBe(true);
    expect(isReferenceFlowKey('R')).toBe(true);
  });

  it('false για κάθε άλλο πλήκτρο', () => {
    for (const k of ['a', 'Enter', 'Escape', '4', '-', '.', 'Backspace', '']) {
      expect(isReferenceFlowKey(k)).toBe(false);
    }
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

  it("rotate: rotate-free + moved → 'commit' (ADR-397 free rotate terminal)", () => {
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, 'rotate-free', true)).toBe('commit');
  });

  it("rotate: rotate-free + !moved → 'stay' (stray same-tick release)", () => {
    expect(resolveHotGripMouseUp('rotate', 'hotGrip', false, 'rotate-free', false)).toBe('stay');
  });

  it("op=null + moved → 'commit' (defensive)", () => {
    expect(resolveHotGripMouseUp(null, 'hotGrip', false, 'tracking', true)).toBe('commit');
  });
});
