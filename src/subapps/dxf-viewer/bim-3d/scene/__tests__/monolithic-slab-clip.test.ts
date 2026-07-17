/**
 * ADR-534 §monolithic-cut — top-clip δοκαριών/κολόνων στο soffit καλύπτουσας πλάκας.
 */

import { buildCeilingSlabHosts, resolveMemberTopClipZmm } from '../monolithic-slab-clip';
import type { SlabEntity } from '../../../bim/types/slab-types';

function ceilingSlab(x0: number, y0: number, x1: number, y1: number, levelMm = 3000, thickMm = 200): SlabEntity {
  return {
    id: 's1',
    params: {
      kind: 'ceiling',
      outline: { vertices: [
        { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
      ] },
      levelElevation: levelMm, thickness: thickMm, geometryType: 'box', sceneUnits: 'mm',
    },
  } as unknown as SlabEntity;
}

/** Πλάκα-**δάπεδο** (`kind:'floor'`) — άνω παρειά στο `levelMm`, κρέμεται προς τα κάτω. */
function floorSlab(x0: number, y0: number, x1: number, y1: number, levelMm = 0, thickMm = 200): SlabEntity {
  const base = ceilingSlab(x0, y0, x1, y1, levelMm, thickMm);
  return { ...base, id: 's-floor', params: { ...base.params, kind: 'floor' } } as unknown as SlabEntity;
}

// Δοκάρι footprint εντός της πλάκας (centroid (4500,4250)).
const beamFootprint = [{ x: 4000, y: 4000 }, { x: 5000, y: 4000 }, { x: 5000, y: 4500 }, { x: 4000, y: 4500 }];

describe('ADR-534 monolithic top-clip', () => {
  it('δοκάρι top 3000/bottom 2600 + πλάκα soffit 2800 → clip 2800', () => {
    const hosts = buildCeilingSlabHosts([ceilingSlab(0, 0, 10000, 10000, 3000, 200)]);
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 2600, hosts)).toBeCloseTo(2800, 6);
  });

  it('καμία πλάκα → ownTop (no-op)', () => {
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 2600, [])).toBe(3000);
  });

  it('πλάκα ΔΕΝ καλύπτει (footprint εκτός) → ownTop (no clip)', () => {
    const hosts = buildCeilingSlabHosts([ceilingSlab(20000, 20000, 30000, 30000)]);
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 2600, hosts)).toBe(3000);
  });

  it('clamp: πολύ χαμηλό soffit (< bottom) → bottom (μη αρνητικό ύψος)', () => {
    // thickness 1500 → soffit 1500 < bottom 2600 → clamp 2600.
    const hosts = buildCeilingSlabHosts([ceilingSlab(0, 0, 10000, 10000, 3000, 1500)]);
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 2600, hosts)).toBe(2600);
  });

  it('πλάκα-ΔΑΠΕΔΟ στη βάση (topside == bottom) → ΔΕΝ καλύπτει (no-op, όχι ύψος 0)', () => {
    // Regression: η πλάκα-δάπεδο του ίδιου ορόφου (top 0, soffit −200) περιέχει την κολόνα
    // στο plan, αλλά τη ΣΤΗΡΙΖΕΙ — δεν την καλύπτει. Πριν το topside guard: clip → −200 →
    // max(0, −200) = 0 == base → effectiveHeightMm 0 → αόρατη κολόνα.
    const hosts = buildCeilingSlabHosts([floorSlab(0, 0, 10000, 10000, 0, 200)]);
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 0, hosts)).toBe(3000);
  });

  it('κολόνα ΑΝΑΜΕΣΑ σε 2 πλάκες (δάπεδο + οροφή) → clip στο soffit της ΟΡΟΦΗΣ', () => {
    // Το πραγματικό σενάριο του χρήστη: όροφος με δικό του δάπεδο (0) + αυto-ceiling (3000).
    const hosts = buildCeilingSlabHosts([
      floorSlab(0, 0, 10000, 10000, 0, 200),
      ceilingSlab(0, 0, 10000, 10000, 3000, 200),
    ]);
    expect(resolveMemberTopClipZmm(beamFootprint, 3000, 0, hosts)).toBeCloseTo(2800, 6);
  });

  it('ground/foundation πλάκες (κάτω) εξαιρούνται', () => {
    const ground = { ...ceilingSlab(0, 0, 10000, 10000), params: { ...ceilingSlab(0, 0, 10000, 10000).params, kind: 'ground' } } as unknown as SlabEntity;
    expect(buildCeilingSlabHosts([ground]).length).toBe(0);
  });
});
