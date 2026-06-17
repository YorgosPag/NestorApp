/**
 * ADR-471 Slice 1 — beam rebar geometry layout (θέσεις ράβδων/συνδετήρων, beam-local mm).
 */

import {
  resolveBeamRebarLayout,
  computeBeamStirrupLevelsMm,
  type BeamRebarLayout,
} from '../beam-rebar-layout';
import type { BeamReinforcement } from '../beam-reinforcement-types';
import type { BeamSectionContext } from '../../codes/structural-code-types';

const ctx: BeamSectionContext = {
  widthMm: 250,
  depthMm: 500,
  spanMm: 5000,
  grossAreaMm2: 250 * 500,
  supportType: 'simple',
};

const reinf: BeamReinforcement = {
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 14, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, legs: 2 },
  coverMm: 30,
};

describe('resolveBeamRebarLayout', () => {
  const layout = resolveBeamRebarLayout(ctx, reinf) as BeamRebarLayout;

  it('returns a layout for a valid rectangular beam', () => {
    expect(layout).not.toBeNull();
    expect(layout.spanMm).toBe(5000);
    expect(layout.widthMm).toBe(250);
    expect(layout.depthMm).toBe(500);
  });

  it('places exactly the requested bottom bars, all continuous over the full span', () => {
    const bottom = layout.longitudinalBars.filter((b) => b.layer === 'bottom');
    expect(bottom).toHaveLength(3);
    for (const b of bottom) {
      expect(b.role).toBe('continuous');
      expect(b.uStartMm).toBe(0);
      expect(b.uEndMm).toBe(5000);
      expect(b.diameterMm).toBe(16);
    }
  });

  it('keeps bars inside the cover envelope (b/2 and h/2)', () => {
    for (const b of layout.longitudinalBars) {
      expect(Math.abs(b.vMm)).toBeLessThanOrEqual(125 - 30); // halfB - cover
      expect(Math.abs(b.wMm)).toBeLessThanOrEqual(250 - 30); // halfH - cover
    }
    // bottom layer below centroid, top layer above.
    const bottom = layout.longitudinalBars.find((b) => b.layer === 'bottom');
    const top = layout.longitudinalBars.find((b) => b.layer === 'top');
    expect(bottom!.wMm).toBeLessThan(0);
    expect(top!.wMm).toBeGreaterThan(0);
  });

  it('splits top steel into 2 continuous corner hangers + support bars per end (simple beam)', () => {
    const top = layout.longitudinalBars.filter((b) => b.layer === 'top');
    const continuous = top.filter((b) => b.role === 'continuous');
    const support = top.filter((b) => b.role === 'support');
    expect(continuous).toHaveLength(2);
    for (const b of continuous) {
      expect(b.uStartMm).toBe(0);
      expect(b.uEndMm).toBe(5000);
    }
    // top.count = 4 → 2 interior support bars × 2 ends = 4 support segments.
    expect(support).toHaveLength(4);
    // support bars are curtailed near the ends, never full span.
    for (const b of support) {
      expect(b.uEndMm - b.uStartMm).toBeLessThan(5000);
    }
    const startBars = support.filter((b) => b.uStartMm === 0);
    const endBars = support.filter((b) => b.uEndMm === 5000);
    expect(startBars).toHaveLength(2);
    expect(endBars).toHaveLength(2);
  });

  it('cantilever → all top bars continuous (top = main tension)', () => {
    const canti = resolveBeamRebarLayout({ ...ctx, supportType: 'cantilever' }, reinf) as BeamRebarLayout;
    const top = canti.longitudinalBars.filter((b) => b.layer === 'top');
    expect(top).toHaveLength(4);
    expect(top.every((b) => b.role === 'continuous')).toBe(true);
  });

  it('builds a closed stirrup section path + 2 hook ends (closed-hooked default)', () => {
    expect(layout.stirrupSectionPathMm.length).toBeGreaterThanOrEqual(4);
    expect(layout.stirrupHookEndsMm).toHaveLength(2);
    expect(layout.stirrupCenterlineLengthMm).toBeGreaterThan(0);
    expect(layout.stirrupDiameterMm).toBe(8);
  });

  it('degenerate section/span → null', () => {
    expect(resolveBeamRebarLayout({ ...ctx, widthMm: 0 }, reinf)).toBeNull();
    expect(resolveBeamRebarLayout({ ...ctx, depthMm: 0 }, reinf)).toBeNull();
    expect(resolveBeamRebarLayout({ ...ctx, spanMm: 0 }, reinf)).toBeNull();
  });
});

describe('computeBeamStirrupLevelsMm', () => {
  it('densifies the end critical zones (lcr ≈ h) and is sparse in the middle', () => {
    const levels = computeBeamStirrupLevelsMm(ctx, reinf);
    expect(levels[0]).toBe(0);
    expect(levels[levels.length - 1]).toBe(5000);
    // monotonic
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    // first gap (critical, 100) tighter than a mid gap (200).
    const firstGap = levels[1] - levels[0];
    expect(firstGap).toBeCloseTo(100, 6);
    const midGaps = levels.slice(1).map((u, i) => u - levels[i]).filter((g) => g > 150);
    expect(midGaps.length).toBeGreaterThan(0); // υπάρχουν αραιές (200) ζώνες στη μέση
  });

  it('cantilever produces fewer (single) critical zones than a simple beam', () => {
    const simple = computeBeamStirrupLevelsMm(ctx, reinf).length;
    const canti = computeBeamStirrupLevelsMm({ ...ctx, supportType: 'cantilever' }, reinf).length;
    expect(canti).toBeLessThanOrEqual(simple);
  });

  it('degenerate span/spacing → empty', () => {
    expect(computeBeamStirrupLevelsMm({ ...ctx, spanMm: 0 }, reinf)).toEqual([]);
    expect(computeBeamStirrupLevelsMm(ctx, { ...reinf, stirrups: { ...reinf.stirrups, spacingMm: 0 } })).toEqual([]);
  });
});
