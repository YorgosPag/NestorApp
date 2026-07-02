/**
 * ADR-449 PART B Slice C (2D) — tests για το `pickFinishFaceAtPoint`.
 *
 * Καλύπτει: nearest-edge εντός band (πάχος σοβά)· κλικ έξω από το band → null· nearest
 * across elements· ανενεργός σοβάς → skip· edgeIndex→`finishFaceRef` ταυτότητα.
 */

import { pickFinishFaceAtPoint, type FinishPickElement } from '../finish-face-pick-2d';
import { finishFaceRef } from '../structural-finish-face-ref';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
  exteriorThickness: 25, // band = 25 (scale=1)
};

/** Ορθογώνιο [0,100]×[0,50] (CCW). Edges: 0 bottom, 1 right, 2 top, 3 left. */
const rect: Pt2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
const el = (id: string, footprint: Pt2[], finish: StructuralFinishSpec | undefined = SPEC): FinishPickElement =>
  ({ id, footprint, finish });

describe('pickFinishFaceAtPoint (ADR-449 Slice C 2D)', () => {
  it('κλικ έξω από την κάτω παρειά (στη λωρίδα σοβά) → side:0', () => {
    const pick = pickFinishFaceAtPoint({ x: 50, y: -10 }, [el('c1', rect)], 1);
    expect(pick).not.toBeNull();
    expect(pick!.elementId).toBe('c1');
    expect(pick!.edgeIndex).toBe(0);
    expect(pick!.ref).toBe(finishFaceRef(rect[0], rect[1]));
  });

  it('πλησιέστερη ακμή ανά πλευρά (right/top/left)', () => {
    expect(pickFinishFaceAtPoint({ x: 110, y: 25 }, [el('c1', rect)], 1)!.edgeIndex).toBe(1); // right
    expect(pickFinishFaceAtPoint({ x: 50, y: 60 }, [el('c1', rect)], 1)!.edgeIndex).toBe(2);  // top
    expect(pickFinishFaceAtPoint({ x: -10, y: 25 }, [el('c1', rect)], 1)!.edgeIndex).toBe(3); // left
  });

  it('κλικ έξω από το band (30 > 25) → null', () => {
    expect(pickFinishFaceAtPoint({ x: 50, y: -30 }, [el('c1', rect)], 1)).toBeNull();
  });

  it('κλικ μακριά → null', () => {
    expect(pickFinishFaceAtPoint({ x: 500, y: 500 }, [el('c1', rect)], 1)).toBeNull();
  });

  it('nearest across elements: κερδίζει το κοντινότερο', () => {
    const other = rect.map((p) => ({ x: p.x + 200, y: p.y })); // στοιχείο στα δεξιά
    const pick = pickFinishFaceAtPoint({ x: 205, y: -8 }, [el('c1', rect), el('c2', other)], 1);
    expect(pick!.elementId).toBe('c2'); // κοντύτερα στην κάτω παρειά του c2
    expect(pick!.edgeIndex).toBe(0);
  });

  it('ανενεργός σοβάς → skip (κανένα pick)', () => {
    expect(pickFinishFaceAtPoint({ x: 50, y: -10 }, [el('c1', rect, { ...SPEC, enabled: false })], 1)).toBeNull();
    const noFinish: FinishPickElement = { id: 'c1', footprint: rect, finish: undefined };
    expect(pickFinishFaceAtPoint({ x: 50, y: -10 }, [noFinish], 1)).toBeNull();
  });

  it('scale + tolWorld μεγαλώνουν το band', () => {
    // scale=0.5 → band=12.5· κλικ στο y=-20 δεν πιάνεται· με tolWorld=10 → band=22.5 → πιάνεται.
    expect(pickFinishFaceAtPoint({ x: 50, y: -20 }, [el('c1', rect)], 0.5)).toBeNull();
    expect(pickFinishFaceAtPoint({ x: 50, y: -20 }, [el('c1', rect)], 0.5, 10)!.edgeIndex).toBe(0);
  });
});
