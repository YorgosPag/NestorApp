/**
 * ADR-456 Slice 3 — column rebar LAYOUT geometry SSoT tests: bar placement
 * (corners + even perimeter distribution), stirrup ring inset, stirrup levels
 * (critical-zone densification), degenerate guards.
 */

import {
  computeColumnRebarLayout,
  computeStirrupLevelsMm,
  buildRoundedStirrupPath,
  buildStirrupHookEndsMm,
  stirrupCenterlinePerimeterMm,
  STIRRUP_BEND_CL_FACTOR,
} from '../column-rebar-layout';
import type { Point2D } from '../../../../rendering/types/Types';
import type { ColumnReinforcement } from '../column-reinforcement-types';

/** Συνολικό μήκος κλειστής polyline (κλείνει last→first). */
function closedPathLength(pts: readonly Point2D[]): number {
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

const R_8x16: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 8 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100 },
  coverMm: 30,
};

const R_4x16: ColumnReinforcement = {
  longitudinal: { diameterMm: 16, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 30,
};

describe('computeColumnRebarLayout — longitudinal bars', () => {
  it('returns exactly `count` bars', () => {
    const layout = computeColumnRebarLayout(R_8x16, 400, 400)!;
    expect(layout.longitudinalBarsMm).toHaveLength(8);
  });

  it('places the 4 corners at width/2 − inset (inset = cover + dbw + dbL/2)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    // inset = 30 + 8 + 16/2 = 46 → half = 200 − 46 = 154
    const xs = layout.longitudinalBarsMm.map((p) => Math.abs(p.x)).sort();
    const ys = layout.longitudinalBarsMm.map((p) => Math.abs(p.y)).sort();
    expect(xs.every((v) => Math.abs(v - 154) < 1e-6)).toBe(true);
    expect(ys.every((v) => Math.abs(v - 154) < 1e-6)).toBe(true);
  });

  it('count ≤ 4 returns only corner subset', () => {
    const layout = computeColumnRebarLayout({ ...R_4x16, longitudinal: { diameterMm: 16, count: 3 } }, 400, 400)!;
    expect(layout.longitudinalBarsMm).toHaveLength(3);
  });

  it('extras are distributed symmetrically on a square section', () => {
    // 8 bars on a square → corners + 1 mid-bar per side. Mid bars sit at x=0 or y=0.
    const layout = computeColumnRebarLayout(R_8x16, 400, 400)!;
    const onAxis = layout.longitudinalBarsMm.filter(
      (p) => Math.abs(p.x) < 1e-6 || Math.abs(p.y) < 1e-6,
    );
    expect(onAxis).toHaveLength(4);
  });

  it('more extras go to the longer side of a rectangular section', () => {
    // 10 bars, 800×400 → top/bottom (long) get more interior bars than left/right.
    const layout = computeColumnRebarLayout({ ...R_8x16, longitudinal: { diameterMm: 16, count: 10 } }, 800, 400)!;
    expect(layout.longitudinalBarsMm).toHaveLength(10);
    const interiorTopBottom = layout.longitudinalBarsMm.filter(
      (p) => Math.abs(p.x) > 1e-6 && Math.abs(p.x) < 300 && Math.abs(Math.abs(p.y) - (400 / 2 - 46)) < 1e-6,
    );
    expect(interiorTopBottom.length).toBeGreaterThan(0);
  });
});

describe('computeColumnRebarLayout — stirrup ring', () => {
  it('ring inset = cover + dbw/2', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    // inset = 30 + 8/2 = 34 → half = 166
    expect(layout.stirrupRingMm).toHaveLength(4);
    expect(Math.abs(Math.abs(layout.stirrupRingMm[0].x) - 166)).toBeLessThan(1e-6);
  });
});

