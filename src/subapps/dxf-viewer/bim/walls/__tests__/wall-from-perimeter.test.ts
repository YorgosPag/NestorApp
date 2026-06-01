/**
 * ADR-363 «Τοίχος από περίγραμμα» — end-to-end geometry path (Φάση 1) tests.
 *
 * Drives the box-select pipeline at the SSoT level: scene faces → perimeter
 * analysis → one filling WallEntity per leg rect (thickness from geometry). Covers
 * the Γ/Π chain, the mixed-selection ignored count, and the no-double-count BOQ
 * invariant (leg rects partition the perimeter → Σ footprint areas == polygon area).
 * Miter joins are produced downstream by `addWallToScene` (browser-verified).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LWPolylineEntity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import { perimeterFacesToRects } from '../perimeter-from-faces';
import { buildWallFillingRect } from '../wall-in-region';

const TOL = 5;
const SU = 'mm' as const;
const LEVEL = '0';

// L (Γ) with 300 mm thick legs (within MAX_WALL_THICKNESS_MM). Footprint 1,710,000.
const L_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// U (Π) with 300 mm thick legs. Footprint 2,520,000.
const U_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 3000 },
  { x: 2700, y: 3000 },
  { x: 2700, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

function lwPolyline(id: string, verts: Point2D[]): LWPolylineEntity {
  return { id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed: true } as LWPolylineEntity;
}

/** Drive the full SSoT path: faces → rects → filling walls (validator-aware). */
function buildWallsFrom(entities: Entity[]): { walls: WallEntity[]; ignored: number } {
  const result = perimeterFacesToRects(entities, TOL);
  const walls = result.rects
    .map((r) => buildWallFillingRect(r, {}, SU, LEVEL))
    .filter((w): w is WallEntity => w !== null);
  return { walls, ignored: result.ignoredCount + (result.rects.length - walls.length) };
}

describe('wall-from-perimeter — Γ (L) chain', () => {
  it('builds 2 leg walls, each 300 mm thick', () => {
    const { walls } = buildWallsFrom([lwPolyline('L', L_SHAPE)]);
    expect(walls).toHaveLength(2);
    for (const w of walls) {
      expect(w.type).toBe('wall');
      expect(w.params.thickness).toBeCloseTo(300, 3);
    }
  });

  it('no double-count: Σ leg footprint == polygon area (legs partition, no overlap)', () => {
    const { walls } = buildWallsFrom([lwPolyline('L', L_SHAPE)]);
    const footprint = walls.reduce((s, w) => {
      const len = Math.hypot(w.params.end.x - w.params.start.x, w.params.end.y - w.params.start.y);
      return s + len * w.params.thickness;
    }, 0);
    expect(footprint).toBeCloseTo(1_710_000, -1);
  });
});

describe('wall-from-perimeter — Π (U) chain', () => {
  it('builds 3 leg walls (foot + 2 stems)', () => {
    const { walls } = buildWallsFrom([lwPolyline('U', U_SHAPE)]);
    expect(walls).toHaveLength(3);
    for (const w of walls) expect(w.params.thickness).toBeCloseTo(300, 3);
  });
});

describe('wall-from-perimeter — mixed selection', () => {
  it('builds the valid Γ and counts the triangle as ignored', () => {
    const triangle: Point2D[] = [
      { x: 10000, y: 0 },
      { x: 13000, y: 0 },
      { x: 11500, y: 2000 },
    ];
    const { walls, ignored } = buildWallsFrom([
      lwPolyline('good', L_SHAPE),
      lwPolyline('bad', triangle),
    ]);
    expect(walls).toHaveLength(2);
    expect(ignored).toBe(1);
  });

  it('a too-thick rectangle (3 m short side) builds nothing and is ignored', () => {
    // 5000×3000 room outline → 3 m "thickness" exceeds MAX_WALL_THICKNESS_MM.
    const room: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    const { walls, ignored } = buildWallsFrom([lwPolyline('room', room)]);
    expect(walls).toHaveLength(0);
    expect(ignored).toBe(1); // validator-rejected leg surfaced as ignored
  });
});
