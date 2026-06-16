/**
 * ADR-457 — column-detail-plan unit tests.
 *
 * Verifies the plan-region builder emits a footprint outline, longitudinal bar
 * dots, the stirrup ring, the key dimensions and a scale caption for a
 * rectangular reinforced column — and stays empty for unsupported inputs.
 */

import { buildColumnPlanRegion } from '../column-detail-plan';
import type { RectMm } from '../detail-sheet-types';
import type { ColumnParams } from '../../../types/column-types';

const REGION: RectMm = { x: 220, y: 160, w: 95, h: 130 };

const RECT_REINFORCED: ColumnParams = {
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

describe('buildColumnPlanRegion (ADR-457)', () => {
  it('builds footprint + reinforcement + dimensions for a rectangular column', () => {
    const result = buildColumnPlanRegion(RECT_REINFORCED, REGION);
    const kinds = result.primitives.map((p) => p.kind);

    expect(result.primitives.length).toBeGreaterThan(0);
    expect(kinds).toContain('polyline'); // footprint + stirrup ring
    expect(kinds.filter((k) => k === 'circle')).toHaveLength(8); // 8 longitudinal bars
    expect(kinds.filter((k) => k === 'dim').length).toBeGreaterThanOrEqual(3); // width/depth/cover
    expect(result.caption).toMatch(/^1:\d+$/);
  });

  it('keeps every primitive inside the region rectangle', () => {
    const result = buildColumnPlanRegion(RECT_REINFORCED, REGION);
    const within = (x: number, y: number): boolean =>
      x >= REGION.x - 1 && x <= REGION.x + REGION.w + 1 &&
      y >= REGION.y - 1 && y <= REGION.y + REGION.h + 1;
    for (const p of result.primitives) {
      if (p.kind === 'circle') expect(within(p.center.x, p.center.y)).toBe(true);
      if (p.kind === 'polyline') for (const pt of p.points) expect(within(pt.x, pt.y)).toBe(true);
    }
  });

  it('emits the width / depth dimension text from the geometry (400 mm)', () => {
    const result = buildColumnPlanRegion(RECT_REINFORCED, REGION);
    const dimTexts = result.primitives
      .filter((p): p is Extract<typeof p, { kind: 'dim' }> => p.kind === 'dim')
      .map((p) => p.text);
    expect(dimTexts).toContain('400'); // width & depth
    expect(dimTexts).toContain('25'); // cover
  });

  it('includes the interior cross-ties (diamond) — same SSoT as the live 2D plan', () => {
    // 8 bars + auto pattern → ONE closed diamond hoop. The plan must show it on
    // top of the footprint + stirrup ring (3 closed polylines), matching the live
    // 2D canvas / 3D cage (regression for the missing-diamonds bug).
    const closedPolys = (params: ColumnParams): number =>
      buildColumnPlanRegion(params, REGION).primitives.filter(
        (p) => p.kind === 'polyline' && p.closed,
      ).length;

    // Μικρή διατομή 200×200: η παρειά (≤200mm) ΔΕΝ θέλει ενδιάμεση (ADR-460 f7
    // code-driven) → μένει 4 γωνιακές ράβδοι → κανένα cross-tie.
    const fourBars: ColumnParams = {
      ...RECT_REINFORCED,
      width: 200,
      depth: 200,
      reinforcement: { ...RECT_REINFORCED.reinforcement!, longitudinal: { diameterMm: 16, count: 4 } },
    };

    expect(closedPolys(RECT_REINFORCED)).toBe(3); // footprint + stirrup + diamond
    expect(closedPolys(fourBars)).toBe(2); // footprint + stirrup only (no cross-ties)
  });

  it('ADR-460 — draws a non-rectangular (circular) reinforced column', () => {
    const circular: ColumnParams = { ...RECT_REINFORCED, kind: 'circular' };
    const result = buildColumnPlanRegion(circular, REGION);
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.caption).toBeDefined();
  });

  it('returns empty when reinforcement is missing', () => {
    const bare: ColumnParams = { ...RECT_REINFORCED, reinforcement: undefined };
    const result = buildColumnPlanRegion(bare, REGION);
    expect(result.primitives).toHaveLength(0);
  });
});
