/**
 * ADR-506 — `beamAxisSceneFrame`: ΕΝΑ SSoT για το πλαίσιο άξονα δοκαριού (origin + μοναδιαίο +
 * lenScene, params-only). Πρώην inline-διπλασιασμένο σε `maxClearSubSpanMm` + `beamInteriorSupports`
 * + `buildBeamMaxWidthMap`.
 */

import { beamAxisSceneFrame } from '../beam-axis-scene-frame';
import type { BeamEntity } from '../../types/beam-types';

/** Params-only fixture — ΧΩΡΙΣ `geometry` (το frame δεν το χρειάζεται, geometry-independent). */
function beam(sx: number, sy: number, ex: number, ey: number): BeamEntity {
  return {
    id: 'b', type: 'beam',
    params: { kind: 'straight', startPoint: { x: sx, y: sy }, endPoint: { x: ex, y: ey }, width: 250, depth: 500 },
  } as unknown as BeamEntity;
}

describe('beamAxisSceneFrame (ADR-506)', () => {
  it('οριζόντιος άξονας: μοναδιαίο (1,0), origin=start, lenScene=μήκος', () => {
    const f = beamAxisSceneFrame(beam(0, 0, 6000, 0));
    expect(f).not.toBeNull();
    expect(f!.ax).toBe(0);
    expect(f!.ay).toBe(0);
    expect(f!.ux).toBeCloseTo(1, 9);
    expect(f!.uy).toBeCloseTo(0, 9);
    expect(f!.lenScene).toBeCloseTo(6000, 6);
  });

  it('κατακόρυφος άξονας: μοναδιαίο (0,1), origin μετατοπισμένο', () => {
    const f = beamAxisSceneFrame(beam(100, 0, 100, 4000));
    expect(f!.ux).toBeCloseTo(0, 9);
    expect(f!.uy).toBeCloseTo(1, 9);
    expect(f!.ax).toBe(100);
    expect(f!.lenScene).toBeCloseTo(4000, 6);
  });

  it('διαγώνιος (3,4,5): μοναδιαίο (0.6,0.8), lenScene=5', () => {
    const f = beamAxisSceneFrame(beam(0, 0, 3, 4));
    expect(f!.ux).toBeCloseTo(0.6, 9);
    expect(f!.uy).toBeCloseTo(0.8, 9);
    expect(f!.lenScene).toBeCloseTo(5, 9);
  });

  it('εκφυλισμένος άξονας (μηδενικό μήκος) → null (geometry-independent, μηδέν crash)', () => {
    expect(beamAxisSceneFrame(beam(5, 5, 5, 5))).toBeNull();
  });
});
