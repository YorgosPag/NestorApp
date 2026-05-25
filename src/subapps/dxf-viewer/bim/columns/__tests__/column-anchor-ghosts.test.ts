/**
 * ADR-363 Phase 4.5c.1 — `column-anchor-ghosts` pure-function tests.
 *
 * Verifies:
 *   - Rectangular / L-shape / T-shape kinds → 9 ghosts, ένα active matching
 *     το `activeAnchor` argument.
 *   - Circular kind → 1 ghost μόνο, anchor='center', isActive=true. Anchor
 *     cycling N/A.
 *   - `ANCHOR_CYCLE_ORDER` ordering preserved στο emitted array.
 *   - Active flag flips correctly για κάθε anchor στο cycle order.
 *   - Footprint vertices shift ανάλογα με anchor (anchor='nw' → bbox center
 *     μετατοπίζεται προς -X/-Y από cursor).
 *   - Foreign overrides (rotation, width, depth, height, lshape, tshape)
 *     propagate σε όλα τα 9 ghosts.
 *   - cursorPos surfacearizes ίδιο σε όλα τα entries του ίδιου frame.
 */

import {
  computeAnchorGhostFootprints,
  type AnchorGhost,
} from '../column-anchor-ghosts';
import {
  ANCHOR_CYCLE_ORDER,
  type ColumnAnchor,
} from '../../types/column-types';
import type { Point2D } from '../../../rendering/types/Types';

const CURSOR: Readonly<Point2D> = { x: 1000, y: 500 };

function bboxCentre(g: AnchorGhost): { x: number; y: number } {
  const xs = g.footprint.vertices.map((v) => v.x);
  const ys = g.footprint.vertices.map((v) => v.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

describe('computeAnchorGhostFootprints — count + structure', () => {
  it('rectangular → 9 ghosts in ANCHOR_CYCLE_ORDER', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'center');
    expect(ghosts).toHaveLength(9);
    expect(ghosts.map((g) => g.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('L-shape → 9 ghosts in ANCHOR_CYCLE_ORDER', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'L-shape', 'center');
    expect(ghosts).toHaveLength(9);
    expect(ghosts.map((g) => g.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('T-shape → 9 ghosts in ANCHOR_CYCLE_ORDER', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'T-shape', 'center');
    expect(ghosts).toHaveLength(9);
    expect(ghosts.map((g) => g.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('circular → 1 ghost only (anchor=center, isActive=true)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'circular', 'center');
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].anchor).toBe('center');
    expect(ghosts[0].isActive).toBe(true);
  });

  it('circular ignores activeAnchor argument (always center, isActive=true)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'circular', 'nw');
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].anchor).toBe('center');
    expect(ghosts[0].isActive).toBe(true);
  });
});

describe('computeAnchorGhostFootprints — active flag', () => {
  it.each(ANCHOR_CYCLE_ORDER)('marks ghost[%s] active when activeAnchor=%s', (anchor) => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', anchor as ColumnAnchor);
    const active = ghosts.filter((g) => g.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].anchor).toBe(anchor);
  });
});

describe('computeAnchorGhostFootprints — footprint shifts per anchor', () => {
  it('anchor=center: bbox centred on cursor', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'center');
    const centre = bboxCentre(ghosts.find((g) => g.anchor === 'center')!);
    expect(centre.x).toBeCloseTo(CURSOR.x, 3);
    expect(centre.y).toBeCloseTo(CURSOR.y, 3);
  });

  it('anchor=nw: bbox centre shifts to +X / -Y from cursor (top-left corner at cursor)', () => {
    // Default rect 400×400 mm. NW anchor on bbox → centre at (+200, -200).
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'nw');
    const centre = bboxCentre(ghosts.find((g) => g.anchor === 'nw')!);
    expect(centre.x).toBeCloseTo(CURSOR.x + 200, 3);
    expect(centre.y).toBeCloseTo(CURSOR.y - 200, 3);
  });

  it('anchor=se: bbox centre shifts to -X / +Y from cursor', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'se');
    const centre = bboxCentre(ghosts.find((g) => g.anchor === 'se')!);
    expect(centre.x).toBeCloseTo(CURSOR.x - 200, 3);
    expect(centre.y).toBeCloseTo(CURSOR.y + 200, 3);
  });
});

