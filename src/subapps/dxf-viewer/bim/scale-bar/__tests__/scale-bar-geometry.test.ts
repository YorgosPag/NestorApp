/**
 * ADR-583 Φ2 — Scale-bar geometry + length-snap unit tests.
 *
 * Locks the ONE correctness rule (the two-formula split): the bar SPAN is a real
 * model distance and therefore drawingScale-INVARIANT, while annotative sizing
 * (thickness / labels via `paperHeightToModel`) changes with the scale. Plus the
 * 1-2-5 length quantizer and the equal-division boundary math.
 */

import { computeScaleBarGeometry } from '../../geometry/scale-bar-geometry';
import { snapScaleBarLength } from '../scale-bar-length-snap';
import { buildScaleBarEntity } from '../build-scale-bar-entity';
import { paperHeightToModel } from '../../../utils/annotation-scale';
import { realDistanceToModelMm } from '../../../utils/scene-units';
import type { ScaleBarEntity } from '../../../types/scale-bar';

function makeBar(overrides: Partial<ScaleBarEntity> = {}): ScaleBarEntity {
  return {
    id: 'sb-test',
    type: 'scale-bar',
    layerId: 'lyr-test',
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

describe('ADR-583 Φ2 — scale-bar geometry', () => {
  describe('(a) span is drawingScale-INVARIANT while ticks/labels are annotative', () => {
    it('yields the SAME totalModelLengthMm at 1:50 and 1:100', () => {
      const bar = makeBar({ length: 10, unit: 'm' });
      const at50 = computeScaleBarGeometry(bar, 50, 'm');
      const at100 = computeScaleBarGeometry(bar, 100, 'm');

      // 10 m → 10000 canonical-mm, regardless of plot scale.
      expect(at50.totalModelLengthMm).toBe(10000);
      expect(at100.totalModelLengthMm).toBe(at50.totalModelLengthMm);
      expect(at100.endPosition).toEqual(at50.endPosition);
    });

    it('annotative thickness/label height DO change with the drawing scale', () => {
      const bar = makeBar();
      // Thickness/labels are the renderer-time annotative concern — they scale.
      const thick50 = paperHeightToModel(bar.barHeightMm, 50, 'm');
      const thick100 = paperHeightToModel(bar.barHeightMm, 100, 'm');
      const label50 = paperHeightToModel(bar.labelHeightMm, 50, 'm');
      const label100 = paperHeightToModel(bar.labelHeightMm, 100, 'm');

      expect(thick100).toBeCloseTo(thick50 * 2, 10);
      expect(label100).toBeCloseTo(label50 * 2, 10);
      // The span (from geometry) is unchanged across the same two scales.
      expect(computeScaleBarGeometry(bar, 50, 'm').totalModelLengthMm)
        .toBe(computeScaleBarGeometry(bar, 100, 'm').totalModelLengthMm);
    });

    it('span span-factor matches realDistanceToModelMm for non-metre units', () => {
      const bar = makeBar({ length: 20, unit: 'ft' });
      const geom = computeScaleBarGeometry(bar, 100, 'm');
      // 20 ft × 304.8 mm/ft = 6096 mm.
      expect(geom.totalModelLengthMm).toBeCloseTo(realDistanceToModelMm(20, 'ft'), 9);
      expect(geom.totalModelLengthMm).toBeCloseTo(6096, 6);
    });
  });

  describe('(b) snapScaleBarLength picks 1-2-5 nice numbers', () => {
    it.each<[number, number]>([
      [9.37, 10],
      [1.3, 1],
      [1.5, 2],
      [4, 5],
      [23, 20],
      [0.12, 0.1],
      [7.2, 10],
      [3.1, 2],
      [3.3, 5],
    ])('snaps %f → %f', (raw, expected) => {
      expect(snapScaleBarLength(raw)).toBeCloseTo(expected, 9);
    });

    it('returns 0 for degenerate input', () => {
      expect(snapScaleBarLength(0)).toBe(0);
      expect(snapScaleBarLength(-5)).toBe(0);
      expect(snapScaleBarLength(Number.NaN)).toBe(0);
    });
  });

  describe('(c) division + subdivision boundaries', () => {
    it('places N+1 equal major boundaries across the span', () => {
      const geom = computeScaleBarGeometry(makeBar({ length: 10, divisions: 4 }), 100, 'm');
      expect(geom.divisionBoundariesMm).toEqual([0, 2500, 5000, 7500, 10000]);
      expect(geom.extensionModelLengthMm).toBe(2500); // one major division
      expect(geom.boundaryLabels).toHaveLength(5);
      expect(geom.boundaryLabels[0].offsetMm).toBe(0);
      expect(geom.boundaryLabels[4].offsetMm).toBe(10000);
    });

    it('emits fine sub-tick offsets only when subdivisions > 0', () => {
      const none = computeScaleBarGeometry(makeBar({ subdivisions: 0 }), 100, 'm');
      expect(none.subdivisionOffsetsMm).toEqual([]);

      const two = computeScaleBarGeometry(
        makeBar({ length: 10, divisions: 4, subdivisions: 2 }),
        100,
        'm',
      );
      // extension = 2500 mm, 2 sub-ticks → [1250, 2500] left of the '0' tick.
      expect(two.subdivisionOffsetsMm).toEqual([1250, 2500]);
    });

    it('includes the left extension in the bbox only when subdivided', () => {
      const none = computeScaleBarGeometry(makeBar({ subdivisions: 0 }), 100, 'm');
      expect(none.bbox.minX).toBe(0);

      const sub = computeScaleBarGeometry(
        makeBar({ length: 10, divisions: 4, subdivisions: 2 }),
        100,
        'm',
      );
      expect(sub.bbox.minX).toBe(-2500);
      expect(sub.bbox.maxX).toBe(10000);
    });
  });

  describe('buildScaleBarEntity — two-click construction + snap', () => {
    it('derives angle 0 and snaps a 9.37 m drag to 10 m', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 9370, y: 0 }, // 9370 mm along +x → 9.37 m
        { layerId: 'lyr-1', unit: 'm' },
      );
      expect(bar.type).toBe('scale-bar');
      expect(bar.angleRad).toBeCloseTo(0, 9);
      expect(bar.length).toBe(10);
      expect(bar.position).toEqual({ x: 0, y: 0 });
      expect(bar.unit).toBe('m');
    });

    it('captures the axis angle from the drag vector', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 0, y: 5000 }, // straight up
        { layerId: 'lyr-1', unit: 'm' },
      );
      expect(bar.angleRad).toBeCloseTo(Math.PI / 2, 9);
      expect(bar.length).toBe(5);
    });
  });
});
