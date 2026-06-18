/**
 * ADR-478 — wall → δοκός φορτίο στήριξης (spatial resolve + aggregation).
 *
 * Καλύπτει: spatial coverage (πλήρης/μερική), explicit FK (attachBaseToIds), multi-beam
 * συνεχόμενος τοίχος, exclusion φέροντος τοιχώματος Ο.Σ., aggregation 2 τοίχων, κενά.
 */

import { computeWallBeamDeadLoads } from '../wall-beam-support';
import { resolveWallLineLoadKnm } from '../wall-line-loads';
import type { Entity } from '../../../../types/entities';
import type { WallDna } from '../../../types/wall-dna-types';

// ─── Fixtures (canvas = mm) ──────────────────────────────────────────────────

/** Δοκάρι κατά X από (x0,0) έως (x1,0), πλάτος 250 → footprint y∈[-125,125]. */
function beam(id: string, x0: number, x1: number): Entity {
  return {
    id, type: 'beam', kind: 'rectangular',
    params: {
      kind: 'rectangular',
      startPoint: { x: x0, y: 0, z: 0 }, endPoint: { x: x1, y: 0, z: 0 },
      width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
    geometry: { volume: 0.5, length: Math.abs(x1 - x0) / 1000 },
  } as unknown as Entity;
}

/** Εξωτερική DNA 25cm (τούβλο core) — candidate τοιχοποιίας. */
function extDna(): WallDna {
  return {
    layers: [
      { id: 'a', name: 'plaster-ext', thickness: 25, materialId: 'mat-plaster-ext', side: 'exterior' },
      { id: 'b', name: 'brick', thickness: 210, materialId: 'mat-brick-masonry', side: 'core' },
      { id: 'c', name: 'plaster-int', thickness: 15, materialId: 'mat-plaster-int', side: 'interior' },
    ],
    totalThickness: 250,
  };
}

interface WallOpts {
  readonly dna?: WallDna;
  readonly material?: string;
  readonly baseBinding?: string;
  readonly attachBaseToIds?: readonly string[];
}

/** Τοίχος κατά X από (x0,0) έως (x1,0)· ύψος 3000· geometry.length = μήκος (m). */
function wall(id: string, x0: number, x1: number, opts: WallOpts = {}): Entity {
  return {
    id, type: 'wall', kind: 'straight',
    params: {
      start: { x: x0, y: 0, z: 0 }, end: { x: x1, y: 0, z: 0 },
      height: 3000, thickness: opts.dna?.totalThickness ?? 250,
      dna: opts.dna, material: opts.material,
      baseBinding: opts.baseBinding ?? 'storey-floor',
      attachBaseToIds: opts.attachBaseToIds,
    },
    geometry: { length: Math.abs(x1 - x0) / 1000 },
  } as unknown as Entity;
}

const LINE_LOAD = resolveWallLineLoadKnm({ dna: extDna(), thickness: 250, height: 3000 });

describe('computeWallBeamDeadLoads', () => {
  it('spatial: τοίχος εξ ολοκλήρου πάνω σε δοκό → lineLoad × μήκος τοίχου', () => {
    // Τοίχος 1000→4000 (3m) πλήρως εντός δοκού 0→5000.
    const map = computeWallBeamDeadLoads([beam('b1', 0, 5000), wall('w1', 1000, 4000, { dna: extDna() })]);
    expect(map.get('b1')).toBeCloseTo(LINE_LOAD * 3, 3);
  });

  it('spatial: μερική επικάλυψη → μόνο το καλυμμένο μήκος', () => {
    // Τοίχος -1000→3000 (4m)· δοκός 0→5000 καλύπτει x[0,3000] → 3m.
    const map = computeWallBeamDeadLoads([beam('b1', 0, 5000), wall('w1', -1000, 3000, { dna: extDna() })]);
    expect(map.get('b1')).toBeCloseTo(LINE_LOAD * 3, 3);
  });

  it('multi-beam: συνεχόμενος τοίχος σε 2 colinear δοκούς → split ανά καλυμμένο μήκος', () => {
    // Τοίχος 1000→9000 (8m)· b1 0→5000 (κάλυψη 4m)· b2 5000→10000 (κάλυψη 4m).
    const map = computeWallBeamDeadLoads([
      beam('b1', 0, 5000), beam('b2', 5000, 10000), wall('w1', 1000, 9000, { dna: extDna() }),
    ]);
    expect(map.get('b1')).toBeCloseTo(LINE_LOAD * 4, 3);
    expect(map.get('b2')).toBeCloseTo(LINE_LOAD * 4, 3);
  });

  it('explicit FK (baseBinding=attached): φορτίζει ΜΟΝΟ τις δοκούς του attachBaseToIds', () => {
    // Τοίχος πάνω από b1 ΚΑΙ b2 spatially, αλλά δηλώνει attach μόνο σε b1.
    const map = computeWallBeamDeadLoads([
      beam('b1', 0, 5000), beam('b2', 5000, 10000),
      wall('w1', 1000, 9000, { dna: extDna(), baseBinding: 'attached', attachBaseToIds: ['b1'] }),
    ]);
    expect(map.get('b1')).toBeCloseTo(LINE_LOAD * 4, 3);
    expect(map.has('b2')).toBe(false);
  });

  it('φέρον τοίχωμα Ο.Σ. (χυτό σκυρόδεμα core) → καμία συνεισφορά (T6, όχι line load)', () => {
    const rc: WallDna = {
      layers: [{ id: 'x', name: 'rc', thickness: 250, materialId: 'mat-concrete-c25', side: 'core' }],
      totalThickness: 250,
    };
    const map = computeWallBeamDeadLoads([beam('b1', 0, 5000), wall('w1', 1000, 4000, { dna: rc })]);
    expect(map.has('b1')).toBe(false);
  });

  it('aggregation: 2 τοιχοποιίες πάνω στην ίδια δοκό → άθροισμα', () => {
    const map = computeWallBeamDeadLoads([
      beam('b1', 0, 5000),
      wall('w1', 500, 2000, { dna: extDna() }),  // 1.5m
      wall('w2', 3000, 4500, { dna: extDna() }), // 1.5m
    ]);
    expect(map.get('b1')).toBeCloseTo(LINE_LOAD * 3, 3); // 1.5 + 1.5
  });

  it('κενό όταν λείπουν τοίχοι ή δοκοί', () => {
    expect(computeWallBeamDeadLoads([beam('b1', 0, 5000)]).size).toBe(0);
    expect(computeWallBeamDeadLoads([wall('w1', 0, 3000, { dna: extDna() })]).size).toBe(0);
  });
});
