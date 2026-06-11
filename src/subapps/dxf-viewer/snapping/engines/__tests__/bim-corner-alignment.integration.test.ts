/**
 * ADR-370 — Generic BIM Corner Snap Priority + cross-entity integration tests.
 *
 * After the 5→1 collapse, ONE `BimCharacteristicSnapEngine('corner')` indexes the
 * corners of EVERY BIM entity. Verifies:
 *
 *   - BIM_CORNER (priority -2) beats ENDPOINT (priority 0) at a coincident point.
 *   - ONE engine finds corners across wall + column + opening simultaneously (the
 *     whole point of the consolidation — no per-entity engines).
 *   - excludeEntityId suppresses an entity's corners; ENDPOINT survives.
 *   - per-entity `description` differentiates the label («Γωνία τοίχου/κολώνας…»).
 */

import { BimCharacteristicSnapEngine } from '../BimCharacteristicSnapEngine';
import { getBimCharacteristicPoints } from '../../../bim/utils/bim-characteristic-points';
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
    category: 'exterior', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 },
    height: 3000, thickness: 200, flip: false, ...overrides,
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

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  const r = () => 300;
  return { entities: [], worldRadiusAt: r, worldRadiusForType: r, maxCandidates: 20, ...overrides };
}

function cornerEngine(): BimCharacteristicSnapEngine {
  return new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_CORNER, 'corner', SNAP_ENGINE_PRIORITIES.BIM_CORNER);
}
function midpointEngine(): BimCharacteristicSnapEngine {
  return new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_MIDPOINT, 'midpoint', SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT);
}
function centerEngine(): BimCharacteristicSnapEngine {
  return new BimCharacteristicSnapEngine(ExtendedSnapType.BIM_CENTER, 'center', SNAP_ENGINE_PRIORITIES.BIM_CENTER);
}

// ─── Priority constants ───────────────────────────────────────────────────────

describe('BIM Corner Snap — priority constants', () => {
  it('BIM_CORNER priority = -2, below ENDPOINT (0)', () => {
    expect(SNAP_ENGINE_PRIORITIES.BIM_CORNER).toBe(-2);
    expect(SNAP_ENGINE_PRIORITIES.BIM_CORNER).toBeLessThan(SNAP_ENGINE_PRIORITIES.ENDPOINT);
  });

  it('BIM_MIDPOINT / BIM_CENTER are negative — they WIN over generic endpoint/midpoint/center', () => {
    // The «Μέσο/Κέντρο never appear» bug: with positive numbers (0.5 / 2.5) the structural snaps
    // lost to coincident raw-DXF ENDPOINT (0) / MIDPOINT (1) / CENTER (3). Revit-grade: structural
    // characteristic points are the precise targets, so they must outrank the generic line snaps.
    expect(SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT).toBeLessThan(SNAP_ENGINE_PRIORITIES.ENDPOINT);
    expect(SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT).toBeLessThan(SNAP_ENGINE_PRIORITIES.MIDPOINT);
    expect(SNAP_ENGINE_PRIORITIES.BIM_CENTER).toBeLessThan(SNAP_ENGINE_PRIORITIES.CENTER);
    expect(SNAP_ENGINE_PRIORITIES.BIM_CENTER).toBeLessThan(SNAP_ENGINE_PRIORITIES.MIDPOINT);
    // Corner stays the most precise structural point.
    expect(SNAP_ENGINE_PRIORITIES.BIM_CORNER).toBeLessThan(SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT);
    expect(SNAP_ENGINE_PRIORITIES.BIM_CORNER).toBeLessThan(SNAP_ENGINE_PRIORITIES.BIM_CENTER);
  });

  it('BIM_MIDPOINT and BIM_CENTER share a tier so DISTANCE decides ⊕ vs ▲ (no priority hijack)', () => {
    // Equal numbers → at a thin member the centroid (⊕) and a face-edge midpoint (▲) are both in
    // range; the candidate processor falls back to distance and picks the nearer, correct one.
    expect(SNAP_ENGINE_PRIORITIES.BIM_MIDPOINT).toBe(SNAP_ENGINE_PRIORITIES.BIM_CENTER);
  });
});

