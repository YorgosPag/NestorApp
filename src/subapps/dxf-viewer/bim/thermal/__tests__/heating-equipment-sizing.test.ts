/**
 * Tests για το heating-equipment-sizing.ts (ADR-422).
 * jest globals — ΟΧΙ vitest import.
 */

import {
  computeHeatingEquipmentSizing,
  DEFAULT_PICKUP_FACTOR,
  OVERSIZE_RATIO,
  type HeatingEquipmentSizingInput,
} from '../heating-equipment-sizing';

// ─── status: 'ok' ─────────────────────────────────────────────────────────────

describe('computeHeatingEquipmentSizing — status ok', () => {
  it('επιστρέφει ok όταν installedW === requiredWithMarginW (ακριβώς)', () => {
    const requiredLoadW = 10_000;
    const requiredWithMarginW = requiredLoadW * DEFAULT_PICKUP_FACTOR;
    const result = computeHeatingEquipmentSizing({
      requiredLoadW,
      installedW: requiredWithMarginW,
    });
    expect(result.status).toBe('ok');
    expect(result.ratio).toBeCloseTo(1.0, 5);
  });

  it('επιστρέφει ok σε τυπική εγκατάσταση: 12kW load, 14kW λέβητας', () => {
    // requiredWithMargin = 12000 × 1.15 = 13800 W
    // 14000 / 13800 ≈ 1.014 — μέσα στο [1, OVERSIZE_RATIO=1.5]
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 12_000,
      installedW: 14_000,
    });
    expect(result.status).toBe('ok');
    expect(result.requiredWithMarginW).toBeCloseTo(13_800, 1);
    expect(result.installedW).toBe(14_000);
    expect(result.ratio).toBeCloseTo(14_000 / 13_800, 4);
  });

  it('επιστρέφει ok ακριβώς στο όριο OVERSIZE_RATIO (δεν ξεπερνά)', () => {
    const requiredLoadW = 10_000;
    const margin = requiredLoadW * DEFAULT_PICKUP_FACTOR;
    // installedW = margin × OVERSIZE_RATIO → oversized threshold (exclusive), άρα ok
    const installedW = margin * OVERSIZE_RATIO;
    const result = computeHeatingEquipmentSizing({ requiredLoadW, installedW });
    // Ακριβώς στο threshold → ΟΧΙ oversized (strictly greater)
    expect(result.status).toBe('ok');
  });
});

// ─── status: 'undersized' ─────────────────────────────────────────────────────

describe('computeHeatingEquipmentSizing — status undersized', () => {
  it('επιστρέφει undersized όταν installedW < requiredWithMargin', () => {
    // requiredWithMargin = 10000 × 1.15 = 11500 W, installed = 10000 W
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 10_000,
      installedW: 10_000,
    });
    expect(result.status).toBe('undersized');
    expect(result.ratio).toBeLessThan(1);
  });

  it('επιστρέφει undersized για λέβητα 1W κάτω από το margin', () => {
    const requiredLoadW = 8_000;
    const requiredWithMarginW = requiredLoadW * DEFAULT_PICKUP_FACTOR; // 9200 W
    const result = computeHeatingEquipmentSizing({
      requiredLoadW,
      installedW: requiredWithMarginW - 1,
    });
    expect(result.status).toBe('undersized');
  });
});

// ─── status: 'oversized' ──────────────────────────────────────────────────────

describe('computeHeatingEquipmentSizing — status oversized', () => {
  it('επιστρέφει oversized όταν installedW > requiredWithMargin × OVERSIZE_RATIO', () => {
    // requiredWithMargin = 5000 × 1.15 = 5750 W
    // oversized threshold = 5750 × 1.5 = 8625 W
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 5_000,
      installedW: 20_000,
    });
    expect(result.status).toBe('oversized');
    expect(result.ratio).toBeGreaterThan(OVERSIZE_RATIO);
  });

  it('επιστρέφει oversized ακριβώς 1W πάνω από το threshold', () => {
    const requiredLoadW = 6_000;
    const margin = requiredLoadW * DEFAULT_PICKUP_FACTOR;
    const threshold = margin * OVERSIZE_RATIO;
    const result = computeHeatingEquipmentSizing({
      requiredLoadW,
      installedW: threshold + 1,
    });
    expect(result.status).toBe('oversized');
  });
});

// ─── status: 'unknown' ────────────────────────────────────────────────────────

describe('computeHeatingEquipmentSizing — status unknown', () => {
  it('επιστρέφει unknown όταν installedW = null', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 10_000,
      installedW: null,
    });
    expect(result.status).toBe('unknown');
    expect(result.ratio).toBeNull();
    expect(result.installedW).toBeNull();
  });

  it('επιστρέφει unknown όταν installedW = undefined', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 10_000,
      installedW: undefined,
    });
    expect(result.status).toBe('unknown');
    expect(result.ratio).toBeNull();
  });

  it('επιστρέφει unknown όταν requiredLoadW = 0', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 0,
      installedW: 10_000,
    });
    expect(result.status).toBe('unknown');
    expect(result.ratio).toBeNull();
  });

  it('επιστρέφει unknown όταν requiredLoadW < 0', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: -500,
      installedW: 10_000,
    });
    expect(result.status).toBe('unknown');
  });
});

// ─── requiredWithMarginW + pickup factor math ─────────────────────────────────

describe('computeHeatingEquipmentSizing — margin math', () => {
  it('υπολογίζει σωστά το requiredWithMarginW με default factor', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 20_000,
      installedW: 25_000,
    });
    // 20000 × 1.15 = 23000
    expect(result.requiredWithMarginW).toBeCloseTo(23_000, 1);
  });

  it('χρησιμοποιεί custom pickupFactor αν δοθεί', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 10_000,
      installedW: 14_000,
      pickupFactor: 1.2,
    });
    // 10000 × 1.2 = 12000
    expect(result.requiredWithMarginW).toBeCloseTo(12_000, 1);
  });

  it('clamps pickupFactor < 1 σε 1 (δεν εφαρμόζει αρνητικό margin)', () => {
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 10_000,
      installedW: 12_000,
      pickupFactor: 0.5,
    });
    // effective pickup = max(0.5, 1) = 1 → requiredWithMargin = 10000 W
    expect(result.requiredWithMarginW).toBeCloseTo(10_000, 1);
  });

  it('υπολογίζει σωστό ratio', () => {
    // requiredWithMargin = 8000 × 1.15 = 9200 W, installed = 11000 W
    // ratio = 11000 / 9200 ≈ 1.1956...
    const result = computeHeatingEquipmentSizing({
      requiredLoadW: 8_000,
      installedW: 11_000,
    });
    expect(result.ratio).toBeCloseTo(11_000 / (8_000 * DEFAULT_PICKUP_FACTOR), 4);
  });

  it('installedW στο αποτέλεσμα αντικατοπτρίζει ακριβώς την είσοδο', () => {
    const input: HeatingEquipmentSizingInput = { requiredLoadW: 5_000, installedW: 7_500 };
    const result = computeHeatingEquipmentSizing(input);
    expect(result.installedW).toBe(7_500);
  });
});
