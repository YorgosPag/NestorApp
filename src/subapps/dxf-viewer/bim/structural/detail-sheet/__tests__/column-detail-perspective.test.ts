/**
 * ADR-457 Slice 3 — perspective region builder + orchestrator wiring tests.
 *
 * The 3D raster itself is captured via offscreen WebGL (not runnable in jsdom);
 * these tests cover the PURE wiring: the perspective region always reserves one
 * raster slot, inset below the heading, carrying the (possibly null) data URL,
 * and the orchestrator threads `perspectiveDataUrl` into that region.
 */

import { buildColumnPerspectiveRegion } from '../column-detail-perspective';
import { buildColumnDetailSheet } from '../column-detail-sheet';
import { computeDetailSheetLayout } from '../detail-sheet-layout';
import type { DetailSheetLabels, RasterPrimitive } from '../detail-sheet-types';
import type { ColumnParams } from '../../../types/column-types';

const LABELS: DetailSheetLabels = {
  plan: 'ΚΑΤΟΨΗ',
  elevation: 'ΟΨΗ',
  perspective: '3Δ',
  schedule: 'ΧΑΛΥΒΑΣ',
  titleBlock: 'ΣΧΕΔΙΟ',
};

const COLUMN: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 400,
  height: 3000,
  rotation: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

function rasterOf(prims: readonly { kind: string }[]): RasterPrimitive {
  const raster = prims.find((p) => p.kind === 'raster');
  if (!raster) throw new Error('no raster primitive');
  return raster as RasterPrimitive;
}

describe('buildColumnPerspectiveRegion (ADR-457 Slice 3)', () => {
  const region = computeDetailSheetLayout().regions.perspective;

  it('emits exactly one raster primitive carrying the data URL', () => {
    const { primitives } = buildColumnPerspectiveRegion(region, 'data:image/png;base64,AAA');
    expect(primitives).toHaveLength(1);
    expect(rasterOf(primitives).dataUrl).toBe('data:image/png;base64,AAA');
  });

  it('still reserves the slot when the capture is pending (null url)', () => {
    const { primitives } = buildColumnPerspectiveRegion(region, null);
    expect(primitives).toHaveLength(1);
    expect(rasterOf(primitives).dataUrl).toBeNull();
  });

  it('insets the raster rect inside the region (below the heading)', () => {
    const { rect } = rasterOf(buildColumnPerspectiveRegion(region, null).primitives);
    expect(rect.x).toBeGreaterThan(region.x);
    expect(rect.y).toBeGreaterThan(region.y);
    expect(rect.x + rect.w).toBeLessThanOrEqual(region.x + region.w + 1e-6);
    expect(rect.y + rect.h).toBeLessThanOrEqual(region.y + region.h + 1e-6);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });
});

describe('buildColumnDetailSheet — perspective wiring (ADR-457 Slice 3)', () => {
  function perspective(url?: string | null) {
    const model = buildColumnDetailSheet({ params: COLUMN, labels: LABELS, perspectiveDataUrl: url });
    const region = model.regions.find((r) => r.id === 'perspective');
    if (!region) throw new Error('no perspective region');
    return region;
  }

  it('threads the data URL into the perspective region raster', () => {
    expect(rasterOf(perspective('data:image/png;base64,ZZZ').primitives).dataUrl)
      .toBe('data:image/png;base64,ZZZ');
  });

  it('defaults to a null raster when no capture is supplied', () => {
    expect(rasterOf(perspective().primitives).dataUrl).toBeNull();
  });
});
