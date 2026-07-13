/**
 * scale-preview-lod.test.ts — ADR-646 Φάση 5 (drag-preview LOD, perf).
 *
 * Pure math for the Scale tool's bounded drag preview: the full/LOD threshold, stride sampling,
 * the selection union bbox, scaling a bbox about the base point, and the extent-box entity.
 */

import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  resolveScalePreviewLod, sampleIds, computeUnionBBox, scaleBBoxAboutBase, buildExtentBoxEntity,
  SCALE_PREVIEW_FULL_FIDELITY_MAX, SCALE_PREVIEW_EXTENT_COLOR,
} from '../scale-preview-lod';

function line(id: string, x0: number, y0: number, x1: number, y1: number): DxfEntityUnion {
  return { id, type: 'line', start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, visible: true } as unknown as DxfEntityUnion;
}

describe('resolveScalePreviewLod', () => {
  it('stays full at/below the cap, switches to LOD above it', () => {
    expect(resolveScalePreviewLod(0)).toBe('full');
    expect(resolveScalePreviewLod(SCALE_PREVIEW_FULL_FIDELITY_MAX)).toBe('full');
    expect(resolveScalePreviewLod(SCALE_PREVIEW_FULL_FIDELITY_MAX + 1)).toBe('lod');
  });
});

describe('sampleIds', () => {
  it('returns the whole list unchanged when it already fits', () => {
    expect(sampleIds(['a', 'b', 'c'], 5)).toEqual(['a', 'b', 'c']);
  });

  it('stride-samples evenly (bounded count, first element kept)', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `e${i}`);
    const sample = sampleIds(ids, 100);
    expect(sample.length).toBeLessThanOrEqual(100);
    expect(sample[0]).toBe('e0');
    // stride = ceil(1000/100) = 10 → spread across the range, not the first 100.
    expect(sample[1]).toBe('e10');
  });

  it('empty for a non-positive cap', () => {
    expect(sampleIds(['a', 'b'], 0)).toEqual([]);
  });
});

describe('computeUnionBBox', () => {
  const scene: Record<string, DxfEntityUnion> = {
    a: line('a', 0, 0, 10, 5),
    b: line('b', -3, 2, 4, 20),
  };
  const getEntity = (id: string): DxfEntityUnion | null => scene[id] ?? null;

  it('unions every resolvable entity bbox', () => {
    expect(computeUnionBBox(['a', 'b'], getEntity)).toEqual({ minX: -3, minY: 0, maxX: 10, maxY: 20 });
  });

  it('skips missing entities, null when nothing contributes', () => {
    expect(computeUnionBBox(['a', 'missing'], getEntity)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 5 });
    expect(computeUnionBBox(['missing'], getEntity)).toBeNull();
    expect(computeUnionBBox([], getEntity)).toBeNull();
  });
});

describe('scaleBBoxAboutBase', () => {
  const box = { minX: 10, minY: 10, maxX: 20, maxY: 30 };

  it('scales about the base point', () => {
    expect(scaleBBoxAboutBase(box, { x: 0, y: 0 }, 2, 2)).toEqual({ minX: 20, minY: 20, maxX: 40, maxY: 60 });
  });

  it('keeps min < max under a negative (mirror) factor', () => {
    const out = scaleBBoxAboutBase(box, { x: 0, y: 0 }, -1, 1);
    expect(out.minX).toBeLessThan(out.maxX);
    expect(out).toEqual({ minX: -20, minY: 10, maxX: -10, maxY: 30 });
  });
});

describe('buildExtentBoxEntity', () => {
  it('traces the bbox as a gold closed 4-vertex polyline', () => {
    const e = buildExtentBoxEntity({ minX: 0, minY: 0, maxX: 4, maxY: 2 }) as unknown as {
      type: string; closed: boolean; color: string; vertices: { x: number; y: number }[];
    };
    expect(e.type).toBe('polyline');
    expect(e.closed).toBe(true);
    expect(e.color).toBe(SCALE_PREVIEW_EXTENT_COLOR);
    expect(e.vertices).toEqual([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 },
    ]);
  });
});
