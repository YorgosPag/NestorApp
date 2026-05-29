/**
 * Tests για envelope-contribution helpers (ADR-396 Phase P2).
 *
 * Per-element envelope layer accessors + area-contribution math (Z1 facade /
 * Z2-Z3 flat / Z4 reveal strips). Όλα pure, meters-in / meters-out.
 */

import {
  getEnvelopeLayer,
  getOpeningRevealInsulation,
  hasEnvelopeLayer,
  computeFacadeContributionArea,
  computeFlatContributionArea,
  computeRevealStrips,
  computeRevealContributionArea,
} from '../envelope-contribution';
import type { EnvelopeLayer } from '../thermal-envelope-types';
import type { OpeningParams } from '../opening-types';

const Z1_LAYER: EnvelopeLayer = { materialId: 'mat-eps-graphite', thickness_m: 0.1, zone: 'Z1' };
const Z4_LAYER: EnvelopeLayer = { materialId: 'mat-eps-graphite', thickness_m: 0.05, zone: 'Z4' };

describe('envelope-contribution — accessors', () => {
  it('getEnvelopeLayer returns the layer when present', () => {
    expect(getEnvelopeLayer({ envelopeLayer: Z1_LAYER })).toEqual(Z1_LAYER);
  });

  it('getEnvelopeLayer returns undefined when absent (non-breaking)', () => {
    expect(getEnvelopeLayer({})).toBeUndefined();
  });

  it('hasEnvelopeLayer reflects presence', () => {
    expect(hasEnvelopeLayer({ envelopeLayer: Z1_LAYER })).toBe(true);
    expect(hasEnvelopeLayer({})).toBe(false);
  });

  it('getOpeningRevealInsulation reads the Z4 reveal layer', () => {
    const params = { revealInsulation: Z4_LAYER } as unknown as OpeningParams;
    expect(getOpeningRevealInsulation(params)).toEqual(Z4_LAYER);
  });

  it('getOpeningRevealInsulation returns undefined for legacy openings', () => {
    const params = {} as unknown as OpeningParams;
    expect(getOpeningRevealInsulation(params)).toBeUndefined();
  });
});

describe('envelope-contribution — Z1 facade area', () => {
  it('= length × height', () => {
    expect(computeFacadeContributionArea(5, 3)).toBe(15);
  });

  it('clamps non-positive inputs to 0', () => {
    expect(computeFacadeContributionArea(0, 3)).toBe(0);
    expect(computeFacadeContributionArea(5, 0)).toBe(0);
    expect(computeFacadeContributionArea(-2, 3)).toBe(0);
  });
});

describe('envelope-contribution — Z2/Z3 flat area', () => {
  it('passes through a positive slab area', () => {
    expect(computeFlatContributionArea(42.5)).toBe(42.5);
  });

  it('clamps non-positive area to 0', () => {
    expect(computeFlatContributionArea(0)).toBe(0);
    expect(computeFlatContributionArea(-1)).toBe(0);
  });
});

describe('envelope-contribution — Z4 reveal strips', () => {
  // ADR-396 §2.1 παράδειγμα: άνοιγμα 1.10×1.10 σε τοίχο 0.25m.
  it('produces 4 strips: left/right run vertical, top/bottom run horizontal', () => {
    const strips = computeRevealStrips(1.1, 1.1, 0.25);
    expect(strips).toHaveLength(4);
    expect(strips.map((s) => s.side)).toEqual(['left', 'right', 'top', 'bottom']);
  });

  it('left/right length = opening height, top/bottom length = opening width', () => {
    const strips = computeRevealStrips(1.0, 2.1, 0.25); // πόρτα 1.00 × 2.10
    const bySide = Object.fromEntries(strips.map((s) => [s.side, s]));
    expect(bySide.left.length_m).toBe(2.1);
    expect(bySide.right.length_m).toBe(2.1);
    expect(bySide.top.length_m).toBe(1.0);
    expect(bySide.bottom.length_m).toBe(1.0);
  });

  it('every strip depth = wall thickness', () => {
    const strips = computeRevealStrips(1.1, 1.1, 0.25);
    expect(strips.every((s) => s.depth_m === 0.25)).toBe(true);
  });

  it('returns [] for non-positive inputs', () => {
    expect(computeRevealStrips(0, 1.1, 0.25)).toEqual([]);
    expect(computeRevealStrips(1.1, 0, 0.25)).toEqual([]);
    expect(computeRevealStrips(1.1, 1.1, 0)).toEqual([]);
  });

  it('total reveal area = 2·(W+H)·t', () => {
    // 2·(1.1+1.1)·0.25 = 1.1
    expect(computeRevealContributionArea(1.1, 1.1, 0.25)).toBeCloseTo(1.1, 10);
  });

  it('total reveal area = 0 για invalid άνοιγμα', () => {
    expect(computeRevealContributionArea(0, 1.1, 0.25)).toBe(0);
  });
});
