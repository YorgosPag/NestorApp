/**
 * ADR-401 Phase E.2 — Beam ribbon command-key registry guards.
 *
 * Verifies the `topElevationEnd` numeric command-key (sloped-beam end-level
 * input) is wired consistently into the registry so the contextual ribbon tab,
 * the bridge mapping (`NUMBER_KEY_TO_FIELD`) and the `useRibbonCommands`
 * composer (`isBeamRibbonKey`) all agree.
 */

import {
  BEAM_RIBBON_KEYS,
  BEAM_RIBBON_NUMBER_KEYS,
  isBeamRibbonKey,
  isBeamRibbonStringKey,
} from '../beam-command-keys';

describe('beam-command-keys — topElevationEnd (ADR-401 E.2)', () => {
  it('exposes a distinct topElevationEnd command key', () => {
    expect(BEAM_RIBBON_KEYS.params.topElevationEnd).toBe('beam.params.topElevationEnd');
    expect(BEAM_RIBBON_KEYS.params.topElevationEnd).not.toBe(
      BEAM_RIBBON_KEYS.params.topElevation,
    );
  });

  it('registers topElevationEnd as a numeric key', () => {
    expect(BEAM_RIBBON_NUMBER_KEYS).toContain(BEAM_RIBBON_KEYS.params.topElevationEnd);
    expect(isBeamRibbonKey(BEAM_RIBBON_KEYS.params.topElevationEnd)).toBe(true);
    expect(isBeamRibbonStringKey(BEAM_RIBBON_KEYS.params.topElevationEnd)).toBe(false);
  });

  it('keeps both elevation keys (start + end) as numeric inputs', () => {
    expect(isBeamRibbonKey(BEAM_RIBBON_KEYS.params.topElevation)).toBe(true);
    expect(isBeamRibbonKey(BEAM_RIBBON_KEYS.params.topElevationEnd)).toBe(true);
    // No accidental duplicates in the numeric registry.
    expect(new Set(BEAM_RIBBON_NUMBER_KEYS).size).toBe(BEAM_RIBBON_NUMBER_KEYS.length);
  });
});
