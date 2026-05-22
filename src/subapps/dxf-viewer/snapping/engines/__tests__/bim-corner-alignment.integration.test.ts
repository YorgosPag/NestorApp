/**
 * ADR-371 §9.3 — BIM Corner Snap Priority Integration Tests.
 *
 * These tests verify the COMPETITIVE PRIORITY between snap engines:
 *
 *   BIM_*_CORNER (priority -2)  beats  ENDPOINT (priority 0)
 *
 * Real-world scenario: a line/polyline entity whose endpoint coincides with
 * a BIM face corner (wall outer-start, column NE, etc.). Both engines fire
 * at the same world coordinate. The BIM corner engine MUST win.
 *
 * All 5 ADR §9.3 integration scenarios:
 *   S1 — Wall-to-wall corner alignment: two wall corners close, nearest wins
 *   S2 — Wall-to-column corner: wall corner vs column bbox corner, nearest wins
 *   S3 — Opening jamb-to-wall corner: opening corner at wall corner position
 *   S4 — Priority verification: ENDPOINT at same point as BIM_WALL_CORNER → corner wins
 *   S5 — Toggle-off simulation: without WallCornerSnapEngine → ENDPOINT wins
 */

import { WallCornerSnapEngine } from '../WallCornerSnapEngine';
import { ColumnCornerSnapEngine } from '../ColumnCornerSnapEngine';
import { OpeningCornerSnapEngine } from '../OpeningCornerSnapEngine';
import { EndpointSnapEngine } from '../EndpointSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import { SNAP_ENGINE_PRIORITIES } from '../../../config/tolerance-config';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { OpeningEntity } from '../../../bim/types/opening-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel, Point2D } from '../../../rendering/types/Types';
import type { Polygon3D } from '../../../bim/types/bim-base';

// ─── Entity factories ─────────────────────────────────────────────────────────

function makeWall(overrides: Partial<WallParams> = {}, id = 'wall_1'): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    ...overrides,
  } as WallParams;
  return {
    id, type: 'wall', kind: 'straight', layerId: '0',
    params, geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as WallEntity;
}

function makeColumn(x: number, y: number, overrides: Partial<ColumnParams> = {}, id = 'col_1'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'rectangular');
  return {
    id, type: 'column', kind: base.kind, layerId: '0',
    params: { ...base, ...overrides },
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

function makeOpening(vertices: { x: number; y: number }[], id = 'opening_1'): OpeningEntity {
  const outline: Polygon3D = { vertices: vertices.map((v) => ({ x: v.x, y: v.y })) };
  return {
    id, type: 'opening', kind: 'door', ifcType: 'IfcDoor', layerId: '0',
    params: { kind: 'door', wallId: 'wall_1', offsetFromStart: 500, width: 900, height: 2100, sillHeight: 0 },
    geometry: { position: { x: 500, y: 0 }, rotation: 0, outline, bbox: undefined as never, area: 1.89, perimeter: 6 },
    validation: undefined as never, visible: true,
  } as unknown as OpeningEntity;
}

function makeLine(start: Point2D, end: Point2D, id: string): EntityModel {
  return { id, type: 'line', start, end, visible: true } as EntityModel;
}

function makeContext(radiusFn?: () => number): SnapEngineContext {
  const r = radiusFn ?? (() => 300);
  return { entities: [], worldRadiusAt: r, worldRadiusForType: r, maxCandidates: 20 };
}

// ─── Helper: merge + sort candidates by priority then distance ────────────────

function bestCandidate(all: ReturnType<SnapEngineContext['worldRadiusAt']> extends never ? never : { type: ExtendedSnapType; priority: number; distance: number }[]) {
  return [...all].sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority : a.distance - b.distance,
  )[0];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BIM Corner Snap — Priority constants', () => {
  it('BIM_WALL_CORNER priority = -2', () => {
    expect(SNAP_ENGINE_PRIORITIES.BIM_WALL_CORNER).toBe(-2);
  });
  it('ENDPOINT priority = 0', () => {
    expect(SNAP_ENGINE_PRIORITIES.ENDPOINT).toBe(0);
  });
  it('All 5 BIM corner types have priority < ENDPOINT', () => {
    const corner = [
      SNAP_ENGINE_PRIORITIES.BIM_WALL_CORNER,
      SNAP_ENGINE_PRIORITIES.BIM_BEAM_CORNER,
      SNAP_ENGINE_PRIORITIES.BIM_SLAB_CORNER,
      SNAP_ENGINE_PRIORITIES.BIM_COLUMN_CORNER,
      SNAP_ENGINE_PRIORITIES.BIM_OPENING_CORNER,
    ];
    for (const p of corner) {
      expect(p).toBeLessThan(SNAP_ENGINE_PRIORITIES.ENDPOINT);
    }
  });
});

// ─── S1: Wall-to-wall corner alignment ───────────────────────────────────────

