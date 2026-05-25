/**
 * ADR-363 Phase 4.5c.2 — `column-hatch-patterns` pure-function tests.
 *
 * Verifies:
 *   - `resolveMaterialKey` case-insensitive + safe `'rc'` fallback
 *   - `computeHatchPlan` shape per material (rc → dots only, steel → diagonals
 *     στις δύο διευθύνσεις, masonry → horizontal courses + staggered joints,
 *     wood → single-direction diagonals)
 *   - Dot grid spacing count για 400×400 bbox @ 150mm
 *   - Degenerate bbox (min===max ή negative) → empty plan, no infinite loops
 *   - Large bbox (10 000×10 000 mm) → reasonable count, no crash (capped από
 *     MAX_HATCH_STEPS safety guard)
 *   - Exported constants τιμές
 *   - Masonry alternating-row stagger: row 0 offset 0, row 1 offset brickL/2
 */

import {
  resolveMaterialKey,
  computeHatchPlan,
  computeCircularHatchPlan,
  HATCH_SPACING_MM,
  HATCH_STROKE_RGBA,
  HATCH_LINE_WIDTH_PX,
  RC_DOT_RADIUS_PX,
  MASONRY_BRICK_LENGTH_MM,
  MASONRY_BRICK_HEIGHT_MM,
  CIRCULAR_RC_RING_FRACTIONS,
} from '../column-hatch-patterns';
import type { BoundingBox3D } from '../../types/bim-base';

function bbox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox3D {
  return { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 0 } };
}

describe('resolveMaterialKey — case-insensitive + fallback', () => {
  it('lowercase known keys preserved', () => {
    expect(resolveMaterialKey('rc')).toBe('rc');
    expect(resolveMaterialKey('steel')).toBe('steel');
    expect(resolveMaterialKey('masonry')).toBe('masonry');
    expect(resolveMaterialKey('wood')).toBe('wood');
  });

  it('uppercase / mixed-case → normalised lower', () => {
    expect(resolveMaterialKey('RC')).toBe('rc');
    expect(resolveMaterialKey('Rc')).toBe('rc');
    expect(resolveMaterialKey('STEEL')).toBe('steel');
    expect(resolveMaterialKey('Steel')).toBe('steel');
    expect(resolveMaterialKey('Masonry')).toBe('masonry');
    expect(resolveMaterialKey('WOOD')).toBe('wood');
  });

  it('undefined / empty / unknown → "rc" fallback', () => {
    expect(resolveMaterialKey(undefined)).toBe('rc');
    expect(resolveMaterialKey('')).toBe('rc');
    expect(resolveMaterialKey('unknown')).toBe('rc');
    expect(resolveMaterialKey('concrete')).toBe('rc');
    expect(resolveMaterialKey('foo-bar')).toBe('rc');
  });
});

describe('computeHatchPlan — per-material shape', () => {
  const B = bbox(0, 0, 400, 400);

  it('rc → dot grid only (lines empty, dots populated)', () => {
    const plan = computeHatchPlan(B, 'rc');
    expect(plan.lines).toHaveLength(0);
    expect(plan.dots.length).toBeGreaterThan(0);
  });

  it('rc dot grid count = ⌊extent/spacing⌋+1 ανά άξονα (400×400 @ 150 → 3×3 = 9)', () => {
    const plan = computeHatchPlan(B, 'rc');
    // startX = ceil(0/150)*150 = 0. Steps: 0,150,300 (3). Ίδιο για Y.
    expect(plan.dots.length).toBe(9);
  });

  it('steel → cross-hatch lines (both diagonal directions), no dots', () => {
    const plan = computeHatchPlan(B, 'steel');
    expect(plan.dots).toHaveLength(0);
    expect(plan.lines.length).toBeGreaterThan(0);
    // Cross-hatch = θετική slope + αρνητική slope. Διαχωρισμός από start→end dx/dy sign.
    const positives = plan.lines.filter((l) => (l.end.x - l.start.x) * (l.end.y - l.start.y) > 0);
    const negatives = plan.lines.filter((l) => (l.end.x - l.start.x) * (l.end.y - l.start.y) < 0);
    expect(positives.length).toBeGreaterThan(0);
    expect(negatives.length).toBeGreaterThan(0);
  });

  it('masonry → horizontal courses + staggered vertical joints, no dots', () => {
    const plan = computeHatchPlan(B, 'masonry');
    expect(plan.dots).toHaveLength(0);
    // Horizontal lines: same y για start/end.
    const horiz = plan.lines.filter((l) => l.start.y === l.end.y);
    const vert = plan.lines.filter((l) => l.start.x === l.end.x);
    expect(horiz.length).toBeGreaterThan(0);
    expect(vert.length).toBeGreaterThan(0);
  });

  it('wood → single-direction diagonals only, no dots', () => {
    const plan = computeHatchPlan(B, 'wood');
    expect(plan.dots).toHaveLength(0);
    expect(plan.lines.length).toBeGreaterThan(0);
    // Όλα ίδια slope sign — εδώ slope=+1, άρα (end.x-start.x) και (end.y-start.y) ίδιο sign.
    for (const l of plan.lines) {
      const sx = Math.sign(l.end.x - l.start.x);
      const sy = Math.sign(l.end.y - l.start.y);
      if (sx !== 0 && sy !== 0) expect(sx).toBe(sy);
    }
  });
});

