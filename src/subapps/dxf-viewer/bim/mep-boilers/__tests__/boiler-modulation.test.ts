/**
 * ADR-408 Εύρος Β #2 — Boiler modulation / turndown ratio SSoT unit tests.
 *
 * Pins the pure `resolveTurndownRatio`: a genuine modulating range (min < max, both
 * positive) yields `max / min` rounded to one decimal; everything else — equal/inverted
 * outputs, non-positive values, or an absent minimum (on/off appliance) — yields `null`.
 */

import { resolveTurndownRatio } from '../boiler-modulation';

describe('resolveTurndownRatio — valid modulating range', () => {
  it('24 kW down to 6 kW → 4 (4:1)', () => {
    expect(resolveTurndownRatio(6000, 24000)).toBe(4);
  });
  it('rounds a fractional ratio to one decimal (24 kW / 7 kW → 3.4)', () => {
    expect(resolveTurndownRatio(7000, 24000)).toBe(3.4);
  });
  it('35 kW down to 9 kW → 3.9', () => {
    expect(resolveTurndownRatio(9000, 35000)).toBe(3.9);
  });
});

describe('resolveTurndownRatio — no turndown (null)', () => {
  it('equal min and max → null (no range)', () => {
    expect(resolveTurndownRatio(24000, 24000)).toBeNull();
  });
  it('min greater than max → null (inverted)', () => {
    expect(resolveTurndownRatio(30000, 24000)).toBeNull();
  });
  it('absent minimum (on/off appliance) → null', () => {
    expect(resolveTurndownRatio(undefined, 24000)).toBeNull();
  });
  it('absent maximum → null', () => {
    expect(resolveTurndownRatio(6000, undefined)).toBeNull();
  });
  it('both absent → null', () => {
    expect(resolveTurndownRatio(undefined, undefined)).toBeNull();
  });
  it('non-positive values → null', () => {
    expect(resolveTurndownRatio(0, 24000)).toBeNull();
    expect(resolveTurndownRatio(6000, 0)).toBeNull();
    expect(resolveTurndownRatio(-6000, 24000)).toBeNull();
  });
});
