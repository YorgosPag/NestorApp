/**
 * ADR-534 Φ3c-B3b (ΤΟΙΧΟΙ) — soffit top-clip του σοβά τοίχου.
 *
 * Mirror του `structural-finish-beam-soffit-clip.test.ts`: όπου μονολιθική πλάκα καλύπτει τον
 * τοίχο, η **κορυφή του σοβά** κόβεται στο soffit (ίδια τιμή με το ορατό στερεό) → ο ροζ σοβάς
 * δεν διαπερνά την πλάκα (Giorgio 2026-07-17, C4D). Absent clip → πλήρες ύψος (byte-for-byte).
 *
 * Καλύπτει **και τα δύο** mesh που τρέφει το ίδιο z-extent (`wallFinishZExtent` SSoT):
 *   1. τον **κάθετο** silhouette (`computeStructuralFinishSilhouette`), και
 *   2. το **οριζόντιο** ενιαίο top-cap (`computeMergedStructuralTopCap`, τα `hup` objects του C4D)
 * — αλλιώς ο σοβάς κόβεται στο soffit αλλά το καπάκι μένει να αιωρείται στο nominal top.
 */

import { computeStructuralFinishSilhouette } from '../structural-finish-scene';
import { computeMergedStructuralTopCap } from '../structural-finish-scene-horizontal';
import { wallFinishZExtent } from '../wall-finish-source';
import { type WallFinishObstacle } from '../structural-finish-scene';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';

/** Τοίχος 6m με ενεργό σοβά, βάση 0, ύψος 3000 (nominal top @ 3000). */
function wall(opts: { id?: string; stripFinish?: boolean } = {}): WallFinishObstacle {
  let params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 6000, y: 0 }, { height: 3000 });
  if (opts.stripFinish) {
    const { finish: _drop, ...rest } = params;
    params = rest;
  }
  return { id: opts.id ?? 'w1', kind: 'straight', params };
}

const maxZTop = (bands: readonly { zTopMm: number }[]): number =>
  bands.reduce((m, b) => Math.max(m, b.zTopMm), -Infinity);

const capPlanes = (faces: readonly { zMm: number }[]): number[] => faces.map((f) => f.zMm);

const topCap = (w: WallFinishObstacle, wallTopClipById?: ReadonlyMap<string, number>) =>
  computeMergedStructuralTopCap({
    columns: [], beams: [], walls: [w], slabs: [], beamObstacles: [], floorElevationMm: 0, wallTopClipById,
  });

describe('computeStructuralFinishSilhouette — ADR-534 Φ3c-B3b soffit clip (τοίχος)', () => {
  it('χωρίς clip → ο σοβάς φτάνει το πλήρες ύψος του τοίχου (3000mm)', () => {
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [wall()], floorElevationMm: 0 });
    expect(bands.length).toBeGreaterThan(0);
    expect(maxZTop(bands)).toBeCloseTo(3000, 6);
  });

  it('με wallTopClipById=2800 → ο σοβάς κόβεται στο soffit της πλάκας (2800mm)', () => {
    const clip = new Map<string, number>([['w1', 2800]]);
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [wall()], floorElevationMm: 0, wallTopClipById: clip });
    expect(bands.length).toBeGreaterThan(0);
    expect(maxZTop(bands)).toBeCloseTo(2800, 6);
  });

  it('clip για άλλο id → no-op (πλήρες ύψος, byte-for-byte)', () => {
    const clip = new Map<string, number>([['other', 2800]]);
    const bands = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [wall()], floorElevationMm: 0, wallTopClipById: clip });
    expect(maxZTop(bands)).toBeCloseTo(3000, 6);
  });

  it('τοίχος-ΕΜΠΟΔΙΟ (χωρίς σοβά) → το clip ΔΕΝ τον αγγίζει (render-only σύμβαση του σοβά)', () => {
    // Ένας legacy/bare τοίχος μένει coverage obstacle: το δομικό του σώμα ΔΕΝ κόβεται στο soffit
    // (T-beam — το δομικό ύψος μένει). Clip στο obstacle θα «ξεκάλυπτε» ψευδώς τη ζώνη soffit→top.
    const obstacle = wall({ stripFinish: true });
    const clip = new Map<string, number>([['w1', 2800]]);
    const withClip = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [obstacle], floorElevationMm: 0, wallTopClipById: clip });
    const without = computeStructuralFinishSilhouette({ columns: [], beams: [], walls: [obstacle], floorElevationMm: 0 });
    expect(withClip).toEqual(without);
  });
});

describe('computeMergedStructuralTopCap — το `hup` καπάκι ακολουθεί το ίδιο clip', () => {
  it('χωρίς clip → το καπάκι κάθεται στο nominal top (3000mm)', () => {
    expect(capPlanes(topCap(wall()))).toEqual([3000]);
  });

  it('με clip 2800 → το επίπεδο του καπακιού πέφτει στο soffit (κάθεται πάνω στον κομμένο σοβά)', () => {
    // Χωρίς αυτό: κάθετος σοβάς @2800 αλλά καπάκι @3000 = οι «λεπτές λωρίδες» πάνω στην πλάκα.
    expect(capPlanes(topCap(wall(), new Map([['w1', 2800]])))).toEqual([2800]);
  });
});

describe('wallFinishZExtent — SSoT z-extent (πρώην διπλό wallObstacleZExtent/wallZExtent)', () => {
  const noBeams = new Map<string, number>();

  it('η ΚΑΤΩ παρειά μένει ανέγγιχτη από το clip (αγκυρωμένη στο floor+baseOffset)', () => {
    const z = wallFinishZExtent(wall(), noBeams, 0, 2800);
    expect(z.zBotMm).toBe(0);
    expect(z.zTopMm).toBe(2800);
  });

  it('clip ψηλότερα από το nominal top → no-op (Math.min κρατά το nominal)', () => {
    expect(wallFinishZExtent(wall(), noBeams, 0, 5000).zTopMm).toBe(3000);
  });

  it('floorElevationMm μετατοπίζει το nominal top (building-relative datum)', () => {
    expect(wallFinishZExtent(wall(), noBeams, 3000, undefined).zTopMm).toBe(6000);
  });

  it('attached-top (beam underside) + clip → νικά ΤΟ ΧΑΜΗΛΟΤΕΡΟ των δύο', () => {
    const attached: WallFinishObstacle = {
      ...wall(),
      params: { ...wall().params, topBinding: 'attached', attachTopToIds: ['b1'] } as WallFinishObstacle['params'],
    };
    const undersides = new Map<string, number>([['b1', 2500]]);
    // beam underside 2500 < clip 2800 → 2500.
    expect(wallFinishZExtent(attached, undersides, 0, 2800).zTopMm).toBe(2500);
    // clip 2300 < beam underside 2500 → 2300.
    expect(wallFinishZExtent(attached, undersides, 0, 2300).zTopMm).toBe(2300);
  });
});