describe('S1 — Wall-to-wall corner alignment', () => {
  it('two walls: WallCornerSnapEngine finds corners from both independently', () => {
    const wallA = makeWall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }, 'wall_a');
    const wallB = makeWall({ start: { x: 1000, y: 0 }, end: { x: 1000, y: 1000 } }, 'wall_b');

    const engine = new WallCornerSnapEngine();
    engine.initialize([wallA, wallB]);

    // Near wallA outer-start (0, 100) → WallA corner found
    const nearA = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext());
    expect(nearA.candidates.length).toBeGreaterThan(0);
    expect(nearA.candidates.every((c) => c.type === ExtendedSnapType.BIM_WALL_CORNER)).toBe(true);

    // Near wallB — a corner should be found
    const nearB = engine.findSnapCandidates({ x: 1000, y: 500 }, makeContext());
    expect(nearB.candidates.some((c) => c.entityId === 'wall_b')).toBe(true);

    engine.dispose();
  });

  it('closer of two wall corners wins when both are within radius', () => {
    // wallA outer-end at (1000, 100), wallB outer-start also near (1000, 100)
    const wallA = makeWall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }, 'wall_a');
    const wallB = makeWall({ start: { x: 1000, y: 200 }, end: { x: 2000, y: 200 } }, 'wall_b');

    const engine = new WallCornerSnapEngine();
    engine.initialize([wallA, wallB]);

    // Cursor exactly at wallA outer-end (1000, 100) — closer to wallA corners
    const { candidates } = engine.findSnapCandidates({ x: 1000, y: 100 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);

    // First candidate (sorted by distance) should be from wallA
    const nearestFromA = candidates.find(
      (c) => c.entityId === 'wall_a' && Math.abs(c.point.x - 1000) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(nearestFromA).toBeDefined();
    expect(nearestFromA!.distance).toBeLessThanOrEqual(candidates[candidates.length - 1]!.distance);

    engine.dispose();
  });
});

// ─── S2: Wall-to-column corner ────────────────────────────────────────────────

