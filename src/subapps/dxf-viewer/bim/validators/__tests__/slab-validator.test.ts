/**
 * ADR-363 Phase 3 — `validateSlabParams` tests.
 *
 * Coverage:
 *   - tooFewVertices fires when < MIN_POLYGON_VERTICES (3)
 *   - selfIntersecting fires for bowtie polygon
 *   - zeroArea fires for collinear degenerate polygon με 3+ vertices
 *   - nonPositiveThickness fires for thickness ≤ 0
 *   - thicknessTooThin code violation κάτω από MIN_SLAB_THICKNESS_MM (100)
 *   - maxFreeSpanExceeded code violation πάνω από 5m bbox dimension
 *   - ceiling/roof με elevation=0 → code violation
 *   - Valid params → 0 hard errors, 0 code violations
 */

import { validateSlabParams } from '../slab-validator';
import type { SlabParams } from '../../types/slab-types';

function makeSlab(overrides?: Partial<SlabParams>): SlabParams {
  return {
    kind: 'floor',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 4000, y: 0, z: 0 },
        { x: 4000, y: 4000, z: 0 },
        { x: 0, y: 4000, z: 0 },
      ],
    },
    elevation: 0,
    thickness: 200,
    ...overrides,
  };
}

describe('validateSlabParams — hard errors', () => {
  it('flags tooFewVertices for 2-vertex outline', () => {
    const r = validateSlabParams(makeSlab({
      outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }] },
    }));
    expect(r.hardErrors).toContain('slab.validation.hardErrors.tooFewVertices');
  });

  it('flags selfIntersecting for bowtie polygon', () => {
    const r = validateSlabParams(makeSlab({
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 1000, z: 0 },
          { x: 1000, y: 0, z: 0 },
          { x: 0, y: 1000, z: 0 },
        ],
      },
    }));
    expect(r.hardErrors).toContain('slab.validation.hardErrors.selfIntersecting');
  });

  it('flags zeroArea for collinear 3-vertex polygon', () => {
    const r = validateSlabParams(makeSlab({
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
          { x: 2000, y: 0, z: 0 },
        ],
      },
    }));
    expect(r.hardErrors).toContain('slab.validation.hardErrors.zeroArea');
  });

  it('flags nonPositiveThickness for thickness = 0', () => {
    const r = validateSlabParams(makeSlab({ thickness: 0 }));
    expect(r.hardErrors).toContain('slab.validation.hardErrors.nonPositiveThickness');
  });

  it('flags nonPositiveThickness for negative thickness', () => {
    const r = validateSlabParams(makeSlab({ thickness: -50 }));
    expect(r.hardErrors).toContain('slab.validation.hardErrors.nonPositiveThickness');
  });
});

describe('validateSlabParams — code violations', () => {
  it('flags thicknessTooThin below MIN_SLAB_THICKNESS_MM (100)', () => {
    const r = validateSlabParams(makeSlab({ thickness: 80 }));
    expect(r.codeViolations).toContain('slab.validation.codeViolations.thicknessTooThin');
  });

  it('flags maxFreeSpanExceeded for bbox > MAX_FREE_SPAN_WARNING_M (5m)', () => {
    // 8m × 6m bbox → max dim 8m > 5m → violation.
    const r = validateSlabParams(makeSlab({
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 8000, y: 0, z: 0 },
          { x: 8000, y: 6000, z: 0 },
          { x: 0, y: 6000, z: 0 },
        ],
      },
    }));
    expect(r.codeViolations).toContain('slab.validation.codeViolations.maxFreeSpanExceeded');
  });

  it('flags ceilingRoofAtZeroElevation for ceiling με elevation=0', () => {
    const r = validateSlabParams(makeSlab({ kind: 'ceiling', elevation: 0 }));
    expect(r.codeViolations).toContain('slab.validation.codeViolations.ceilingRoofAtZeroElevation');
  });

  it('flags ceilingRoofAtZeroElevation for roof με elevation=0', () => {
    const r = validateSlabParams(makeSlab({ kind: 'roof', elevation: 0 }));
    expect(r.codeViolations).toContain('slab.validation.codeViolations.ceilingRoofAtZeroElevation');
  });

  it('does NOT flag ceilingRoofAtZeroElevation for floor με elevation=0', () => {
    const r = validateSlabParams(makeSlab({ kind: 'floor', elevation: 0 }));
    expect(r.codeViolations).not.toContain('slab.validation.codeViolations.ceilingRoofAtZeroElevation');
  });
});

describe('validateSlabParams — happy path', () => {
  it('returns zero hard errors AND zero code violations for a valid 4m × 4m floor', () => {
    const r = validateSlabParams(makeSlab({ thickness: 200 }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0);
    expect(r.bimValidation.hasCodeViolations).toBe(false);
  });

  it('hasCodeViolations === true όταν υπάρχει code violation', () => {
    const r = validateSlabParams(makeSlab({ thickness: 80 }));
    expect(r.bimValidation.hasCodeViolations).toBe(true);
    expect(r.bimValidation.violationKeys.length).toBeGreaterThan(0);
  });
});
