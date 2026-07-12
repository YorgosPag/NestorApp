/**
 * ADR-640 — unit tests for the BLOCK gizmo (whole-block move cross + rotation handle),
 * mirror of systems/group/__tests__/group-gizmo-grips.test.ts.
 *
 * Covers the pure grip emission (`getBlockGizmoGrips` over the shared `getContainerGizmoGrips`
 * core) and the shared-pipeline wiring (glyph registry + hot-grip op registry + the
 * `hotGripKindOf` discriminator chain).
 */

import { computeBlockSelectionBounds } from '../block-selection-bounds';
import { getBlockGizmoGrips, BLOCK_MOVE_KIND, BLOCK_ROTATION_KIND } from '../block-gizmo-grips';
import { gripGlyphShape } from '../../../bim/grips/grip-glyph-registry';
import { hotGripOpForKind, hotGripKindOf } from '../../../hooks/grips/wall-hot-grip-fsm';
import { gripKindOf } from '../../../hooks/grip-kinds';
import type { BlockEntity, Entity } from '../../../types/entities';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

// Bounds: min {0,0}, max {4,2} → centre {2,1}, halfWidth 2, halfLength 1.
const makeBlock = (): BlockEntity =>
  ({
    id: 'BLK1', type: 'block', name: 'Door', layerId: 'lyr_test', visible: true,
    position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: [mkLine('a', 0, 0, 4, 0), mkLine('b', 0, 2, 4, 2)],
  } as unknown as BlockEntity);

describe('getBlockGizmoGrips (ADR-640)', () => {
  it('emits exactly TWO handles keyed on the block id, always visible', () => {
    const block = makeBlock();
    const bounds = computeBlockSelectionBounds(block)!;
    const grips = getBlockGizmoGrips(block, bounds);
    expect(grips).toHaveLength(2);
    expect(grips.every((g) => g.entityId === block.id)).toBe(true);
    expect(grips.every((g) => g.type === 'vertex')).toBe(true);
  });

  it('places the MOVE cross at the bbox centre (whole-block translate)', () => {
    const block = makeBlock();
    const bounds = computeBlockSelectionBounds(block)!;
    const [move] = getBlockGizmoGrips(block, bounds);
    expect(move.gripIndex).toBe(0);
    expect(move.position).toEqual({ x: 2, y: 1 });
    expect(move.movesEntity).toBe(true);
    expect(gripKindOf(move, 'block')).toBe(BLOCK_MOVE_KIND);
  });

  it('places the rotation handle midway toward the bottom edge (−halfLength/2)', () => {
    const block = makeBlock();
    const bounds = computeBlockSelectionBounds(block)!;
    const [, rot] = getBlockGizmoGrips(block, bounds);
    expect(rot.gripIndex).toBe(1);
    expect(rot.position.x).toBeCloseTo(2);
    expect(rot.position.y).toBeCloseTo(0.5);
    expect(rot.movesEntity).toBe(false);
    expect(gripKindOf(rot, 'block')).toBe(BLOCK_ROTATION_KIND);
  });
});

describe('BLOCK gizmo — shared-pipeline wiring (ADR-640)', () => {
  it('maps both kinds to the SAME glyphs every entity uses', () => {
    expect(gripGlyphShape('block-move')).toBe('move');
    expect(gripGlyphShape('block-rotation')).toBe('rotation');
  });

  it('opts both kinds into the shared hot-grip flow (move / rotate)', () => {
    expect(hotGripOpForKind('block-move')).toBe('move');
    expect(hotGripOpForKind('block-rotation')).toBe('rotate');
  });

  it('resolves the block discriminator via the shared hotGripKindOf chain', () => {
    expect(hotGripKindOf({
      gripKind: { on: 'block', kind: 'block-move' },
    } as unknown as UnifiedGripInfo)).toBe('block-move');
    expect(hotGripKindOf({
      gripKind: { on: 'block', kind: 'block-rotation' },
    } as unknown as UnifiedGripInfo)).toBe('block-rotation');
  });
});
