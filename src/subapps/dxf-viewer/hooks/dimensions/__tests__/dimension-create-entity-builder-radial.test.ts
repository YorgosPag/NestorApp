/**
 * ADR-362 Phase D2 — radial family + ordinate entity-builder tests.
 *
 * Mirrors the structure of `dimension-create-entity-builder.test.ts` but covers
 * the 5 variants added in Phase D2: radius / diameter / arcLength / joggedRadius
 * / ordinate. Both preview (cursor-as-next-point) and commit (clicks-only)
 * paths exercised + association capture (D11).
 */

import type { ArcEntity, CircleEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type {
  ArcLengthDimensionEntity,
  DiameterDimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
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

function arc(id: string, center: Point2D, radius: number, startAngle = 0, endAngle = Math.PI / 2): ArcEntity {
  return { id, type: 'arc', center, radius, startAngle, endAngle, layerId: 'L' } as ArcEntity;
}

function circle(id: string, center: Point2D, radius: number): CircleEntity {
  return { id, type: 'circle', center, radius, layerId: 'L' } as CircleEntity;
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

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ──────────────────────────────────────────────────────────────────────────────
// Radius
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — buildRadius', () => {
  it('preview: cursor sets text direction, arcPoint snapped to perimeter', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      currentType: 'radius',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: arcHover }],
      cursorWorld: { x: 100, y: 100 },
    });
    const preview = buildPreviewDimensionEntity(s) as RadiusDimensionEntity;
    expect(preview.dimensionType).toBe('radius');
    expect(preview.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(distance(preview.defPoints[1], preview.defPoints[0])).toBeCloseTo(50, 6);
    expect(preview.textMidpoint).toEqual({ x: 100, y: 100 });
  });

  it('preview: returns null without a picked arc/circle on click 1', () => {
    const s = state({
      currentType: 'radius',
      clicks: [{ world: { x: 50, y: 0 } }],
      cursorWorld: { x: 100, y: 100 },
    });
    expect(buildPreviewDimensionEntity(s)).toBeNull();
  });

  it('commit: associations carry center pin on the picked arc', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      status: 'commit-ready',
      currentType: 'radius',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: arcHover },
        { world: { x: 80, y: 30 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_rad', layerId: 'lyr_x' });
    expect(result!.entity.id).toBe('dim_rad');
    expect(result!.associations).toHaveLength(1);
    expect(result!.associations[0]).toMatchObject({
      defPointIndex: 0, geometryId: 'A1', associationType: 'center',
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Diameter
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — buildDiameter', () => {
  it('commit: side2 is auto-derived antipodal to side1 (Q-B)', () => {
    const c = circle('C1', { x: 0, y: 0 }, 50);
    const s = state({
      status: 'commit-ready',
      currentType: 'diameter',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: c }, // direction = +X
        { world: { x: 0, y: 80 } },                  // text position
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_dia', layerId: 'lyr_x' });
    const entity = result!.entity as DiameterDimensionEntity;
    expect(entity.defPoints).toHaveLength(2);
    expect(entity.defPoints[0].x).toBeCloseTo(50, 6);
    expect(entity.defPoints[0].y).toBeCloseTo(0, 6);
    expect(entity.defPoints[1].x).toBeCloseTo(-50, 6);
    expect(entity.defPoints[1].y).toBeCloseTo(0, 6);
  });

  it('commit: emits nearest associations for both side points on the picked circle', () => {
    const c = circle('C1', { x: 0, y: 0 }, 50);
    const s = state({
      status: 'commit-ready',
      currentType: 'diameter',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: c },
        { world: { x: 0, y: 80 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_dia', layerId: 'lyr_x' });
    expect(result!.associations).toHaveLength(2);
    expect(result!.associations.map((a) => a.defPointIndex)).toEqual([0, 1]);
    expect(result!.associations[0].associationType).toBe('nearest');
  });

  it('preview: returns null without circle pick (arc is invalid for diameter)', () => {
    const arcHover = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      currentType: 'diameter',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: arcHover }],
      cursorWorld: { x: 0, y: 80 },
    });
    expect(buildPreviewDimensionEntity(s)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ArcLength
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — buildArcLength', () => {
  it('commit: derives center / arcStart / arcEnd from the picked arc', () => {
    // Arc centred at origin, radius 100, sweeping 0° → 90°.
    const a = arc('A1', { x: 0, y: 0 }, 100, 0, Math.PI / 2);
    const s = state({
      status: 'commit-ready',
      currentType: 'arcLength',
      clicks: [
        { world: { x: 100, y: 0 }, pickedEntity: a },
        { world: { x: 80, y: 80 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_arclen', layerId: 'lyr_x' });
    const entity = result!.entity as ArcLengthDimensionEntity;
    expect(entity.defPoints).toHaveLength(3);
    expect(entity.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(entity.defPoints[1].x).toBeCloseTo(100, 6); // cos(0) * 100
    expect(entity.defPoints[1].y).toBeCloseTo(0, 6);
    expect(entity.defPoints[2].x).toBeCloseTo(0, 6);   // cos(π/2) * 100
    expect(entity.defPoints[2].y).toBeCloseTo(100, 6);
    expect(entity.textMidpoint).toEqual({ x: 80, y: 80 });
  });

  it('commit: associations pin all 3 defPoints to the arc (center + 2 endpoints)', () => {
    const a = arc('A1', { x: 0, y: 0 }, 100);
    const s = state({
      status: 'commit-ready',
      currentType: 'arcLength',
      clicks: [
        { world: { x: 100, y: 0 }, pickedEntity: a },
        { world: { x: 80, y: 80 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_arclen', layerId: 'lyr_x' });
    expect(result!.associations).toHaveLength(3);
    expect(result!.associations.map((a2) => a2.associationType)).toEqual([
      'center',
      'endpoint',
      'endpoint',
    ]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// JoggedRadius
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — buildJoggedRadius', () => {
  it('commit: all 4 defPoints assembled (center + perimeter arcPoint + jogPoint + jogVertex)', () => {
    const a = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      status: 'commit-ready',
      currentType: 'joggedRadius',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: a }, // center pick
        { world: { x: 100, y: 0 } },                 // arcPoint direction → snapped to perimeter
        { world: { x: 200, y: 30 } },                // jogPoint
        { world: { x: 250, y: 0 } },                 // jogVertex
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_jog', layerId: 'lyr_x' });
    const entity = result!.entity as JoggedRadiusDimensionEntity;
    expect(entity.defPoints).toHaveLength(4);
    expect(entity.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(distance(entity.defPoints[1], { x: 0, y: 0 })).toBeCloseTo(50, 6); // on perimeter
    expect(entity.defPoints[2]).toEqual({ x: 200, y: 30 });
    expect(entity.defPoints[3]).toEqual({ x: 250, y: 0 });
  });

  it('preview: partial clicks pad with cursor so rubber-band stays alive', () => {
    const a = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      currentType: 'joggedRadius',
      clicks: [{ world: { x: 50, y: 0 }, pickedEntity: a }],
      cursorWorld: { x: 80, y: 30 },
    });
    const preview = buildPreviewDimensionEntity(s) as JoggedRadiusDimensionEntity;
    expect(preview).not.toBeNull();
    expect(preview.defPoints).toHaveLength(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ordinate
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase D2 — buildOrdinate', () => {
  it('commit: horizontal leader → axis="y" (reads the Y coordinate)', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'ordinate',
      clicks: [
        { world: { x: 100, y: 50 } },
        { world: { x: 300, y: 50 } }, // |Δx|=200 ≫ |Δy|=0 → axis 'y'
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_ord', layerId: 'lyr_x' });
    const entity = result!.entity as OrdinateDimensionEntity;
    expect(entity.axis).toBe('y');
    expect(entity.datum).toEqual({ x: 0, y: 0 });
    expect(entity.defPoints).toEqual([{ x: 100, y: 50 }]);
  });

  it('commit: vertical leader → axis="x" (reads the X coordinate)', () => {
    const s = state({
      status: 'commit-ready',
      currentType: 'ordinate',
      clicks: [
        { world: { x: 100, y: 50 } },
        { world: { x: 100, y: 300 } },
      ],
    });
    const entity = buildCommittedDimensionEntity(s, { id: 'dim_ord', layerId: 'lyr_x' })!
      .entity as OrdinateDimensionEntity;
    expect(entity.axis).toBe('x');
  });

  it('preview: cursor fills the leader endpoint', () => {
    const s = state({
      currentType: 'ordinate',
      clicks: [{ world: { x: 100, y: 50 } }],
      cursorWorld: { x: 300, y: 50 },
    });
    const preview = buildPreviewDimensionEntity(s) as OrdinateDimensionEntity;
    expect(preview.textMidpoint).toEqual({ x: 300, y: 50 });
    expect(preview.axis).toBe('y');
  });

  it('commit: emits association on the feature point when click 1 hovered an entity', () => {
    const a = arc('A1', { x: 0, y: 0 }, 50);
    const s = state({
      status: 'commit-ready',
      currentType: 'ordinate',
      clicks: [
        { world: { x: 50, y: 0 }, pickedEntity: a },
        { world: { x: 150, y: 0 } },
      ],
    });
    const result = buildCommittedDimensionEntity(s, { id: 'dim_ord', layerId: 'lyr_x' });
    expect(result!.associations).toHaveLength(1);
    expect(result!.associations[0]).toMatchObject({
      defPointIndex: 0, geometryId: 'A1',
    });
  });
});
