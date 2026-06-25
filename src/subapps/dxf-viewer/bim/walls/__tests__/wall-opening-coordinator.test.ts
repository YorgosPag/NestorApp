/**
 * ADR-363 §5.4 — Hosted-opening cascade SSoT tests.
 *
 * Covers `recomputeHostedOpeningGeometry` + `cascadeHostedOpeningsForWalls`:
 *   - openings recompute against the new wall, SAME offsetFromStart
 *   - geometry equals the `computeOpeningGeometry` SSoT (no divergent math)
 *   - wallId scan via `getEntities`, fallback to `hostedOpeningIds`
 *   - meter scene units respected (ADR-397/398 unit-mismatch lesson)
 *   - moving the wall carries the opening (position follows the axis)
 *   - cascade no-ops for non-walls / walls without openings / empty input
 */

import {
  recomputeHostedOpeningGeometry,
  cascadeHostedOpeningsForWalls,
} from '../wall-opening-coordinator';
import { computeOpeningGeometry } from '../../geometry/opening-geometry';
import { computeWallGeometry } from '../../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';

const TOL = 1e-6;

function makeWallParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  } as WallParams;
}

function makeWall(id: string, overrides?: Partial<WallParams>, hostedOpeningIds?: string[]): WallEntity {
  const params = makeWallParams(overrides);
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
    ...(hostedOpeningIds ? { hostedOpeningIds } : {}),
  } as unknown as WallEntity;
}

function makeOpeningParams(wallId: string, overrides?: Partial<OpeningParams>): OpeningParams {
  return {
    kind: 'door',
    wallId,
    offsetFromStart: 1000,
    width: 900,
    height: 2100,
    sillHeight: 0,
    handing: 'left',
    openDirection: 'inward',
    ...overrides,
  } as OpeningParams;
}

