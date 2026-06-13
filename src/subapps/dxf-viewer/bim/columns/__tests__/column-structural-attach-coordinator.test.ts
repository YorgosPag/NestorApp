/**
 * Tests for column-structural-attach-coordinator (ADR-401 Phase F.3).
 *
 * Pure detection: which storey-bound columns auto-attach their top/base to a
 * just-created beam/slab host (plan overlap + Z gate). Mirror of the wall
 * coordinator test. mm scene (footprints + host footprints in mm).
 */

import {
  findColumnsToAutoAttachToHost,
  findColumnsToAutoAttachBaseToHost,
  findColumnsFramedByBeam,
} from '../column-structural-attach-coordinator';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';

/** Beam axis (0,0)→(4000,0), width 250 → footprint band y∈[-125,125], underside = topElevation−depth. */
function beamOver(topElevation = 3000): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 },
      width: 250, depth: 500, topElevation, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** Slab footprint 5000×5000 at `levelElevation`, thickness 150. */
function slabAt(levelElevation: number): SlabEntity {
  return {
    id: 'slab_1', type: 'slab', kind: 'floor',
    params: {
      kind: 'floor',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
      levelElevation, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box',
    },
  } as unknown as SlabEntity;
}

/** Column with a square footprint (mm) centred at (cx, cy), half-size `h`, base at FFL (baseOffset 0). */
function column(id: string, cx: number, cy: number, h = 200, overrides: Record<string, unknown> = {}): Entity {
  return {
    id, type: 'column', kind: 'rectangular',
    params: {
      kind: 'rectangular', topBinding: 'storey-ceiling', baseBinding: 'storey-floor',
      baseOffset: 0, height: 3000, position: { x: cx, y: cy, z: 0 }, ...overrides,
    },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - h, y: cy - h, z: 0 },
          { x: cx + h, y: cy - h, z: 0 },
          { x: cx + h, y: cy + h, z: 0 },
          { x: cx - h, y: cy + h, z: 0 },
        ],
      },
    },
  } as unknown as Entity;
}

