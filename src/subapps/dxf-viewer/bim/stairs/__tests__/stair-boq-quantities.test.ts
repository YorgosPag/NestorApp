/**
 * Tests for stair BOQ quantity derivation (ADR-395 Phase 2 / G1).
 */

import { computeStairBoqQuantities } from '../stair-boq-quantities';
import type { StairParams, StairStructureType } from '../../types/stair-types';

function makeParams(overrides: Partial<{
  stepCount: number;
  tread: number;
  rise: number;
  width: number;
  inner: boolean;
  outer: boolean;
  structureType: StairStructureType;
}> = {}): StairParams {
  const {
    stepCount = 10,
    tread = 280,
    rise = 175,
    width = 1000,
    inner = true,
    outer = true,
    structureType = 'monolithic',
  } = overrides;
  return {
    stepCount,
    tread,
    rise,
    width,
    structureType,
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
});