function makeOpening(id: string, wallId: string, overrides?: Partial<OpeningParams>): OpeningEntity {
  const params = makeOpeningParams(wallId, overrides);
  const host = makeWall(wallId);
  return {
    id,
    type: 'opening',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: computeOpeningGeometry(params, host, 'mm'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

/** Mock ISceneManager backed by a Map; records updateEntities calls. */
function makeSceneManager(
  entities: ReadonlyArray<WallEntity | OpeningEntity>,
  opts: { withGetEntities?: boolean } = { withGetEntities: true },
): ISceneManager & { snapshot(id: string): SceneEntity | undefined } {
  // BIM entities have `visible?` optional (BaseEntity) vs SceneEntity's required
  // `visible`; the mocks always set it, so the cast is safe at this single point.
  const seeded = entities.map((e) => e as unknown as SceneEntity);
  const sm = createMockSceneManager(seeded);
  const withSnapshot = Object.assign(sm, {
    snapshot: (id: string) => sm.store.get(id),
  });
  if (!opts.withGetEntities) {
    // Shadow getEntities so the fallback-to-hostedOpeningIds path is exercised.
    (withSnapshot as unknown as Record<string, unknown>).getEntities = undefined;
  }
  return withSnapshot;
}

describe('ADR-363 §5.4 — recomputeHostedOpeningGeometry', () => {
  it('recomputes geometry for openings hosted on the wall (wallId scan)', () => {
    const wall = makeWall('w1');
    const op = makeOpening('o1', 'w1');
    const other = makeOpening('o2', 'w_other');
    const sm = makeSceneManager([wall, op, other]);

    const patches = recomputeHostedOpeningGeometry(wall, sm);
    expect(patches.map((p) => p.openingId)).toEqual(['o1']);
  });

  it('keeps the SAME offsetFromStart and matches the computeOpeningGeometry SSoT', () => {
    // Wall moved +1000 in X. Opening offset unchanged → geometry follows axis.
    const movedWall = makeWall('w1', {
      start: { x: 1000, y: 0, z: 0 },
      end: { x: 6000, y: 0, z: 0 },
    });
    const op = makeOpening('o1', 'w1'); // offset 1000, width 900 → center @ 1450
    const sm = makeSceneManager([movedWall, op]);

    const [patch] = recomputeHostedOpeningGeometry(movedWall, sm);
    const expected = computeOpeningGeometry(op.params, movedWall, 'mm');
    expect(patch.geometry.position.x).toBeCloseTo(expected.position.x, TOL);
    // Center shifted with the wall: 1000 (wall start) + 1450 = 2450.
    expect(patch.geometry.position.x).toBeCloseTo(2450, TOL);
  });

  it('respects meter scene units (no 1000× off-screen drift)', () => {
    const meterWall = makeWall('w1', {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5, y: 0, z: 0 }, // 5 m axis in a meter scene
      thickness: 250,
      sceneUnits: 'm',
    });
    const op = makeOpening('o1', 'w1'); // offset 1000 mm, width 900 mm
    const sm = makeSceneManager([meterWall, op]);

    const [patch] = recomputeHostedOpeningGeometry(meterWall, sm);
    // 1450 mm → 1.45 m along the axis. (mm × 0.001)
    expect(patch.geometry.position.x).toBeCloseTo(1.45, TOL);
  });

  it('falls back to hostedOpeningIds when getEntities is absent', () => {
    const wall = makeWall('w1', undefined, ['o1']);
    const op = makeOpening('o1', 'w1');
    const sm = makeSceneManager([wall, op], { withGetEntities: false });

    const patches = recomputeHostedOpeningGeometry(wall, sm);
    expect(patches.map((p) => p.openingId)).toEqual(['o1']);
  });

  it('returns [] for a wall with no hosted openings', () => {
    const wall = makeWall('w1');
    const sm = makeSceneManager([wall]);
    expect(recomputeHostedOpeningGeometry(wall, sm)).toEqual([]);
  });
});

describe('ADR-363 §5.4 — cascadeHostedOpeningsForWalls', () => {
  it('applies recomputed opening geometry after the wall moved', () => {
    const movedWall = makeWall('w1', {
      start: { x: 2000, y: 0, z: 0 },
      end: { x: 7000, y: 0, z: 0 },
    });
    const op = makeOpening('o1', 'w1'); // stale geometry @ center 1450
    const sm = makeSceneManager([movedWall, op]);

    cascadeHostedOpeningsForWalls(['w1'], sm);

    const updated = sm.snapshot('o1') as unknown as OpeningEntity;
    // Opening followed the wall: 2000 + 1450 = 3450.
    expect(updated.geometry.position.x).toBeCloseTo(3450, TOL);
  });

  it('no-ops for non-wall ids', () => {
    const op = makeOpening('o1', 'w1');
    const sm = makeSceneManager([op]);
    const before = sm.snapshot('o1');
    cascadeHostedOpeningsForWalls(['o1'], sm);
    expect(sm.snapshot('o1')).toBe(before);
  });

  it('no-ops for empty input', () => {
    const sm = makeSceneManager([makeWall('w1')]);
    expect(() => cascadeHostedOpeningsForWalls([], sm)).not.toThrow();
  });

  it('leaves openings hosted on OTHER walls untouched', () => {
    const wall = makeWall('w1', { start: { x: 3000, y: 0, z: 0 }, end: { x: 8000, y: 0, z: 0 } });
    const onW1 = makeOpening('o1', 'w1');
    const onOther = makeOpening('o2', 'w_other');
    const sm = makeSceneManager([wall, onW1, onOther]);
    const otherBefore = sm.snapshot('o2');

    cascadeHostedOpeningsForWalls(['w1'], sm);

    expect(sm.snapshot('o2')).toBe(otherBefore);
    expect((sm.snapshot('o1') as unknown as OpeningEntity).geometry.position.x).toBeCloseTo(4450, TOL);
  });
});
