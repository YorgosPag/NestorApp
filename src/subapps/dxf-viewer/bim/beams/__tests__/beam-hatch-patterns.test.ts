/**
 * ADR-363 Phase 5.5c — `beam-hatch-patterns` pure-function tests.
 *
 * Verifies:
 *   - `resolveBeamMaterialKey` case-insensitive + safe `'rc'` fallback
 *   - `computeBeamHatchPlan` shape per material (rc → dots only, steel →
 *     cross-hatch και στις δύο διευθύνσεις, glulam → axis-aligned grain +
 *     sparse cross-grain)
 *   - Dot grid spacing count για 400×400 bbox @ 100mm
 *   - Glulam grain alignment: axis-parallel direction reflected στο line angle
 *   - Degenerate bbox (min===max ή negative) → empty plan
 *   - Degenerate axis (zero vector) για glulam → fallback horizontal grain
 *   - Large bbox → reasonable count, no infinite loop (MAX_HATCH_STEPS cap)
 *   - Exported constants verify
 */

import {
  resolveBeamMaterialKey,
  computeBeamHatchPlan,
  BEAM_HATCH_SPACING_MM,
  BEAM_HATCH_STROKE_RGBA,
  BEAM_HATCH_LINE_WIDTH_PX,
  BEAM_RC_DOT_RADIUS_PX,
  GLULAM_CROSS_GRAIN_SPACING_MM,
  GLULAM_CROSS_GRAIN_ANGLE_RAD,
  type BeamAxisOrientation,
} from '../beam-hatch-patterns';
import type { BoundingBox3D } from '../../types/bim-base';

function bbox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox3D {
  return { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 0 } };
}

const AXIS_HORIZONTAL: BeamAxisOrientation = { ux: 1, uy: 0 };
const AXIS_VERTICAL: BeamAxisOrientation = { ux: 0, uy: 1 };
const AXIS_DEGENERATE: BeamAxisOrientation = { ux: 0, uy: 0 };

describe('resolveBeamMaterialKey — case-insensitive + fallback', () => {
  it('lowercase known keys preserved', () => {
    expect(resolveBeamMaterialKey('rc')).toBe('rc');
    expect(resolveBeamMaterialKey('steel')).toBe('steel');
    expect(resolveBeamMaterialKey('glulam')).toBe('glulam');
  });

  it('uppercase / mixed-case → normalised lower', () => {
    expect(resolveBeamMaterialKey('RC')).toBe('rc');
    expect(resolveBeamMaterialKey('Steel')).toBe('steel');
    expect(resolveBeamMaterialKey('GLULAM')).toBe('glulam');
    expect(resolveBeamMaterialKey('Glulam')).toBe('glulam');
  });

  it('undefined / empty / unknown → "rc" fallback', () => {
    expect(resolveBeamMaterialKey(undefined)).toBe('rc');
    expect(resolveBeamMaterialKey('')).toBe('rc');
    expect(resolveBeamMaterialKey('unknown')).toBe('rc');
    expect(resolveBeamMaterialKey('wood')).toBe('rc'); // wood is column-only, not beam
    expect(resolveBeamMaterialKey('masonry')).toBe('rc');
  });
});

describe('computeBeamHatchPlan — RC dot grid', () => {
  it('returns dots only (no lines)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 400, 400), AXIS_HORIZONTAL, 'rc');
    expect(plan.lines.length).toBe(0);
    expect(plan.dots.length).toBeGreaterThan(0);
  });

  it('400×400 @ 100mm spacing → 5×5 = 25 dots (0,100,200,300,400)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 400, 400), AXIS_HORIZONTAL, 'rc');
    expect(plan.dots.length).toBe(25);
  });

  it('all dots inside bbox', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 400, 400), AXIS_HORIZONTAL, 'rc');
    for (const d of plan.dots) {
      expect(d.center.x).toBeGreaterThanOrEqual(0);
      expect(d.center.x).toBeLessThanOrEqual(400);
      expect(d.center.y).toBeGreaterThanOrEqual(0);
      expect(d.center.y).toBeLessThanOrEqual(400);
    }
  });
});

describe('computeBeamHatchPlan — steel cross-hatch', () => {
  it('returns lines only (no dots)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 1000, 400), AXIS_HORIZONTAL, 'steel');
    expect(plan.dots.length).toBe(0);
    expect(plan.lines.length).toBeGreaterThan(0);
  });

  it('contains both @45° and @135° diagonal sets', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 1000, 400), AXIS_HORIZONTAL, 'steel');
    // Each line has a slope sign — @45° slope = +1, @135° slope = -1.
    const slopes = plan.lines
      .map((l) => {
        const dx = l.end.x - l.start.x;
        const dy = l.end.y - l.start.y;
        if (Math.abs(dx) < 1e-6) return 0;
        return Math.sign(dy / dx);
      })
      .filter((s) => s !== 0);
    const positives = slopes.filter((s) => s > 0).length;
    const negatives = slopes.filter((s) => s < 0).length;
    expect(positives).toBeGreaterThan(0);
    expect(negatives).toBeGreaterThan(0);
  });
});

