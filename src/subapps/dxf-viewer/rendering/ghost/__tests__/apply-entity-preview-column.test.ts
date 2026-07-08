/**
 * ADR-397 — `applyEntityPreview` column live-ghost parity tests.
 *
 * The column branch was MISSING from the ghost SSoT (only wall/beam/slab/stair
 * existed), so columns had zero live preview during move/rotation/resize — the
 * commit worked on release but the user saw no ghost ("δεν συμπεριφέρεται σωστά").
 * These lock the move + 6-click-rotation preview = commit parity.
 */
import { applyEntityPreview, type EntityPreviewTransform } from '../apply-entity-preview';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { ColumnEntity } from '../../../bim/types/column-types';

function makeColumn(pos: { x: number; y: number }): ColumnEntity {
  const r = buildColumnEntity(buildDefaultColumnParams(pos, 'rectangular'), 'lyr', 'mm');
  if (!r.ok) throw new Error('fixture invalid');
  return r.entity;
}

describe('applyEntityPreview — column (ADR-397)', () => {
  it('column-center move → ghost params translated by delta', () => {
    const col = makeColumn({ x: 0, y: 0 });
    const preview: EntityPreviewTransform = {
      entityId: col.id,
      gripIndex: 0,
      delta: { x: 300, y: 150 },
      movesEntity: true,
      gripKind: { on: 'column', kind: 'column-center' },
      anchorPos: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(col as unknown as DxfEntityUnion, preview) as unknown as ColumnEntity;
    expect(ghost).not.toBe(col); // cloned
    expect(ghost.params.position.x).toBeCloseTo(300, 6);
    expect(ghost.params.position.y).toBeCloseTo(150, 6);
    expect(ghost.geometry).toBeDefined(); // geometry recomputed for the ghost
  });

  it('column-rotation 6-click → ghost orbits pivot + adds swept angle (matches commit)', () => {
    // pivot origin, reference arm anchor at (100,0)=0°, align to (0,100)=90°.
    // preview encoding (mirror buildRotateReferencePreview await-align-end):
    //   anchorPos = pivot + refDir = (100,0); delta = alignDir − refDir = (-100,100).
    const col = makeColumn({ x: 50, y: 0 });
    const preview: EntityPreviewTransform = {
      entityId: col.id,
      gripIndex: 1,
      delta: { x: -100, y: 100 },
      movesEntity: false,
      gripKind: { on: 'column', kind: 'column-rotation' },
      anchorPos: { x: 100, y: 0 },
      rotatePivot: { x: 0, y: 0 },
    };
    const ghost = applyEntityPreview(col as unknown as DxfEntityUnion, preview) as unknown as ColumnEntity;
    // position (50,0) rotated 90° CCW about origin → (0,50); rotation 0 → 90.
    expect(ghost.params.position.x).toBeCloseTo(0, 6);
    expect(ghost.params.position.y).toBeCloseTo(50, 6);
    expect(ghost.params.rotation).toBeCloseTo(90, 6);
  });

  it('non-targeting preview / zero delta → original reference unchanged', () => {
    const col = makeColumn({ x: 0, y: 0 });
    const zero: EntityPreviewTransform = {
      entityId: col.id, gripIndex: 0, delta: { x: 0, y: 0 }, movesEntity: true,
      gripKind: { on: 'column', kind: 'column-center' },
      anchorPos: { x: 0, y: 0 },
    };
    expect(applyEntityPreview(col as unknown as DxfEntityUnion, zero)).toBe(col);
  });
});
