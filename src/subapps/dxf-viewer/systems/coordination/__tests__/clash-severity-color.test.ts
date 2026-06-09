/**
 * ADR-435 Slice 1b — clash-severity-color SSoT (Boy-Scout N.0.2).
 *
 * The single palette shared by the 2D overlay, the 3D markers and the DOM panel.
 */

import { CLASH_SEVERITY_COLOR, clashSeverityColorInt } from '../clash-severity-color';

describe('CLASH_SEVERITY_COLOR', () => {
  it('is the Navisworks triage palette (red / amber / yellow)', () => {
    expect(CLASH_SEVERITY_COLOR).toEqual({ high: '#dc2626', medium: '#f59e0b', low: '#eab308' });
  });
});

describe('clashSeverityColorInt', () => {
  it('converts each hex to its THREE colour int', () => {
    expect(clashSeverityColorInt('high')).toBe(0xdc2626);
    expect(clashSeverityColorInt('medium')).toBe(0xf59e0b);
    expect(clashSeverityColorInt('low')).toBe(0xeab308);
  });
});
