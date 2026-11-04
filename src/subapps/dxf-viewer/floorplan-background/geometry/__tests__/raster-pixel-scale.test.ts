/**
 * ADR-929 Δ4 — μία απάντηση για «μέτρα ανά pixel», με την πηγή της, από δύο αποθηκευμένα πεδία.
 */

import { describe, it, expect } from '@jest/globals';
import { resolveRasterPixelScale, type RasterScaleInput } from '../raster-pixel-scale';
import type { CalibrationData } from '../../providers/types';

const CALIBRATION: CalibrationData = {
  method: 'two-point',
  pointA: { x: 0, y: 0 },
  pointB: { x: 100, y: 0 },
  realDistance: 5,
  unit: 'm',
  rotationDerived: false,
  calibratedAt: 0,
  calibratedBy: '',
};

const base: RasterScaleInput = {
  providerId: 'image',
  naturalBounds: { width: 1000, height: 800 },
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  calibration: null,
};

describe('resolveRasterPixelScale', () => {
  it('βαθμονόμηση viewer: |scale| χιλιοστά σκηνής ανά pixel ⇒ μέτρα', () => {
    const r = resolveRasterPixelScale({
      ...base,
      calibration: CALIBRATION,
      transform: { ...base.transform, scaleX: 12.5, scaleY: 12.5 },
    });
    expect(r?.source).toBe('viewer-two-point-calibration');
    expect(r?.metresPerPixelX).toBeCloseTo(0.0125, 12);
    expect(r?.metresPerPixelY).toBeCloseTo(0.0125, 12);
  });

  it('η περιστροφή και η αναστροφή Y δεν αλλάζουν το μέγεθος του pixel', () => {
    const r = resolveRasterPixelScale({
      ...base,
      calibration: CALIBRATION,
      transform: { translateX: 900, translateY: -40, scaleX: 10, scaleY: 10, rotation: 37 },
    });
    expect(r?.metresPerPixelX).toBeCloseTo(0.01, 12);
    expect(r?.metresPerPixelY).toBeCloseTo(0.01, 12);
  });

  it('η βαθμονόμηση του viewer ΚΕΡΔΙΖΕΙ την κλίμακα της συλλογής (Δ4: η υπάρχουσα τοποθέτηση)', () => {
    const r = resolveRasterPixelScale({
      ...base,
      calibration: CALIBRATION,
      transform: { ...base.transform, scaleX: 20, scaleY: 20 },
      scale: { unitsPerMeter: 40, sourceUnit: 'pixel' },
    });
    expect(r?.source).toBe('viewer-two-point-calibration');
  });

  it('κλίμακα συλλογής σε εικόνα: 1 / (pixel ανά μέτρο)', () => {
    const r = resolveRasterPixelScale({ ...base, scale: { unitsPerMeter: 40, sourceUnit: 'pixel' } });
    expect(r).toEqual({ metresPerPixelX: 0.025, metresPerPixelY: 0.025, source: 'gallery-scale' });
  });

  it('⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: κλίμακα συλλογής σε PDF ΔΕΝ γίνεται δεκτή (χώρος pixel ανεπιβεβαίωτος)', () => {
    const r = resolveRasterPixelScale({
      ...base,
      providerId: 'pdf-page',
      scale: { unitsPerMeter: 40, sourceUnit: 'pixel' },
    });
    expect(r).toBeNull();
  });

  it('κλίμακα σε μονάδες σχεδίου (mm) δεν είναι κλίμακα pixel', () => {
    expect(resolveRasterPixelScale({ ...base, scale: { unitsPerMeter: 1000, sourceUnit: 'mm' } })).toBeNull();
  });

  it('καμία πηγή ⇒ null, ποτέ υπόθεση «1 px = 1 mm»', () => {
    expect(resolveRasterPixelScale(base)).toBeNull();
  });

  it('εκφυλισμένη βαθμονόμηση (scale 0) ⇒ πέφτει στην επόμενη πηγή, όχι 0 μέτρα', () => {
    const r = resolveRasterPixelScale({
      ...base,
      calibration: CALIBRATION,
      transform: { ...base.transform, scaleX: 0, scaleY: 0 },
      scale: { unitsPerMeter: 50, sourceUnit: 'pixel' },
    });
    expect(r?.source).toBe('gallery-scale');
  });
});