describe('computeHatchPlan — degenerate + large bbox safety', () => {
  it('min === max → empty plan', () => {
    const plan = computeHatchPlan(bbox(100, 100, 100, 100), 'rc');
    expect(plan.lines).toHaveLength(0);
    expect(plan.dots).toHaveLength(0);
  });

  it('negative extents → empty plan', () => {
    const plan = computeHatchPlan(bbox(500, 500, 100, 100), 'steel');
    expect(plan.lines).toHaveLength(0);
    expect(plan.dots).toHaveLength(0);
  });

  it('large bbox (10000×10000) → bounded count, no crash', () => {
    const plan = computeHatchPlan(bbox(0, 0, 10000, 10000), 'rc');
    // 10000/150 + 1 = 68 ανά άξονα → ~4624 dots. Capped από MAX_HATCH_STEPS=4000.
    expect(plan.dots.length).toBeGreaterThan(100);
    expect(plan.dots.length).toBeLessThanOrEqual(4624);
  });
});

describe('Exported constants', () => {
  it('spacing values', () => {
    expect(HATCH_SPACING_MM.rc).toBe(150);
    expect(HATCH_SPACING_MM.steel).toBe(100);
    expect(HATCH_SPACING_MM.masonry).toBe(80);
    expect(HATCH_SPACING_MM.wood).toBe(80);
  });

  it('stroke + line width + dot radius', () => {
    expect(HATCH_STROKE_RGBA).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.20\)/);
    expect(HATCH_LINE_WIDTH_PX.steel).toBeGreaterThan(0);
    expect(HATCH_LINE_WIDTH_PX.wood).toBeGreaterThan(0);
    expect(RC_DOT_RADIUS_PX).toBe(1.5);
  });

  it('masonry brick dimensions', () => {
    expect(MASONRY_BRICK_LENGTH_MM).toBe(200);
    expect(MASONRY_BRICK_HEIGHT_MM).toBe(80);
  });
});

describe('buildDiagonalHatch — slope sign parity (ADR-363 Phase 8 bugfix)', () => {
  it('steel cross-hatch produces same line count for slope=+1 and slope=-1 σε square bbox', () => {
    // Bug pre-Phase 8: slope=-1 με kMin=kMax=400 → ZERO negative-slope lines.
    // Fix: 4-corner sweep για kMin/kMax.
    const plan = computeHatchPlan(bbox(0, 0, 400, 400), 'steel');
    const pos = plan.lines.filter((l) => (l.end.x - l.start.x) * (l.end.y - l.start.y) > 0);
    const neg = plan.lines.filter((l) => (l.end.x - l.start.x) * (l.end.y - l.start.y) < 0);
    expect(pos.length).toBeGreaterThan(0);
    expect(neg.length).toBeGreaterThan(0);
    expect(neg.length).toBe(pos.length);
  });

  it('asymmetric bbox: slope=-1 produces non-zero lines', () => {
    // 200×800 vertical rectangle (shear-wall-like) — earlier formula degenerated εδώ.
    const plan = computeHatchPlan(bbox(0, 0, 200, 800), 'steel');
    const neg = plan.lines.filter((l) => (l.end.x - l.start.x) * (l.end.y - l.start.y) < 0);
    expect(neg.length).toBeGreaterThan(0);
  });
});

describe('computeHatchPlan — backward-compat: arcs field is always present', () => {
  const B = bbox(0, 0, 400, 400);

  it.each(['rc', 'steel', 'masonry', 'wood'] as const)('%s → arcs array exists and is empty', (mat) => {
    const plan = computeHatchPlan(B, mat);
    expect(Array.isArray(plan.arcs)).toBe(true);
    expect(plan.arcs).toHaveLength(0);
  });
});

