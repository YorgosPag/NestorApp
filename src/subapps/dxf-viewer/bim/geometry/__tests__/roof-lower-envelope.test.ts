/**
 * ADR-417 Φ2a — Unit tests για τον γενικό lower-envelope solver.
 *
 * Επικυρώνει: (1) το height field `roofZmm` (γείσο = basePivot, ανηφορίζει μέσα),
 * (2) ο `solveLowerEnvelope` αναπαράγει gable (2 νερά + 1 οριζόντιος ridge) και
 * δίνει σωστή τετράρριχτη (4 νερά + hips), (3) ridge vs hip classification.
 */

import {
  resolveEavePlanes,
  roofZmm,
  solveLowerEnvelope,
  type Vec2,
} from '../roof-lower-envelope';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Point3D } from '../../types/bim-base';
import type { RoofEdgeSlope } from '../../types/roof-types';

const RECT: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4000, y: 0, z: 0 },
  { x: 4000, y: 3000, z: 0 },
  { x: 0, y: 3000, z: 0 },
];
const footprint2D: Vec2[] = RECT.map((v) => ({ x: v.x, y: v.y }));
const s = mmToSceneUnits('mm');
const canvasToM = (1 / s) * 0.001;
const BASE = 3000;

const slope = (defines: boolean): RoofEdgeSlope => ({ definesSlope: defines, slope: 30, overhangMm: 0 });
const planesFor = (defs: readonly boolean[]) =>
  resolveEavePlanes(RECT, defs.map(slope), 'deg').planes;

describe('roofZmm — height field (lower envelope)', () => {
  it('επιστρέφει basePivot στο γείσο και ψηλότερα προς τα μέσα (gable)', () => {
    const planes = planesFor([true, false, true, false]); // north+south eaves
    const atEave = roofZmm(planes, BASE, s, { x: 2000, y: 0 });
    const atRidge = roofZmm(planes, BASE, s, { x: 2000, y: 1500 });
    expect(atEave).toBeCloseTo(BASE, 3);
    expect(atRidge).toBeGreaterThan(atEave);
  });

  it('χωρίς επίπεδα → επίπεδο στο basePivot', () => {
    expect(roofZmm([], BASE, s, { x: 1000, y: 1000 })).toBe(BASE);
  });
});

describe('solveLowerEnvelope', () => {
  it('gable (2 αντικριστά) → 2 νερά + 1 οριζόντιος ridge', () => {
    const planes = planesFor([true, false, true, false]);
    const { faces, ridges } = solveLowerEnvelope(footprint2D, planes, BASE, s, canvasToM);
    expect(faces.length).toBe(2);
    expect(ridges.length).toBe(1);
    expect(ridges[0].kind).toBe('ridge');
    expect(ridges[0].a.z).toBeCloseTo(ridges[0].b.z ?? 0, 3); // οριζόντιος
  });

  it('hip (4 ακμές) → 4 νερά + 4 hips + 1 ridge', () => {
    const planes = planesFor([true, true, true, true]);
    const { faces, ridges } = solveLowerEnvelope(footprint2D, planes, BASE, s, canvasToM);
    expect(faces.length).toBe(4);
    expect(ridges.filter((r) => r.kind === 'hip').length).toBe(4);
    expect(ridges.filter((r) => r.kind === 'ridge').length).toBe(1);
  });

  it('οι hip γραμμές είναι κεκλιμένες (διαφορετικό z άκρων)', () => {
    const planes = planesFor([true, true, true, true]);
    const { ridges } = solveLowerEnvelope(footprint2D, planes, BASE, s, canvasToM);
    for (const hip of ridges.filter((r) => r.kind === 'hip')) {
      expect(Math.abs((hip.a.z ?? 0) - (hip.b.z ?? 0))).toBeGreaterThan(1);
    }
  });
});
