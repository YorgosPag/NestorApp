/**
 * ADR-477 Slice 3 — σεισμική δύναμη σύνδεσης συνδετήριων δοκών (EN1998-5 §5.4.1.2).
 *
 * Καλύπτει: τον EC8 συντελεστή `ε·α·S` ανά κατηγορία εδάφους (seismic-params) και τον
 * scene-level υπολογισμό `N_tie = factor·N_Ed,mean`. Η συνδεσιμότητα ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ
 * το organism SSoT: άκρο → πέδιλο που το περιέχει (footprint coverage) → στηρίζουσα
 * κολώνα (footingId FK) → χαρακτηριστικό SLS αξονικό. Pure (μηδέν store).
 */

import {
  seismicTieForceFactor,
  soilFactorS,
  isSeismicGroundType,
} from '../seismic-params';
import { computeTieBeamTieForces } from '../tie-beam-tie-force';
import type { AppliedMemberLoad } from '../structural-loads-types';
import type { Entity } from '../../../../types/entities';

// ─── Entity fixtures (canvas = mm) ───────────────────────────────────────────

/** Πέδιλο με τετράγωνο footprint γύρω από (cx,cy)· στηρίζει την κολώνα μέσω FK. */
function pad(id: string, cx: number, cy: number, half = 750): Entity {
  return {
    id, type: 'foundation', kind: 'pad',
    params: {
      kind: 'pad', topElevationMm: -1000, thicknessMm: 500,
      position: { x: cx, y: cy, z: 0 }, width: 2 * half, length: 2 * half,
      rotation: 0, anchor: 'center', profile: 'flat', sceneUnits: 'mm',
    },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
          { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
        ],
      },
    },
  } as unknown as Entity;
}

/** Υποστύλωμα FK-δεμένο σε πέδιλο (η θέση δεν μετράει — σύνδεση μέσω footingId). */
function column(id: string, footingId: string, deadAxialKn: number): Entity {
  return {
    id, type: 'column', kind: 'rectangular',
    params: {
      kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
      width: 600, depth: 600, height: 3000, rotation: 0, sceneUnits: 'mm',
      footingId, appliedLoad: { deadAxialKn, liveAxialKn: 0 } as AppliedMemberLoad,
    },
  } as unknown as Entity;
}

function tieBeam(id: string, sx: number, sy: number, ex: number, ey: number): Entity {
  return {
    id, type: 'foundation', kind: 'tie-beam',
    params: {
      kind: 'tie-beam', start: { x: sx, y: sy, z: 0 }, end: { x: ex, y: ey, z: 0 },
      width: 300, thicknessMm: 500, sceneUnits: 'mm',
    },
  } as unknown as Entity;
}

describe('seismic-params — EC8 ground tables', () => {
  it('soil factor S per ground type (EN1998-1 Πίν. 3.2, Τύπος 1)', () => {
    expect(soilFactorS('A')).toBe(1.0);
    expect(soilFactorS('B')).toBe(1.2);
    expect(soilFactorS('D')).toBe(1.35);
  });

  it('tie-force factor ε·α·S — ground A = 0 (βράχος, δεν απαιτούνται tie-beams)', () => {
    expect(seismicTieForceFactor('A', 0.24)).toBe(0);
  });

  it('tie-force factor ground B, a_gR=0.16g → 0.3·0.16·1.2', () => {
    expect(seismicTieForceFactor('B', 0.16)).toBeCloseTo(0.3 * 0.16 * 1.2, 6);
  });

  it('μη-θετική επιτάχυνση → 0', () => {
    expect(seismicTieForceFactor('C', 0)).toBe(0);
  });

  it('isSeismicGroundType guard', () => {
    expect(isSeismicGroundType('B')).toBe(true);
    expect(isSeismicGroundType('Z')).toBe(false);
    expect(isSeismicGroundType(undefined)).toBe(false);
  });
});

describe('computeTieBeamTieForces — N_tie = factor·N_Ed,mean (organism FK + coverage)', () => {
  it('μέσος όρος αξονικών των δύο συνδεόμενων υποστυλωμάτων (μέσω πεδίλων στα άκρα)', () => {
    const entities = [
      pad('p1', 0, 0), pad('p2', 3000, 0),
      column('c1', 'p1', 500), column('c2', 'p2', 300),
      tieBeam('t1', 0, 0, 3000, 0),
    ];
    const patches = computeTieBeamTieForces(entities, 'B', 0.16);
    expect(patches).toHaveLength(1);
    // factor 0.0576 · mean(500,300)=400 → 23.04 → 23.0
    expect(patches[0]).toEqual({ tieBeamId: 't1', seismicTieForceKn: 23.0 });
  });

  it('κατηγορία εδάφους A → κενό (factor 0)', () => {
    const entities = [pad('p1', 0, 0), column('c1', 'p1', 500), tieBeam('t1', 0, 0, 3000, 0)];
    expect(computeTieBeamTieForces(entities, 'A', 0.24)).toHaveLength(0);
  });

  it('άκρα χωρίς πέδιλο/FK κολώνα → N_tie 0', () => {
    const entities = [
      pad('p1', 9000, 9000), column('c1', 'p1', 500), // πέδιλο+κολώνα μακριά από τα άκρα
      tieBeam('t1', 0, 0, 3000, 0),
    ];
    const patches = computeTieBeamTieForces(entities, 'B', 0.16);
    expect(patches[0]).toEqual({ tieBeamId: 't1', seismicTieForceKn: 0 });
  });

  it('ένα μόνο συνδεδεμένο άκρο → mean = αυτό', () => {
    const entities = [pad('p1', 0, 0), column('c1', 'p1', 600), tieBeam('t1', 0, 0, 3000, 0)];
    const patches = computeTieBeamTieForces(entities, 'B', 0.16);
    // mean=600 → 0.0576·600=34.56 → 34.6
    expect(patches[0]?.seismicTieForceKn).toBeCloseTo(34.6, 1);
  });

  it('πέδιλο χωρίς στηρίζουσα κολώνα (χωρίς FK) → δεν συνεισφέρει', () => {
    const entities = [pad('p1', 0, 0), pad('p2', 3000, 0), column('c2', 'p2', 400), tieBeam('t1', 0, 0, 3000, 0)];
    const patches = computeTieBeamTieForces(entities, 'B', 0.16);
    // μόνο το p2-άκρο συνδέεται → mean=400 → 0.0576·400=23.04 → 23.0
    expect(patches[0]?.seismicTieForceKn).toBeCloseTo(23.0, 1);
  });
});