// ─── Selection: at a wall centroid, ⊕ (center) beats ▲ (face midpoint) by distance ──
describe('BIM_CENTER vs BIM_MIDPOINT — distance tiebreak at the centroid', () => {
  it('cursor on the wall centroid → BIM_CENTER wins (equal priority, smaller distance)', () => {
    // 200mm-thick wall along X; centroid at (500,0), long-face midpoints at (500,±100).
    const wall = makeWall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 200 }, 'wall_1');
    const mid = midpointEngine();
    const center = centerEngine();
    mid.initialize([wall]);
    center.initialize([wall]);

    const cursor: Point2D = { x: 500, y: 0 }; // exactly the centroid
    const ctx = makeContext();
    const all = [
      ...mid.findSnapCandidates(cursor, ctx).candidates,
      ...center.findSnapCandidates(cursor, ctx).candidates,
    ].sort((a, b) => (a.priority - b.priority) || (a.distance - b.distance));

    expect(all[0]!.type).toBe(ExtendedSnapType.BIM_CENTER);

    mid.dispose();
    center.dispose();
  });
});

// ─── Cross-entity: ONE engine over wall + column + opening ───────────────────

describe('Generic engine indexes corners across ALL BIM entities at once', () => {
  it('finds wall, column AND opening corners from a single engine instance', () => {
    const wall = makeWall({}, 'wall_1');
    const col = makeColumn(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' }, 'col_1');
    const opening = makeOpening(
      [{ x: 500, y: -100 }, { x: 1400, y: -100 }, { x: 1400, y: 100 }, { x: 500, y: 100 }],
      'opening_1',
    );

    const engine = cornerEngine();
    engine.initialize([wall, col, opening]);

    // Wall outer-start (0, 100)
    expect(engine.findSnapCandidates({ x: 0, y: 100 }, makeContext()).candidates
      .some((c) => c.entityId === 'wall_1' && c.type === ExtendedSnapType.BIM_CORNER)).toBe(true);
    // Column NE corner (200, 150)
    expect(engine.findSnapCandidates({ x: 200, y: 150 }, makeContext()).candidates
      .some((c) => c.entityId === 'col_1')).toBe(true);
    // Opening corner (500, -100)
    expect(engine.findSnapCandidates({ x: 500, y: -100 }, makeContext()).candidates
      .some((c) => c.entityId === 'opening_1')).toBe(true);

    engine.dispose();
  });

  it('per-entity description differentiates the label root', () => {
    const wall = makeWall({}, 'wall_1');
    const col = makeColumn(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' }, 'col_1');
    const engine = cornerEngine();
    engine.initialize([wall, col]);

    const wallHit = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext()).candidates
      .find((c) => c.entityId === 'wall_1');
    const colHit = engine.findSnapCandidates({ x: 200, y: 150 }, makeContext()).candidates
      .find((c) => c.entityId === 'col_1');

    expect(wallHit!.description).toBe('bim-wall-corner');
    expect(colHit!.description).toBe('bim-column-corner');

    engine.dispose();
  });

  it('«περίεργο σχήμα» (circular column) → corner snap with EMPTY description (no label)', () => {
    const base = buildDefaultColumnParams({ x: 0, y: 0 }, 'circular');
    const circ = {
      id: 'col_circ', type: 'column', kind: 'circular', layerId: '0',
      params: { ...base, width: 400 },
      geometry: undefined as never, validation: undefined as never, visible: true,
    } as unknown as ColumnEntity;

    // Probe a real corner point (perimeter diagonal) from the SSoT dispatcher.
    const corner = getBimCharacteristicPoints(circ).corners[0]!;
    expect(corner).toBeDefined();

    const engine = cornerEngine();
    engine.initialize([circ]);
    const hit = engine.findSnapCandidates(corner, makeContext()).candidates
      .find((c) => c.entityId === 'col_circ');
    expect(hit).toBeDefined();
    expect(hit!.description).toBe('');

    engine.dispose();
  });
});

// ─── Midpoint + Center categories (same parametric engine) ───────────────────

describe('BIM_MIDPOINT — wall edge midpoints (all sides)', () => {
  it('snaps to a wall edge midpoint with description bim-wall-mid', () => {
    const wall = makeWall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }, 'wall_1');
    const mids = getBimCharacteristicPoints(wall).midpoints;
    expect(mids.length).toBe(4); // ALL sides (Giorgio)
    const engine = midpointEngine();
    engine.initialize([wall]);
    const hit = engine.findSnapCandidates(mids[0]!, makeContext()).candidates
      .find((c) => c.entityId === 'wall_1');
    expect(hit).toBeDefined();
    expect(hit!.type).toBe(ExtendedSnapType.BIM_MIDPOINT);
    expect(hit!.description).toBe('bim-wall-mid');
    engine.dispose();
  });
});

