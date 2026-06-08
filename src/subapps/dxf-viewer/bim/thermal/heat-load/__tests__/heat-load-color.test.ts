/**
 * ADR-422 L1 — tests για τη χρωματική κλίμακα heat-map (heat-load-color).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 */

import {
  heatLoadFillColor,
  normalizeHeatLoad,
  HEAT_LOAD_FILL_ALPHA,
} from '../heat-load-color';

describe('normalizeHeatLoad', () => {
  it('min → 0, max → 1, midpoint → 0.5', () => {
    expect(normalizeHeatLoad(0, 0, 100)).toBe(0);
    expect(normalizeHeatLoad(100, 0, 100)).toBe(1);
    expect(normalizeHeatLoad(50, 0, 100)).toBe(0.5);
  });

  it('degenerate εύρος (min==max) → 0.5 (όχι NaN)', () => {
    expect(normalizeHeatLoad(42, 42, 42)).toBe(0.5);
    expect(normalizeHeatLoad(42, 50, 10)).toBe(0.5); // max ≤ min
  });

  it('clamp εκτός ορίων', () => {
    expect(normalizeHeatLoad(-10, 0, 100)).toBe(0);
    expect(normalizeHeatLoad(200, 0, 100)).toBe(1);
  });
});

describe('heatLoadFillColor', () => {
  it('min → μπλε, max → κόκκινο', () => {
    expect(heatLoadFillColor(0, 0, 100)).toBe(`rgba(37, 99, 235, ${HEAT_LOAD_FILL_ALPHA})`);
    expect(heatLoadFillColor(100, 0, 100)).toBe(`rgba(220, 38, 38, ${HEAT_LOAD_FILL_ALPHA})`);
  });

  it('midpoint → ενδιάμεσο (παρεμβολή μπλε↔κόκκινο)', () => {
    expect(heatLoadFillColor(50, 0, 100)).toBe(`rgba(129, 69, 137, ${HEAT_LOAD_FILL_ALPHA})`);
  });

  it('custom alpha', () => {
    expect(heatLoadFillColor(0, 0, 100, 0.5)).toBe('rgba(37, 99, 235, 0.5)');
  });
});
