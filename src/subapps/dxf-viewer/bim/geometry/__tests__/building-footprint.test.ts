/**
 * ADR-396 v2 Phase 2 — Tests για building-footprint.ts (boolean union SSoT).
 *
 * Σενάρια: απλό ορθογώνιο, L, 2 κτίρια, αίθριο/δωμάτια = τρύπες, κολώνα-σε-τοίχο
 * overlap, δοκάρι. Repo = jest (ΟΧΙ vitest).
 */

import {
  computeBuildingFootprint,
  type BeamForFootprint,
} from '../building-footprint';
import type { WallForEnvelope, ColumnForEnvelope } from '../envelope-perimeter';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { ColumnParams } from '../../types/column-types';
import type { BeamParams } from '../../types/beam-types';

// ─── Builders ────────────────────────────────────────────────────────────────

const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });

function wallParams(start: Point3D, end: Point3D, thickness = 200): WallParams {
  return {
    category: 'exterior',
    start,
    end,
    height: 3000,
    thickness,
    flip: false,
    sceneUnits: 'mm',
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
  };
}

function wall(id: string, start: Point3D, end: Point3D, thickness = 200): WallForEnvelope {
  return { id, kind: 'straight', params: wallParams(start, end, thickness) };
}

/** Κλειστό τετράγωνο `size`×`size` με origin (ox,oy). 4 τοίχοι CCW. */
function square(prefix: string, ox: number, oy: number, size: number): WallForEnvelope[] {
  const q = (x: number, y: number): Point3D => ({ x: ox + x, y: oy + y, z: 0 });
  return [
    wall(`${prefix}1`, q(0, 0), q(size, 0)),
    wall(`${prefix}2`, q(size, 0), q(size, size)),
    wall(`${prefix}3`, q(size, size), q(0, size)),
    wall(`${prefix}4`, q(0, size), q(0, 0)),
  ];
}

function column(id: string, x: number, y: number, size = 400): ColumnForEnvelope {
  return {
    id,
    params: {
      kind: 'rectangular',
      position: { x, y, z: 0 },
      anchor: 'center',
      width: size,
      depth: size,
      height: 3000,
      rotation: 0,
      sceneUnits: 'mm',
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    } as ColumnParams,
  };
}

function beam(id: string, start: Point3D, end: Point3D, width = 400): BeamForFootprint {
  return {
    id,
    params: {
      kind: 'straight',
      startPoint: start,
      endPoint: end,
      width,
      depth: 500,
      topElevation: 3000,
      sceneUnits: 'mm',
    } as BeamParams,
  };
}

// ─── 1. Απλό ορθογώνιο ────────────────────────────────────────────────────────

describe('computeBuildingFootprint — simple rectangle', () => {
  it('4 walls → 1 component, 1 outer ring, 1 hole (interior)', () => {
    const r = computeBuildingFootprint(square('w', 0, 0, 10000));
    expect(r.components).toHaveLength(1);
    expect(r.outerRings).toHaveLength(1);
    expect(r.holes).toHaveLength(1);
    expect(r.components[0].outer.isHole).toBe(false);
    expect(r.components[0].holes[0].isHole).toBe(true);
  });

  it('outer ring edges are attributed to walls', () => {
    const r = computeBuildingFootprint(square('w', 0, 0, 10000));
    const outer = r.outerRings[0];
    expect(outer.edges.some((e) => e.sourceEntityType === 'wall')).toBe(true);
    // Κάθε attributed ακμή δείχνει σε υπαρκτό wall id.
    const walIds = new Set(['w1', 'w2', 'w3', 'w4']);
    for (const e of outer.edges) {
      if (e.sourceEntityId !== null) expect(walIds.has(e.sourceEntityId)).toBe(true);
    }
  });

  it('outer ring encloses the building (area larger than the interior hole)', () => {
    const r = computeBuildingFootprint(square('w', 0, 0, 10000));
    expect(r.outerRings[0].areaCanvas).toBeGreaterThan(r.holes[0].areaCanvas);
  });
});

// ─── 2. L-shape ───────────────────────────────────────────────────────────────

