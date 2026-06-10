/**
 * Boiler sound power level (L_WA) — pure SSoT (ADR-408 Εύρος Β #2).
 *
 * Revit Mechanical Equipment «Sound» data / IFC `Pset_SoundAttenuation` ·
 * `Pset_BoilerTypeCommon`. The THIRD and final datum of the EU energy label that the
 * other two axes already started: a space-heater label (Regulation 811/2013) prints
 * THREE figures — seasonal efficiency η_s → ErP class (`boiler-efficiency.ts`),
 * NOx emissions (`boiler-nox.ts`), AND the internal SOUND POWER LEVEL `L_WA` in dB(A).
 * The appliance stores its measured figure (`soundPowerDbA`); this module resolves a
 * PLACEMENT-SUITABILITY band so the designer can judge where the unit may sit (living
 * room / bedroom vs kitchen / utility vs dedicated plant room).
 *
 * ⚠️ HONESTY (N.HONESTY): unlike the NOx ceiling — a genuine EU LEGAL gate — there is
 * NO statutory noise limit for boilers. The thresholds below are an ENGINEERING-GUIDANCE
 * UX HEURISTIC, not a legal limit:
 *
 *     ≤ 45 dB(A)  →  'quiet'     (suitable for living / sleeping spaces)
 *     ≤ 55 dB(A)  →  'standard'  (kitchen / utility / plant room)
 *     > 55 dB(A)  →  'loud'      (dedicated plant room / acoustic enclosure)
 *
 * Typical wall-hung gas boilers sit ≈ 40–50 dB(A). The band applies to EVERY fuel type
 * (a pump / fan / burner all emit noise), unlike NOx which is combustion-only.
 *
 * Pure + unit-tested; NO import from `mep-boiler-symbol`/renderer (mirrors the
 * `boiler-nox.ts` discipline). Feeds the «Θερμικά» readout today (data-only, no glyph).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-nox
 */

/**
 * Placement-suitability band derived from the internal sound power level (dB(A)).
 *   - `'quiet'`:    ≤ 45 dB(A) — quiet enough for living / sleeping spaces.
 *   - `'standard'`: ≤ 55 dB(A) — kitchen / utility / plant room.
 *   - `'loud'`:     > 55 dB(A) — dedicated plant room / acoustic enclosure.
 *
 * ⚠️ A guidance heuristic, NOT a legal limit (no EU statutory boiler-noise ceiling).
 */
export type AcousticBand = 'quiet' | 'standard' | 'loud';

/** Upper bound (inclusive) for the `'quiet'` band — dB(A). Guidance heuristic, not legal. */
export const ACOUSTIC_QUIET_MAX_DBA = 45;

/** Upper bound (inclusive) for the `'standard'` band — dB(A). Guidance heuristic, not legal. */
export const ACOUSTIC_STANDARD_MAX_DBA = 55;

/**
 * Resolves a boiler's placement-suitability band from its measured sound power level.
 * Pure: maps `soundPowerDbA` to a {@link AcousticBand} against the guidance thresholds.
 * Returns `null` when the figure cannot apply — absent, non-numeric, or non-positive
 * (a boiler is never genuinely silent, so `≤ 0` is treated as unspecified).
 *
 * Examples: `(40) → 'quiet'`, `(45) → 'quiet'` (≤ inclusive), `(46) → 'standard'`,
 * `(55) → 'standard'`, `(58) → 'loud'`, `(undefined) → null`, `(0) → null`.
 *
 * @param soundPowerDbA Measured internal sound power level (dB(A)) — `MepBoilerParams.soundPowerDbA`.
 */
export function resolveAcousticBand(
  soundPowerDbA: number | undefined,
): AcousticBand | null {
  if (typeof soundPowerDbA !== 'number' || soundPowerDbA <= 0) return null;
  if (soundPowerDbA <= ACOUSTIC_QUIET_MAX_DBA) return 'quiet';
  if (soundPowerDbA <= ACOUSTIC_STANDARD_MAX_DBA) return 'standard';
  return 'loud';
}
