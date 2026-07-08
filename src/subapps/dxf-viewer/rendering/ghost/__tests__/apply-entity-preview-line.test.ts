/**
 * ADR-363 Slice F/G.5 — applyEntityPreview line ghost routing.
 *
 * The plain DXF line carries TWO `lineGripKind`s:
 *   - `'line-rotation'` (Slice F) → the ghost SPINS both endpoints about the pivot.
 *   - `'line-move'`     (Slice G.5) → the ¼-west MOVE cross is a whole-entity
 *     TRANSLATE; its ghost must move start+end by `delta` (preview ≡ the centre
 *     midpoint grip), NOT rotate.
 *
 * Regression: a bare `if (lineGripKind)` in the ghost routed BOTH kinds into the
 * rotation branch, so the move grip's X-axial arm (delta collinear with the axis)
 * produced a zero-sweep no-op — the line appeared frozen. These lock the split.
 */

import { applyEntityPreview } from '../apply-entity-preview';
import type { EntityPreviewTransform } from '../entity-preview-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

function makeLine(): DxfEntityUnion {
  return {
    id: 'line_1', type: 'line',
    start: { x: 0, y: 0 }, end: { x: 100, y: 0 },
  } as unknown as DxfEntityUnion;
}

type LineGhost = { start: { x: number; y: number }; end: { x: number; y: number } };
const len = (g: LineGhost) => Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y);

describe('ADR-363 Slice G.5 — line MOVE grip ghost = whole-entity translate', () => {
  it('X-axial arm (delta along the axis) translates the whole line — NOT a no-op (the bug)', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'line_1', gripIndex: 4, delta: { x: 50, y: 0 },
      movesEntity: true, edgeVertexIndices: [0, 1],
      gripKind: { on: 'line', kind: 'line-move' },
    };
    const g = applyEntityPreview(makeLine(), preview) as unknown as LineGhost;
    expect(g.start).toEqual({ x: 50, y: 0 });
    expect(g.end).toEqual({ x: 150, y: 0 });
    expect(len(g)).toBeCloseTo(100, 6); // translate preserves length (no spin)
  });

  it('Y-perp arm (delta across the axis) translates the whole line', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'line_1', gripIndex: 4, delta: { x: 0, y: 50 },
      movesEntity: true, edgeVertexIndices: [0, 1],
      gripKind: { on: 'line', kind: 'line-move' },
    };
    const g = applyEntityPreview(makeLine(), preview) as unknown as LineGhost;
    expect(g.start).toEqual({ x: 0, y: 50 });
    expect(g.end).toEqual({ x: 100, y: 50 });
    expect(len(g)).toBeCloseTo(100, 6);
  });

  it('is byte-identical to the centre midpoint grip ghost (same movesEntity translate path)', () => {
    const delta = { x: 50, y: 0 };
    const moveCross: EntityPreviewTransform = {
      entityId: 'line_1', gripIndex: 4, delta, movesEntity: true,
      edgeVertexIndices: [0, 1],
      gripKind: { on: 'line', kind: 'line-move' },
    };
    const midpoint: EntityPreviewTransform = {
      entityId: 'line_1', gripIndex: 2, delta, movesEntity: true, edgeVertexIndices: [0, 1],
    };
    expect(applyEntityPreview(makeLine(), moveCross)).toEqual(applyEntityPreview(makeLine(), midpoint));
  });
});

describe('ADR-363 Slice F — line ROTATION grip ghost still spins (unchanged)', () => {
  it("'line-rotation' rotates the endpoints about the midpoint (length preserved, shape rotated)", () => {
    // anchor = ¼-east (75,0); cursor delta sweeps it off-axis → non-zero angle.
    const preview: EntityPreviewTransform = {
      entityId: 'line_1', gripIndex: 3, delta: { x: -25, y: 25 },
      movesEntity: false,
      gripKind: { on: 'line', kind: 'line-rotation' }, anchorPos: { x: 75, y: 0 },
    };
    const g = applyEntityPreview(makeLine(), preview) as unknown as LineGhost;
    expect(len(g)).toBeCloseTo(100, 6);       // rotation preserves length
    // endpoints actually moved off the original axis (a spin, not a translate).
    const movedOffAxis = g.start.y !== 0 || g.end.y !== 0;
    expect(movedOffAxis).toBe(true);
  });
});
