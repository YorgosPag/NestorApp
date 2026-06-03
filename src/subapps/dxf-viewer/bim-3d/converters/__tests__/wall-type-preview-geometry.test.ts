/**
 * Tests for `buildWallTypePreviewBands` (ADR-414) — synthetic per-layer preview
 * band math for the «Edit Wall Type» dialog. Pure geometry, no THREE.
 */

import { buildWallTypePreviewBands } from '../wall-type-preview-geometry';
import { computeTotalThickness } from '../../../bim/types/wall-dna-types';
import type { WallDna, WallDnaLayer } from '../../../bim/types/wall-dna-types';

function dna(layers: readonly WallDnaLayer[]): WallDna {
  return { layers, totalThickness: computeTotalThickness(layers) };
}

const THREE_LAYER = dna([
  { id: 'out', name: 'Plaster', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' },
  { id: 'core', name: 'Concrete', thickness: 210, materialId: 'mat-concrete-c25', side: 'core' },
  { id: 'in', name: 'Plaster', thickness: 20, materialId: 'mat-plaster-int', side: 'interior' },
]);

describe('buildWallTypePreviewBands', () => {
  it('returns one band per layer with materialId + layerId preserved', () => {
    const bands = buildWallTypePreviewBands(THREE_LAYER);
    expect(bands.map((b) => b.layerId)).toEqual(['out', 'core', 'in']);
    expect(bands.map((b) => b.materialId)).toEqual([
      'mat-plaster-ext',
      'mat-concrete-c25',
      'mat-plaster-int',
    ]);
  });

  it('converts mm → m and sums depths to the total thickness', () => {
    const bands = buildWallTypePreviewBands(THREE_LAYER);
    expect(bands[0].depthM).toBeCloseTo(0.02, 6);
    expect(bands[1].depthM).toBeCloseTo(0.21, 6);
    const sum = bands.reduce((s, b) => s + b.depthM, 0);
    expect(sum).toBeCloseTo(0.25, 6);
  });

  it('centers the stack on Z=0 with exterior at +Z, interior at −Z', () => {
    const bands = buildWallTypePreviewBands(THREE_LAYER);
    // Exterior band center is positive, interior negative, symmetric here.
    expect(bands[0].centerZM).toBeGreaterThan(0);
    expect(bands[2].centerZM).toBeLessThan(0);
    expect(bands[0].centerZM).toBeCloseTo(-bands[2].centerZM, 6);
    // Each band center lies inside its slab: |z| < total/2.
    for (const b of bands) expect(Math.abs(b.centerZM)).toBeLessThan(0.25 / 2 + 1e-9);
  });

  it('skips zero-thickness layers', () => {
    const withZero = dna([
      { id: 'a', name: 'A', thickness: 100, materialId: 'mat-brick', side: 'core' },
      { id: 'z', name: 'Z', thickness: 0, materialId: 'mat-plaster', side: 'interior' },
    ]);
    const bands = buildWallTypePreviewBands(withZero);
    expect(bands.map((b) => b.layerId)).toEqual(['a']);
  });

  it('returns [] for a DNA with no positive thickness', () => {
    const empty = dna([{ id: 'a', name: 'A', thickness: 0, materialId: 'm', side: 'core' }]);
    expect(buildWallTypePreviewBands(empty)).toEqual([]);
  });
});
