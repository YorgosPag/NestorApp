/**
 * ADR-362 Phase N — pick-entity quick dimension builder tests (`dim-entity`).
 *
 * Covers:
 *   - `resolveEntityDimKind` zone logic (aligned / linear-h / linear-v) across
 *     the three named drag gestures, on diagonal + axis-aligned spans.
 *   - `buildEntityPickDimension` routed via the shared preview/commit entry:
 *     line & wall → linear/aligned span; circle → diameter; arc → radius.
 *   - Association capture: entity-mode line/wall anchors both span endpoints
 *     (subIndex 0/1) to the single picked host.
 */

import type { ArcEntity, CircleEntity, LineEntity, WallEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { DimensionCreateState } from '../dimension-create-state';
import { initialDimensionCreateState } from '../dimension-create-state';
import {
  buildCommittedDimensionEntity,
  buildPreviewDimensionEntity,
} from '../dimension-create-entity-builder';
import { resolveEntityDimKind } from '../dimension-create-entity-pick-builder';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'dimstyle_iso';

function line(id: string, start: Point2D, end: Point2D): LineEntity {
  return { id, type: 'line', start, end, layerId: 'L' } as LineEntity;
}

function circle(id: string, center: Point2D, radius: number): CircleEntity {
  return { id, type: 'circle', center, radius, layerId: 'L' } as CircleEntity;
}

function arc(id: string, center: Point2D, radius: number): ArcEntity {
  return { id, type: 'arc', center, radius, startAngle: 0, endAngle: Math.PI / 2, layerId: 'L' } as ArcEntity;
}

function wall(id: string, start: Point2D, end: Point2D): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    params: { start: { ...start, z: 0 }, end: { ...end, z: 0 } },
    layerId: 'L',
  } as unknown as WallEntity;
}

/** Entity-mode state: `currentType` is any non-null value (routing ignores it). */
function entityState(over: Partial<DimensionCreateState>): DimensionCreateState {
  return {
    ...initialDimensionCreateState,
    status: 'collecting',
    mode: 'entity',
    currentType: 'aligned',
    styleId: STYLE_ID,
    ...over,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Zone logic
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveEntityDimKind', () => {
  const A = { x: 0, y: 0 };
  const B = { x: 4, y: 3 }; // 3-4-5 diagonal, ~36.87°

  it('perpendicular drag → aligned (true length)', () => {
    // midpoint (2, 1.5) + along the entity normal (-0.6, 0.8)
    expect(resolveEntityDimKind(A, B, { x: -4, y: 9.5 })).toBe('aligned');
  });

  it('vertical drag (↑/↓) → linear-h (horizontal projection)', () => {
    expect(resolveEntityDimKind(A, B, { x: 2, y: 12 })).toBe('linear-h');
    expect(resolveEntityDimKind(A, B, { x: 2, y: -12 })).toBe('linear-h');
  });

  it('horizontal drag (←/→) → linear-v (vertical projection)', () => {
    expect(resolveEntityDimKind(A, B, { x: -12, y: 1.5 })).toBe('linear-v');
    expect(resolveEntityDimKind(A, B, { x: 16, y: 1.5 })).toBe('linear-v');
  });

  it('degenerate placement on the span midpoint → aligned', () => {
    expect(resolveEntityDimKind(A, B, { x: 2, y: 1.5 })).toBe('aligned');
  });

  it('axis-aligned span: aligned and horizontal coincide (value identical)', () => {
    const kind = resolveEntityDimKind({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 6 });
    expect(kind === 'aligned' || kind === 'linear-h').toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Line / wall → aligned | linear
// ──────────────────────────────────────────────────────────────────────────────

describe('buildEntityPickDimension — line / wall span', () => {
  it('diagonal line, vertical drag → linear (rotation 0), span endpoints as defPoints', () => {
    const l = line('L1', { x: 0, y: 0 }, { x: 4, y: 3 });
    const s = entityState({
      status: 'commit-ready',
      clicks: [{ world: { x: 2, y: 1.5 }, pickedEntity: l }, { world: { x: 2, y: 12 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.dimensionType).toBe('linear');
    expect(result!.entity.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(result!.entity.defPoints[1]).toEqual({ x: 4, y: 3 });
    expect(result!.entity.defPoints[2]).toEqual({ x: 2, y: 12 });
  });

  it('diagonal line, perpendicular drag → aligned', () => {
    const l = line('L2', { x: 0, y: 0 }, { x: 4, y: 3 });
    const s = entityState({
      status: 'commit-ready',
      clicks: [{ world: { x: 2, y: 1.5 }, pickedEntity: l }, { world: { x: -4, y: 9.5 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.dimensionType).toBe('aligned');
  });

  it('wall uses centerline endpoints as the measured span', () => {
    const w = wall('W1', { x: 0, y: 0 }, { x: 0, y: 300 });
    const s = entityState({
      status: 'commit-ready',
      clicks: [{ world: { x: 0, y: 150 }, pickedEntity: w }, { world: { x: 80, y: 150 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(result!.entity.defPoints[1]).toEqual({ x: 0, y: 300 });
  });

  it('preview: uses the live cursor as placement', () => {
    const l = line('L3', { x: 0, y: 0 }, { x: 100, y: 0 });
    const s = entityState({
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: l }],
      cursorWorld: { x: 50, y: 40 },
    });
    const preview = buildPreviewDimensionEntity(s);
    expect(preview!.defPoints[2]).toEqual({ x: 50, y: 40 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Circle / arc delegation
// ──────────────────────────────────────────────────────────────────────────────

describe('buildEntityPickDimension — radial delegation', () => {
  it('circle pick → diameter', () => {
    const c = circle('C1', { x: 0, y: 0 }, 50);
    const s = entityState({
      status: 'commit-ready',
      currentType: 'diameter',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: c }, { world: { x: 90, y: 0 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.dimensionType).toBe('diameter');
  });

  it('arc pick → radius', () => {
    const a = arc('A1', { x: 0, y: 0 }, 50);
    const s = entityState({
      status: 'commit-ready',
      currentType: 'radius',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: a }, { world: { x: 90, y: 90 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.entity.dimensionType).toBe('radius');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Association capture
// ──────────────────────────────────────────────────────────────────────────────

describe('entity-pick association capture', () => {
  it('line: anchors both span endpoints to the single host (subIndex 0/1)', () => {
    const l = line('L9', { x: 0, y: 0 }, { x: 100, y: 0 });
    const s = entityState({
      status: 'commit-ready',
      clicks: [{ world: { x: 40, y: 0 }, pickedEntity: l }, { world: { x: 50, y: 30 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.associations).toHaveLength(2);
    expect(result!.associations[0]).toMatchObject({
      defPointIndex: 0, geometryId: 'L9', associationType: 'endpoint', subIndex: 0,
    });
    expect(result!.associations[1]).toMatchObject({
      defPointIndex: 1, geometryId: 'L9', associationType: 'endpoint', subIndex: 1,
    });
  });

  it('wall: anchors both span endpoints to the wall host', () => {
    const w = wall('W9', { x: 0, y: 0 }, { x: 500, y: 0 });
    const s = entityState({
      status: 'commit-ready',
      clicks: [{ world: { x: 250, y: 0 }, pickedEntity: w }, { world: { x: 250, y: 60 } }],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_real', layerId: 'lyr_x' });
    expect(result!.associations.map((a) => a.geometryId)).toEqual(['W9', 'W9']);
    expect(result!.associations.map((a) => a.subIndex)).toEqual([0, 1]);
  });
});
