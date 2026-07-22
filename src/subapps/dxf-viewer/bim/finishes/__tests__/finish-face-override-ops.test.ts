/**
 * ADR-449 PART B Slice C — tests για τα per-face override ops (pure).
 *
 * Καλύπτει: `side:i` parse· faceKey→finishFaceRef (ίδιο key με finishFaceRef ακμής)·
 * non-side → null· immutable merge/overwrite/clear στο spec.
 */

import {
  edgeIndexFromFaceKey,
  finishFaceRefForFaceKey,
  withFinishFaceOverride,
  finishFootprintVertices,
  wholeElementFinishFaceKeys,
} from '../finish-face-override-ops';
import { finishFaceRef } from '../structural-finish-face-ref';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

/** Ορθογώνιο footprint [0,100]×[0,50] (CCW). */
const rect: Pt2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];

describe('edgeIndexFromFaceKey', () => {
  it('side:i → i', () => {
    expect(edgeIndexFromFaceKey('side:0')).toBe(0);
    expect(edgeIndexFromFaceKey('side:12')).toBe(12);
  });
  it('non-side → null', () => {
    expect(edgeIndexFromFaceKey('top')).toBeNull();
    expect(edgeIndexFromFaceKey('bottom')).toBeNull();
    expect(edgeIndexFromFaceKey('hole:0:1')).toBeNull();
    expect(edgeIndexFromFaceKey('*')).toBeNull();
    expect(edgeIndexFromFaceKey('side:x')).toBeNull();
  });
});

describe('finishFaceRefForFaceKey', () => {
  it('side:0 → finishFaceRef της ακμής 0 (v0→v1) — ίδιο key με pushFinishOverrideEdges', () => {
    expect(finishFaceRefForFaceKey(rect, 'side:0')).toBe(finishFaceRef(rect[0], rect[1]));
  });
  it('side:2 → ακμή 2 (v2→v3)', () => {
    expect(finishFaceRefForFaceKey(rect, 'side:2')).toBe(finishFaceRef(rect[2], rect[3]));
  });
  it('τελευταία ακμή wrap-around (v3→v0)', () => {
    expect(finishFaceRefForFaceKey(rect, 'side:3')).toBe(finishFaceRef(rect[3], rect[0]));
  });
  it('non-side / out-of-bounds / degenerate → null', () => {
    expect(finishFaceRefForFaceKey(rect, 'top')).toBeNull();
    expect(finishFaceRefForFaceKey(rect, 'side:9')).toBeNull();
    expect(finishFaceRefForFaceKey([{ x: 0, y: 0 }, { x: 1, y: 1 }], 'side:0')).toBeNull();
  });
});

// ADR-539 (Giorgio 2026-07-22) — entity-level «ΣΟΒΑΣ» drag-drop reads these to paint EVERY side.
describe('finishFootprintVertices', () => {
  it('πλάκα → params.outline', () => {
    expect(finishFootprintVertices({ params: { outline: { vertices: rect } } })).toBe(rect);
  });
  it('κολόνα → geometry.footprint', () => {
    expect(finishFootprintVertices({ geometry: { footprint: { vertices: rect } } })).toBe(rect);
  });
  it('δοκάρι → geometry.outline', () => {
    expect(finishFootprintVertices({ geometry: { outline: { vertices: rect } } })).toBe(rect);
  });
  it('κανένα footprint → undefined', () => {
    expect(finishFootprintVertices({})).toBeUndefined();
  });
});

describe('wholeElementFinishFaceKeys', () => {
  it('n κορυφές → side:0..n-1', () => {
    expect(wholeElementFinishFaceKeys({ params: { outline: { vertices: rect } } }))
      .toEqual(['side:0', 'side:1', 'side:2', 'side:3']);
  });
  it('εκφυλισμένο footprint (<3) → κενό', () => {
    expect(wholeElementFinishFaceKeys({ geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } } })).toEqual([]);
    expect(wholeElementFinishFaceKeys({})).toEqual([]);
  });
});

describe('withFinishFaceOverride', () => {
  const ref = finishFaceRef(rect[0], rect[1]);

  it('προσθέτει override (immutable — νέο spec)', () => {
    const next = withFinishFaceOverride(SPEC, ref, { materialId: 'mat-gypsum-board' });
    expect(next.faceOverrides).toEqual({ [ref]: { materialId: 'mat-gypsum-board' } });
    expect(next).not.toBe(SPEC);
    expect(SPEC.faceOverrides).toBeUndefined(); // αμετάβλητο original
  });

  it('overwrite υπάρχοντος ref + διατήρηση άλλων', () => {
    const ref2 = finishFaceRef(rect[2], rect[3]);
    const base = withFinishFaceOverride(withFinishFaceOverride(SPEC, ref, { colorOverride: '#aaa' }), ref2, { materialId: 'x' });
    const next = withFinishFaceOverride(base, ref, { colorOverride: '#bbb' });
    expect(next.faceOverrides).toEqual({ [ref]: { colorOverride: '#bbb' }, [ref2]: { materialId: 'x' } });
  });

  it('null → clear (διαγράφει το ref, κρατά τα άλλα)', () => {
    const ref2 = finishFaceRef(rect[2], rect[3]);
    const base = { ...SPEC, faceOverrides: { [ref]: { materialId: 'a' }, [ref2]: { materialId: 'b' } } };
    const next = withFinishFaceOverride(base, ref, null);
    expect(next.faceOverrides).toEqual({ [ref2]: { materialId: 'b' } });
  });

  it('κενό override → clear (τίποτα να εφαρμοστεί)', () => {
    const base = { ...SPEC, faceOverrides: { [ref]: { materialId: 'a' } } };
    expect(withFinishFaceOverride(base, ref, {}).faceOverrides).toEqual({});
  });
});