describe('findColumnsToAutoAttachToHost (top)', () => {
  it('attaches a storey-ceiling column under a beam (centroid in band + beam above base)', () => {
    const beam = beamOver(); // underside 2500 > base 0
    const col = column('c1', 2000, 0, 100); // centroid (2000,0) inside beam band [-125,125]
    expect(findColumnsToAutoAttachToHost(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('attaches a column under a CEILING slab (underside above base)', () => {
    const slab = slabAt(3000); // underside 2850 > base 0
    const col = column('c1', 1000, 1000); // inside slab footprint
    expect(findColumnsToAutoAttachToHost(slab as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('does NOT attach to a FLOOR slab below the column base (Z gate)', () => {
    const slab = slabAt(0); // underside -150 <= base 0 → skip
    const col = column('c1', 1000, 1000);
    expect(findColumnsToAutoAttachToHost(slab as unknown as Entity, [col])).toEqual([]);
  });

  it('ΔΕΝ τραβά κολώνα που φτάνει στη θεμελίωση: floor/ground slab@0 με base −1000 (ADR-441)', () => {
    // Κολώνα GEN-COL συνέχειας (base −1000). Floor/ground slab top 0, underside −150.
    // Παλιό gate (underside > base): −150 > −1000 → BUG attach. Νέο (max(base,FFL=0)):
    // −150 <= 0 → ΟΧΙ. Η εδαφόπλακα/δάπεδο ΔΕΝ αλλοιώνει την κορυφή της κολώνας.
    const slab = slabAt(0);
    const col = column('c1', 1000, 1000, 200, { baseOffset: -1000, height: 4000 });
    expect(findColumnsToAutoAttachToHost(slab as unknown as Entity, [col])).toEqual([]);
  });

  it('ΕΞΑΚΟΛΟΥΘΕΙ να attach-άρει σε ΟΡΟΦΗ slab παρά το βαθύ base (−1000)', () => {
    const slab = slabAt(3000); // underside 2850 > FFL 0 → ταβάνι
    const col = column('c1', 1000, 1000, 200, { baseOffset: -1000, height: 4000 });
    expect(findColumnsToAutoAttachToHost(slab as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('does NOT attach when the host does not overlap the column footprint', () => {
    const beam = beamOver();
    const col = column('c1', 2000, 5000, 100); // far from beam band
    expect(findColumnsToAutoAttachToHost(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('attaches when only a CORNER of the column footprint overlaps the host', () => {
    const beam = beamOver();
    // centroid (2000, 200) is OUTSIDE band [-125,125], but bottom edge (y=120) overlaps.
    const col = column('c1', 2000, 200, 80);
    expect(findColumnsToAutoAttachToHost(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('ignores columns whose topBinding is not "storey-ceiling"', () => {
    const beam = beamOver();
    const col = column('c1', 2000, 0, 100, { topBinding: 'unconnected', unconnectedHeight: 2400 });
    expect(findColumnsToAutoAttachToHost(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('returns [] for a non-host entity (not beam/slab)', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Entity;
    expect(findColumnsToAutoAttachToHost(line, [column('c1', 2000, 0)])).toEqual([]);
  });
});

describe('findColumnsToAutoAttachBaseToHost (base, inverted Z gate)', () => {
  it('attaches a storey-floor column over a FOUNDATION beam (topside below base)', () => {
    const beam = beamOver(-100); // topside -100 < base 0
    const col = column('c1', 2000, 0, 100);
    expect(findColumnsToAutoAttachBaseToHost(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('attaches a column over a FOUNDATION slab (topside below base)', () => {
    const slab = slabAt(-100); // topside -100 < base 0
    const col = column('c1', 1000, 1000);
    expect(findColumnsToAutoAttachBaseToHost(slab as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('does NOT attach to a CEILING slab above the column base (inverted Z gate)', () => {
    const slab = slabAt(3000); // topside 3000 > base 0 → skip
    const col = column('c1', 1000, 1000);
    expect(findColumnsToAutoAttachBaseToHost(slab as unknown as Entity, [col])).toEqual([]);
  });

  it('ignores columns whose baseBinding is not "storey-floor"', () => {
    const beam = beamOver(-100);
    const col = column('c1', 2000, 0, 100, { baseBinding: 'absolute' });
    expect(findColumnsToAutoAttachBaseToHost(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('returns [] for a non-host entity', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Entity;
    expect(findColumnsToAutoAttachBaseToHost(line, [column('c1', 2000, 0)])).toEqual([]);
  });
});

describe('findColumnsFramedByBeam (frame-into column→beam)', () => {
  it('frames a column sitting at the beam endpoint (center on axis, within span)', () => {
    const beam = beamOver(); // axis (0,0)→(4000,0), top 3000 > FFL
    const col = column('c1', 4000, 0, 200); // center at end E, on axis
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('frames a mid-span column whose center lies on the beam axis', () => {
    const beam = beamOver();
    const col = column('c1', 2000, 0, 200);
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('does NOT frame an off-axis column (perp distance ≫ half-width)', () => {
    const beam = beamOver();
    const col = column('c1', 2000, 5000, 200);
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('does NOT frame a column beyond the span + support distance', () => {
    const beam = beamOver();
    const col = column('c1', 4500, 0, 100); // t=4500 > 4000 + support(100) + tol
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('skips columns whose topBinding is not "storey-ceiling"', () => {
    const beam = beamOver();
    const col = column('c1', 4000, 0, 200, { topBinding: 'attached', attachTopToIds: ['x'] });
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('Z-gate: a foundation beam below FFL does not frame a storey column', () => {
    const beam = beamOver(-100); // topside -100 <= max(base 0, FFL 0) + gate
    const col = column('c1', 4000, 0, 200);
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('returns [] for a non-beam host (slab does not frame)', () => {
    const slab = slabAt(3000);
    expect(findColumnsFramedByBeam(slab as unknown as Entity, [column('c1', 1000, 1000)])).toEqual([]);
  });
});
