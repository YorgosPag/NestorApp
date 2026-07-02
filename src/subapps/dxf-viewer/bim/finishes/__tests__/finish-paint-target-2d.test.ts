/**
 * ADR-449 PART B Slice C (2D) — tests για το `resolveFinishPaintTarget` (click → face target).
 *
 * Καλύπτει: κλικ σε λωρίδα σοβά → `{bimId, faceKey:'side:i'}`· κλικ μακριά → null· nearest
 * across elements· ανενεργός σοβάς → null. Πυρήνας (collect/pick) έχει ήδη δικά του tests —
 * εδώ επιβεβαιώνεται η γέφυρα edgeIndex → `side:i` + η ταυτότητα του target.
 */

import { resolveFinishPaintTarget } from '../finish-paint-target-2d';
import type { StructuralFinishSpec } from '../structural-finish-types';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const VERTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = (id: string, finish?: StructuralFinishSpec, verts = VERTS): any =>
  ({ id, type: 'column', params: { finish }, geometry: { footprint: { vertices: verts } } });

describe('resolveFinishPaintTarget (ADR-449 Slice C 2D)', () => {
  it('κλικ στη λωρίδα σοβά της κάτω παρειάς → side:0', () => {
    const target = resolveFinishPaintTarget({ x: 50, y: -10 }, [col('c1', SPEC)], 1);
    expect(target).toEqual({ bimId: 'c1', faceKey: 'side:0' });
  });

  it('κλικ στη δεξιά παρειά → side:1', () => {
    expect(resolveFinishPaintTarget({ x: 110, y: 25 }, [col('c1', SPEC)], 1)).toEqual({ bimId: 'c1', faceKey: 'side:1' });
  });

  it('κλικ μακριά → null', () => {
    expect(resolveFinishPaintTarget({ x: 500, y: 500 }, [col('c1', SPEC)], 1)).toBeNull();
  });

  it('nearest across elements → κερδίζει το κοντινότερο', () => {
    const other = VERTS.map((p) => ({ x: p.x + 200, y: p.y }));
    const target = resolveFinishPaintTarget({ x: 205, y: -8 }, [col('c1', SPEC), col('c2', SPEC, other)], 1);
    expect(target).toEqual({ bimId: 'c2', faceKey: 'side:0' });
  });

  it('ανενεργός σοβάς → null', () => {
    expect(resolveFinishPaintTarget({ x: 50, y: -10 }, [col('c1', { ...SPEC, enabled: false })], 1)).toBeNull();
  });
});
