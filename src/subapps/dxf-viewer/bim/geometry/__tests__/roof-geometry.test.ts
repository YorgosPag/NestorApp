/**
 * ADR-417 Φ1-part-2 — Engine tests για `computeRoofGeometry` / `applyRoofShapePreset`.
 *
 * Κύρια εστίαση: **winding-agnostic** συμπεριφορά. Ο χρήστης μπορεί να σχεδιάσει
 * το footprint είτε CCW είτε CW· η μηχανή ΠΡΕΠΕΙ να παράγει την ίδια κεκλιμένη
 * στέγη (ridge πάνω από το γείσο) και στις δύο φορές. Regression για το bug
 * «όλες οι μορφές βγαίνουν επίπεδες» (ridgeHeightMm === 0 για CW footprint).
 */

import { computeRoofGeometry, applyRoofShapePreset } from '../roof-geometry';
import type { Point3D, Polygon3D } from '../../types/bim-base';
import type { RoofParams } from '../../types/roof-types';

const rect = (cw: boolean): Polygon3D => {
  // CCW (y-up math): (0,0)→(4000,0)→(4000,3000)→(0,3000). CW = reversed.
  const ccw: Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 4000, y: 0, z: 0 },
    { x: 4000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ];
  return { vertices: cw ? [...ccw].reverse() : ccw };
};

const buildParams = (outline: Polygon3D, shape: 'flat' | 'mono-pitch' | 'gable'): RoofParams => ({
  outline,
  edges: applyRoofShapePreset(outline, shape, 30, 'deg'),
  slopeUnit: 'deg',
  basePivotZ: 3000,
  thickness: 200,
  sceneUnits: 'mm',
});

describe('computeRoofGeometry — winding-agnostic heights', () => {
  it('gable rises above the eave for a CCW footprint', () => {
    const g = computeRoofGeometry(buildParams(rect(false), 'gable'));
    expect(g.shape).toBe('gable');
    expect(g.faces.length).toBe(2);
    expect(g.ridgeHeightMm).toBeGreaterThan(0);
  });

  it('gable rises above the eave for a CW footprint (regression: was flat)', () => {
    const g = computeRoofGeometry(buildParams(rect(true), 'gable'));
    expect(g.faces.length).toBe(2);
    expect(g.ridgeHeightMm).toBeGreaterThan(0);
  });

  it('produces the same ridge height regardless of winding', () => {
    const ccw = computeRoofGeometry(buildParams(rect(false), 'gable'));
    const cw = computeRoofGeometry(buildParams(rect(true), 'gable'));
    expect(cw.ridgeHeightMm).toBeCloseTo(ccw.ridgeHeightMm, 3);
  });

  it('mono-pitch rises for both windings', () => {
    const ccw = computeRoofGeometry(buildParams(rect(false), 'mono-pitch'));
    const cw = computeRoofGeometry(buildParams(rect(true), 'mono-pitch'));
    expect(ccw.ridgeHeightMm).toBeGreaterThan(0);
    expect(cw.ridgeHeightMm).toBeGreaterThan(0);
    expect(cw.ridgeHeightMm).toBeCloseTo(ccw.ridgeHeightMm, 3);
  });

  it('flat stays at the eave (ridgeHeightMm === 0)', () => {
    const g = computeRoofGeometry(buildParams(rect(false), 'flat'));
    expect(g.shape).toBe('flat');
    expect(g.ridgeHeightMm).toBe(0);
  });

  it('gross (sloped) area exceeds projected area for a pitched roof', () => {
    const g = computeRoofGeometry(buildParams(rect(false), 'gable'));
    expect(g.grossAreaM2).toBeGreaterThan(g.projectedAreaM2);
  });
});
