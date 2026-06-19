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
  findColumnsFramedByBeamForGraph,
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

  it('ΔΕΝ attach-άρει δοκάρι που ακουμπά ΜΟΝΟ γωνία (corner-graze → κεκλιμένη κορυφή· framing το πιάνει)', () => {
    // ADR-449 Δρόμος Β 2026-06-14 (Giorgio): δοκάρι band [-125,125], centroid (2000,200) ΕΞΩ,
    // αλλά κάτω-ακμή (y=120) ακουμπά τη λωρίδα. Παλιό covering → attach → per-corner resolver
    // κατέβαζε ΜΟΝΟ αυτή τη γωνία → κεκλιμένη κορυφή κολώνας. Τώρα: δοκάρι απαιτεί κάλυψη ΚΕΝΤΡΟΥ.
    const beam = beamOver();
    const col = column('c1', 2000, 200, 80);
    expect(findColumnsToAutoAttachToHost(beam as unknown as Entity, [col])).toEqual([]);
  });

  it('ΕΞΑΚΟΛΟΥΘΕΙ να attach-άρει ΠΛΑΚΑ σε corner-overlap (επίπεδη → flat top, μηδέν κλίση)', () => {
    // Πλάκα 5000×5000· κολώνα με centroid (5040) ΕΞΩ από την πλάκα αλλά γωνία (4960) ΜΕΣΑ.
    // Οι πλάκες κρατούν corner-tolerant covering (το soffit είναι επίπεδο → καμία κεκλιμένη κορυφή).
    const slab = slabAt(3000);
    const col = column('c1', 5040, 2000, 80);
    expect(findColumnsToAutoAttachToHost(slab as unknown as Entity, [col])).toEqual(['c1']);
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

  it('skips a column VALIDLY attached to a LIVE host (δεν διαταράσσει έγκυρο attach)', () => {
    const beam = beamOver(); // id 'beam_1'
    const col = column('c1', 4000, 0, 200, { topBinding: 'attached', attachTopToIds: ['beam_1'] });
    // beam_1 ζωντανό (μέσα στα entities) → ΟΧΙ stale → skip.
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col, beam as unknown as Entity])).toEqual([]);
  });

  it('ADR-401 re-link: κολώνα attached ΜΟΝΟ σε STALE (διαγραμμένο) host ΕΙΝΑΙ ξανά επιλέξιμη (self-heal)', () => {
    const beam = beamOver();
    const col = column('c1', 4000, 0, 200, { topBinding: 'attached', attachTopToIds: ['beam_DELETED'] });
    // beam_DELETED εκτός σκηνής → stale → δεν μπλοκάρει το re-link στο νέο δοκάρι.
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [col])).toEqual(['c1']);
  });

  it('skips unconnected/absolute κολώνες (ρητή επιλογή, ΟΧΙ stale)', () => {
    const beam = beamOver();
    const col = column('c1', 4000, 0, 200, { topBinding: 'unconnected', unconnectedHeight: 2400 });
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

// ─── ADR-494 — kind-agnostic footprint-based framing (asymmetric L/T/U/I/τοιχείο) ──
//
// Η ρίζα του cantilever bug: η παλιά detection χρησιμοποιούσε το insertion point
// `params.position`. Για ασύμμετρη διατομή (L-shape) το `position` μετατοπίζεται κάθετα
// στον άξονα του δοκαριού > halfWidth+tol → η κολώνα χανόταν → πρόβολος. Τώρα η detection
// κοιτά το πραγματικό `geometry.footprint` (τέμνει/εφάπτεται τη λωρίδα του δοκαριού).

/** Κολώνα με ΡΗΤΟ footprint (mm) + ξεχωριστό insertion point `position` (ασύμμετρη διατομή). */
function columnWithFootprint(
  id: string,
  position: { x: number; y: number },
  vertices: readonly { x: number; y: number }[],
  overrides: Record<string, unknown> = {},
): Entity {
  return {
    id, type: 'column', kind: 'L-shape',
    params: {
      kind: 'L-shape', topBinding: 'storey-ceiling', baseBinding: 'storey-floor',
      baseOffset: 0, height: 3000, position: { x: position.x, y: position.y, z: 0 }, ...overrides,
    },
    geometry: { footprint: { vertices: vertices.map((v) => ({ x: v.x, y: v.y, z: 0 })) } },
  } as unknown as Entity;
}

describe('ADR-494 — footprint-based framing για ασύμμετρες διατομές', () => {
  // Beam axis (0,0)→(4000,0), width 250 → halfWidth 125, tol 5 → παλιό perp-όριο 130mm.
  // L-shape στο αριστερό άκρο: το insertion point είναι στο y=200 (perp 200 > 130 → ο παλιός
  // center-test ΑΠΕΡΡΙΠΤΕ → bug), αλλά το footprint διασταυρώνει τον άξονα (y∈[-200,300]).
  const lShapeStart = (): Entity =>
    columnWithFootprint('cL', { x: 0, y: 200 }, [
      { x: -200, y: -200 }, { x: 200, y: -200 }, { x: 200, y: 300 },
      { x: 0, y: 300 }, { x: 0, y: 0 }, { x: -200, y: 0 },
    ]);

  it('🐛 REPRO: L-shape με offset position αναγνωρίζεται ΩΣ στήριξη (footprint τέμνει τον άξονα)', () => {
    const beam = beamOver();
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [lShapeStart()])).toEqual(['cL']);
  });

  it('graph variant: L-shape παράγει column-bearing edge → ΟΧΙ πρόβολος (το διάγραμμα ροπών διορθώνεται)', () => {
    const beam = beamOver();
    // 2 κολώνες (L αριστερά + ορθογωνική δεξιά) → 2 στηρίξεις → αμφιέρειστο, όχι cantilever.
    const rect = column('cR', 4000, 0, 200);
    expect(findColumnsFramedByBeamForGraph(beam as unknown as Entity, [lShapeStart(), rect]).sort())
      .toEqual(['cL', 'cR']);
  });

  it('T-shape: footprint εκατέρωθεν του άξονα (κορμός κάτω, πέλμα πάνω) → στήριξη', () => {
    const beam = beamOver();
    // Τ ανεστραμμένο: πέλμα στο y∈[100,300], κορμός κατεβαίνει στο y=-300· position offset στο πέλμα.
    const tShape = columnWithFootprint('cT', { x: 2000, y: 200 }, [
      { x: 1800, y: 100 }, { x: 2200, y: 100 }, { x: 2200, y: 300 }, { x: 1800, y: 300 },
      { x: 1900, y: 300 }, { x: 1900, y: -300 }, { x: 2100, y: -300 }, { x: 2100, y: 300 },
    ]);
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [tShape])).toEqual(['cT']);
  });

  it('τοιχείο (shear-wall) που ο άξονας ΤΕΜΝΕΙ → στήριξη', () => {
    const beam = beamOver();
    // Μακρόστενο τοιχείο 1200×200, διαμήκες στον y, τέμνεται από τον άξονα y=0 στο x≈4000.
    const wall = columnWithFootprint('cW', { x: 4000, y: 0 }, [
      { x: 3900, y: -600 }, { x: 4100, y: -600 }, { x: 4100, y: 600 }, { x: 3900, y: 600 },
    ], { kind: 'shear-wall' });
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [wall])).toEqual(['cW']);
  });

  it('τοιχείο μακριά από τον άξονα (δεν το τέμνει) → ΟΧΙ στήριξη', () => {
    const beam = beamOver();
    // Ίδιο τοιχείο αλλά μετατοπισμένο στο y=2000 → footprint y∈[1400,2600], perp 1400 ≫ 130.
    const wall = columnWithFootprint('cW', { x: 4000, y: 2000 }, [
      { x: 3900, y: 1400 }, { x: 4100, y: 1400 }, { x: 4100, y: 2600 }, { x: 3900, y: 2600 },
    ], { kind: 'shear-wall' });
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [wall])).toEqual([]);
  });

  it('κυκλική (footprint = πολύγωνο προσέγγισης) που εφάπτεται στον άξονα → στήριξη', () => {
    const beam = beamOver();
    // Octagon ακτίνας 200 κεντραρισμένο στο (2000,0) — footprint τέμνει y=0.
    const r = 200;
    const oct = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i;
      return { x: 2000 + r * Math.cos(a), y: r * Math.sin(a) };
    });
    const circ = columnWithFootprint('cC', { x: 2000, y: 0 }, oct, { kind: 'circular' });
    expect(findColumnsFramedByBeam(beam as unknown as Entity, [circ])).toEqual(['cC']);
  });

  it('γνήσιος πρόβολος: ΜΟΝΟ μία κολώνα framing → ο graph δίνει 1 edge (παραμένει cantilever)', () => {
    const beam = beamOver();
    // Μόνο η L αριστερά· καμία δεξιά → 1 column-bearing edge → derive-beam-support: cantilever.
    expect(findColumnsFramedByBeamForGraph(beam as unknown as Entity, [lShapeStart()])).toEqual(['cL']);
  });
});
