/**
 * ADR-362 Phase D1 — dimension-create-entity-builder unit tests.
 *
 * Covers both build paths:
 *   - `buildPreviewDimensionEntity` — cursor-as-next-point, used per frame to
 *     feed the PreviewCanvas overlay.
 *   - `buildCommittedDimensionEntity` — clicks-only, gated on
 *     `status === 'commit-ready'`, materialises `DimensionAssociation`s.
 *
 * Variants exercised: linear, aligned, angular2L (with picked lines + arc
 * anchor), angular3P (4 clicks). Radial / ordinate / baseline / continued
 * variants live in their own sibling builder modules — exercised in
 * `dimension-create-entity-builder-radial.test.ts` and
 * `dimension-create-chained-builders.test.ts`. This file also exercises the
 * dispatcher delegation path for those types.
 */

import type { LineEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type {
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  LinearDimensionEntity,
} from '../../../types/dimension';
import type { DimensionCreateState } from '../dimension-create-state';
import { initialDimensionCreateState } from '../dimension-create-state';
import {
  buildCommittedDimensionEntity,
  buildPreviewDimensionEntity,
} from '../dimension-create-entity-builder';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'dimstyle_iso';

function line(id: string, start: Point2D, end: Point2D): LineEntity {
  return { id, type: 'line', start, end, layerId: 'L' } as LineEntity;
}

function state(over: Partial<DimensionCreateState>): DimensionCreateState {
  return {
    ...initialDimensionCreateState,
    status: 'collecting',
    mode: 'manual',
    styleId: STYLE_ID,
    ...over,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Preview path
// ──────────────────────────────────────────────────────────────────────────────

describe('buildPreviewDimensionEntity', () => {
  it('returns null when currentType is not set', () => {
    const s = state({ currentType: null, cursorWorld: { x: 0, y: 0 } });
    expect(buildPreviewDimensionEntity(s)).toBeNull();
  });

  it('returns null when no clicks and no cursor', () => {
    const s = state({ currentType: 'linear' });
    expect(buildPreviewDimensionEntity(s)).toBeNull();
  });

  it('linear: cursor fills the next-to-be-placed point', () => {
    const s = state({
      currentType: 'linear',
      clicks: [{ world: { x: 0, y: 0 } }],
      cursorWorld: { x: 50, y: 50 },
    });
    const preview = buildPreviewDimensionEntity(s) as LinearDimensionEntity;
    expect(preview.dimensionType).toBe('linear');
    expect(preview.defPoints).toHaveLength(2);
    expect(preview.defPoints[1]).toEqual({ x: 50, y: 50 });
  });

  it('linear: caps defPoints at the variant maximum (3) when clicks fill it', () => {
    const s = state({
      currentType: 'linear',
      clicks: [
        { world: { x: 0, y: 0 } },
        { world: { x: 100, y: 0 } },
        { world: { x: 50, y: 30 } },
      ],
      cursorWorld: { x: 999, y: 999 },
    });
    const preview = buildPreviewDimensionEntity(s) as LinearDimensionEntity;
    expect(preview.defPoints).toHaveLength(3);
    expect(preview.defPoints[2]).toEqual({ x: 50, y: 30 });
  });

  it('angular2L: degenerate placeholder when only line1 is picked', () => {
    const l1 = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const s = state({
      currentType: 'angular2L',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: l1 }],
      cursorWorld: { x: 80, y: 30 },
    });
    const preview = buildPreviewDimensionEntity(s) as Angular2LDimensionEntity;
    expect(preview).not.toBeNull();
    expect(preview.dimensionType).toBe('angular2L');
    // defPoints = [line1.start, line1.end, cursor, cursor, arcAnchor].
    expect(preview.defPoints).toHaveLength(5);
    expect(preview.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(preview.defPoints[1]).toEqual({ x: 100, y: 0 });
    expect(preview.defPoints[2]).toEqual({ x: 80, y: 30 });
  });

  it('angular3P: 2 clicks + cursor → 3 defPoints (preview not yet ready to commit)', () => {
    const s = state({
      currentType: 'angular3P',
      clicks: [
        { world: { x: 0, y: 0 } },
        { world: { x: 100, y: 0 } },
      ],
      cursorWorld: { x: 0, y: 100 },
    });
    const preview = buildPreviewDimensionEntity(s) as Angular3PDimensionEntity;
    expect(preview.defPoints).toHaveLength(3);
    expect(preview.defPoints[2]).toEqual({ x: 0, y: 100 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Commit path
// ──────────────────────────────────────────────────────────────────────────────

describe('buildCommittedDimensionEntity', () => {
  it('returns null while status is not commit-ready', () => {
    const s = state({ currentType: 'linear', clicks: [{ world: { x: 0, y: 0 } }] });
    expect(buildCommittedDimensionEntity(s, { id: 'X', layerId: 'L' })).toBeNull();
  });

  it('linear: real id + layerId applied, defPoints from clicks only', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'linear',
      clicks: [
        { world: { x: 0, y: 0 } },
        { world: { x: 100, y: 0 } },
        { world: { x: 50, y: 30 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result).not.toBeNull();
    expect(result!.entity.id).toBe('dim_real');
    expect(result!.entity.layerId).toBe('lyr_x');
    expect(result!.entity.defPoints).toHaveLength(3);
    expect(result!.entity.defPoints[2]).toEqual({ x: 50, y: 30 });
  });

  it('captures associations for clicks with pickedEntity (linear)', () => {
    const l1 = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const s = state({
      status: 'commit-ready',
      currentType: 'linear',
      clicks: [
        { world: { x: 0, y: 0 }, pickedEntity: l1 },
        { world: { x: 100, y: 0 }, pickedEntity: l1 },
        { world: { x: 50, y: 30 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.associations).toHaveLength(2);
    // ADR-362 2026-05-19 hotfix: linear/aligned/angular3P/ordinate/baseline/continued
    // use 'nearest' (position-preserving) until snap-aware capture lands. 'endpoint'
    // without subIndex caused the observer to snap defPoint to `line.end`.
    expect(result!.associations[0]).toMatchObject({
      defPointIndex: 0, geometryId: 'L1', associationType: 'nearest',
    });
    expect(result!.entity.associations).toEqual(result!.associations);
  });

  it('angular2L: emits 4 line endpoint associations (2 per picked line)', () => {
    const l1 = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const l2 = line('L2', { x: 0, y: 0 }, { x: 0, y: 100 });
    const s = state({
      status: 'commit-ready',
      currentType: 'angular2L',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: l1 },
        { world: { x: 0, y: 50 }, pickedEntity: l2 },
        { world: { x: 30, y: 30 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.defPoints).toHaveLength(5);
    expect(result!.associations).toHaveLength(4);
    expect(result!.associations.map((a) => a.defPointIndex)).toEqual([0, 1, 2, 3]);
    expect(result!.associations[0].subIndex).toBe(0);
    expect(result!.associations[1].subIndex).toBe(1);
  });

  it('angular3P: 4 defPoints with associations only on picked clicks', () => {
    const l1 = line('L1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const s = state({
      status: 'commit-ready',
      currentType: 'angular3P',
      clicks: [
        { world: { x: 0, y: 0 }, pickedEntity: l1 },
        { world: { x: 100, y: 0 } },
        { world: { x: 0, y: 100 } },
        { world: { x: 50, y: 50 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.defPoints).toHaveLength(4);
    expect(result!.associations).toHaveLength(1);
    expect(result!.associations[0].defPointIndex).toBe(0);
  });

  it('Phase D2 radial without entity pick still returns null (guard at builder level)', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'radius',
      clicks: [
        { world: { x: 0, y: 0 } },
        { world: { x: 100, y: 0 } },
        { world: { x: 50, y: 30 } },
      ],
    });
    expect(buildCommittedDimensionEntity(s, { id: 'X', layerId: 'L' })).toBeNull();
  });

  it('Phase D3 baseline/continued without parentDimensionId returns null (defensive)', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'baseline',
      clicks: [{ world: { x: 100, y: 0 } }],
    });
    expect(buildCommittedDimensionEntity(s, { id: 'X', layerId: 'L' })).toBeNull();
  });

  it('Phase D3 baseline WITH parentDimensionId commits a BaselineDimensionEntity', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'baseline',
      parentDimensionId: 'dim_parent_123',
      clicks: [{ world: { x: 100, y: 0 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_b1', layerId: 'lyr_x' });
    expect(result).not.toBeNull();
    expect(result!.entity.dimensionType).toBe('baseline');
    expect(result!.entity.defPoints).toEqual([{ x: 100, y: 0 }]);
    expect((result!.entity as { parentDimensionId?: string }).parentDimensionId).toBe(
      'dim_parent_123',
    );
  });

  it('Phase D3 continued WITH parent + hovered host yields an endpoint association', () => {
    const hovered = line('L_host', { x: 0, y: 0 }, { x: 200, y: 0 });
    const s = state({
      status: 'commit-ready',
      currentType: 'continued',
      parentDimensionId: 'dim_parent_456',
      clicks: [{ world: { x: 200, y: 0 }, pickedEntity: hovered }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_c1', layerId: 'lyr_x' });
    expect(result).not.toBeNull();
    expect(result!.entity.dimensionType).toBe('continued');
    expect(result!.associations).toHaveLength(1);
    expect(result!.associations[0].defPointIndex).toBe(0);
    expect(result!.associations[0].geometryId).toBe('L_host');
  });
});
