/**
 * ADR-363 Phase 7.2 — bim-copy-builder unit tests.
 *
 * Verifies:
 *   - Kind-specific enterprise IDs (wall_*, opening_*, …).
 *   - Host rewire when host is in selection (opening→wall, slab-opening→slab).
 *   - Host PRESERVED when host is NOT in selection.
 *   - Translate / mirror / rotate transform paths.
 *   - Non-BIM sources skipped (returned in `skipped`).
 */
import { buildBimCopyClones } from '../bim-copy-builder';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []) {
  const sm = createMockSceneManager(initial, {
    updateEntity: () => {},
    updateEntities: () => {},
    getEntityIndex: () => -1,
  });
  return { scene: sm.store, sm };
}

function makeWall(id = 'wall_src'): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeOpening(id = 'opn_src', wallId = 'wall_src'): OpeningEntity {
  return {
    id,
    type: 'opening',
    kind: 'door',
    layerId: 'L',
    params: {
      kind: 'door',
      wallId,
      offsetFromStart: 1000,
      width: 900,
      height: 2100,
      sillHeight: 0,
      handing: 'left',
    },
    geometry: {
      position: { x: 1000, y: 0, z: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      perimeter: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as OpeningEntity;
}

function makeSlab(id = 'slab_src'): SlabEntity {
  return {
    id,
    type: 'slab',
    kind: 'floor',
    layerId: 'L',
    params: {
      kind: 'floor',
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
          { x: 0, y: 1000 },
        ],
      },
      elevation: 0,
      thickness: 200,
    },
    geometry: { bbox: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeSlabOpening(id = 'slbopn_src', slabId = 'slab_src'): SlabOpeningEntity {
  return {
    id,
    type: 'slab-opening',
    kind: 'shaft',
    layerId: 'L',
    params: {
      kind: 'shaft',
      slabId,
      outline: {
        vertices: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 300 },
          { x: 100, y: 300 },
        ],
      },
    },
    geometry: { bbox: { min: { x: 100, y: 100 }, max: { x: 300, y: 300 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabOpeningEntity;
}

describe('ADR-363 Phase 7.2 — buildBimCopyClones', () => {
  it('generates kind-specific enterprise IDs (wall_<ulid>)', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const result = buildBimCopyClones(
      [wall.id],
      { kind: 'translate', delta: { x: 500, y: 0 } },
      sm,
    );
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0].id).toMatch(/^wall_[a-z0-9-]+$/i);
    expect(result.clones[0].id).not.toBe(wall.id);
  });

  it('opening clone: rewires wallId when wall is ALSO in selection', () => {
    const wall = makeWall();
    const opening = makeOpening('opn_src', wall.id);
    const { sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const result = buildBimCopyClones(
      [wall.id, opening.id],
      { kind: 'translate', delta: { x: 5000, y: 0 } },
      sm,
    );
    const cloneWall = result.clones.find((c) => c.type === 'wall');
    const cloneOpening = result.clones.find((c) => c.type === 'opening');
    expect(cloneWall).toBeDefined();
    expect(cloneOpening).toBeDefined();
    const cloneOpeningWallId = (cloneOpening as unknown as { params: { wallId: string } }).params.wallId;
    expect(cloneOpeningWallId).toBe(cloneWall!.id);
    expect(cloneOpeningWallId).not.toBe(wall.id);
  });

  it('opening clone: preserves wallId when wall is NOT in selection', () => {
    const wall = makeWall();
    const opening = makeOpening('opn_src', wall.id);
    const { sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const result = buildBimCopyClones(
      [opening.id], // wall NOT in selection
      { kind: 'translate', delta: { x: 0, y: 1000 } },
      sm,
    );
    const cloneOpening = result.clones[0];
    const cloneOpeningWallId = (cloneOpening as unknown as { params: { wallId: string } }).params.wallId;
    expect(cloneOpeningWallId).toBe(wall.id); // unchanged
  });

  it('slab-opening clone: rewires slabId when slab is in selection', () => {
    const slab = makeSlab();
    const slabOpening = makeSlabOpening('slbopn_src', slab.id);
    const { sm } = makeMockScene([
      slab as unknown as SceneEntity,
      slabOpening as unknown as SceneEntity,
    ]);
    const result = buildBimCopyClones(
      [slab.id, slabOpening.id],
      { kind: 'translate', delta: { x: 2000, y: 0 } },
      sm,
    );
    const cloneSlab = result.clones.find((c) => c.type === 'slab');
    const cloneSlabOpening = result.clones.find((c) => c.type === 'slab-opening');
    const cloneSlabOpeningSlabId = (cloneSlabOpening as unknown as { params: { slabId: string } }).params.slabId;
    expect(cloneSlabOpeningSlabId).toBe(cloneSlab!.id);
  });

  it('translate transform: clones shift by delta', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const result = buildBimCopyClones(
      [wall.id],
      { kind: 'translate', delta: { x: 500, y: 200 } },
      sm,
    );
    const cloneParams = (result.clones[0] as unknown as WallEntity).params;
    expect(cloneParams.start).toEqual({ x: 500, y: 200, z: 0 });
    expect(cloneParams.end).toEqual({ x: 4500, y: 200, z: 0 });
  });

  it('mirror transform: clones reflect across axis', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const result = buildBimCopyClones(
      [wall.id],
      { kind: 'mirror', axis: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } } },
      sm,
    );
    const cloneParams = (result.clones[0] as unknown as WallEntity).params;
    expect(cloneParams.start.x).toBe(0);
    expect(cloneParams.end.x).toBe(-4000);
  });

  it('rotate transform: clones rotate around pivot', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const result = buildBimCopyClones(
      [wall.id],
      { kind: 'rotate', pivot: { x: 0, y: 0 }, angleDeg: 90 },
      sm,
    );
    const cloneParams = (result.clones[0] as unknown as WallEntity).params;
    expect(cloneParams.start.x).toBeCloseTo(0, 4);
    expect(cloneParams.start.y).toBeCloseTo(0, 4);
    expect(cloneParams.end.x).toBeCloseTo(0, 4);
    expect(cloneParams.end.y).toBeCloseTo(4000, 4);
  });

  it('non-BIM source skipped (returned in `skipped`)', () => {
    const line: SceneEntity = {
      id: 'line_1',
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    } as unknown as SceneEntity;
    const { sm } = makeMockScene([line]);
    const result = buildBimCopyClones(
      [line.id],
      { kind: 'translate', delta: { x: 50, y: 0 } },
      sm,
    );
    expect(result.clones).toHaveLength(0);
    expect(result.skipped).toEqual(['line_1']);
  });

  it('missing source skipped (returned in `skipped`)', () => {
    const { sm } = makeMockScene([]);
    const result = buildBimCopyClones(
      ['ghost_id'],
      { kind: 'translate', delta: { x: 1, y: 1 } },
      sm,
    );
    expect(result.clones).toHaveLength(0);
    expect(result.skipped).toEqual(['ghost_id']);
  });

  it('sourceToCloneId mapping includes every successful clone', () => {
    const wall = makeWall();
    const opening = makeOpening('opn_src', wall.id);
    const { sm } = makeMockScene([
      wall as unknown as SceneEntity,
      opening as unknown as SceneEntity,
    ]);
    const result = buildBimCopyClones(
      [wall.id, opening.id],
      { kind: 'translate', delta: { x: 100, y: 0 } },
      sm,
    );
    expect(result.sourceToCloneId.size).toBe(2);
    expect(result.sourceToCloneId.get(wall.id)).toMatch(/^wall_[a-z0-9-]+$/i);
    expect(result.sourceToCloneId.get(opening.id)).toMatch(/^opening_[a-z0-9-]+$/i);
  });
});
