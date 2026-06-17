/**
 * ADR-457 — column-detail-elevation unit tests.
 *
 * Verifies the elevation builder emits the concrete outline, vertical
 * longitudinal bars, the transverse reinforcement drawn by stirrup type, the
 * height dimension + label, and a scale caption — and stays empty for
 * unsupported inputs.
 */

import { buildColumnElevationRegion } from '../column-detail-elevation';
import type { RectMm } from '../detail-sheet-types';
import type { ColumnParams } from '../../../types/column-types';

const REGION: RectMm = { x: 14, y: 12, w: 95, h: 130 };

const BASE: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 400,
  height: 3000,
  rotation: 0,
  baseBinding: 'storey-floor',
  topBinding: 'storey-ceiling',
  baseOffset: 0,
  topOffset: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

function countKind(params: ColumnParams, kind: string): number {
  return buildColumnElevationRegion(params, REGION).primitives.filter((p) => p.kind === kind).length;
}

describe('buildColumnElevationRegion (ADR-457)', () => {
  it('builds outline + bars + stirrups + height dim + label for a rectangular column', () => {
    const result = buildColumnElevationRegion(BASE, REGION);
    const kinds = result.primitives.map((p) => p.kind);
    expect(kinds).toContain('polyline'); // concrete outline
    expect(kinds).toContain('line');     // bars + stirrups
    expect(kinds).toContain('dim');      // height
    expect(kinds).toContain('text');     // stirrup label
    expect(result.caption).toMatch(/^1:\d+$/);
  });

  it('emits the height dimension text from the geometry (3000 mm)', () => {
    const dims = buildColumnElevationRegion(BASE, REGION).primitives
      .filter((p): p is Extract<typeof p, { kind: 'dim' }> => p.kind === 'dim');
    expect(dims.map((d) => d.text)).toContain('3000');
  });

  it('draws extra hook lines for closed-hooked vs closed-welded stirrups', () => {
    const hooked = countKind(BASE, 'line');
    const welded = countKind({
      ...BASE,
      reinforcement: { ...BASE.reinforcement!, stirrups: { ...BASE.reinforcement!.stirrups, type: 'closed-welded' } },
    }, 'line');
    expect(hooked).toBeGreaterThan(welded);
  });

  it('draws a spiral as one extra continuous polyline (helix)', () => {
    const spiral: ColumnParams = {
      ...BASE,
      reinforcement: { ...BASE.reinforcement!, stirrups: { ...BASE.reinforcement!.stirrups, type: 'spiral' } },
    };
    expect(countKind(spiral, 'polyline')).toBe(2); // outline + helix
  });

  it('spiral helix is a smooth continuous rising strand (not a chaotic zig-zag)', () => {
    const spiral: ColumnParams = {
      ...BASE,
      reinforcement: { ...BASE.reinforcement!, stirrups: { ...BASE.reinforcement!.stirrups, type: 'spiral' } },
    };
    const polylines = buildColumnElevationRegion(spiral, REGION).primitives
      .filter((p): p is Extract<typeof p, { kind: 'polyline' }> => p.kind === 'polyline');
    const helix = polylines[1].points; // [outline, helix]
    // Finely sampled (≫ the handful of stirrup levels) → smooth curve, not zig-zag.
    expect(helix.length).toBeGreaterThan(100);
    // Sheet-y never goes back up → z rises monotonically → a single continuous helix.
    for (let i = 1; i < helix.length; i++) {
      expect(helix[i].y).toBeLessThanOrEqual(helix[i - 1].y + 1e-6);
    }
  });

  it('emits stirrup spacing-dim zones (lcr 100 / middle 200) on closed stirrups', () => {
    const dims = buildColumnElevationRegion(BASE, REGION).primitives
      .filter((p): p is Extract<typeof p, { kind: 'dim' }> => p.kind === 'dim')
      .map((d) => d.text);
    // height dim (3000) + spacing zones. The dense end zones read "n×100".
    expect(dims).toContain('3000');
    expect(dims.some((t) => /×100$/.test(t))).toBe(true);  // critical end zone @100
    expect(dims.some((t) => /×200$/.test(t) || t === '200')).toBe(true); // middle @200
  });

  it('densifies a spiral at the ends too (variable pitch + zones, like closed)', () => {
    const spiral: ColumnParams = {
      ...BASE,
      reinforcement: { ...BASE.reinforcement!, stirrups: { ...BASE.reinforcement!.stirrups, type: 'spiral' } },
    };
    const texts = buildColumnElevationRegion(spiral, REGION).primitives
      .filter((p): p is Extract<typeof p, { kind: 'dim' }> => p.kind === 'dim')
      .map((d) => d.text)
      .filter((t) => t !== '3000'); // drop the height dim
    expect(texts.length).toBeGreaterThan(1);              // multiple zones (densified)
    expect(texts.some((t) => /×100$/.test(t))).toBe(true); // tight pitch at the ends
    expect(texts.some((t) => /×200$/.test(t) || t === '200')).toBe(true); // loose middle
  });

  it('ADR-460 — draws a non-rectangular (circular) reinforced column', () => {
    expect(buildColumnElevationRegion({ ...BASE, kind: 'circular' }, REGION).primitives.length).toBeGreaterThan(0);
  });
});
