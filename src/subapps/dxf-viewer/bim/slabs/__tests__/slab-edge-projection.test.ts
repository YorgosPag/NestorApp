/**
 * ADR-363 Phase 5.5f — `slab-edge-projection` pure helpers tests.
 *
 * Coverage:
 *   - `projectPointOnSlabEdge` (clamped, NEAREST semantics):
 *       rect slab   — cursor above bottom edge / left edge / corner zone (→ nearest edge clamped)
 *       triangle    — cursor over closest edge
 *       closing edge — cursor above closing edge [last→first]
 *       null cases  — slab χωρίς cached geometry / <3 vertices
 *   - `getSlabEdgePerpendicularFeet` (unclamped per-edge, PERPENDICULAR):
 *       rect slab   — foot εντός snap radius / εκτός
 *       closing edge — foot on last edge εντός radius
 *       unclamped   — foot στην προέκταση ακμής εντός radius
 *       radius filter — εκτός radius → κενή λίστα
 *       multiple feet — corner zone επιστρέφει 2 feet
 *       null guard  — slab χωρίς cached geometry
 */

import {
  projectPointOnSlabEdge,
  getSlabEdgePerpendicularFeet,
} from '../slab-edge-projection';
import {
  buildDefaultSlabParams,
  buildSlabEntity,
} from '../../../hooks/drawing/slab-completion';
import type { SlabEntity } from '../../types/slab-types';

