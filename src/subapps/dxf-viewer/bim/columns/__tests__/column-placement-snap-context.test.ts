/**
 * ADR-398 §ghost coloring (bugfix 2026-06-19) — `column-placement-snap-context` (pure).
 *
 * Επαληθεύει το **thin reader** ghost-status: παράγεται από το ΑΠΟΤΕΛΕΣΜΑ του ενιαίου snap
 * (`snapResult.snapPoint.entityId`) + light footprint-overlap, με precedence
 * **overlap > beam > neutral**. (Η beam-axis projection/snap ζει πια ΜΟΝΟ στο
 * `NearestSnapEngine` — μηδέν διπλότυπο εδώ.) Fixtures: canvas = mm.
 */

import {
  findColumnOverlap,
  resolveColumnGhostStatusFromSnap,
} from '../column-placement-snap-context';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';

function beam(id: string, sx: number, sy: number, ex: number, ey: number, width = 250): BeamEntity {
  return {
    id, type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', width, depth: 500, sceneUnits: 'mm',
      startPoint: { x: sx, y: sy }, endPoint: { x: ex, y: ey },
    },
    geometry: {
      axisPolyline: { points: [{ x: sx, y: sy, z: 0 }, { x: ex, y: ey, z: 0 }] },
      length: Math.hypot(ex - sx, ey - sy) / 1000,
    },
  } as unknown as BeamEntity;
}

function columnFootprint(id: string, cx: number, cy: number, half = 200): Entity {
  return {
    id, type: 'column',
    geometry: { footprint: { vertices: [
      { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
      { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
    ] } },
    params: { sceneUnits: 'mm' },
  } as unknown as Entity;
}

describe('findColumnOverlap — footprint hit-test', () => {
  it('cursor μέσα σε footprint κολώνας → id', () => {
    expect(findColumnOverlap({ x: 8000, y: 0 }, [columnFootprint('c1', 8000, 0)])).toBe('c1');
  });

  it('cursor εκτός κάθε footprint → null', () => {
    expect(findColumnOverlap({ x: 50000, y: 50000 }, [columnFootprint('c1', 0, 0)])).toBeNull();
  });

  it('αγνοεί μη-κολώνες (δοκάρι) → null', () => {
    expect(findColumnOverlap({ x: 4000, y: 0 }, [beam('b1', 0, 0, 10000, 0) as unknown as Entity])).toBeNull();
  });
});

describe('resolveColumnGhostStatusFromSnap — precedence overlap > beam > neutral', () => {
  it('snap σε δοκάρι (όχι σε footprint) → beam (🟢)', () => {
    const entities = [beam('b1', 0, 0, 10000, 0) as unknown as Entity];
    expect(resolveColumnGhostStatusFromSnap({ x: 4000, y: 0 }, entities, 'b1')).toBe('beam');
  });

  it('snap σε υπάρχουσα κολώνα → overlap (🔴)', () => {
    const entities = [columnFootprint('c1', 30000, 0)]; // μακριά → όχι footprint hit στο cursor
    expect(resolveColumnGhostStatusFromSnap({ x: 4000, y: 0 }, entities, 'c1')).toBe('overlap');
  });

  it('cursor μέσα σε footprint κολώνας → overlap ΑΚΟΜΗ κι αν το snap είναι δοκάρι (ενδιάμεση κολώνα)', () => {
    // Σενάριο Giorgio: τρίτη κολώνα στο μέσο δοκαριού· snap στον άξονα αλλά cursor πάνω της → 🔴.
    const entities = [
      beam('b1', 0, 0, 10000, 0) as unknown as Entity,
      columnFootprint('c1', 5000, 0),
    ];
    expect(resolveColumnGhostStatusFromSnap({ x: 5000, y: 0 }, entities, 'b1')).toBe('overlap');
  });

  it('κενό σημείο δοκαριού (μακριά από κολώνα) + snap δοκάρι → beam (🟢)', () => {
    const entities = [
      beam('b1', 0, 0, 10000, 0) as unknown as Entity,
      columnFootprint('c1', 5000, 0),
    ];
    expect(resolveColumnGhostStatusFromSnap({ x: 3000, y: 0 }, entities, 'b1')).toBe('beam');
  });

  it('cursor μέσα σε footprint, snap null → overlap (light fallback)', () => {
    expect(resolveColumnGhostStatusFromSnap({ x: 8000, y: 0 }, [columnFootprint('c1', 8000, 0)], null)).toBe('overlap');
  });

  it('κενός χώρος, snap null → neutral', () => {
    expect(resolveColumnGhostStatusFromSnap({ x: 50000, y: 50000 }, [columnFootprint('c1', 0, 0)], null)).toBe('neutral');
  });

  it('snapEntityId άγνωστο (δεν βρίσκεται) → neutral', () => {
    expect(resolveColumnGhostStatusFromSnap({ x: 4000, y: 0 }, [beam('b1', 0, 0, 10000, 0) as unknown as Entity], 'ghost-id')).toBe('neutral');
  });
});