describe('computeColumnRebarLayout — rounded stirrup corners (Slice 3b)', () => {
  it('exposes a rounded stirrup path with corner radius = 2.5·dbw', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    // dbw=8 → r_cl = 2.5·8 = 20 (clamped ≤ min half-side = 166 → 20)
    expect(layout.stirrupCornerRadiusMm).toBeCloseTo(STIRRUP_BEND_CL_FACTOR * 8, 6);
    expect(layout.stirrupPathMm.length).toBeGreaterThan(layout.stirrupRingMm.length);
  });

  it('rounded path is SHORTER than the sharp ring (corners are cut)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    expect(closedPathLength(layout.stirrupPathMm)).toBeLessThan(closedPathLength(layout.stirrupRingMm));
  });

  it('rounded path stays within the ring half-extents (embraces inward)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const halfWs = Math.max(...layout.stirrupRingMm.map((p) => Math.abs(p.x)));
    const halfDs = Math.max(...layout.stirrupRingMm.map((p) => Math.abs(p.y)));
    for (const p of layout.stirrupPathMm) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(halfWs + 1e-6);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(halfDs + 1e-6);
    }
  });

  it('the sharp corner itself is no longer on the path (rounded away)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const corner = layout.stirrupRingMm[2]; // TR (halfWs, halfDs)
    const minDist = Math.min(...layout.stirrupPathMm.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)));
    expect(minDist).toBeGreaterThan(1); // pulled in by the bend radius
  });
});

describe('buildStirrupHookEndsMm — 135° hook ends', () => {
  it('layout exposes exactly TWO hook ends for a hooked stirrup', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    expect(layout.stirrupHookEndsMm).toHaveLength(2);
  });

  it('each end has a bend arc + tail (more than 2 points)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    for (const end of layout.stirrupHookEndsMm) expect(end.length).toBeGreaterThan(2);
  });

  it('both tail ends point INTO the core (toward the centroid)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const corner = layout.stirrupRingMm[0]; // BL (−,−) → core direction is (+,+)
    for (const end of layout.stirrupHookEndsMm) {
      const tip = end[end.length - 1];
      expect(tip.x).toBeGreaterThan(corner.x); // moved toward center on both axes
      expect(tip.y).toBeGreaterThan(corner.y);
    }
  });

  it('the two ends are distinct (splayed apart)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const [a, b] = layout.stirrupHookEndsMm;
    const tipA = a[a.length - 1];
    const tipB = b[b.length - 1];
    expect(Math.hypot(tipA.x - tipB.x, tipA.y - tipB.y)).toBeGreaterThan(1);
  });

  it('returns no ends for a degenerate (zero-diameter) stirrup', () => {
    const ring: Point2D[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    expect(buildStirrupHookEndsMm(ring, { x: -80, y: -80 }, { x: 0, y: 0 }, 0, 16, 6)).toEqual([]);
  });

  it('each hook wraps around the corner bar (points span >90° around it)', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const bar = layout.longitudinalBarsMm[0];
    for (const end of layout.stirrupHookEndsMm) {
      // drop the final straight-tail point; the rest are the wrap arc around the bar
      const arc = end.slice(0, -1);
      const angles = arc.map((p) => Math.atan2(p.y - bar.y, p.x - bar.x));
      const span = Math.max(...angles) - Math.min(...angles);
      expect(span).toBeGreaterThan(Math.PI / 2); // wraps more than a quarter turn
    }
  });

  it('each tail makes EXACTLY 45° with its stirrup side → a true 135° hook', () => {
    const layout = computeColumnRebarLayout(R_4x16, 400, 400)!;
    const cc = layout.stirrupRingMm[0];
    // side directions from the closure corner (same order as the two hook ends)
    const sides = [
      { x: layout.stirrupRingMm[1].x - cc.x, y: layout.stirrupRingMm[1].y - cc.y },
      { x: layout.stirrupRingMm[3].x - cc.x, y: layout.stirrupRingMm[3].y - cc.y },
    ];
    layout.stirrupHookEndsMm.forEach((end, i) => {
      const tip = end[end.length - 1];
      const prev = end[end.length - 2];
      const tail = { x: tip.x - prev.x, y: tip.y - prev.y };
      const side = sides[i];
      const cosA =
        (tail.x * side.x + tail.y * side.y) /
        (Math.hypot(tail.x, tail.y) * Math.hypot(side.x, side.y));
      const acuteDeg = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
      expect(acuteDeg).toBeCloseTo(45, 1); // 45° to the side ⇒ 135° hook
    });
  });
});

