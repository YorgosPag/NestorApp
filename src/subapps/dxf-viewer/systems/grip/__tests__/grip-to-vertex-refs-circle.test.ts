/**
 * ADR-561 / ADR-559 (Giorgio 2026-07-09) — gripToVertexRefs for the plain DXF circle.
 *
 * The 4 radius-edit handles are typed `'vertex'` (STRUCTURAL) in `getCircleGrips` so
 * they are ALWAYS shown on a selected circle (wall-corner / circular-column parity).
 * That same `'vertex'` type is what UNLOCKS the radius drag here: `refsForCircle` gates
 * on `type==='vertex'` + gripIndex 1-4 → `'circle-quadrant'` index 0-3, which
 * `stretchCircle` turns into a radius resize. Regression pinned: with the previous
 * `'quadrant'` type this resolver returned `[]` and the handles were inert (visible-but-
 * dead). The centre grip (#0, `movesEntity`) stays anchor-translate → `[]` here.
 */

import { gripToVertexRefs } from '../grip-to-vertex-refs';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { Entity } from '../../../types/entities';

const circle = { id: 'C1', type: 'circle', center: { x: 10, y: 20 }, radius: 5 } as unknown as Entity;

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return { id: 'g', source: 'dxf', entityId: 'C1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...over } as UnifiedGripInfo;
}

describe('gripToVertexRefs — plain DXF circle', () => {
  it('the 4 vertex radius handles (gripIndex 1-4) resolve to circle-quadrant 0-3', () => {
    expect(gripToVertexRefs(circle, grip({ gripIndex: 1 }))).toEqual([{ entityId: 'C1', kind: 'circle-quadrant', index: 0 }]);
    expect(gripToVertexRefs(circle, grip({ gripIndex: 2 }))).toEqual([{ entityId: 'C1', kind: 'circle-quadrant', index: 1 }]);
    expect(gripToVertexRefs(circle, grip({ gripIndex: 3 }))).toEqual([{ entityId: 'C1', kind: 'circle-quadrant', index: 2 }]);
    expect(gripToVertexRefs(circle, grip({ gripIndex: 4 }))).toEqual([{ entityId: 'C1', kind: 'circle-quadrant', index: 3 }]);
  });

  it('centre grip (#0, movesEntity) resolves to [] — anchor-translate, not a quadrant', () => {
    expect(gripToVertexRefs(circle, grip({ gripIndex: 0, type: 'center', movesEntity: true }))).toEqual([]);
  });
});
