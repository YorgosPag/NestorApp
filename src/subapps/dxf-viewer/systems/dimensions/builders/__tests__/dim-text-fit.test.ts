/**
 * ADR-362 Phase M — Text-fit / overlap handling tests.
 *
 * Table-driven coverage of the DIMATFIT/DIMTMOVE decision (`resolveTextFit`) +
 * the arrow/text/leader placement math (`computeLinearFitPlacement`).
 */

import type { Point2D } from '../../../../rendering/types/Types';
import {
  resolveTextFit,
  computeLinearFitPlacement,
  computeAngularFitPlacement,
  type TextFitInput,
  type TextFitResult,
} from '../dim-text-fit';

// ──────────────────────────────────────────────────────────────────────────────
// resolveTextFit
// ──────────────────────────────────────────────────────────────────────────────

function fitInput(patch: Partial<TextFitInput> = {}): TextFitInput {
  return {
    gap: 200,
    textWidth: 40,
    arrowSize: 10,
    textGap: 2,
    dimatfit: 3,
    dimtix: false,
    dimtofl: false,
    dimtmove: 0,
    ...patch,
  };
}

describe('resolveTextFit — fits inside', () => {
  it('wide gap → everything inside (zero regression)', () => {
    const r = resolveTextFit(fitInput({ gap: 200, textWidth: 40, arrowSize: 10 }));
    expect(r).toEqual<TextFitResult>({
      textOutside: false,
      arrowsOutside: false,
      drawDimLineInside: true,
      useLeader: false,
    });
  });

  it('exact boundary (textWidth + 2*arrows + 2*gap === gap) counts as fits', () => {
    // 40 + 2*10 + 2*2 = 64
    const r = resolveTextFit(fitInput({ gap: 64, textWidth: 40, arrowSize: 10, textGap: 2 }));
    expect(r.textOutside).toBe(false);
    expect(r.arrowsOutside).toBe(false);
  });
});

describe('resolveTextFit — DIMATFIT prioritisation when it does not fit', () => {
  // Narrow gap where text alone fits but not with arrows: gap 50, text 40 (+2*2=44),
  // arrowsSpan 20 → with arrows 64 > 50, text alone 44 <= 50, arrows alone 20 <= 50.
  const narrowTextFits = { gap: 50, textWidth: 40, arrowSize: 10, textGap: 2 };
  // Very narrow where text alone does NOT fit: gap 30, text 40 → text alone 44 > 30,
  // arrows alone 20 <= 30.
  const veryNarrow = { gap: 30, textWidth: 40, arrowSize: 10, textGap: 2 };
  // Tiny where nothing fits: gap 10, arrowsSpan 20 > 10.
  const tiny = { gap: 10, textWidth: 40, arrowSize: 10, textGap: 2 };

  it('DIMATFIT 0 — both outside', () => {
    const r = resolveTextFit(fitInput({ ...narrowTextFits, dimatfit: 0 }));
    expect(r.textOutside).toBe(true);
    expect(r.arrowsOutside).toBe(true);
  });

  it('DIMATFIT 1 (arrows first) — arrows out, text stays when it fits alone', () => {
    const r = resolveTextFit(fitInput({ ...narrowTextFits, dimatfit: 1 }));
    expect(r.arrowsOutside).toBe(true);
    expect(r.textOutside).toBe(false);
  });

  it('DIMATFIT 1 (arrows first) — text also leaves when it does not fit alone', () => {
    const r = resolveTextFit(fitInput({ ...veryNarrow, dimatfit: 1 }));
    expect(r.arrowsOutside).toBe(true);
    expect(r.textOutside).toBe(true);
  });

  it('DIMATFIT 2 (text first) — text out, arrows stay when they fit alone', () => {
    const r = resolveTextFit(fitInput({ ...veryNarrow, dimatfit: 2 }));
    expect(r.textOutside).toBe(true);
    expect(r.arrowsOutside).toBe(false);
  });

  it('DIMATFIT 2 (text first) — arrows also leave when they do not fit alone', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 2 }));
    expect(r.textOutside).toBe(true);
    expect(r.arrowsOutside).toBe(true);
  });

  it('DIMATFIT 3 (best fit) — text fits alone → keep text in, arrows out', () => {
    const r = resolveTextFit(fitInput({ ...narrowTextFits, dimatfit: 3 }));
    expect(r.textOutside).toBe(false);
    expect(r.arrowsOutside).toBe(true);
  });

  it('DIMATFIT 3 (best fit) — only arrows fit alone → text out, arrows in', () => {
    const r = resolveTextFit(fitInput({ ...veryNarrow, dimatfit: 3 }));
    expect(r.textOutside).toBe(true);
    expect(r.arrowsOutside).toBe(false);
  });

  it('DIMATFIT 3 (best fit) — nothing fits → both out', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 3 }));
    expect(r.textOutside).toBe(true);
    expect(r.arrowsOutside).toBe(true);
  });
});

