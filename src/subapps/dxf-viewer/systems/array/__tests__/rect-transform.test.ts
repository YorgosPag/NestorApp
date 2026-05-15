import { computeRectTransforms } from '../rect-transform';
import type { RectParams, SourceBbox } from '../types';

function makeParams(overrides: Partial<RectParams> = {}): RectParams {
  return {
    kind: 'rect',
    rows: 3,
    cols: 4,
    rowSpacing: 10,
    colSpacing: 10,
    angle: 0,
    ...overrides,
  };
}

function makeBbox(cx = 0, cy = 0): SourceBbox {
  return { minX: cx - 5, minY: cy - 5, maxX: cx + 5, maxY: cy + 5, width: 10, height: 10, center: { x: cx, y: cy } };
}

describe('computeRectTransforms', () => {
  it('returns rows×cols items', () => {
    const result = computeRectTransforms(makeParams(), makeBbox());
    expect(result).toHaveLength(12);
  });

  it('item[0] = identity (zero translation)', () => {
    const result = computeRectTransforms(makeParams(), makeBbox(5, 5));
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[0].translateY).toBeCloseTo(0);
    expect(result[0].rotateDeg).toBe(0);
  });

  it('count=1 (1×1) returns single identity transform', () => {
    const result = computeRectTransforms(makeParams({ rows: 1, cols: 1 }), makeBbox());
    expect(result).toHaveLength(1);
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[0].translateY).toBeCloseTo(0);
  });

  it('3×4 default spacing: item[1] = (colSpacing,0)', () => {
    const result = computeRectTransforms(makeParams({ colSpacing: 15, rowSpacing: 20, angle: 0 }), makeBbox());
    // row=0, col=1 → index 1
    expect(result[1].translateX).toBeCloseTo(15);
    expect(result[1].translateY).toBeCloseTo(0);
  });

  it('row offset: item[cols] = (0, rowSpacing)', () => {
    const result = computeRectTransforms(makeParams({ rows: 2, cols: 3, colSpacing: 10, rowSpacing: 20, angle: 0 }), makeBbox());
    // row=1, col=0 → index cols = 3
    expect(result[3].translateX).toBeCloseTo(0);
    expect(result[3].translateY).toBeCloseTo(20);
  });

  it('negative colSpacing inverts column direction', () => {
    const result = computeRectTransforms(makeParams({ rows: 1, cols: 3, colSpacing: -10, angle: 0 }), makeBbox());
    expect(result[1].translateX).toBeCloseTo(-10);
    expect(result[2].translateX).toBeCloseTo(-20);
  });

  it('negative rowSpacing inverts row direction', () => {
    const result = computeRectTransforms(makeParams({ rows: 3, cols: 1, rowSpacing: -15, angle: 0 }), makeBbox());
    expect(result[1].translateY).toBeCloseTo(-15);
    expect(result[2].translateY).toBeCloseTo(-30);
  });

  it('45° angle: columns move along diagonal', () => {
    const result = computeRectTransforms(makeParams({ rows: 1, cols: 2, colSpacing: 10, angle: 45 }), makeBbox());
    const sqrt2Over2 = Math.sqrt(2) / 2;
    expect(result[1].translateX).toBeCloseTo(10 * sqrt2Over2);
    expect(result[1].translateY).toBeCloseTo(10 * sqrt2Over2);
  });

  it('90° angle: columns become vertical', () => {
    const result = computeRectTransforms(makeParams({ rows: 1, cols: 2, colSpacing: 10, angle: 90 }), makeBbox());
    expect(result[1].translateX).toBeCloseTo(0, 10);
    expect(result[1].translateY).toBeCloseTo(10);
  });

  it('rotateDeg is always 0 for rect arrays', () => {
    const result = computeRectTransforms(makeParams(), makeBbox());
    result.forEach(t => expect(t.rotateDeg).toBe(0));
  });

  it('row-major order: index = row * cols + col', () => {
    const rows = 2, cols = 3, spacing = 10;
    const result = computeRectTransforms(makeParams({ rows, cols, colSpacing: spacing, rowSpacing: spacing, angle: 0 }), makeBbox());
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        expect(result[idx].translateX).toBeCloseTo(c * spacing);
        expect(result[idx].translateY).toBeCloseTo(r * spacing);
      }
    }
  });
});