describe('BIM_CENTER — slab centroid', () => {
  it('snaps to the slab centroid with description bim-slab-center', () => {
    const SQUARE = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    const polygon: Polygon3D = { vertices: SQUARE.map((v) => ({ x: v.x, y: v.y })) };
    const slab = {
      id: 'slab_1', type: 'slab', kind: 'floor', layerId: '0',
      params: { outline: { vertices: SQUARE } },
      geometry: { polygon, bbox: undefined as never, area: 0, netArea: 0, volume: 0, perimeter: 0 },
      validation: undefined as never, visible: true,
    } as unknown as EntityModel;

    const engine = centerEngine();
    engine.initialize([slab]);
    const hit = engine.findSnapCandidates({ x: 500, y: 500 }, makeContext()).candidates
      .find((c) => c.entityId === 'slab_1');
    expect(hit).toBeDefined();
    expect(hit!.type).toBe(ExtendedSnapType.BIM_CENTER);
    expect(hit!.description).toBe('bim-slab-center');
    expect(hit!.point.x).toBeCloseTo(500, 6);
    expect(hit!.point.y).toBeCloseTo(500, 6);
    engine.dispose();
  });
});

// ─── Priority: BIM_CORNER beats ENDPOINT at coincident point ─────────────────

describe('BIM_CORNER beats ENDPOINT at the same world point', () => {
  it('line endpoint at wall outer-start → corner wins by priority', () => {
    const wall = makeWall({ thickness: 200 }, 'wall_1');
    const lineAtCorner = makeLine({ x: 0, y: 100 }, { x: -200, y: 300 }, 'line_at_corner');

    const engine = cornerEngine();
    const endpointEngine = new EndpointSnapEngine();
    engine.initialize([wall, lineAtCorner]);
    endpointEngine.initialize([wall, lineAtCorner]);

    const cursor: Point2D = { x: 0, y: 100 };
    const ctx = makeContext();
    const cornerCands = engine.findSnapCandidates(cursor, ctx).candidates;
    const epCands = endpointEngine.findSnapCandidates(cursor, ctx).candidates;

    const cornerHit = cornerCands.find((c) => Math.abs(c.point.x) < 1 && Math.abs(c.point.y - 100) < 1);
    expect(cornerHit!.type).toBe(ExtendedSnapType.BIM_CORNER);
    expect(cornerHit!.priority).toBe(-2);

    const all = [...cornerCands, ...epCands].sort((a, b) => a.priority - b.priority);
    expect(all[0]!.type).toBe(ExtendedSnapType.BIM_CORNER);

    engine.dispose();
    endpointEngine.dispose();
  });
});

// ─── excludeEntityId ─────────────────────────────────────────────────────────

describe('excludeEntityId suppresses an entity\'s corners', () => {
  it('excluded wall yields no corners; ENDPOINT from line survives', () => {
    const wall = makeWall({ thickness: 200 }, 'wall_exclude');
    const lineAtCorner = makeLine({ x: 0, y: 100 }, { x: -200, y: 300 }, 'line_at_corner');

    const engine = cornerEngine();
    const endpointEngine = new EndpointSnapEngine();
    engine.initialize([wall, lineAtCorner]);
    endpointEngine.initialize([wall, lineAtCorner]);

    const cursor: Point2D = { x: 0, y: 100 };
    const cornerCands = engine.findSnapCandidates(cursor, makeContext({ excludeEntityId: 'wall_exclude' })).candidates;
    expect(cornerCands.every((c) => c.entityId !== 'wall_exclude')).toBe(true);

    const epHit = endpointEngine.findSnapCandidates(cursor, makeContext()).candidates
      .find((c) => c.entityId === 'line_at_corner' && Math.abs(c.point.y - 100) < 1);
    expect(epHit).toBeDefined();

    engine.dispose();
    endpointEngine.dispose();
  });
});