describe('buildRoundedStirrupPath', () => {
  const SQUARE: Point2D[] = [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 100, y: 100 },
    { x: -100, y: 100 },
  ];

  it('falls back to sharp corners when radius ≤ 0', () => {
    expect(buildRoundedStirrupPath(SQUARE, 0, 6)).toHaveLength(4);
    expect(buildRoundedStirrupPath(SQUARE, -5, 6)).toHaveLength(4);
  });

  it('produces (segPerArc+1) points per corner', () => {
    expect(buildRoundedStirrupPath(SQUARE, 20, 6)).toHaveLength(4 * 7);
  });

  it('clamps radius to half the shortest side', () => {
    // Huge radius on a 200×200 square → clamp to 100; perimeter → full circle 2π·100.
    const path = buildRoundedStirrupPath(SQUARE, 9999, 64);
    expect(closedPathLength(path)).toBeCloseTo(2 * Math.PI * 100, 0);
  });
});

describe('stirrupCenterlinePerimeterMm', () => {
  it('matches the rounded rectangle formula 2(W+D) − 8r + 2πr', () => {
    // 400×400, cover30, dbw8 → inset 34 → W=D=332, r=min(20,166)=20.
    const W = 332;
    const D = 332;
    const r = 20;
    const expected = 2 * (W + D) - 8 * r + 2 * Math.PI * r;
    expect(stirrupCenterlinePerimeterMm(R_4x16, 400, 400)).toBeCloseTo(expected, 4);
  });

  it('is shorter than the naive sharp centerline 2(W+D)', () => {
    const sharp = 2 * (332 + 332);
    expect(stirrupCenterlinePerimeterMm(R_4x16, 400, 400)).toBeLessThan(sharp);
  });

  it('returns 0 for a degenerate section', () => {
    expect(stirrupCenterlinePerimeterMm(R_4x16, 0, 400)).toBe(0);
  });
});

describe('computeColumnRebarLayout — guards', () => {
  it('returns null for degenerate section', () => {
    expect(computeColumnRebarLayout(R_4x16, 0, 400)).toBeNull();
    expect(computeColumnRebarLayout(R_4x16, -10, 400)).toBeNull();
  });
});

describe('computeStirrupLevelsMm', () => {
  it('returns empty for degenerate height/spacing', () => {
    expect(computeStirrupLevelsMm(R_8x16, 400, 400, 0)).toEqual([]);
    expect(computeStirrupLevelsMm({ ...R_8x16, stirrups: { diameterMm: 8, spacingMm: 0 } }, 400, 400, 3000)).toEqual([]);
  });

  it('starts at 0 and ends at height', () => {
    const z = computeStirrupLevelsMm(R_8x16, 400, 400, 3000);
    expect(z[0]).toBe(0);
    expect(z[z.length - 1]).toBe(3000);
  });

  it('densifies critical end zones (more stirrups than uniform spacing)', () => {
    const z = computeStirrupLevelsMm(R_8x16, 400, 400, 3000);
    const uniform = Math.ceil(3000 / 200) + 1; // had it been all at spacingMm
    expect(z.length).toBeGreaterThan(uniform);
  });

  it('is monotonically increasing', () => {
    const z = computeStirrupLevelsMm(R_8x16, 400, 400, 3000);
    for (let i = 1; i < z.length; i++) expect(z[i]).toBeGreaterThanOrEqual(z[i - 1]);
  });
});
