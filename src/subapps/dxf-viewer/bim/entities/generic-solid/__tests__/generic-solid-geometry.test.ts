/**
 * ADR-684 Φ2 — unit tests: generic-solid geometry + validation.
 *
 * Καλύπτει: (1) `shapeBoundingBoxMm` ανά σχήμα (και τα 8), (2) `computeGenericSolidGeometry`
 * footprint/bbox/height invariants, (3) `validateGenericSolidParams` hard-error paths.
 */

import {
  shapeBoundingBoxMm,
  computeGenericSolidGeometry,
  validateGenericSolidParams,
} from '../generic-solid-geometry';
import type { GenericSolidParams, GenericSolidShape } from '../generic-solid-types';

const paramsFor = (shape: GenericSolidShape): GenericSolidParams => ({
  kind: 'generic',
  shape,
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: 0,
  mountingElevationMm: 0,
  sceneUnits: 'mm',
});

describe('shapeBoundingBoxMm — bbox ανά σχήμα (και τα 8)', () => {
  it('box → οι authored διαστάσεις', () => {
    expect(shapeBoundingBoxMm({ kind: 'box', widthMm: 400, depthMm: 300, heightMm: 200 })).toEqual({
      widthMm: 400,
      depthMm: 300,
      heightMm: 200,
    });
  });

  it('sphere → διάμετρος και στους 3 άξονες', () => {
    expect(shapeBoundingBoxMm({ kind: 'sphere', radiusMm: 150 })).toEqual({
      widthMm: 300,
      depthMm: 300,
      heightMm: 300,
    });
  });

  it('cylinder → διάμετρος × διάμετρος × ύψος', () => {
    expect(shapeBoundingBoxMm({ kind: 'cylinder', radiusMm: 100, heightMm: 500 })).toEqual({
      widthMm: 200,
      depthMm: 200,
      heightMm: 500,
    });
  });

  it('cone → η μεγαλύτερη ακτίνα ορίζει τη διάμετρο', () => {
    expect(
      shapeBoundingBoxMm({ kind: 'cone', radiusBottomMm: 120, radiusTopMm: 40, heightMm: 300 }),
    ).toEqual({ widthMm: 240, depthMm: 240, heightMm: 300 });
  });

  it('torus → (major+tube)*2 πλάτος/βάθος, tube*2 ύψος', () => {
    expect(shapeBoundingBoxMm({ kind: 'torus', majorRadiusMm: 200, tubeRadiusMm: 50 })).toEqual({
      widthMm: 500,
      depthMm: 500,
      heightMm: 100,
    });
  });

  it('pyramid → βάση × βάση × ύψος', () => {
    expect(
      shapeBoundingBoxMm({ kind: 'pyramid', baseWidthMm: 600, baseDepthMm: 400, heightMm: 500 }),
    ).toEqual({ widthMm: 600, depthMm: 400, heightMm: 500 });
  });

  it('disc → διάμετρος × διάμετρος × πάχος', () => {
    expect(shapeBoundingBoxMm({ kind: 'disc', radiusMm: 250, thicknessMm: 20 })).toEqual({
      widthMm: 500,
      depthMm: 500,
      heightMm: 20,
    });
  });

  it('prism → διάμετρος περιγεγραμμένου × ύψος', () => {
    expect(shapeBoundingBoxMm({ kind: 'prism', radiusMm: 150, heightMm: 400, sides: 6 })).toEqual({
      widthMm: 300,
      depthMm: 300,
      heightMm: 400,
    });
  });
});

describe('computeGenericSolidGeometry — παράγωγη γεωμετρία', () => {
  it('box: height = bbox Z· footprint κλειστό ίχνος· bbox συνεπές', () => {
    const geo = computeGenericSolidGeometry(
      paramsFor({ kind: 'box', widthMm: 400, depthMm: 300, heightMm: 200 }),
    );
    expect(geo.height).toBe(200);
    expect(geo.footprint.vertices.length).toBeGreaterThanOrEqual(4);
    expect(geo.bbox).toBeDefined();
    expect(geo.area).toBeGreaterThan(0);
  });

  it('sphere: height ίσο με διάμετρο (12 ο πυρήνας μοιράζεται με έπιπλο/imported-mesh)', () => {
    const geo = computeGenericSolidGeometry(paramsFor({ kind: 'sphere', radiusMm: 150 }));
    expect(geo.height).toBe(300);
  });

  it('idempotent — δύο κλήσεις ίδιο αποτέλεσμα', () => {
    const p = paramsFor({ kind: 'cylinder', radiusMm: 100, heightMm: 500 });
    expect(computeGenericSolidGeometry(p)).toEqual(computeGenericSolidGeometry(p));
  });
});

describe('validateGenericSolidParams — hard errors', () => {
  it('έγκυρο box → καμία hard error', () => {
    const r = validateGenericSolidParams(paramsFor({ kind: 'box', widthMm: 400, depthMm: 300, heightMm: 200 }));
    expect(r.hardErrors).toEqual([]);
  });

  it('μηδενική διάσταση → nonPositiveDimension', () => {
    const r = validateGenericSolidParams(paramsFor({ kind: 'box', widthMm: 0, depthMm: 300, heightMm: 200 }));
    expect(r.hardErrors).toContain('genericSolid.validation.hardErrors.nonPositiveDimension');
  });

  it('εκφυλισμένη διάσταση (<1mm) → degenerateDimension', () => {
    const r = validateGenericSolidParams(paramsFor({ kind: 'sphere', radiusMm: 0.5 }));
    expect(r.hardErrors).toContain('genericSolid.validation.hardErrors.degenerateDimension');
  });

  it('πρίσμα με < 3 πλευρές → tooFewSides', () => {
    const r = validateGenericSolidParams(paramsFor({ kind: 'prism', radiusMm: 150, heightMm: 400, sides: 2 }));
    expect(r.hardErrors).toContain('genericSolid.validation.hardErrors.tooFewSides');
  });

  it('κώνος με radiusTopMm = 0 (πλήρης κώνος) → έγκυρος', () => {
    const r = validateGenericSolidParams(
      paramsFor({ kind: 'cone', radiusBottomMm: 120, radiusTopMm: 0, heightMm: 300 }),
    );
    expect(r.hardErrors).toEqual([]);
  });
});
