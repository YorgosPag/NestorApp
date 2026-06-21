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

  it('returns a WYSIWYG FoundationEntity ghost once the start is placed', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'strip', overrides: {} });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 2000, y: 0 });
    expect(preview).not.toBeNull();
    const ghost = preview as { type: string; preview?: boolean; wysiwygPreview?: boolean };
    // WYSIWYG (2026-06-11): full FoundationEntity via the real renderer, not a green band polyline.
    expect(ghost.type).toBe('foundation');
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
  });

  it('uses the store kind/overrides for WYSIWYG width (tie-beam narrower than strip)', () => {
    foundationPreviewStore.set({ startPoint: { x: 0, y: 0 }, endPoint: null, kind: 'tie-beam', overrides: { width: 250 } });
    const preview = generateFoundationPreview([{ x: 0, y: 0 }], { x: 1000, y: 0 }) as {
      params: { width: number };
    };
    // ribbon width override → committed (WYSIWYG) FoundationEntity width = 250.
    expect(preview.params.width).toBe(250);
  });
});