describe('computeBeamHatchPlan — glulam grain', () => {
  it('returns lines only (no dots)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 1000, 400), AXIS_HORIZONTAL, 'glulam');
    expect(plan.dots.length).toBe(0);
    expect(plan.lines.length).toBeGreaterThan(0);
  });

  it('grain lines align with horizontal axis (mostly horizontal segments)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 1000, 400), AXIS_HORIZONTAL, 'glulam');
    // The dense grain set (spacing 40mm) should dominate; sample those lines.
    // For horizontal axis, grain lines are horizontal → dy ≈ 0 on those segments.
    const horizontals = plan.lines.filter((l) => Math.abs(l.end.y - l.start.y) < 1e-3);
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('grain lines rotate with axis (vertical axis → vertical grain)', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 400, 1000), AXIS_VERTICAL, 'glulam');
    const verticals = plan.lines.filter((l) => Math.abs(l.end.x - l.start.x) < 1e-3);
    expect(verticals.length).toBeGreaterThan(0);
  });

  it('degenerate axis (0,0) falls back to horizontal grain — no crash', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 1000, 400), AXIS_DEGENERATE, 'glulam');
    expect(plan.lines.length).toBeGreaterThan(0);
    const horizontals = plan.lines.filter((l) => Math.abs(l.end.y - l.start.y) < 1e-3);
    expect(horizontals.length).toBeGreaterThan(0);
  });
});

describe('computeBeamHatchPlan — degenerate bbox', () => {
  it('min === max → empty plan', () => {
    const plan = computeBeamHatchPlan(bbox(100, 100, 100, 100), AXIS_HORIZONTAL, 'rc');
    expect(plan.lines.length).toBe(0);
    expect(plan.dots.length).toBe(0);
  });

  it('negative extents → empty plan', () => {
    const plan = computeBeamHatchPlan(bbox(100, 100, 50, 50), AXIS_HORIZONTAL, 'steel');
    expect(plan.lines.length).toBe(0);
    expect(plan.dots.length).toBe(0);
  });

  it('NaN extents → empty plan, no crash', () => {
    const bb: BoundingBox3D = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: NaN, y: 100, z: 0 },
    };
    const plan = computeBeamHatchPlan(bb, AXIS_HORIZONTAL, 'rc');
    expect(plan.lines.length).toBe(0);
    expect(plan.dots.length).toBe(0);
  });
});

describe('computeBeamHatchPlan — large bbox bounded', () => {
  it('10 000 × 10 000 mm @ 100mm RC → bounded by MAX_HATCH_STEPS', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 10000, 10000), AXIS_HORIZONTAL, 'rc');
    expect(plan.dots.length).toBeGreaterThan(0);
    expect(plan.dots.length).toBeLessThanOrEqual(4001);
  });

  it('steel large bbox → bounded line count', () => {
    const plan = computeBeamHatchPlan(bbox(0, 0, 10000, 10000), AXIS_HORIZONTAL, 'steel');
    expect(plan.lines.length).toBeGreaterThan(0);
    expect(plan.lines.length).toBeLessThanOrEqual(8002);
  });
});

describe('Exported constants', () => {
  it('spacing per material is positive', () => {
    expect(BEAM_HATCH_SPACING_MM.rc).toBeGreaterThan(0);
    expect(BEAM_HATCH_SPACING_MM.steel).toBeGreaterThan(0);
    expect(BEAM_HATCH_SPACING_MM.glulam).toBeGreaterThan(0);
  });

  it('glulam grain spacing < cross-grain spacing (grain denser)', () => {
    expect(BEAM_HATCH_SPACING_MM.glulam).toBeLessThan(GLULAM_CROSS_GRAIN_SPACING_MM);
  });

  it('cross-grain angle is 30°', () => {
    expect(GLULAM_CROSS_GRAIN_ANGLE_RAD).toBeCloseTo(Math.PI / 6, 6);
  });

  it('stroke RGBA matches column convention', () => {
    expect(BEAM_HATCH_STROKE_RGBA).toBe('rgba(0, 0, 0, 0.20)');
  });

  it('line width per material is positive', () => {
    expect(BEAM_HATCH_LINE_WIDTH_PX.rc).toBeGreaterThan(0);
    expect(BEAM_HATCH_LINE_WIDTH_PX.steel).toBeGreaterThan(0);
    expect(BEAM_HATCH_LINE_WIDTH_PX.glulam).toBeGreaterThan(0);
  });

  it('RC dot radius is positive', () => {
    expect(BEAM_RC_DOT_RADIUS_PX).toBeGreaterThan(0);
  });
});
