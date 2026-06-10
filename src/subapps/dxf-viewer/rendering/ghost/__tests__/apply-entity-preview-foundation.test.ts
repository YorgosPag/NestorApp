/**
 * ADR-436 Slice 1b — `applyEntityPreview` foundation pad live-ghost parity tests.
 *
 * The foundation branch routes through `applyFoundationGripDrag` +
 * `computeFoundationGeometry` so the live ghost == the commit. These lock the
 * Alt-move + width resize + 6-click-rotation preview = commit parity (mirror
 * apply-entity-preview-column.test.ts).
 */
import { applyEntityPreview, type EntityPreviewTransform } from '../apply-entity-preview';
import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
} from '../../../hooks/drawing/foundation-completion';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { FoundationEntity, PadFootingParams } from '../../../bim/types/foundation-types';

function makePad(pos: { x: number; y: number }): FoundationEntity {
  const r = buildFoundationEntity(buildDefaultFoundationParams(pos, 'pad', {}, 'mm'), 'lyr');
  if (!r.ok) throw new Error('fixture invalid');
  return r.entity;
}

describe('applyEntityPreview — foundation (ADR-436)', () => {
  it('foundation-center Alt-move → ghost params translated by delta', () => {
    const pad = makePad({ x: 0, y: 0 });
    const preview: EntityPreviewTransform = {
      entityId: pad.id,
      gripIndex: 0,
      delta: { x: 300, y: 150 },
      movesEntity: false,
      foundationGripKind: 'foundation-center',
      anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(pad as unknown as DxfEntityUnion, preview) as unknown as FoundationEntity;
    expect(ghost).not.toBe(pad); // cloned
    const gp = ghost.params as PadFootingParams;
    expect(gp.position.x).toBeCloseTo(300, 6);
    expect(gp.position.y).toBeCloseTo(150, 6);
    expect(ghost.geometry).toBeDefined(); // geometry recomputed for the ghost
  });

  it('foundation-rotation 6-click → ghost orbits pivot + adds swept angle (matches commit)', () => {
    const pad = makePad({ x: 50, y: 0 });
    const preview: EntityPreviewTransform = {
      entityId: pad.id,
      gripIndex: 1,
      delta: { x: -100, y: 100 },
      movesEntity: false,
      foundationGripKind: 'foundation-rotation',
      anchorPos: { x: 100, y: 0 },
      rotatePivot: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(pad as unknown as DxfEntityUnion, preview) as unknown as FoundationEntity;
    const gp = ghost.params as PadFootingParams;
    // position (50,0) rotated 90° CCW about origin → (0,50); rotation 0 → 90.
    expect(gp.position.x).toBeCloseTo(0, 6);
    expect(gp.position.y).toBeCloseTo(50, 6);
    expect(gp.rotation).toBeCloseTo(90, 6);
  });

  it('non-targeting preview / zero delta → original reference unchanged', () => {
    const pad = makePad({ x: 0, y: 0 });
    const zero: EntityPreviewTransform = {
      entityId: pad.id, gripIndex: 0, delta: { x: 0, y: 0 }, movesEntity: false,
      foundationGripKind: 'foundation-center', anchorPos: { x: 0, y: 0 },
    };
    expect(applyEntityPreview(pad as unknown as DxfEntityUnion, zero)).toBe(pad);
  });
});
