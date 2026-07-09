/**
 * ADR-608 — buildScaleBarPrimitives (frame-space layout SSoT) unit tests.
 *
 * Verifies the pure builder emits the right frame primitives per body style,
 * folds annotative sizes through the drawing scale, and always emits the boundary
 * numerals + trailing unit label. Coordinate-system-agnostic — asserts on the
 * frame `(s, t)` values directly (no canvas / world mapping).
 */

import type { ScaleBarEntity, ScaleBarStyle } from '../../../types/scale-bar';
import {
  buildScaleBarPrimitives,
  type ScaleBarFramePrimitive,
} from '../scale-bar-primitives';

function makeBar(overrides: Partial<ScaleBarEntity> = {}): ScaleBarEntity {
  return {
    id: 'sb_test',
    type: 'scale-bar',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    length: 10,
    unit: 'm',
    divisions: 4,
    subdivisions: 0,
    style: 'alternating',
    barHeightMm: 4,
    labelHeightMm: 2.5,
    labelPlacement: 'below',
    ...overrides,
  };
}

const kinds = (prims: readonly ScaleBarFramePrimitive[], kind: ScaleBarFramePrimitive['kind']) =>
  prims.filter((p) => p.kind === kind);

describe('buildScaleBarPrimitives — body styles', () => {
  it('alternating → one cell per division, even cells filled', () => {
    const prims = buildScaleBarPrimitives(makeBar({ style: 'alternating' }), 100, 'mm');
    const cells = kinds(prims, 'cell');
    expect(cells).toHaveLength(4); // divisions = 4
    const filled = cells.filter((c) => c.kind === 'cell' && c.filled);
    expect(filled).toHaveLength(2); // cells 0 and 2
  });

  it('hollow → cells present, none filled', () => {
    const prims = buildScaleBarPrimitives(makeBar({ style: 'hollow' }), 100, 'mm');
    const cells = kinds(prims, 'cell');
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.kind === 'cell' && !c.filled)).toBe(true);
  });

  it('line-ticks → baseline segment + one tick per boundary, no cells', () => {
    const prims = buildScaleBarPrimitives(makeBar({ style: 'line-ticks' }), 100, 'mm');
    expect(kinds(prims, 'cell')).toHaveLength(0);
    // 1 baseline + 5 boundary ticks (divisions + 1).
    expect(kinds(prims, 'segment')).toHaveLength(6);
  });

  it('double → two half-height cells per division interval', () => {
    const prims = buildScaleBarPrimitives(makeBar({ style: 'double' }), 100, 'mm');
    expect(kinds(prims, 'cell')).toHaveLength(8); // 4 intervals × 2 rows
  });

  it.each<ScaleBarStyle>(['alternating', 'hollow', 'line-ticks', 'double'])(
    'style=%s → 5 boundary numerals + 1 unit label',
    (style) => {
      const prims = buildScaleBarPrimitives(makeBar({ style }), 100, 'mm');
      const labels = kinds(prims, 'label');
      expect(labels).toHaveLength(6); // 5 boundaries + trailing unit
      const centred = labels.filter((l) => l.kind === 'label' && l.align === 'center');
      const left = labels.filter((l) => l.kind === 'label' && l.align === 'left');
      expect(centred).toHaveLength(5);
      expect(left).toHaveLength(1); // the unit label
    },
  );
});

describe('buildScaleBarPrimitives — subdivisions + annotative sizing', () => {
  it('subdivisions add fine cells left of the origin (negative s)', () => {
    const prims = buildScaleBarPrimitives(makeBar({ subdivisions: 2 }), 100, 'mm');
    const subCells = kinds(prims, 'cell').filter(
      (c) => c.kind === 'cell' && c.corners.some((pt) => pt.s < 0),
    );
    expect(subCells).toHaveLength(2);
  });

  it('cell thickness folds through the drawing scale (annotative)', () => {
    const at100 = buildScaleBarPrimitives(makeBar(), 100, 'mm');
    const at50 = buildScaleBarPrimitives(makeBar(), 50, 'mm');
    const topT = (prims: readonly ScaleBarFramePrimitive[]) => {
      const cell = prims.find((p) => p.kind === 'cell');
      if (cell?.kind !== 'cell') throw new Error('no cell');
      return Math.max(...cell.corners.map((c) => c.t));
    };
    // barHeightMm 4 → model thickness = 4 × scale (mm). 1:100 = 400, 1:50 = 200.
    expect(topT(at100)).toBeCloseTo(400);
    expect(topT(at50)).toBeCloseTo(200);
  });

  it('numeral text = formatted real-world values (0 … 10)', () => {
    const prims = buildScaleBarPrimitives(makeBar(), 100, 'mm');
    const texts = prims
      .filter((p): p is Extract<ScaleBarFramePrimitive, { kind: 'label' }> => p.kind === 'label')
      .map((l) => l.text);
    // Numerals come straight from `computeScaleBarGeometry` (length-format SSoT) —
    // assert the boundary magnitudes are present (locale-separator agnostic) + unit.
    expect(texts.some((t) => Number(t.replace(/\D/g, '')) === 0)).toBe(true);
    expect(texts.some((t) => Number(t.replace(/\D/g, '')) === 10000)).toBe(true);
    expect(texts).toContain('m'); // trailing unit
  });
});
