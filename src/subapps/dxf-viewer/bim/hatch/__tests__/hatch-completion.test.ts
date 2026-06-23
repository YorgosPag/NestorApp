/**
 * ADR-507 S2 — tests για τα hatch completion helpers + draw-defaults store.
 */

import {
  buildHatchEntityFromBoundary,
  buildHatchEntityFromRegion,
  computeHatchAreaMm2,
  buildHatchPostCreateCommands,
  HATCH_MIN_BOUNDARY_POINTS,
} from '../hatch-completion';
import {
  getHatchDrawDefaults,
  setHatchDrawDefaults,
  resetHatchDrawDefaults,
  subscribeHatchDrawDefaults,
} from '../hatch-draw-defaults-store';
import type { Point2D } from '../../../rendering/types/Types';

const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

describe('hatch-draw-defaults-store', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('defaults to solid grey poché', () => {
    const d = getHatchDrawDefaults();
    expect(d.fillType).toBe('solid');
    expect(d.fillColor).toBe('#808080');
    expect(d.islandStyle).toBe('normal');
  });

  it('patches a single field and keeps the rest', () => {
    setHatchDrawDefaults({ fillType: 'user-defined' });
    expect(getHatchDrawDefaults().fillType).toBe('user-defined');
    expect(getHatchDrawDefaults().fillColor).toBe('#808080');
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsub = subscribeHatchDrawDefaults(() => { calls++; });
    setHatchDrawDefaults({ lineAngle: 90 });
    expect(calls).toBe(1);
    unsub();
    setHatchDrawDefaults({ lineAngle: 0 });
    expect(calls).toBe(1);
  });
});

describe('buildHatchEntityFromBoundary', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('returns null below the minimum boundary points', () => {
    expect(buildHatchEntityFromBoundary(SQUARE.slice(0, HATCH_MIN_BOUNDARY_POINTS - 1), 'e1', 'lyr')).toBeNull();
  });

  it('builds a solid hatch from defaults (drawOrder=0, no double-hatch)', () => {
    const h = buildHatchEntityFromBoundary(SQUARE, 'e1', 'lyr');
    expect(h).not.toBeNull();
    expect(h!.type).toBe('hatch');
    expect(h!.fillType).toBe('solid');
    expect(h!.patternType).toBe('solid');
    expect(h!.drawOrder).toBe(0);
    expect(h!.doubleCrossHatch).toBeUndefined();
    expect(h!.boundaryPaths[0]).toHaveLength(4);
    expect(h!.layerId).toBe('lyr');
  });

  it('builds a user-defined hatch carrying angle/spacing/double', () => {
    setHatchDrawDefaults({ fillType: 'user-defined', lineAngle: 30, lineSpacing: 150, doubleCrossHatch: true });
    const h = buildHatchEntityFromBoundary(SQUARE, 'e2', 'lyr')!;
    expect(h.fillType).toBe('user-defined');
    expect(h.patternType).toBe('pattern');
    expect(h.lineAngle).toBe(30);
    expect(h.lineSpacing).toBe(150);
    expect(h.doubleCrossHatch).toBe(true);
  });

  it('builds a gradient hatch carrying the gradient object from defaults (ADR-507 Φ5)', () => {
    setHatchDrawDefaults({
      fillType: 'gradient',
      gradientType: 'spherical',
      gradientColor1: '#2980b9',
      gradientColor2: '#c0392b',
      gradientAngle: 45,
    });
    const h = buildHatchEntityFromBoundary(SQUARE, 'e3', 'lyr')!;
    expect(h.fillType).toBe('gradient');
    expect(h.patternType).toBe('gradient');
    expect(h.gradient).toEqual({
      type: 'spherical',
      color1: '#2980b9',
      color2: '#c0392b',
      angleDeg: 45,
      singleColor: undefined,
    });
    // gradient → όχι double-hatch, όχι predefined pattern.
    expect(h.doubleCrossHatch).toBeUndefined();
    expect(h.patternName).toBeUndefined();
  });

  it('omits gradient for non-gradient fill types', () => {
    setHatchDrawDefaults({ fillType: 'solid' });
    const h = buildHatchEntityFromBoundary(SQUARE, 'e4', 'lyr')!;
    expect(h.gradient).toBeUndefined();
  });
});

describe('buildHatchEntityFromRegion (ADR-507 Φ3 — pick-point)', () => {
  beforeEach(() => resetHatchDrawDefaults());

  const HOLE: Point2D[] = [
    { x: 250, y: 250 },
    { x: 750, y: 250 },
    { x: 750, y: 750 },
    { x: 250, y: 750 },
  ];

  it('returns null when the outer ring is below the minimum points', () => {
    expect(buildHatchEntityFromRegion(SQUARE.slice(0, 2), [], 'e1', 'lyr')).toBeNull();
  });

  it('builds a single-ring hatch when there are no holes', () => {
    const h = buildHatchEntityFromRegion(SQUARE, [], 'e1', 'lyr')!;
    expect(h.type).toBe('hatch');
    expect(h.boundaryPaths).toHaveLength(1);
    expect(h.boundaryPaths[0]).toHaveLength(4);
  });

  it('keeps islands as inner rings (outer + holes)', () => {
    const h = buildHatchEntityFromRegion(SQUARE, [HOLE], 'e2', 'lyr')!;
    expect(h.boundaryPaths).toHaveLength(2);
    expect(computeHatchAreaMm2(h)).toBe(1_000_000 - 250_000);
  });

  it('drops degenerate rings (<3 vertices) — outer survives, bad hole removed', () => {
    const h = buildHatchEntityFromRegion(SQUARE, [HOLE.slice(0, 2)], 'e3', 'lyr')!;
    expect(h.boundaryPaths).toHaveLength(1);
  });

  it('clones the input points (no aliasing of caller arrays)', () => {
    const outer = SQUARE.map((p) => ({ ...p }));
    const h = buildHatchEntityFromRegion(outer, [], 'e4', 'lyr')!;
    expect(h.boundaryPaths[0][0]).not.toBe(outer[0]);
    expect(h.boundaryPaths[0][0]).toEqual(outer[0]);
  });

  it('persists gapTolerance only when > 0', () => {
    expect(buildHatchEntityFromRegion(SQUARE, [], 'e5', 'lyr')!.gapTolerance).toBeUndefined();
    setHatchDrawDefaults({ gapTolerance: 3 });
    expect(buildHatchEntityFromRegion(SQUARE, [], 'e6', 'lyr')!.gapTolerance).toBe(3);
  });
});

describe('computeHatchAreaMm2', () => {
  it('computes the outer polygon area', () => {
    expect(computeHatchAreaMm2({ boundaryPaths: [SQUARE] })).toBe(1_000_000);
  });

  it('subtracts island holes', () => {
    const hole: Point2D[] = [
      { x: 250, y: 250 },
      { x: 750, y: 250 },
      { x: 750, y: 750 },
      { x: 250, y: 750 },
    ];
    expect(computeHatchAreaMm2({ boundaryPaths: [SQUARE, hole] })).toBe(1_000_000 - 250_000);
  });

  it('returns 0 for empty boundary', () => {
    expect(computeHatchAreaMm2({ boundaryPaths: [] })).toBe(0);
  });
});

describe('buildHatchPostCreateCommands', () => {
  it('returns a single send-to-back reorder command', () => {
    const fakeSm = {} as never;
    const cmds = buildHatchPostCreateCommands('e1', fakeSm);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].name).toBe('ReorderEntity');
  });
});