describe('computeCircularHatchPlan — RC concentric rings', () => {
  const center = { x: 0, y: 0 };
  const radius = 200;

  it('rc → 3 concentric arcs, no lines, no dots', () => {
    const plan = computeCircularHatchPlan(center, radius, 'rc');
    expect(plan.arcs).toHaveLength(CIRCULAR_RC_RING_FRACTIONS.length);
    expect(plan.lines).toHaveLength(0);
    expect(plan.dots).toHaveLength(0);
  });

  it('rc ring radii match CIRCULAR_RC_RING_FRACTIONS × radius', () => {
    const plan = computeCircularHatchPlan(center, radius, 'rc');
    plan.arcs.forEach((arc, i) => {
      expect(arc.radiusMm).toBeCloseTo(radius * CIRCULAR_RC_RING_FRACTIONS[i], 6);
    });
  });

  it('rc ring centers all at column position', () => {
    const plan = computeCircularHatchPlan({ x: 100, y: 50 }, radius, 'rc');
    for (const arc of plan.arcs) {
      expect(arc.center.x).toBe(100);
      expect(arc.center.y).toBe(50);
    }
  });

  it('CIRCULAR_RC_RING_FRACTIONS has 3 entries in ascending order', () => {
    expect(CIRCULAR_RC_RING_FRACTIONS).toHaveLength(3);
    for (let i = 1; i < CIRCULAR_RC_RING_FRACTIONS.length; i++) {
      expect(CIRCULAR_RC_RING_FRACTIONS[i]).toBeGreaterThan(CIRCULAR_RC_RING_FRACTIONS[i - 1]);
    }
  });
});

describe('computeCircularHatchPlan — steel/masonry/wood use bbox clip lines', () => {
  const center = { x: 0, y: 0 };
  const radius = 200;

  it.each(['steel', 'masonry', 'wood'] as const)('%s circular → lines populated, arcs empty', (mat) => {
    const plan = computeCircularHatchPlan(center, radius, mat);
    expect(plan.arcs).toHaveLength(0);
    expect(plan.lines.length).toBeGreaterThan(0);
    expect(plan.dots).toHaveLength(0);
  });
});

describe('computeCircularHatchPlan — degenerate inputs', () => {
  it('radius = 0 → empty plan', () => {
    const plan = computeCircularHatchPlan({ x: 0, y: 0 }, 0, 'rc');
    expect(plan.arcs).toHaveLength(0);
    expect(plan.lines).toHaveLength(0);
    expect(plan.dots).toHaveLength(0);
  });

  it('negative radius → empty plan', () => {
    const plan = computeCircularHatchPlan({ x: 0, y: 0 }, -100, 'rc');
    expect(plan.arcs).toHaveLength(0);
  });

  it('NaN radius → empty plan', () => {
    const plan = computeCircularHatchPlan({ x: 0, y: 0 }, NaN, 'rc');
    expect(plan.arcs).toHaveLength(0);
  });
});

describe('Masonry alternating-row stagger', () => {
  it('row 0 joints align με brickL grid, row 1 με brickL/2 offset', () => {
    // bbox 0..800 X, 0..160 Y → 2 rows ύψους 80 → 2 ζώνες (y∈[0,80), y∈[80,160)).
    const plan = computeHatchPlan(bbox(0, 0, 800, 160), 'masonry');
    const vert = plan.lines.filter((l) => l.start.x === l.end.x);
    const row0 = vert.filter((l) => l.start.y === 0).map((l) => l.start.x).sort((a, b) => a - b);
    const row1 = vert.filter((l) => l.start.y === 80).map((l) => l.start.x).sort((a, b) => a - b);

    // Row 0: offset 0 → x ∈ {0, 200, 400, 600, 800}
    expect(row0).toContain(0);
    expect(row0).toContain(200);
    expect(row0).toContain(400);

    // Row 1: offset 100 → x ∈ {100, 300, 500, 700}
    expect(row1).toContain(100);
    expect(row1).toContain(300);
    expect(row1).toContain(500);

    // Stagger verify: row 1 ΔΕΝ έχει 200 ή 400 (αυτά είναι row-0 alignment).
    expect(row1).not.toContain(200);
    expect(row1).not.toContain(400);
  });
});
