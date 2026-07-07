/**
 * ADR-581 Φ6 — match-preview-entity SSoT tests.
 *
 * Κλειδώνει το ghost ≡ commit invariant: το φάντασμα της σύριγγας χτίζεται από τα
 * ΙΔΙΑ patches + recompute με το click-commit. Καλύπτει: style-only clone (raw DXF),
 * params→geometry reshape (column), empty-patch clone, και ghost ≡ commit ισότητα.
 */

import { buildMatchPreviewEntity, recomputeParametricGeometry } from '../match-preview-entity';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import type { ColumnParams } from '../../../bim/types/column-types';
import type { EntityType } from '../../../types/entities';
import type { Channelled } from '../match-transfer-applier';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const rec = (e: unknown): Record<string, unknown> => e as Record<string, unknown>;

function rectColumnParams(width: number, depth: number): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width,
    depth,
    height: 3000,
    rotation: 0,
  } as unknown as ColumnParams;
}

function columnEntity(params: ColumnParams): DxfEntityUnion {
  return {
    id: 'c1',
    type: 'column',
    kind: 'rectangular',
    visible: true,
    params,
    geometry: computeColumnGeometry(params),
  } as unknown as DxfEntityUnion;
}

describe('match-preview-entity (ADR-581 Φ6)', () => {
  it('(α) style-only: merges scene patch, no geometry, original untouched', () => {
    const target = {
      id: 'l1', type: 'line', visible: true, color: '#000000',
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
    } as unknown as DxfEntityUnion;
    const patches: Channelled = { scenePatch: { color: '#ff0000' }, paramsPatch: {} };

    const preview = buildMatchPreviewEntity(target, 'line' as EntityType, patches);

    expect(rec(preview).color).toBe('#ff0000');
    expect(rec(preview).geometry).toBeUndefined();
    expect(rec(target).color).toBe('#000000'); // pure — original δεν άλλαξε
    expect(preview).not.toBe(target);
  });

  it('(β) column: params patch reshapes geometry', () => {
    const target = columnEntity(rectColumnParams(300, 300));
    const patches: Channelled = { scenePatch: {}, paramsPatch: { width: 600, depth: 450 } };

    const preview = buildMatchPreviewEntity(target, 'column' as EntityType, patches);

    expect(rec(rec(preview).params).width).toBe(600);
    expect(rec(rec(preview).params).depth).toBe(450);
    expect(rec(preview).geometry).toBeDefined();
    expect(rec(preview).geometry).not.toEqual(rec(target).geometry);
    // original params δεν μεταλλάχθηκαν
    expect(rec(rec(target).params).width).toBe(300);
  });

  it('(γ) empty patches → content-equal clone (νέο ref)', () => {
    const target = columnEntity(rectColumnParams(300, 300));
    const preview = buildMatchPreviewEntity(target, 'column' as EntityType, { scenePatch: {}, paramsPatch: {} });

    expect(preview).toEqual(target);
    expect(preview).not.toBe(target);
  });

  it('(δ) ghost ≡ commit: recomputed geometry == direct compute of merged params', () => {
    const params = rectColumnParams(300, 300);
    const target = columnEntity(params);
    const patch = { width: 500, depth: 350 };

    const preview = buildMatchPreviewEntity(target, 'column' as EntityType, { scenePatch: {}, paramsPatch: patch });
    const expected = computeColumnGeometry({ ...params, ...patch } as ColumnParams);

    expect(rec(preview).geometry).toEqual(expected);
    expect(recomputeParametricGeometry('column' as EntityType, { ...params, ...patch })).toEqual(expected);
  });

  it('recomputeParametricGeometry → null για opening (host-wall context) + raw kinds', () => {
    expect(recomputeParametricGeometry('opening' as EntityType, { widthMm: 900 })).toBeNull();
    expect(recomputeParametricGeometry('line' as EntityType, {})).toBeNull();
  });
});
