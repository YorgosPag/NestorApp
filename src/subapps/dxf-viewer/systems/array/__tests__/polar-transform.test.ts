import { computePolarTransforms } from '../polar-transform';
import type { PolarParams, SourceBbox } from '../types';

function makeParams(overrides: Partial<PolarParams> = {}): PolarParams {
  return {
    kind: 'polar',
    count: 6,
    fillAngle: 360,
    startAngle: 0,
    rotateItems: false,
    center: { x: 0, y: 0 },
    radius: 10,
    ...overrides,
  };
}

function makeBbox(cx = 10, cy = 0): SourceBbox {
  return { minX: cx - 2, minY: cy - 2, maxX: cx + 2, maxY: cy + 2, width: 4, height: 4, center: { x: cx, y: cy } };
}

const DEG = Math.PI / 180;

describe('computePolarTransforms', () => {
  it('returns count items', () => {
    const result = computePolarTransforms(makeParams({ count: 6 }), makeBbox());
    expect(result).toHaveLength(6);
  });

  it('count=0 returns empty array', () => {
    expect(computePolarTransforms(makeParams({ count: 0 }), makeBbox())).toHaveLength(0);
  });

  it('count=1 returns single item at startAngle', () => {
    const result = computePolarTransforms(makeParams({ count: 1, fillAngle: 180, radius: 10, center: { x: 0, y: 0 } }), makeBbox(0, 0));
    expect(result).toHaveLength(1);
    // Single item: no divisor ambiguity, item stays at startAngle (0°)
    expect(result[0].translateX).toBeCloseTo(10 - 0);
    expect(result[0].translateY).toBeCloseTo(0);
  });

  it('360°/N: 6 items evenly spaced, no duplicate at end', () => {
    // center=(0,0), radius=10 → first item at 0°=(10,0), last at 5*60°=300°
    const result = computePolarTransforms(makeParams({ count: 6, fillAngle: 360, radius: 10, center: { x: 0, y: 0 } }), makeBbox(10, 0));
    expect(result).toHaveLength(6);
    // item[0] = identity (0° → pos=(10,0), source at (10,0))
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[0].translateY).toBeCloseTo(0);
    // item[1] at 60°
    expect(result[1].translateX).toBeCloseTo(10 * Math.cos(60 * DEG) - 10);
    expect(result[1].translateY).toBeCloseTo(10 * Math.sin(60 * DEG));
    // item[5] at 300° — NOT at 360° (no duplicate)
    expect(result[5].translateX).toBeCloseTo(10 * Math.cos(300 * DEG) - 10);
    expect(result[5].translateY).toBeCloseTo(10 * Math.sin(300 * DEG));
  });

  it('partial arc 180°/(N-1): 5 items, last item at 180°', () => {
    // angleStep = 180/4 = 45°, items at 0°,45°,90°,135°,180°
    const result = computePolarTransforms(makeParams({ count: 5, fillAngle: 180, radius: 10, center: { x: 0, y: 0 } }), makeBbox(10, 0));
    expect(result).toHaveLength(5);
    // Last item (i=4) at 4*45=180°
    expect(result[4].translateX).toBeCloseTo(10 * Math.cos(180 * DEG) - 10);
    expect(result[4].translateY).toBeCloseTo(10 * Math.sin(180 * DEG), 10);
  });

  it('negative fillAngle → clockwise traversal', () => {
    // -90°/(4-1) = -30° step → items go CW
    const result = computePolarTransforms(makeParams({ count: 4, fillAngle: -90, radius: 10, center: { x: 0, y: 0 } }), makeBbox(10, 0));
    expect(result).toHaveLength(4);
    // item[1] at -30° (CW from 0°)
    expect(result[1].translateX).toBeCloseTo(10 * Math.cos(-30 * DEG) - 10);
    expect(result[1].translateY).toBeCloseTo(10 * Math.sin(-30 * DEG));
  });

  it('rotateItems=false → all rotateDeg=0', () => {
    const result = computePolarTransforms(makeParams({ count: 6, fillAngle: 360, rotateItems: false, radius: 10 }), makeBbox(10, 0));
    for (const t of result) {
      expect(t.rotateDeg).toBe(0);
    }
  });

  it('rotateItems=true → rotateDeg increases by angleStep', () => {
    // 4 items / 360° → angleStep=90°
    const result = computePolarTransforms(makeParams({ count: 4, fillAngle: 360, rotateItems: true, radius: 10 }), makeBbox(10, 0));
    expect(result[0].rotateDeg).toBeCloseTo(0);
    expect(result[1].rotateDeg).toBeCloseTo(90);
    expect(result[2].rotateDeg).toBeCloseTo(180);
    expect(result[3].rotateDeg).toBeCloseTo(270);
  });

  it('explicit radius overrides zero', () => {
    // source bbox center same as polar center → auto radius=0; explicit=20 should win
    const result = computePolarTransforms(makeParams({ count: 4, fillAngle: 360, radius: 20, center: { x: 0, y: 0 } }), makeBbox(0, 0));
    // item[0] at 0° with radius=20: pos=(20,0), source=(0,0) → tx=20
    expect(result[0].translateX).toBeCloseTo(20);
    expect(result[0].translateY).toBeCloseTo(0);
  });

  it('radius=0 auto-derived from source center to polar center', () => {
    // source bbox center=(5,0), polar center=(0,0) → auto radius=5
    const result = computePolarTransforms(makeParams({ count: 4, fillAngle: 360, radius: 0, center: { x: 0, y: 0 } }), makeBbox(5, 0));
    // item[0] at 0° with auto radius=5: pos=(5,0), source=(5,0) → tx=0
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[0].translateY).toBeCloseTo(0);
    // item[1] at 90°: pos=(0,5), source=(5,0) → tx=-5, ty=5
    expect(result[1].translateX).toBeCloseTo(-5);
    expect(result[1].translateY).toBeCloseTo(5);
  });

  it('startAngle offset shifts all items', () => {
    // startAngle=90°, 4 items/360° → first item at 90°
    const result = computePolarTransforms(makeParams({ count: 4, fillAngle: 360, startAngle: 90, radius: 10, center: { x: 0, y: 0 } }), makeBbox(0, 10));
    // Source at (0,10)=90°. item[0] at 90°: pos=(0,10) → tx=0, ty=0
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[0].translateY).toBeCloseTo(0);
    // item[1] at 90+90=180°: pos=(-10,0) → tx=-10, ty=-10
    expect(result[1].translateX).toBeCloseTo(-10);
    expect(result[1].translateY).toBeCloseTo(-10);
  });
});
