/**
 * ADR-684 §6 — unit tests για το περίγραμμα κάτοψης (`computeGenericSolidPlanOutline`).
 *
 * Επιβεβαιώνει ότι κάθε σχήμα προβάλλεται με το ΣΩΣΤΟ περίγραμμα (κύκλος / n-γωνο / ορθογώνιο /
 * δακτύλιος), όχι πάντα το ορθογώνιο του bbox — το bug που ανέφερε ο χρήστης («ό,τι κι αν επιλέγω,
 * ίδιο σχήμα στην κάτοψη»).
 */

import { computeGenericSolidPlanOutline } from '../generic-solid-plan-outline';
import type { Point3D } from '../../../types/bim-base';
import type { GenericSolidShape } from '../generic-solid-types';

const ORIGIN: Point3D = { x: 0, y: 0, z: 0 };
const outline = (shape: GenericSolidShape) => computeGenericSolidPlanOutline(shape, ORIGIN, 0, 'mm');

/** Μέγιστη ακτίνα (απόσταση από το κέντρο) ενός δαχτυλιδιού. */
function maxRadius(ring: readonly Point3D[]): number {
  return Math.max(...ring.map((p) => Math.hypot(p.x, p.y)));
}

describe('computeGenericSolidPlanOutline — περίγραμμα ανά σχήμα', () => {
  it('box → ΕΝΑ ορθογώνιο δαχτυλίδι (4 κορυφές)', () => {
    const { rings } = outline({ kind: 'box', widthMm: 400, depthMm: 300, heightMm: 200 });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
  });

  it('pyramid → ορθογώνιο βάσης (4 κορυφές)', () => {
    const { rings } = outline({ kind: 'pyramid', baseWidthMm: 500, baseDepthMm: 500, heightMm: 500 });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
  });

  it('pyramid → 4 εσωτερικές ακμές γωνία→κορυφή (το «Χ»), όλες καταλήγουν στο κέντρο', () => {
    const { rings, interiorEdges } = outline({
      kind: 'pyramid',
      baseWidthMm: 500,
      baseDepthMm: 500,
      heightMm: 500,
    });
    expect(interiorEdges).toHaveLength(4);
    // Κάθε ακμή: πρώτο σημείο = μια γωνία βάσης, δεύτερο = η κορυφή προβεβλημένη στο κέντρο (ORIGIN).
    for (let i = 0; i < interiorEdges.length; i++) {
      const [corner, apex] = interiorEdges[i];
      expect(corner).toEqual(rings[0][i]);
      expect(apex.x).toBeCloseTo(ORIGIN.x, 6);
      expect(apex.y).toBeCloseTo(ORIGIN.y, 6);
    }
  });

  it('box/sphere/cylinder/disc/cone/prism/torus → καμία εσωτερική ακμή (το περίγραμμα αρκεί)', () => {
    for (const shape of [
      { kind: 'box', widthMm: 400, depthMm: 300, heightMm: 200 },
      { kind: 'sphere', radiusMm: 150 },
      { kind: 'cylinder', radiusMm: 100, heightMm: 500 },
      { kind: 'disc', radiusMm: 250, thicknessMm: 20 },
      { kind: 'cone', radiusBottomMm: 120, radiusTopMm: 0, heightMm: 300 },
      { kind: 'prism', radiusMm: 150, heightMm: 400, sides: 6 },
      { kind: 'torus', majorRadiusMm: 200, tubeRadiusMm: 50 },
    ] as const satisfies readonly GenericSolidShape[]) {
      expect(outline(shape).interiorEdges).toHaveLength(0);
    }
  });

  it('sphere/cylinder/disc/cone → κύκλος (tessellated, > 4 κορυφές)', () => {
    for (const shape of [
      { kind: 'sphere', radiusMm: 150 },
      { kind: 'cylinder', radiusMm: 100, heightMm: 500 },
      { kind: 'disc', radiusMm: 250, thicknessMm: 20 },
      { kind: 'cone', radiusBottomMm: 120, radiusTopMm: 0, heightMm: 300 },
    ] as const satisfies readonly GenericSolidShape[]) {
      const { rings } = outline(shape);
      expect(rings).toHaveLength(1);
      expect(rings[0].length).toBeGreaterThan(8);
    }
  });

  it('cone → ακτίνα = η μεγαλύτερη βάση (κάτω/άνω)', () => {
    const { rings } = outline({ kind: 'cone', radiusBottomMm: 120, radiusTopMm: 200, heightMm: 300 });
    // ακτίνα κάτοψης = max(120, 200) = 200 mm (canvas units = mm για sceneUnits 'mm')
    expect(maxRadius(rings[0])).toBeCloseTo(200, 0);
  });

  it('prism → n-γωνο με ακριβώς `sides` κορυφές', () => {
    const { rings } = outline({ kind: 'prism', radiusMm: 150, heightMm: 400, sides: 6 });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(6);
  });

  it('torus → ΔΥΟ ομόκεντροι κύκλοι (εξωτερικός + η τρύπα)', () => {
    const { rings } = outline({ kind: 'torus', majorRadiusMm: 200, tubeRadiusMm: 50 });
    expect(rings).toHaveLength(2);
    expect(maxRadius(rings[0])).toBeCloseTo(250, 0); // major + tube
    expect(maxRadius(rings[1])).toBeCloseTo(150, 0); // major - tube
  });

  it('torus με tube ≥ major → ΕΝΑ δαχτυλίδι (καμία τρύπα)', () => {
    const { rings } = outline({ kind: 'torus', majorRadiusMm: 40, tubeRadiusMm: 40 });
    expect(rings).toHaveLength(1);
  });
});
