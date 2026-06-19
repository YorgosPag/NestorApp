/**
 * ADR-398 §Column→Beam axis snap — `column-placement-snap-context` (pure).
 *
 * Επαληθεύει: κάθετη προβολή στον άξονα δοκαριού (snap point στον centerline)· clamp στο
 * segment (όχι προέκταση)· capture = πάνω στο σώμα (width-based)· nearest beam· context
 * precedence (δοκάρι > overlap κολώνας > neutral). Fixtures: canvas = mm.
 */

import {
  findColumnBeamAxisSnap,
  resolveColumnPlacementContext,
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
    geometry: { length: Math.hypot(ex - sx, ey - sy) / 1000 },
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

describe('findColumnBeamAxisSnap — προβολή στον άξονα', () => {
  it('cursor πάνω στο σώμα → snap στον centerline (κάθετη προβολή)', () => {
    const b = beam('b1', 0, 0, 10000, 0, 250); // οριζόντιος άξονας y=0
    const snap = findColumnBeamAxisSnap({ x: 4000, y: 80 }, [b]);
    expect(snap).not.toBeNull();
    expect(snap!.beamId).toBe('b1');
    expect(snap!.point.x).toBeCloseTo(4000, 6);
    expect(snap!.point.y).toBeCloseTo(0, 6); // κουμπώνει στον άξονα
  });

  it('cursor μακριά από τον άξονα (εκτός width) → null', () => {
    const b = beam('b1', 0, 0, 10000, 0, 250); // capture = 125*1.5 = 187.5mm
    expect(findColumnBeamAxisSnap({ x: 4000, y: 300 }, [b])).toBeNull();
  });

  it('εκτός segment (πέρα από το άκρο) → null (όχι προέκταση)', () => {
    const b = beam('b1', 0, 0, 10000, 0);
    expect(findColumnBeamAxisSnap({ x: 12000, y: 0 }, [b])).toBeNull();
    expect(findColumnBeamAxisSnap({ x: -500, y: 0 }, [b])).toBeNull();
  });

  it('διαγώνιος άξονας → προβολή κάθετη στον άξονα', () => {
    const b = beam('b1', 0, 0, 10000, 10000, 400);
    const snap = findColumnBeamAxisSnap({ x: 5100, y: 4900 }, [b]);
    expect(snap).not.toBeNull();
    expect(snap!.point.x).toBeCloseTo(5000, 0);
    expect(snap!.point.y).toBeCloseTo(5000, 0);
  });

  it('δύο δοκάρια → νικά το πλησιέστερο (μικρότερο κάθετο)', () => {
    const b1 = beam('b1', 0, 0, 10000, 0, 250);
    const b2 = beam('b2', 0, 100, 10000, 100, 250); // y=100
    const snap = findColumnBeamAxisSnap({ x: 5000, y: 90 }, [b1, b2]);
    expect(snap!.beamId).toBe('b2'); // perp 10 < 90
  });
});

describe('resolveColumnPlacementContext — precedence', () => {
  it('πάνω σε δοκάρι → status beam (+ snap point)', () => {
    const ctx = resolveColumnPlacementContext({ x: 4000, y: 50 }, [beam('b1', 0, 0, 10000, 0) as unknown as Entity]);
    expect(ctx.status).toBe('beam');
    if (ctx.status === 'beam') expect(ctx.point.y).toBeCloseTo(0, 6);
  });

  it('δοκάρι ΝΙΚΑ ακόμη κι όταν υπάρχει κολώνα από κάτω (overlap)', () => {
    const entities = [
      beam('b1', 0, 0, 10000, 0) as unknown as Entity,
      columnFootprint('c1', 4000, 0),
    ];
    const ctx = resolveColumnPlacementContext({ x: 4000, y: 0 }, entities);
    expect(ctx.status).toBe('beam');
  });

  it('μέσα σε κολώνα (όχι σε δοκάρι) → status overlap', () => {
    const ctx = resolveColumnPlacementContext({ x: 8000, y: 0 }, [columnFootprint('c1', 8000, 0)]);
    expect(ctx.status).toBe('overlap');
    if (ctx.status === 'overlap') expect(ctx.columnId).toBe('c1');
  });

  it('κενός χώρος → status neutral', () => {
    const ctx = resolveColumnPlacementContext({ x: 50000, y: 50000 }, [columnFootprint('c1', 0, 0)]);
    expect(ctx.status).toBe('neutral');
  });
});
