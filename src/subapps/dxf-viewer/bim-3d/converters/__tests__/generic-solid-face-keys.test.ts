/**
 * ADR-684 Φ4-C — genericSolidFaceKeys: σταθερή αντιστοίχιση materialIndex → FaceKey ανά σχήμα.
 * Η σταθερότητα (μήκος + περιεχόμενο) είναι το συμβόλαιο persistence: αν αλλάξει η σειρά, οι βαμμένες
 * έδρες θα «μετακινηθούν» στο reload. Καλύπτει και τα 8 σχήματα (ADR-587 πληρότητα).
 */

import { genericSolidFaceKeys } from '../generic-solid-face-keys';
import { GENERIC_SOLID_SHAPE_KINDS } from '../../../bim/entities/generic-solid/generic-solid-types';
import type { GenericSolidShape } from '../../../bim/entities/generic-solid/generic-solid-types';

const SHAPE: Record<GenericSolidShape['kind'], GenericSolidShape> = {
  box: { kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 },
  sphere: { kind: 'sphere', radiusMm: 400 },
  cylinder: { kind: 'cylinder', radiusMm: 300, heightMm: 800 },
  cone: { kind: 'cone', radiusBottomMm: 300, radiusTopMm: 0, heightMm: 800 },
  torus: { kind: 'torus', majorRadiusMm: 500, tubeRadiusMm: 120 },
  pyramid: { kind: 'pyramid', baseWidthMm: 600, baseDepthMm: 400, heightMm: 700 },
  disc: { kind: 'disc', radiusMm: 400, thicknessMm: 40 },
  prism: { kind: 'prism', radiusMm: 350, heightMm: 600, sides: 6 },
};

describe('genericSolidFaceKeys', () => {
  it('box → 6 όψεις (BoxGeometry group order)', () => {
    expect(genericSolidFaceKeys(SHAPE.box)).toEqual([
      'side:0',
      'side:1',
      'top',
      'bottom',
      'side:2',
      'side:3',
    ]);
  });

  it.each(['cylinder', 'cone', 'disc', 'prism'] as const)(
    '%s → [side:0, top, bottom] (CylinderGeometry group order)',
    (kind) => {
      expect(genericSolidFaceKeys(SHAPE[kind])).toEqual(['side:0', 'top', 'bottom']);
    },
  );

  it.each(['sphere', 'torus'] as const)('%s → ΜΙΑ έδρα', (kind) => {
    expect(genericSolidFaceKeys(SHAPE[kind])).toEqual(['side:0']);
  });

  it('pyramid → [bottom, side:0..3] (χειροκίνητα groups)', () => {
    expect(genericSolidFaceKeys(SHAPE.pyramid)).toEqual([
      'bottom',
      'side:0',
      'side:1',
      'side:2',
      'side:3',
    ]);
  });

  it('καλύπτει ΚΑΘΕ σχήμα του SSoT (καμία παράλειψη, καμία κενή λίστα)', () => {
    for (const kind of GENERIC_SOLID_SHAPE_KINDS) {
      const keys = genericSolidFaceKeys(SHAPE[kind]);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length); // μοναδικοί faceKeys
    }
  });
});
