/**
 * ADR-363 Phase 5.5g — `opening-outline-projection` pure helpers tests.
 *
 * Coverage:
 *   - `projectPointOnOpeningOutline` (clamped, NEAREST semantics):
 *       below outer face   — foot at y=-100
 *       right of end jamb  — foot at x=3500
 *       above inner face   — foot at y=100
 *       left of start jamb — foot at x=2500
 *       corner zone        — clamped to nearest corner
 *       null cases         — opening χωρίς cached geometry / <4 vertices
 *   - `getOpeningOutlinePerpendicularFeet` (unclamped per-edge, PERPENDICULAR):
 *       foot εντός snap radius on outer face (edgeIndex=0)
 *       outside radius → empty list
 *       unclamped foot past end jamb endpoint (edgeIndex=1)
 *       corner zone → 2+ feet from adjacent edges
 *       closing edge (start jamb, edgeIndex=3) in radius
 *       null guard — opening χωρίς cached geometry
 *
 * Setup: wall (0,0)→(6000,0) thickness=200mm, window opening offset=2500 width=1000.
 * Outline (CCW): [0]=(2500,-100) [1]=(3500,-100) [2]=(3500,100) [3]=(2500,100)
 * Edges: 0=outer(y=-100) 1=end-jamb(x=3500) 2=inner(y=100) 3=start-jamb(x=2500)
 */

import {
  projectPointOnOpeningOutline,
  getOpeningOutlinePerpendicularFeet,
} from '../opening-outline-projection';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { buildOpeningEntity } from '../../../hooks/drawing/opening-completion';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';

function unwrapWall(r: ReturnType<typeof buildWallEntity>): WallEntity {
  if (!r.ok) throw new Error('expected ok wall: ' + r.hardErrors.join(','));
  return r.entity;
}

function unwrapOpening(r: ReturnType<typeof buildOpeningEntity>): OpeningEntity {
  if (!r.ok) throw new Error('expected ok opening: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('opening-outline-projection (Phase 5.5g)', () => {
  // Wall (0,0)→(6000,0) thickness=200. ux=1 uy=0 px=0 py=1.
  function makeWall(): WallEntity {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 6000, y: 0 }, { thickness: 200 });
    return unwrapWall(buildWallEntity(params, '0', 'straight'));
  }

  // Window offset=2500 width=1000 → center=(3000,0), halfW=500, halfT=100.
  // Outline: [0]=(2500,-100) [1]=(3500,-100) [2]=(3500,100) [3]=(2500,100).
  function makeOpening(wall: WallEntity): OpeningEntity {
    const params: OpeningParams = {
      kind: 'window',
      wallId: wall.id,
      offsetFromStart: 2500,
      width: 1000,
      height: 1200,
      sillHeight: 900,
      frameWidth: 50,
    };
    return unwrapOpening(buildOpeningEntity(params, wall, '0'));
  }

  // ─── projectPointOnOpeningOutline (clamped) ─────────────────────────────────

  it('1. cursor below outer face → foot at y=-100', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const foot = projectPointOnOpeningOutline(opening, { x: 3000, y: -200 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(3000, 6);
    expect(foot!.y).toBeCloseTo(-100, 6);
  });

  it('2. cursor right of end jamb → foot at x=3500', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const foot = projectPointOnOpeningOutline(opening, { x: 3700, y: 0 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(3500, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('3. cursor above inner face → foot at y=100', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const foot = projectPointOnOpeningOutline(opening, { x: 3000, y: 200 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(3000, 6);
    expect(foot!.y).toBeCloseTo(100, 6);
  });

  it('4. cursor left of start jamb → foot at x=2500', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const foot = projectPointOnOpeningOutline(opening, { x: 2300, y: 0 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(2500, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('5. corner zone (3700,-200) → clamped to corner (3500,-100)', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const foot = projectPointOnOpeningOutline(opening, { x: 3700, y: -200 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(3500, 0);
    expect(foot!.y).toBeCloseTo(-100, 0);
  });

  it('6. opening χωρίς cached geometry → null', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const stripped = { ...opening, geometry: undefined as unknown as OpeningEntity['geometry'] };
    expect(projectPointOnOpeningOutline(stripped as OpeningEntity, { x: 3000, y: -200 })).toBeNull();
  });

  it('7. opening with <4 vertices → null', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const bad = {
      ...opening,
      geometry: {
        ...opening.geometry,
        outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 100, z: 0 }] },
      },
    } as unknown as OpeningEntity;
    expect(projectPointOnOpeningOutline(bad, { x: 500, y: -50 })).toBeNull();
  });

  // ─── getOpeningOutlinePerpendicularFeet (unclamped) ─────────────────────────

  it('8. outer face (edgeIndex=0) — foot εντός radius', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const feet = getOpeningOutlinePerpendicularFeet(opening, { x: 3000, y: -150 }, 100);
    const outer = feet.find((f) => f.edgeIndex === 0);
    expect(outer).toBeDefined();
    expect(outer!.point.x).toBeCloseTo(3000, 6);
    expect(outer!.point.y).toBeCloseTo(-100, 6);
  });

  it('9. cursor far below → all feet εκτός radius → empty list', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const feet = getOpeningOutlinePerpendicularFeet(opening, { x: 3000, y: -600 }, 100);
    expect(feet).toHaveLength(0);
  });

  it('10. unclamped foot past end jamb endpoint (edgeIndex=1)', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    // Edge 1: x=3500 vertical (y:-100→100). Cursor (3580,-200) → unclamped foot (3500,-200) d=80<100.
    const feet = getOpeningOutlinePerpendicularFeet(opening, { x: 3580, y: -200 }, 100);
    const endJamb = feet.find((f) => f.edgeIndex === 1);
    expect(endJamb).toBeDefined();
    expect(endJamb!.point.x).toBeCloseTo(3500, 6);
    expect(endJamb!.point.y).toBeCloseTo(-200, 6);
  });

  it('11. corner zone (3500,-150) → 2+ feet (outer face + end jamb)', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    // Edge 0 foot=(3500,-100) d=50; edge 1 foot=(3500,-150) d=0. Both in radius.
    const feet = getOpeningOutlinePerpendicularFeet(opening, { x: 3500, y: -150 }, 100);
    expect(feet.length).toBeGreaterThanOrEqual(2);
    const indices = feet.map((f) => f.edgeIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('12. start jamb (edgeIndex=3) — foot εντός radius', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    // Edge 3: x=2500 vertical (y:100→-100). Cursor (2420, 0) → foot=(2500,0) d=80<100.
    const feet = getOpeningOutlinePerpendicularFeet(opening, { x: 2420, y: 0 }, 100);
    const startJamb = feet.find((f) => f.edgeIndex === 3);
    expect(startJamb).toBeDefined();
    expect(startJamb!.point.x).toBeCloseTo(2500, 6);
    expect(startJamb!.point.y).toBeCloseTo(0, 6);
  });

  it('13. opening χωρίς cached geometry → empty list', () => {
    const wall = makeWall();
    const opening = makeOpening(wall);
    const stripped = { ...opening, geometry: undefined as unknown as OpeningEntity['geometry'] };
    expect(
      getOpeningOutlinePerpendicularFeet(stripped as OpeningEntity, { x: 3000, y: -150 }, 100),
    ).toHaveLength(0);
  });
});
