/**
 * ADR-457 Slice 3 — perspective region builder tests.
 *
 * The 3D raster itself is captured via offscreen WebGL (not runnable in jsdom);
 * these tests cover the PURE region build: an empty raster slot while pending,
 * and — given a capture — a raster plus the W/D/H dimensions and bar marks as
 * standard 2D `dim` / `text` primitives (the FULL-SSOT overlay).
 */

import { buildColumnPerspectiveRegion } from '../column-detail-perspective';
import { computeDetailSheetLayout } from '../detail-sheet-layout';
import type { DetailPrimitive } from '../detail-sheet-types';
import type { ColumnDetail3dCapture } from '../render/column-detail-3d-capture';

const REGION = computeDetailSheetLayout().regions.perspective;

const CAPTURE: ColumnDetail3dCapture = {
  dataUrl: 'data:image/png;base64,AAA',
  widthPx: 800,
  heightPx: 1200,
  centroid: { x: 0.5, y: 0.5 },
  dims: [
    { a: { x: 0.2, y: 0.8 }, b: { x: 0.8, y: 0.8 }, text: '400' },
    { a: { x: 0.8, y: 0.8 }, b: { x: 0.8, y: 0.2 }, text: '600' },
    { a: { x: 0.9, y: 0.8 }, b: { x: 0.9, y: 0.2 }, text: '3000' },
  ],
  marks: [
    { pos: { x: 0.3, y: 0.1 }, text: '1' },
    { pos: { x: 0.7, y: 0.1 }, text: '2' },
  ],
};

function byKind<K extends DetailPrimitive['kind']>(
  prims: readonly DetailPrimitive[],
  kind: K,
): Extract<DetailPrimitive, { kind: K }>[] {
  return prims.filter((p): p is Extract<DetailPrimitive, { kind: K }> => p.kind === kind);
}

describe('buildColumnPerspectiveRegion (ADR-457 Slice 3)', () => {
  it('emits an empty raster slot while the capture is pending (null)', () => {
    const { primitives } = buildColumnPerspectiveRegion(REGION, null);
    const rasters = byKind(primitives, 'raster');
    expect(rasters).toHaveLength(1);
    expect(rasters[0].dataUrl).toBeNull();
    expect(byKind(primitives, 'dim')).toHaveLength(0);
  });

  it('emits the raster + W/D/H dims + bar marks as standard 2D primitives', () => {
    const { primitives } = buildColumnPerspectiveRegion(REGION, CAPTURE);
    expect(byKind(primitives, 'raster')[0].dataUrl).toBe('data:image/png;base64,AAA');
    expect(byKind(primitives, 'dim').map((d) => d.text)).toEqual(['400', '600', '3000']);
    expect(byKind(primitives, 'text').map((t) => t.text)).toEqual(['1', '2']);
  });

  it('offsets every dimension line off the measured edge (non-zero offset)', () => {
    const { primitives } = buildColumnPerspectiveRegion(REGION, CAPTURE);
    for (const dim of byKind(primitives, 'dim')) expect(Math.abs(dim.offsetMm)).toBeGreaterThan(0);
  });

  it('places the raster + overlay inside the region', () => {
    const { primitives } = buildColumnPerspectiveRegion(REGION, CAPTURE);
    const raster = byKind(primitives, 'raster')[0];
    expect(raster.rect.x).toBeGreaterThanOrEqual(REGION.x);
    expect(raster.rect.y).toBeGreaterThan(REGION.y);
    expect(raster.rect.x + raster.rect.w).toBeLessThanOrEqual(REGION.x + REGION.w + 1e-6);
  });
});