describe('resolveTextFit — DIMTIX / DIMTOFL / DIMTMOVE overrides', () => {
  const tiny = { gap: 10, textWidth: 40, arrowSize: 10, textGap: 2 };

  it('DIMTIX forces text inside even when it does not fit', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 0, dimtix: true }));
    expect(r.textOutside).toBe(false);
    expect(r.arrowsOutside).toBe(true);
  });

  it('both outside without DIMTOFL → inside dim line suppressed', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 0, dimtofl: false }));
    expect(r.drawDimLineInside).toBe(false);
  });

  it('DIMTOFL forces inside dim line even when both outside', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 0, dimtofl: true }));
    expect(r.drawDimLineInside).toBe(true);
  });

  it('DIMTMOVE=1 + text outside → useLeader', () => {
    const r = resolveTextFit(fitInput({ ...tiny, dimatfit: 0, dimtmove: 1 }));
    expect(r.textOutside).toBe(true);
    expect(r.useLeader).toBe(true);
  });

  it('DIMTMOVE=1 but text stays inside → no leader', () => {
    // best-fit narrow where text stays in.
    const r = resolveTextFit(
      fitInput({ gap: 50, textWidth: 40, arrowSize: 10, textGap: 2, dimatfit: 3, dimtmove: 1 }),
    );
    expect(r.textOutside).toBe(false);
    expect(r.useLeader).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeLinearFitPlacement
// ──────────────────────────────────────────────────────────────────────────────

const foot1: Point2D = { x: 0, y: 0 };
const foot2: Point2D = { x: 100, y: 0 };
const midAnchor: Point2D = { x: 50, y: 0 };
// Geometry conventions: arrowDirection1 = unit(foot2→foot1), arrowDirection2 = unit(foot1→foot2).
const dir1: Point2D = { x: -1, y: 0 };
const dir2: Point2D = { x: 1, y: 0 };

function placementInput(fit: TextFitResult) {
  return {
    foot1,
    foot2,
    textAnchor: midAnchor,
    textWidth: 40,
    arrowSize: 10,
    textGap: 2,
    arrowDirection1: dir1,
    arrowDirection2: dir2,
    fit,
  };
}

describe('computeLinearFitPlacement', () => {
  it('all inside → unchanged directions + anchor', () => {
    const p = computeLinearFitPlacement(
      placementInput({ textOutside: false, arrowsOutside: false, drawDimLineInside: true, useLeader: false }),
    );
    expect(p.arrowDirection1).toEqual(dir1);
    expect(p.arrowDirection2).toEqual(dir2);
    expect(p.textAnchor).toEqual(midAnchor);
    expect(p.leaderPath).toBeUndefined();
  });

  it('arrows outside → directions negated, anchor unchanged when text inside', () => {
    const p = computeLinearFitPlacement(
      placementInput({ textOutside: false, arrowsOutside: true, drawDimLineInside: true, useLeader: false }),
    );
    expect(p.arrowDirection1.x).toBeCloseTo(1, 9);
    expect(p.arrowDirection1.y).toBeCloseTo(0, 9);
    expect(p.arrowDirection2.x).toBeCloseTo(-1, 9);
    expect(p.arrowDirection2.y).toBeCloseTo(0, 9);
    expect(p.textAnchor).toEqual(midAnchor);
  });

  it('text outside (arrows inside) → anchor past foot2 by textGap + textWidth/2', () => {
    const p = computeLinearFitPlacement(
      placementInput({ textOutside: true, arrowsOutside: false, drawDimLineInside: true, useLeader: false }),
    );
    // beyond = 0 + 2 + 40/2 = 22 → x = 100 + 22
    expect(p.textAnchor.x).toBeCloseTo(122, 9);
    expect(p.textAnchor.y).toBeCloseTo(0, 9);
  });

  it('text + arrows outside → anchor also clears the outside arrow (2*arrowSize)', () => {
    const p = computeLinearFitPlacement(
      placementInput({ textOutside: true, arrowsOutside: true, drawDimLineInside: false, useLeader: false }),
    );
    // beyond = 2*10 + 2 + 20 = 42 → x = 142
    expect(p.textAnchor.x).toBeCloseTo(142, 9);
  });

  it('useLeader → 3-point path [foot2, nearEdge, farEdge]', () => {
    const p = computeLinearFitPlacement(
      placementInput({ textOutside: true, arrowsOutside: false, drawDimLineInside: true, useLeader: true }),
    );
    expect(p.leaderPath).toBeDefined();
    const path = p.leaderPath!;
    expect(path).toHaveLength(3);
    expect(path[0]).toEqual(foot2);
    // anchor x = 122, nearEdge = 122 - 20 = 102, farEdge = 122 + 20 = 142.
    expect(path[1].x).toBeCloseTo(102, 9);
    expect(path[2].x).toBeCloseTo(142, 9);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeAngularFitPlacement
// ──────────────────────────────────────────────────────────────────────────────

const arcCenter: Point2D = { x: 0, y: 0 };
const aDir1: Point2D = { x: 0, y: -1 };
const aDir2: Point2D = { x: -1, y: 0 };

function angularInput(fit: TextFitResult, patch: Record<string, number> = {}) {
  const arcRadius = patch.arcRadius ?? 100;
  const arcStartAngle = patch.arcStartAngle ?? 0;
  const arcEndAngle = patch.arcEndAngle ?? Math.PI / 2;
  const midAngle = (arcStartAngle + arcEndAngle) / 2;
  return {
    arcCenter,
    arcRadius,
    arcStartAngle,
    arcEndAngle,
    textAnchor: {
      x: arcRadius * Math.cos(midAngle),
      y: arcRadius * Math.sin(midAngle),
    },
    textWidth: patch.textWidth ?? 40,
    arrowSize: 10,
    textGap: 2,
    arrowDirection1: aDir1,
    arrowDirection2: aDir2,
    fit,
  };
}

function radiusOf(p: Point2D): number {
  return Math.hypot(p.x, p.y);
}

describe('computeAngularFitPlacement', () => {
  it('all inside → unchanged directions + anchor on the arc', () => {
    const p = computeAngularFitPlacement(
      angularInput({ textOutside: false, arrowsOutside: false, drawDimLineInside: true, useLeader: false }),
    );
    expect(p.arrowDirection1).toEqual(aDir1);
    expect(p.arrowDirection2).toEqual(aDir2);
    expect(radiusOf(p.textAnchor)).toBeCloseTo(100, 6);
    expect(p.leaderPath).toBeUndefined();
  });

  it('arrows outside → tangent directions negated', () => {
    const p = computeAngularFitPlacement(
      angularInput({ textOutside: false, arrowsOutside: true, drawDimLineInside: true, useLeader: false }),
    );
    expect(p.arrowDirection1.x).toBeCloseTo(0, 9);
    expect(p.arrowDirection1.y).toBeCloseTo(1, 9);
    expect(p.arrowDirection2.x).toBeCloseTo(1, 9);
    expect(p.arrowDirection2.y).toBeCloseTo(0, 9);
  });

  it('text outside (wide arc) → pushed radially out to minRadius, same bisector', () => {
    const p = computeAngularFitPlacement(
      angularInput({ textOutside: true, arrowsOutside: false, drawDimLineInside: true, useLeader: false }),
    );
    // requiredRadius = (40+4)/(π/2) ≈ 28 < minRadius(102) → outerRadius = 102.
    expect(radiusOf(p.textAnchor)).toBeCloseTo(102, 6);
    // still on the 45° bisector.
    expect(p.textAnchor.x).toBeCloseTo(p.textAnchor.y, 6);
  });

  it('text outside (very narrow arc) → radius clamped to maxRadius', () => {
    const p = computeAngularFitPlacement(
      angularInput(
        { textOutside: true, arrowsOutside: false, drawDimLineInside: true, useLeader: false },
        { arcEndAngle: 0.1, textWidth: 40 },
      ),
    );
    // requiredRadius = 44/0.1 = 440 > maxRadius (100*3+40=340) → clamped to 340.
    expect(radiusOf(p.textAnchor)).toBeCloseTo(340, 4);
  });

  it('useLeader → radial 2-point path [arcMid, movedAnchor]', () => {
    const p = computeAngularFitPlacement(
      angularInput({ textOutside: true, arrowsOutside: false, drawDimLineInside: true, useLeader: true }),
    );
    expect(p.leaderPath).toBeDefined();
    const path = p.leaderPath!;
    expect(path).toHaveLength(2);
    expect(radiusOf(path[0])).toBeCloseTo(100, 6); // arc midpoint at arcRadius
    expect(radiusOf(path[1])).toBeCloseTo(102, 6); // moved anchor
  });
});