function unwrap(r: ReturnType<typeof buildSlabEntity>): SlabEntity {
  if (!r.ok) throw new Error('expected slab ok: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('slab-edge-projection (Phase 5.5f)', () => {
  // Rect 4000×3000 mm. Bottom edge y=0, top y=3000, left x=0, right x=4000.
  // Closing edge = [3] (0,3000)→[0] (0,0) = left edge (x=0, y=3000→0).
  function makeRect(): SlabEntity {
    const verts = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    return unwrap(buildSlabEntity(buildDefaultSlabParams(verts), '0'));
  }

  function makeTriangle(): SlabEntity {
    const verts = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 1000, y: 2000 },
    ];
    return unwrap(buildSlabEntity(buildDefaultSlabParams(verts), '0'));
  }

  // ─── projectPointOnSlabEdge (clamped) ───────────────────────────────────

  it('1. rect slab — cursor above bottom edge → foot at y=0', () => {
    const slab = makeRect();
    const foot = projectPointOnSlabEdge(slab, { x: 2000, y: 150 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(2000, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('2. rect slab — cursor left of left edge (closing edge) → foot at x=0', () => {
    const slab = makeRect();
    // Closing edge: (0,3000)→(0,0). Cursor at (-50, 1500) → foot = (0, 1500).
    const foot = projectPointOnSlabEdge(slab, { x: -50, y: 1500 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(0, 6);
    expect(foot!.y).toBeCloseTo(1500, 6);
  });

  it('3. rect slab — cursor in corner zone → clamped to nearest edge vertex', () => {
    // Cursor at (4500, -200) — outside corner (4000,0). Nearest edge: bottom [0→1] clamps to (4000,0); right [1→2] also near (4000,0).
    const slab = makeRect();
    const foot = projectPointOnSlabEdge(slab, { x: 4500, y: -200 });
    expect(foot).not.toBeNull();
    // Both candidate edges clamp to corner (4000,0) — pick closest.
    expect(foot!.x).toBeCloseTo(4000, 0);
    expect(foot!.y).toBeCloseTo(0, 0);
  });

  it('4. triangle slab — cursor near hypotenuse → foot on slant edge', () => {
    const slab = makeTriangle();
    // Hypotenuse: (2000,0)→(1000,2000). Midpoint ~(1500,1000). Cursor at (1700, 900).
    const foot = projectPointOnSlabEdge(slab, { x: 1700, y: 900 });
    expect(foot).not.toBeNull();
    // Foot should be on edge [1]→[2].
    expect(foot!.x).toBeGreaterThan(1000);
    expect(foot!.x).toBeLessThan(2000);
    expect(foot!.y).toBeGreaterThan(0);
    expect(foot!.y).toBeLessThan(2000);
  });

  it('5. slab χωρίς cached geometry → null', () => {
    const slab = makeRect();
    const stripped = { ...slab, geometry: undefined as unknown as SlabEntity['geometry'] };
    expect(projectPointOnSlabEdge(stripped as SlabEntity, { x: 2000, y: 50 })).toBeNull();
  });

  it('6. slab with <3 vertices → null', () => {
    const slab = makeRect();
    const bad = {
      ...slab,
      geometry: { ...slab.geometry, polygon: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], closed: true } },
    } as unknown as SlabEntity;
    expect(projectPointOnSlabEdge(bad, { x: 500, y: 50 })).toBeNull();
  });

  // ─── getSlabEdgePerpendicularFeet (unclamped) ───────────────────────────

  it('7. rect slab — foot εντός snap radius on bottom edge', () => {
    const slab = makeRect();
    const feet = getSlabEdgePerpendicularFeet(slab, { x: 2000, y: 50 }, 100);
    expect(feet.length).toBeGreaterThanOrEqual(1);
    const bottomFoot = feet.find((f) => f.edgeIndex === 0);
    expect(bottomFoot).toBeDefined();
    expect(bottomFoot!.point.x).toBeCloseTo(2000, 6);
    expect(bottomFoot!.point.y).toBeCloseTo(0, 6);
  });

  it('8. rect slab — cursor μακριά → εκτός radius, κενή λίστα', () => {
    const slab = makeRect();
    const feet = getSlabEdgePerpendicularFeet(slab, { x: 2000, y: 5000 }, 100);
    expect(feet).toHaveLength(0);
  });

  it('9. rect slab — unclamped foot στην προέκταση bottom edge', () => {
    // Cursor (6000, 50): unclamped foot on bottom line (y=0) = (6000,0), distance=50 < 100.
    const slab = makeRect();
    const feet = getSlabEdgePerpendicularFeet(slab, { x: 6000, y: 50 }, 100);
    const bottomFoot = feet.find((f) => f.edgeIndex === 0);
    expect(bottomFoot).toBeDefined();
    expect(bottomFoot!.point.x).toBeCloseTo(6000, 6);
    expect(bottomFoot!.point.y).toBeCloseTo(0, 6);
  });

  it('10. rect slab — corner zone → 2+ feet (from adjacent edges)', () => {
    // Cursor at (4000, -50): bottom edge foot=(4000,0) d=50; right edge foot=(4000,-50) unclamped d=50 (on extended line x=4000).
    const slab = makeRect();
    const feet = getSlabEdgePerpendicularFeet(slab, { x: 4000, y: -50 }, 100);
    expect(feet.length).toBeGreaterThanOrEqual(2);
    const indices = feet.map((f) => f.edgeIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('11. closing edge — cursor right of left edge → foot on closing edge', () => {
    const slab = makeRect();
    // Cursor at (-80, 800): foot on closing edge (x=0 vertical, y=3000→0) = (0,800), d=80 < 100.
    const feet = getSlabEdgePerpendicularFeet(slab, { x: -80, y: 800 }, 100);
    // Closing edge has edgeIndex = 3 (last→first).
    const closingFoot = feet.find((f) => f.edgeIndex === 3);
    expect(closingFoot).toBeDefined();
    expect(closingFoot!.point.x).toBeCloseTo(0, 6);
    expect(closingFoot!.point.y).toBeCloseTo(800, 6);
  });

  it('12. slab χωρίς cached geometry → κενή λίστα', () => {
    const slab = makeRect();
    const stripped = { ...slab, geometry: undefined as unknown as SlabEntity['geometry'] };
    expect(getSlabEdgePerpendicularFeet(stripped as SlabEntity, { x: 2000, y: 50 }, 100)).toHaveLength(0);
  });
});
