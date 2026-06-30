/**
 * ADR-349 / ADR-363 Slice G.5 — gripToVertexRefs for the plain DXF line.
 *
 * The commit path (`commitDxfGripDragViaStretchCommand`) resolves a grip to the
 * vertices a `StretchEntityCommand` moves. Regression: `refsForLine` keyed off a
 * HARDCODED `gripIndex` (0/1/2 only), so the ¼-west MOVE cross (gripIndex 4) fell
 * through to `[]` → the line never moved (the directional arms opened a prompt but
 * committed nothing). Now it keys off `edgeVertexIndices`, so the centre midpoint
 * (#2) AND the MOVE cross (#4) both resolve to start+end — commit ≡ preview.
 */

import { gripToVertexRefs } from '../grip-to-vertex-refs';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { Entity } from '../../../types/entities';

const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } as unknown as Entity;

function grip(over: Partial<UnifiedGripInfo>): UnifiedGripInfo {
  return { id: 'g', source: 'dxf', entityId: 'L1', gripIndex: 0, type: 'vertex', position: { x: 0, y: 0 }, movesEntity: false, ...over } as UnifiedGripInfo;
}

describe('gripToVertexRefs — plain DXF line', () => {
  it('endpoint grips resolve to their single vertex', () => {
    expect(gripToVertexRefs(line, grip({ gripIndex: 0 }))).toEqual([{ entityId: 'L1', kind: 'line-start' }]);
    expect(gripToVertexRefs(line, grip({ gripIndex: 1 }))).toEqual([{ entityId: 'L1', kind: 'line-end' }]);
  });

  it('centre midpoint grip (#2) moves BOTH endpoints', () => {
    const refs = gripToVertexRefs(line, grip({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1] }));
    expect(refs).toEqual([{ entityId: 'L1', kind: 'line-start' }, { entityId: 'L1', kind: 'line-end' }]);
  });

  it('¼-west MOVE cross (#4, Slice G.5) moves BOTH endpoints — IDENTICAL to the midpoint (the bug)', () => {
    const moveCross = grip({ gripIndex: 4, type: 'vertex', movesEntity: true, edgeVertexIndices: [0, 1], lineGripKind: 'line-move' });
    const midpoint = grip({ gripIndex: 2, type: 'edge', movesEntity: true, edgeVertexIndices: [0, 1] });
    expect(gripToVertexRefs(line, moveCross)).toEqual([{ entityId: 'L1', kind: 'line-start' }, { entityId: 'L1', kind: 'line-end' }]);
    expect(gripToVertexRefs(line, moveCross)).toEqual(gripToVertexRefs(line, midpoint));
  });

  it('rotation handle (#3, no edgeVertexIndices) resolves to [] — it has its own commit', () => {
    expect(gripToVertexRefs(line, grip({ gripIndex: 3, type: 'vertex', lineGripKind: 'line-rotation' }))).toEqual([]);
  });
});