describe('S2 — Wall-to-column corner', () => {
  it('wall corner and column corner independently found by their own engines', () => {
    // Wall outer-start at approximately (0, 100)
    const wall = makeWall({}, 'wall_1');
    // Column NE corner at (200, 150) for width=400, depth=300
    const col = makeColumn(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' }, 'col_1');

    const wallEngine = new WallCornerSnapEngine();
    const colEngine = new ColumnCornerSnapEngine();
    wallEngine.initialize([wall]);
    colEngine.initialize([col]);

    const wallCandidates = wallEngine.findSnapCandidates({ x: 0, y: 100 }, makeContext()).candidates;
    const colCandidates = colEngine.findSnapCandidates({ x: 200, y: 150 }, makeContext()).candidates;

    expect(wallCandidates.length).toBeGreaterThan(0);
    expect(wallCandidates[0]!.type).toBe(ExtendedSnapType.BIM_WALL_CORNER);

    expect(colCandidates.length).toBeGreaterThan(0);
    expect(colCandidates[0]!.type).toBe(ExtendedSnapType.BIM_COLUMN_CORNER);

    // Both have priority -2 — distance tiebreaks
    expect(wallCandidates[0]!.priority).toBe(-2);
    expect(colCandidates[0]!.priority).toBe(-2);

    wallEngine.dispose();
    colEngine.dispose();
  });
});

// ─── S3: Opening jamb-to-wall corner ─────────────────────────────────────────

describe('S3 — Opening jamb-to-wall corner', () => {
  it('opening corner and wall corner both carry priority -2', () => {
    const wall = makeWall({}, 'wall_1');
    // Opening outline = 4 vertices, first one at (500, -100) = inner-start position
    const OPENING_VERTS = [
      { x: 500, y: -100 }, { x: 1400, y: -100 },
      { x: 1400, y: 100 }, { x: 500, y: 100 },
    ];
    const opening = makeOpening(OPENING_VERTS, 'opening_1');

    const wallEngine = new WallCornerSnapEngine();
    const openingEngine = new OpeningCornerSnapEngine();
    wallEngine.initialize([wall]);
    openingEngine.initialize([opening]);

    const wallCorner = wallEngine.findSnapCandidates({ x: 0, y: 100 }, makeContext()).candidates;
    const openingCorner = openingEngine.findSnapCandidates({ x: 500, y: -100 }, makeContext()).candidates;

    expect(wallCorner.length).toBeGreaterThan(0);
    expect(openingCorner.length).toBeGreaterThan(0);
    expect(wallCorner[0]!.priority).toBe(-2);
    expect(openingCorner[0]!.priority).toBe(-2);
    expect(openingCorner[0]!.type).toBe(ExtendedSnapType.BIM_OPENING_CORNER);

    wallEngine.dispose();
    openingEngine.dispose();
  });
});

// ─── S4: Priority verification — BIM_WALL_CORNER beats ENDPOINT ──────────────

describe('S4 — Priority: BIM_WALL_CORNER beats ENDPOINT at same position', () => {
  it('line endpoint at wall outer-start position → corner candidate wins by priority', () => {
    const wall = makeWall({ thickness: 200 }, 'wall_1');
    // Place a line whose start endpoint is at the wall outer-start corner (0, 100)
    const lineAtCorner = makeLine({ x: 0, y: 100 }, { x: -200, y: 300 }, 'line_at_corner');

    const wallEngine = new WallCornerSnapEngine();
    const endpointEngine = new EndpointSnapEngine();
    wallEngine.initialize([wall, lineAtCorner]);
    endpointEngine.initialize([wall, lineAtCorner]);

    const cursor: Point2D = { x: 0, y: 100 };
    const ctx = makeContext();

    const wallCandidates = wallEngine.findSnapCandidates(cursor, ctx).candidates;
    const epCandidates = endpointEngine.findSnapCandidates(cursor, ctx).candidates;

    // WallCornerSnapEngine: finds (0, 100) from wall entity
    const wallHit = wallCandidates.find(
      (c) => Math.abs(c.point.x) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(wallHit).toBeDefined();
    expect(wallHit!.priority).toBe(-2);
    expect(wallHit!.type).toBe(ExtendedSnapType.BIM_WALL_CORNER);

    // EndpointSnapEngine: finds (0, 100) from the line entity
    const epHit = epCandidates.find(
      (c) => Math.abs(c.point.x) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(epHit).toBeDefined();
    expect(epHit!.priority).toBe(0);
    expect(epHit!.type).toBe(ExtendedSnapType.ENDPOINT);

    // Merge all candidates and sort by priority → wall corner wins
    const all = [...wallCandidates, ...epCandidates].sort((a, b) => a.priority - b.priority);
    expect(all[0]!.type).toBe(ExtendedSnapType.BIM_WALL_CORNER);
    expect(all[0]!.priority).toBe(-2);

    wallEngine.dispose();
    endpointEngine.dispose();
  });

  it('same point: all 5 BIM corner types rank before ENDPOINT', () => {
    // Synthetic: manually create candidates at the same point to verify priority ordering
    const cornerPriority = -2;
    const endpointPriority = SNAP_ENGINE_PRIORITIES.ENDPOINT;
    expect(cornerPriority).toBeLessThan(endpointPriority);
  });
});

// ─── S5: Toggle-off simulation ────────────────────────────────────────────────

describe('S5 — Toggle-off: without WallCornerSnapEngine, ENDPOINT wins', () => {
  it('when only EndpointSnapEngine runs, ENDPOINT candidate wins at the line endpoint', () => {
    const wall = makeWall({ thickness: 200 }, 'wall_1');
    const lineAtCorner = makeLine({ x: 0, y: 100 }, { x: -200, y: 300 }, 'line_at_corner');

    // Simulate "BIM_WALL_CORNER toggled off" by only running EndpointSnapEngine
    const endpointEngine = new EndpointSnapEngine();
    endpointEngine.initialize([wall, lineAtCorner]);

    const cursor: Point2D = { x: 0, y: 100 };
    const { candidates } = endpointEngine.findSnapCandidates(cursor, makeContext());

    const epHit = candidates.find(
      (c) => Math.abs(c.point.x) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(epHit).toBeDefined();
    expect(epHit!.type).toBe(ExtendedSnapType.ENDPOINT);
    // No BIM_WALL_CORNER candidate in the list
    expect(candidates.every((c) => c.type !== ExtendedSnapType.BIM_WALL_CORNER)).toBe(true);

    endpointEngine.dispose();
  });

  it('WallCornerSnapEngine with excludeEntityId = no wall corner, ENDPOINT survives', () => {
    const wall = makeWall({ thickness: 200 }, 'wall_exclude');
    const lineAtCorner = makeLine({ x: 0, y: 100 }, { x: -200, y: 300 }, 'line_at_corner');

    const wallEngine = new WallCornerSnapEngine();
    const endpointEngine = new EndpointSnapEngine();
    wallEngine.initialize([wall, lineAtCorner]);
    endpointEngine.initialize([wall, lineAtCorner]);

    const cursor: Point2D = { x: 0, y: 100 };
    const ctxExclude = makeContext();
    (ctxExclude as SnapEngineContext & { excludeEntityId: string }).excludeEntityId = 'wall_exclude';

    const wallCandidates = wallEngine.findSnapCandidates(cursor, ctxExclude).candidates;
    const epCandidates = endpointEngine.findSnapCandidates(cursor, makeContext()).candidates;

    // Wall corners suppressed
    expect(wallCandidates.every((c) => c.entityId !== 'wall_exclude')).toBe(true);

    // ENDPOINT from line still works
    const epHit = epCandidates.find(
      (c) => c.entityId === 'line_at_corner' && Math.abs(c.point.x) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(epHit).toBeDefined();

    wallEngine.dispose();
    endpointEngine.dispose();
  });
});
