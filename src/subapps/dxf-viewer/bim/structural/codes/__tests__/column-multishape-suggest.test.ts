/**
 * ADR-460 Slice 5 — shape-aware column reinforcement suggestion (perimeter/circular/wall).
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import type { ColumnSectionContext } from '../structural-code-types';

describe('suggestColumnReinforcement — shape-aware', () => {
  it('circular: perimeter-based bar count (π·d / spacing), no wall intent', () => {
    const ctx: ColumnSectionContext = {
      widthMm: 500, depthMm: 500, heightMm: 3000,
      grossAreaMm2: Math.PI * 250 ** 2,
      minThicknessMm: 500, maxDimensionMm: 500, perimeterMm: Math.PI * 500, mode: 'circular',
    };
    const r = EUROCODE_PROVIDER.suggestColumnReinforcement(ctx);
    expect(r.wall).toBeUndefined();
    // count ≥ ceil(π·500 / 200) = ceil(7.85) = 8
    expect(r.longitudinal.count).toBeGreaterThanOrEqual(8);
    expect(r.longitudinal.diameterMm).toBeGreaterThanOrEqual(12);
  });

  it('wall: emits boundary + web web reinforcement intent', () => {
    const ctx: ColumnSectionContext = {
      widthMm: 2000, depthMm: 250, heightMm: 3000,
      grossAreaMm2: 2000 * 250,
      minThicknessMm: 250, maxDimensionMm: 2000, perimeterMm: 2 * (2000 + 250), mode: 'wall',
    };
    const r = EUROCODE_PROVIDER.suggestColumnReinforcement(ctx);
    expect(r.wall).toBeDefined();
    expect(r.wall!.boundary.count).toBeGreaterThanOrEqual(6);
    expect(r.wall!.boundary.diameterMm).toBeGreaterThanOrEqual(12);
    expect(r.wall!.webVertical.spacingMm).toBeGreaterThan(0);
    expect(r.wall!.webHorizontal.spacingMm).toBeGreaterThan(0);
  });

  it('rectangular: unchanged (no perimeterMm) → no wall intent', () => {
    const ctx: ColumnSectionContext = {
      widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 400 * 400,
    };
    const r = EUROCODE_PROVIDER.suggestColumnReinforcement(ctx);
    expect(r.wall).toBeUndefined();
    expect(r.longitudinal.count).toBeGreaterThanOrEqual(4);
  });
});
