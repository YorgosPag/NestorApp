/**
 * ADR-401 Phase E/(β) — beam-slope SSoT (κεκλιμένη δοκός).
 *
 * Ελέγχει το `beamSlopeOffsetZmm`/`beamTopZmmAt`/`beamUndersideZmmAt`:
 *   - flat (απών/ίσο topElevationEnd) → offset 0 (fast-path)
 *   - start → 0, end → Δ, mid → Δ/2 (γραμμικό κατά μήκος άξονα)
 *   - off-axis (perpendicular) δεν επηρεάζει (προβολή στον άξονα)
 *   - unit-safety: ίδιο magnitude σε mm-scale ΚΑΙ meter-scale (αδιάστατο f)
 *   - εκφυλισμένος άξονας → 0
 */

import {
  beamSlopeOffsetZmm,
  beamTopZmmAt,
  beamUndersideZmmAt,
  isBeamTilted,
} from '../beam-slope';
import type { BeamParams } from '../../types/beam-types';

function makeBeam(over: Partial<BeamParams> = {}): BeamParams {
  return {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    width: 250,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    ...over,
  } as BeamParams;
}

describe('isBeamTilted', () => {
  it('flat (no topElevationEnd) → false', () => {
    expect(isBeamTilted(makeBeam())).toBe(false);
  });
  it('topElevationEnd === topElevation → false', () => {
    expect(isBeamTilted(makeBeam({ topElevationEnd: 3000 }))).toBe(false);
  });
  it('topElevationEnd ≠ topElevation → true', () => {
    expect(isBeamTilted(makeBeam({ topElevationEnd: 3500 }))).toBe(true);
  });
});

describe('beamSlopeOffsetZmm — flat fast-path', () => {
  it('οριζόντια δοκός → 0 παντού', () => {
    const p = makeBeam();
    expect(beamSlopeOffsetZmm(p, { x: 0, y: 0 })).toBe(0);
    expect(beamSlopeOffsetZmm(p, { x: 500, y: 0 })).toBe(0);
    expect(beamSlopeOffsetZmm(p, { x: 1000, y: 0 })).toBe(0);
  });
});

describe('beamSlopeOffsetZmm — tilted (γραμμικό κατά μήκος άξονα)', () => {
  const p = makeBeam({ topElevationEnd: 3500 }); // Δ = 500mm

  it('start → 0', () => {
    expect(beamSlopeOffsetZmm(p, { x: 0, y: 0 })).toBeCloseTo(0, 9);
  });
  it('end → Δ', () => {
    expect(beamSlopeOffsetZmm(p, { x: 1000, y: 0 })).toBeCloseTo(500, 9);
  });
  it('mid → Δ/2', () => {
    expect(beamSlopeOffsetZmm(p, { x: 500, y: 0 })).toBeCloseTo(250, 9);
  });
  it('off-axis (perpendicular) → ίδιο με την προβολή του στον άξονα', () => {
    // (500, 50) προβάλλεται στο 500 κατά μήκος του άξονα (0,0)→(1000,0).
    expect(beamSlopeOffsetZmm(p, { x: 500, y: 50 })).toBeCloseTo(250, 9);
  });
  it('κατηφορική δοκός (Δ<0) → αρνητικό offset στο end', () => {
    const down = makeBeam({ topElevationEnd: 2500 }); // Δ = −500
    expect(beamSlopeOffsetZmm(down, { x: 1000, y: 0 })).toBeCloseTo(-500, 9);
  });
});

describe('beamSlopeOffsetZmm — unit-safety', () => {
  it('ίδιο magnitude (Δmm) είτε σε mm-scale είτε σε meter-scale', () => {
    const mm = makeBeam({ topElevationEnd: 3500, startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 } });
    const meters = makeBeam({ topElevationEnd: 3500, sceneUnits: 'm', startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } });
    // mid-point σε κάθε scale → ίδιο 250mm (το f είναι αδιάστατο).
    expect(beamSlopeOffsetZmm(mm, { x: 500, y: 0 })).toBeCloseTo(250, 9);
    expect(beamSlopeOffsetZmm(meters, { x: 0.5, y: 0 })).toBeCloseTo(250, 9);
  });
});

describe('beamSlopeOffsetZmm — degenerate axis', () => {
  it('start === end → 0 (no divide-by-zero)', () => {
    const p = makeBeam({ topElevationEnd: 3500, endPoint: { x: 0, y: 0, z: 0 } });
    expect(beamSlopeOffsetZmm(p, { x: 0, y: 0 })).toBe(0);
  });
});

describe('beamTopZmmAt / beamUndersideZmmAt', () => {
  const p = makeBeam({ topElevationEnd: 3500, zOffset: 100 }); // Δ=500, drop 100

  it('top στο start = topElevation + zOffset', () => {
    expect(beamTopZmmAt(p, { x: 0, y: 0 })).toBeCloseTo(3100, 9);
  });
  it('top στο end = topElevationEnd + zOffset', () => {
    expect(beamTopZmmAt(p, { x: 1000, y: 0 })).toBeCloseTo(3600, 9);
  });
  it('underside = top − depth (σταθερό βάθος)', () => {
    expect(beamUndersideZmmAt(p, { x: 0, y: 0 })).toBeCloseTo(3100 - 400, 9);
    expect(beamUndersideZmmAt(p, { x: 1000, y: 0 })).toBeCloseTo(3600 - 400, 9);
  });
  it('flat δοκός → top = topElevation + zOffset παντού', () => {
    const flat = makeBeam({ zOffset: 100 });
    expect(beamTopZmmAt(flat, { x: 0, y: 0 })).toBeCloseTo(3100, 9);
    expect(beamTopZmmAt(flat, { x: 1000, y: 0 })).toBeCloseTo(3100, 9);
  });
});