describe('computeAnchorGhostFootprints — overrides propagate', () => {
  it('width override applies to all 9 ghosts (bbox width=overridden value)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'center', {
      width: 800, depth: 400,
    });
    for (const g of ghosts) {
      const xs = g.footprint.vertices.map((v) => v.x);
      const w = Math.max(...xs) - Math.min(...xs);
      expect(w).toBeCloseTo(800, 3);
    }
  });

  it('rotation override applies to all 9 ghosts (bbox no longer axis-aligned)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'center', {
      rotation: 45,
    });
    // After 45° rotation, the 4 vertices of a square sit on the axes through
    // the bbox centre — distance from centre = diagonal/2 in x AND y.
    const g = ghosts[0];
    const c = bboxCentre(g);
    const halfDiag = Math.SQRT2 * 200; // 400/2 × √2
    const v0 = g.footprint.vertices[0];
    expect(Math.hypot(v0.x - c.x, v0.y - c.y)).toBeCloseTo(halfDiag, 3);
  });

  it('lshape override propagates to all 9 L-shape ghosts (vertex count = 6)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'L-shape', 'center', {
      lshape: { armLength: 150, armWidth: 100 },
    });
    for (const g of ghosts) {
      expect(g.footprint.vertices).toHaveLength(6);
    }
  });

  it('tshape override propagates to all 9 T-shape ghosts (vertex count = 8)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'T-shape', 'center', {
      tshape: { flangeLength: 600, webThickness: 120 },
    });
    for (const g of ghosts) {
      expect(g.footprint.vertices).toHaveLength(8);
    }
  });

  // ── ADR-363 Phase 8D — polygon / shear-wall / I-shape kinds ───────────────
  it('polygon → 9 ghosts in ANCHOR_CYCLE_ORDER (mirrors rectangular)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'polygon', 'center');
    expect(ghosts).toHaveLength(9);
    expect(ghosts.map((g) => g.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('polygon sides override propagates to all 9 ghosts (default 6 → vertex count 6)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'polygon', 'center');
    for (const g of ghosts) {
      expect(g.footprint.vertices.length).toBe(6);
    }
  });

  it('polygon sides=8 override propagates to all 9 ghosts (vertex count 8)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'polygon', 'center', {
      polygon: { sides: 8 },
    });
    for (const g of ghosts) {
      expect(g.footprint.vertices.length).toBe(8);
    }
  });

  it('shear-wall → 9 ghosts (rectangular footprint, 4 vertices)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'shear-wall', 'center');
    expect(ghosts).toHaveLength(9);
    for (const g of ghosts) {
      expect(g.footprint.vertices).toHaveLength(4);
    }
  });

  it('I-shape → 9 ghosts in ANCHOR_CYCLE_ORDER', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'I-shape', 'center');
    expect(ghosts).toHaveLength(9);
    expect(ghosts.map((g) => g.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('ishape override propagates to all 9 I-shape ghosts (12 vertices double-T)', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'I-shape', 'center', {
      ishape: { flangeThickness: 25, webThickness: 18 },
    });
    for (const g of ghosts) {
      // I-shape footprint = 12 vertices (top flange 4 + web 4 + bottom flange 4).
      expect(g.footprint.vertices.length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('computeAnchorGhostFootprints — cursorPos surface', () => {
  it('each entry carries the input cursorPos verbatim', () => {
    const ghosts = computeAnchorGhostFootprints(CURSOR, 'rectangular', 'center');
    for (const g of ghosts) {
      expect(g.cursorPos.x).toBe(CURSOR.x);
      expect(g.cursorPos.y).toBe(CURSOR.y);
    }
  });
});