describe('computeBuildingFootprint — L-shape', () => {
  it('6 walls → 1 component with one outer ring + interior hole', () => {
    const ring = [p(0, 0), p(6000, 0), p(6000, 3000), p(3000, 3000), p(3000, 6000), p(0, 6000)];
    const walls = ring.map((s, i) => wall(`L${i}`, s, ring[(i + 1) % ring.length]));
    const r = computeBuildingFootprint(walls);
    expect(r.components).toHaveLength(1);
    expect(r.outerRings).toHaveLength(1);
    expect(r.holes.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 3. Δύο ξεχωριστά κτίρια ───────────────────────────────────────────────────

describe('computeBuildingFootprint — two detached buildings', () => {
  it('→ 2 components / 2 outer rings / 2 holes', () => {
    const walls = [...square('a', 0, 0, 5000), ...square('b', 50000, 50000, 5000)];
    const r = computeBuildingFootprint(walls);
    expect(r.components).toHaveLength(2);
    expect(r.outerRings).toHaveLength(2);
    expect(r.holes).toHaveLength(2);
  });
});

// ─── 4. Αίθριο / δωμάτια = τρύπες ──────────────────────────────────────────────

describe('computeBuildingFootprint — interior partition → rooms as holes', () => {
  it('square + central dividing wall → 1 outer ring + 2 holes (rooms/αίθρια)', () => {
    const walls = [
      ...square('w', 0, 0, 10000),
      wall('mid', p(5000, 0), p(5000, 10000)), // χώρισμα → 2 δωμάτια
    ];
    const r = computeBuildingFootprint(walls);
    expect(r.components).toHaveLength(1);
    expect(r.outerRings).toHaveLength(1);
    expect(r.holes).toHaveLength(2);
    expect(r.holes.every((h) => h.isHole)).toBe(true);
  });
});

// ─── 5. Κολώνα μέσα σε τοίχο (overlap) ─────────────────────────────────────────

describe('computeBuildingFootprint — column inside wall (overlap)', () => {
  it('column fully inside a thick wall → merged, no separate island, no column edges', () => {
    const w = wall('w', p(0, 0), p(6000, 0), 600); // πάχος 600 → ±300
    const col = column('c', 3000, 0, 200);          // 200×200 κεντραρισμένη → εντός
    const r = computeBuildingFootprint([w], [col]);
    expect(r.components).toHaveLength(1);
    expect(r.outerRings).toHaveLength(1);
    expect(r.holes).toHaveLength(0); // μονό bar → καμία τρύπα
    // Η κολώνα είναι μέσα → καμία ακμή εξόδου δεν αποδίδεται σε 'column'.
    expect(r.outerRings[0].edges.every((e) => e.sourceEntityType !== 'column')).toBe(true);
  });

  it('overlap does not inflate the outer area beyond the wall footprint', () => {
    const w = wall('w', p(0, 0), p(6000, 0), 600);
    const col = column('c', 3000, 0, 200);
    const wallOnly = computeBuildingFootprint([w]).outerRings[0].areaCanvas;
    const withCol = computeBuildingFootprint([w], [col]).outerRings[0].areaCanvas;
    expect(withCol).toBeCloseTo(wallOnly, 3);
  });
});

// ─── 6. Δοκάρι ─────────────────────────────────────────────────────────────────

describe('computeBuildingFootprint — beam', () => {
  it('beam alone → valid outer ring with edges attributed to the beam', () => {
    const r = computeBuildingFootprint([], [], [beam('b', p(0, 0), p(4000, 0))]);
    expect(r.outerRings).toHaveLength(1);
    expect(r.outerRings[0].edges.some((e) => e.sourceEntityType === 'beam')).toBe(true);
  });

  it('beam crossing a wall (T-shape) → 1 component with both wall + beam edges', () => {
    const w = wall('w', p(0, 0), p(5000, 0), 200);          // οριζόντιος τοίχος
    const b = beam('b', p(2500, -1000), p(2500, 2000), 400); // κάθετο δοκάρι που προεξέχει
    const r = computeBuildingFootprint([w], [], [b]);
    expect(r.components).toHaveLength(1);
    expect(r.outerRings).toHaveLength(1);
    const types = new Set(r.outerRings[0].edges.map((e) => e.sourceEntityType));
    expect(types.has('wall')).toBe(true);
    expect(types.has('beam')).toBe(true);
  });
});

// ─── Degenerate ────────────────────────────────────────────────────────────────

describe('computeBuildingFootprint — degenerate', () => {
  it('empty input → empty result', () => {
    const r = computeBuildingFootprint([]);
    expect(r.components).toHaveLength(0);
    expect(r.outerRings).toHaveLength(0);
    expect(r.holes).toHaveLength(0);
  });
});
