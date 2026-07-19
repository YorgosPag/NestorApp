/**
 * ADR-397 §glyph-suppression — `snapCoversMoveCross` predicate.
 *
 * The OSNAP glyph is hidden when the snap point lands ON a selected entity's MOVE
 * cross (drawn at a move-glyph grip). These tests lock: only `moveGlyphFrame` grips
 * count, the band is screen-px (scale-aware), and non-move / far / no-scale cases
 * never suppress.
 */

import { snapCoversMoveCross, SNAP_ON_MOVE_CROSS_PX } from '../snap-over-move-cross';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { MoveGlyphFrame } from '../../../bim/grips/move-glyph-frame';

const FRAME: MoveGlyphFrame = { axisX: { x: 1, y: 0 }, axisY: { x: 0, y: 1 } };

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  const base = {
    id: 'g',
    entityId: 'e1',
    gripIndex: 0,
    position: { x: 0, y: 0 },
    type: 'vertex',
    source: 'dxf',
  };
  return { ...base, ...over } as UnifiedGripInfo;
}

const moveGrip = (x: number, y: number): UnifiedGripInfo =>
  grip({ position: { x, y }, moveGlyphFrame: FRAME });
const plainGrip = (x: number, y: number): UnifiedGripInfo =>
  grip({ position: { x, y } }); // no moveGlyphFrame

describe('snapCoversMoveCross (ADR-397 §glyph-suppression)', () => {
  it('suppresses when the snap point is exactly on a move grip', () => {
    expect(snapCoversMoveCross({ x: 5, y: 5 }, 1, [moveGrip(5, 5)])).toBe(true);
  });

  it('suppresses within the screen-px band (scale 1 → world band = SNAP_ON_MOVE_CROSS_PX)', () => {
    const justInside = SNAP_ON_MOVE_CROSS_PX - 1;
    const justOutside = SNAP_ON_MOVE_CROSS_PX + 1;
    expect(snapCoversMoveCross({ x: justInside, y: 0 }, 1, [moveGrip(0, 0)])).toBe(true);
    expect(snapCoversMoveCross({ x: justOutside, y: 0 }, 1, [moveGrip(0, 0)])).toBe(false);
  });

  it('is scale-aware — the world band shrinks as zoom grows', () => {
    // scale 10 → world band = 1 unit. 0.5 in → suppressed, 2 out → not.
    expect(snapCoversMoveCross({ x: 0.5, y: 0 }, 10, [moveGrip(0, 0)])).toBe(true);
    expect(snapCoversMoveCross({ x: 2, y: 0 }, 10, [moveGrip(0, 0)])).toBe(false);
  });

  it('does NOT suppress a non-move (no moveGlyphFrame) grip — endpoint/vertex snap stays', () => {
    expect(snapCoversMoveCross({ x: 0, y: 0 }, 1, [plainGrip(0, 0)])).toBe(false);
  });

  it('does NOT suppress when far from every move grip', () => {
    expect(snapCoversMoveCross({ x: 100, y: 100 }, 1, [moveGrip(0, 0), moveGrip(20, 0)])).toBe(false);
  });

  it('returns false for a non-positive scale (guard)', () => {
    expect(snapCoversMoveCross({ x: 0, y: 0 }, 0, [moveGrip(0, 0)])).toBe(false);
    expect(snapCoversMoveCross({ x: 0, y: 0 }, -1, [moveGrip(0, 0)])).toBe(false);
  });

  it('returns false for an empty grip set', () => {
    expect(snapCoversMoveCross({ x: 0, y: 0 }, 1, [])).toBe(false);
  });

  it('finds a move grip among mixed grips', () => {
    const grips = [plainGrip(0, 0), plainGrip(1, 1), moveGrip(50, 50)];
    expect(snapCoversMoveCross({ x: 50, y: 50 }, 1, grips)).toBe(true);
  });
});
