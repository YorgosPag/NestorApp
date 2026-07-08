/**
 * ADR-363 Phase 1G.5 — buildDxfDragPreview Alt whole-entity ghost tests.
 *
 * When `altMove` is true the live drag-preview snapshot must drop the parametric
 * grip-kind discriminator and emit `movesEntity: true`, so `applyEntityPreview`
 * translates the WHOLE entity (base = grabbed grip) instead of running the corner
 * / thickness / resize parametric ghost. With `altMove` false the snapshot keeps
 * its `wallGripKind` (zero regression to the normal parametric ghost).
 */

import { buildDxfDragPreview } from '../grip-projections';
import type { UnifiedGripInfo } from '../unified-grip-types';
import { gripKindOf } from '../../grip-kinds';

const ANCHOR = { x: 100, y: 100 };
const CURSOR = { x: 400, y: 250 };
const EXPECTED_DELTA = { x: 300, y: 150 };

function cornerGrip(): UnifiedGripInfo {
  return {
    id: 'g', source: 'dxf', type: 'vertex',
    entityId: 'wall_1', gripIndex: 6,
    gripKind: { on: 'wall', kind: 'wall-corner-start-neg' },
    position: ANCHOR, movesEntity: false,
  } as unknown as UnifiedGripInfo;
}

describe('ADR-363 Phase 1G.5 — buildDxfDragPreview altMove', () => {
  it('altMove=true → movesEntity ghost, NO wallGripKind (whole-entity translate)', () => {
    const preview = buildDxfDragPreview('dragging', cornerGrip(), ANCHOR, CURSOR, true);
    expect(preview).not.toBeNull();
    expect(preview!.movesEntity).toBe(true);
    expect(preview!.delta).toEqual(EXPECTED_DELTA);
    expect(gripKindOf(preview!, 'wall')).toBeUndefined();
    expect(preview!.entityId).toBe('wall_1');
  });

  it('altMove=false → keeps wallGripKind (parametric ghost unchanged)', () => {
    const preview = buildDxfDragPreview('dragging', cornerGrip(), ANCHOR, CURSOR, false);
    expect(preview).not.toBeNull();
    expect(gripKindOf(preview!, 'wall')).toBe('wall-corner-start-neg');
    expect(preview!.delta).toEqual(EXPECTED_DELTA);
  });

  it('altMove defaults to false when omitted (backward compatible)', () => {
    const preview = buildDxfDragPreview('dragging', cornerGrip(), ANCHOR, CURSOR);
    expect(gripKindOf(preview!, 'wall')).toBe('wall-corner-start-neg');
  });
});
