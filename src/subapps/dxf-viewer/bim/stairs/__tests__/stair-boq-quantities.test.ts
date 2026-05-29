/**
 * Tests for stair BOQ quantity derivation (ADR-395 Phase 2 / G1).
 */

import {
  computeStairBoqQuantities,
  DEFAULT_WAIST_SLAB_THICKNESS_MM,
} from '../stair-boq-quantities';
import type { StairParams, StairStructureType } from '../../types/stair-types';

function makeParams(overrides: Partial<{
  stepCount: number;
  tread: number;
  rise: number;
  width: number;
  inner: boolean;
  outer: boolean;
  structureType: StairStructureType;
  waistThickness: number;
}> = {}): StairParams {
  const {
    stepCount = 10,
    tread = 280,
    rise = 175,
    width = 1000,
    inner = true,
    outer = true,
    structureType = 'monolithic',
    waistThickness,
  } = overrides;
  return {
    stepCount,
    tread,
    rise,
    width,
    structureType,
    waistThickness,
    handrails: { inner, outer, height: 900 },
  } as unknown as StairParams;
}

describe('computeStairBoqQuantities', () => {
  it('tread cladding area = stepCount × tread × width (m²)', () => {
    const q = computeStairBoqQuantities(makeParams());
    // 10 × 280mm × 1000mm = 2,800,000 mm² = 2.8 m²
    expect(q.treadCladdingAreaM2).toBeCloseTo(2.8, 6);
  });

  it('handrail length = railCount × stepCount × hypot(tread, rise) (m)', () => {
    const q = computeStairBoqQuantities(makeParams());
    const hyp = Math.hypot(280, 175); // ≈ 330.19 mm
    expect(q.handrailLinearM).toBeCloseTo((2 * 10 * hyp) / 1000, 6);
  });

  it('one rail only → half the two-rail length', () => {
    const two = computeStairBoqQuantities(makeParams({ inner: true, outer: true }));
    const one = computeStairBoqQuantities(makeParams({ inner: true, outer: false }));
    expect(one.handrailLinearM).toBeCloseTo(two.handrailLinearM / 2, 6);
  });

  it('no rails → handrail length 0', () => {
    const q = computeStairBoqQuantities(makeParams({ inner: false, outer: false }));
    expect(q.handrailLinearM).toBe(0);
  });

  it('concrete volume = waist slab + step wedges (m³) for RC structure', () => {
    const q = computeStairBoqQuantities(makeParams({ structureType: 'monolithic' }));
    const hyp = Math.hypot(280, 175);
    const waist = 10 * hyp * 1000 * 150; // inclinedRun × width × 150mm thickness (mm³)
    const wedges = 10 * 0.5 * 280 * 175 * 1000; // mm³
    expect(q.concreteVolumeM3).toBeCloseTo((waist + wedges) * 1e-9, 6);
  });

  it('steel-grating → concrete volume 0 (no cast concrete)', () => {
    const q = computeStairBoqQuantities(makeParams({ structureType: 'steel-grating' }));
    expect(q.concreteVolumeM3).toBe(0);
    // cladding + handrail still measured
    expect(q.treadCladdingAreaM2).toBeGreaterThan(0);
    expect(q.handrailLinearM).toBeGreaterThan(0);
  });

  it('glass-tread → concrete volume 0', () => {
    const q = computeStairBoqQuantities(makeParams({ structureType: 'glass-tread' }));
    expect(q.concreteVolumeM3).toBe(0);
  });

  it('degenerate stair (0 steps) → all quantities 0', () => {
    const q = computeStairBoqQuantities(makeParams({ stepCount: 0 }));
    expect(q.concreteVolumeM3).toBe(0);
    expect(q.treadCladdingAreaM2).toBe(0);
    expect(q.handrailLinearM).toBe(0);
  });

  it('negative inputs clamped to 0', () => {
    const q = computeStairBoqQuantities(makeParams({ width: -500, tread: -10 }));
    expect(q.treadCladdingAreaM2).toBe(0);
  });

  // ── ADR-395 G1 — editable waist-slab thickness ────────────────────────────

  it('waistThickness undefined → falls back to DEFAULT (150mm)', () => {
    const withDefault = computeStairBoqQuantities(makeParams());
    const explicit150 = computeStairBoqQuantities(
      makeParams({ waistThickness: DEFAULT_WAIST_SLAB_THICKNESS_MM }),
    );
    expect(withDefault.concreteVolumeM3).toBeCloseTo(explicit150.concreteVolumeM3, 9);
  });

  it('custom waistThickness scales the waist-slab term of the concrete volume', () => {
    const hyp = Math.hypot(280, 175);
    const inclinedRun = 10 * hyp;
    const wedges = 10 * 0.5 * 280 * 175 * 1000; // mm³ — independent of waist thickness
    const q = computeStairBoqQuantities(makeParams({ waistThickness: 200 }));
    const waist = inclinedRun * 1000 * 200; // mm³ @ 200mm
    expect(q.concreteVolumeM3).toBeCloseTo((waist + wedges) * 1e-9, 6);
  });

  it('thicker waist → larger concrete volume (monotonic); step wedges unchanged', () => {
    const thin = computeStairBoqQuantities(makeParams({ waistThickness: 120 }));
    const thick = computeStairBoqQuantities(makeParams({ waistThickness: 250 }));
    expect(thick.concreteVolumeM3).toBeGreaterThan(thin.concreteVolumeM3);
  });

  it('waistThickness ignored for non-concrete structures (steel-grating → 0)', () => {
    const q = computeStairBoqQuantities(
      makeParams({ structureType: 'steel-grating', waistThickness: 300 }),
    );
    expect(q.concreteVolumeM3).toBe(0);
  });

  it('negative waistThickness clamped to 0 → only step wedges remain', () => {
    const wedges = 10 * 0.5 * 280 * 175 * 1000; // mm³
    const q = computeStairBoqQuantities(makeParams({ waistThickness: -50 }));
    expect(q.concreteVolumeM3).toBeCloseTo(wedges * 1e-9, 6);
  });
});
