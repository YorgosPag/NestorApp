/**
 * ADR-436 Slice 2 — foundation line-tool preview helper tests.
 *
 * Verifies the rubber-band state map: [] → cursor dot, [start] → band footprint
 * ghost (WYSIWYG via computeFoundationGeometry). Pure — μηδέν canvas.
 */

import { generateFoundationPreview } from '../foundation-preview-helpers';
import { foundationPreviewStore } from '../../../bim/foundations/foundation-preview-store';

describe('generateFoundationPreview', () => {
  afterEach(() => foundationPreviewStore.reset());

  it('returns a cursor start marker when no points are clicked yet', () => {
    const preview = generateFoundationPreview([], { x: 10, y: 20 });
    expect(preview).not.toBeNull();
    expect(preview!.type).toBe('point');
    expect(preview!.preview).toBe(true);
  });

  it('returns a closed band polygon ghost once the start is placed', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'strip', overrides: {} });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 2000, y: 0 });
    expect(preview).not.toBeNull();
    expect(preview!.type).toBe('polyline');
    const poly = preview as { closed?: boolean; vertices?: { x: number; y: number }[] };
    expect(poly.closed).toBe(true);
    // band rectangle = 4 vertices
    expect(poly.vertices).toHaveLength(4);
  });

  it('uses the store kind/overrides for WYSIWYG width (tie-beam narrower than strip)', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'tie-beam', overrides: { width: 250 } });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 1000, y: 0 }) as {
      vertices: { x: number; y: number }[];
    };
    // axis along +X, width 250 → band half-width 125 → y extents ±125.
    const ys = preview.vertices.map((v) => v.y);
    expect(Math.max(...ys)).toBeCloseTo(125);
    expect(Math.min(...ys)).toBeCloseTo(-125);
  });
});
