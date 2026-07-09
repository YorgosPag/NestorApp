/**
 * ADR-583 Φ2.5 — `buildScaleBarEntity` / `deriveScaleBarAxis` focused unit tests.
 *
 * Complements the two-click smoke tests already in `scale-bar-geometry.test.ts`
 * (horizontal snap + straight-up angle) with the cases NOT covered there:
 * diagonal / negative-direction angles, unit pass-through for non-metric units,
 * option defaulting, id-override, and full opts pass-through.
 */

import { buildScaleBarEntity, deriveScaleBarAxis } from '../build-scale-bar-entity';
import {
  DEFAULT_SCALE_BAR_DIVISIONS,
  DEFAULT_SCALE_BAR_SUBDIVISIONS,
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
  DEFAULT_SCALE_BAR_UNIT,
  DEFAULT_SCALE_BAR_STYLE,
  DEFAULT_SCALE_BAR_LABEL_PLACEMENT,
} from '../../../types/scale-bar';

describe('ADR-583 Φ2.5 — buildScaleBarEntity / deriveScaleBarAxis', () => {
  describe('angle derivation across quadrants', () => {
    it('derives a 45° diagonal angle for an equal dx/dy drag', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 7071, y: 7071 }, // ~10000mm hypotenuse at 45°
        { layerId: 'lyr-1', unit: 'm' },
      );
      expect(bar.angleRad).toBeCloseTo(Math.PI / 4, 3);
    });

    it('derives a negative-direction angle (drag to the left)', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: -5000, y: 0 },
        { layerId: 'lyr-1', unit: 'm' },
      );
      expect(bar.angleRad).toBeCloseTo(Math.PI, 9);
      expect(bar.length).toBe(5);
    });

    it('derives a downward angle (negative atan2 quadrant)', () => {
      const { angleRad } = deriveScaleBarAxis({ x: 0, y: 0 }, { x: 0, y: -3000 }, 'm');
      expect(angleRad).toBeCloseTo(-Math.PI / 2, 9);
    });
  });

  describe('non-metric unit pass-through', () => {
    it('snaps a feet-unit drag using the same 1-2-5 quantizer', () => {
      // 1 ft = 304.8mm → a 3048mm drag = exactly 10 ft, no snapping needed.
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 3048, y: 0 },
        { layerId: 'lyr-1', unit: 'ft' },
      );
      expect(bar.unit).toBe('ft');
      expect(bar.length).toBe(10);
    });
  });

  describe('option defaulting', () => {
    it('falls back to every DEFAULT_SCALE_BAR_* constant when opts omit them', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { layerId: 'lyr-1' },
      );
      expect(bar.unit).toBe(DEFAULT_SCALE_BAR_UNIT);
      expect(bar.divisions).toBe(DEFAULT_SCALE_BAR_DIVISIONS);
      expect(bar.subdivisions).toBe(DEFAULT_SCALE_BAR_SUBDIVISIONS);
      expect(bar.style).toBe(DEFAULT_SCALE_BAR_STYLE);
      expect(bar.barHeightMm).toBe(DEFAULT_SCALE_BAR_HEIGHT_MM);
      expect(bar.labelHeightMm).toBe(DEFAULT_SCALE_BAR_LABEL_MM);
      expect(bar.labelPlacement).toBe(DEFAULT_SCALE_BAR_LABEL_PLACEMENT);
    });
  });

  describe('opts pass-through + id handling', () => {
    it('threads every explicit opt onto the built entity', () => {
      const bar = buildScaleBarEntity(
        { x: 100, y: 200 },
        { x: 1100, y: 200 },
        {
          layerId: 'lyr-custom',
          unit: 'cm',
          divisions: 5,
          subdivisions: 3,
          style: 'double',
          barHeightMm: 6,
          labelHeightMm: 3,
          labelPlacement: 'above',
          name: 'My Scale Bar',
        },
      );
      expect(bar.layerId).toBe('lyr-custom');
      expect(bar.unit).toBe('cm');
      expect(bar.divisions).toBe(5);
      expect(bar.subdivisions).toBe(3);
      expect(bar.style).toBe('double');
      expect(bar.barHeightMm).toBe(6);
      expect(bar.labelHeightMm).toBe(3);
      expect(bar.labelPlacement).toBe('above');
      expect(bar.name).toBe('My Scale Bar');
      expect(bar.position).toEqual({ x: 100, y: 200 });
    });

    it('uses opts.id verbatim instead of minting a fresh enterprise id', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { layerId: 'lyr-1', id: 'sb_fixed_test_id' },
      );
      expect(bar.id).toBe('sb_fixed_test_id');
    });

    it('mints a non-empty generated id when opts.id is omitted', () => {
      const bar = buildScaleBarEntity(
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { layerId: 'lyr-1' },
      );
      expect(typeof bar.id).toBe('string');
      expect(bar.id.length).toBeGreaterThan(0);
    });
  });
});
