/**
 * Boiler 2D Plan Tag — content SSoT (ADR-408 Εύρος Β #2, Revit «Mechanical Equipment Tag»).
 *
 * Single source of truth for WHAT the boiler plan-tag prints. Pure, unit-testable:
 * `buildBoilerTagLines(params, t)` maps a `MepBoilerParams` to an ordered array of
 * fully-formatted text lines (model name, thermal output in kW, fuel, flue Ø). The
 * `MepBoilerRenderer.drawTag()` consumes the lines and lays them out in screen space
 * (fixed-pixel, zoom-invariant) — this file owns NO geometry/styling, only text.
 *
 * i18n SSoT (N.11): every label/enum is an i18n key under
 * `ribbon.commands.mepBoilerTag.*` (namespace `dxf-viewer-shell`). The model name is
 * a literal product label from the Type Catalog (`isLiteralLabel` sanctioned exception).
 * The unit/symbol glyphs (`Ø`) are non-translatable annotation glyphs (mirror `'%'` in
 * the slope label), not user strings.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-model-catalog
 */

import { i18n } from '@/i18n';
import type { MepBoilerParams } from '../types/mep-boiler-types';
import {
  defaultBoilerFlueDiameterMm,
  defaultBoilerFuelDiameterMm,
  DEFAULT_BOILER_CONDENSATE_DIAMETER_MM,
  DEFAULT_BOILER_SERVICE_CLEARANCE_MM,
  DEFAULT_BOILER_RELIEF_PRESSURE_BAR,
  DEFAULT_BOILER_EXPANSION_VESSEL_L,
  DEFAULT_BOILER_SYSTEM_PRESSURE_BAR,
} from '../types/mep-boiler-types';
import { resolveBoilerModel, type BoilerFuelType } from './boiler-model-catalog';
import { DEFAULT_FLUE_TERMINATION } from './boiler-flue-terminal';
import { resolveErpClass } from './boiler-efficiency';
import { resolveTurndownRatio } from './boiler-modulation';

/** i18n key prefix for every boiler-tag string (namespace `dxf-viewer-shell`). */
const TAG_KEY_PREFIX = 'ribbon.commands.mepBoilerTag.';

/** Namespace owning the boiler-tag keys (ADR-280 split). */
const TAG_NS = 'dxf-viewer-shell';

/** Diameter glyph prefix for the flue line — non-translatable annotation symbol. */
const DIAMETER_GLYPH = 'Ø';

/** Percent glyph for the efficiency line — non-translatable annotation symbol. */
const PERCENT_GLYPH = '%';

/** Millimetre unit glyph for the clearance line — non-translatable annotation symbol. */
const MM_GLYPH = 'mm';

/** Check mark for boolean-present lines (neutraliser) — non-translatable annotation symbol. */
const CHECK_GLYPH = '✓';

/** Pressure unit glyph for the safety-relief-valve line — non-translatable annotation symbol. */
const BAR_UNIT = 'bar';

/** Litre unit glyph for the expansion-vessel line — non-translatable annotation symbol. */
const LITRE_UNIT = 'L';

/** En-dash joining the min–max kW range on the modulation line — non-translatable glyph. */
const RANGE_DASH = '–';

/**
 * Combustion fuel sources — only these have a flue (καπναγωγός). Electric /
 * heat-pump boilers exhaust nothing, so the flue line is omitted for them.
 */
const COMBUSTION_FUELS: ReadonlySet<BoilerFuelType> = new Set<BoilerFuelType>(['gas', 'oil']);

/**
 * Translator contract for the pure builder. Accepts a SHORT key (e.g. `'power'`)
 * relative to {@link TAG_KEY_PREFIX}. Injected so the core stays pure (tests pass a
 * fake `t`); the live wrapper binds it to the i18n singleton.
 */
export type BoilerTagTranslator = (shortKey: string) => string;

// ─── Pure core (injected translator) ──────────────────────────────────────────

/**
 * Builds the ordered tag lines for a boiler. Pure — no i18n singleton, no canvas.
 * Lines are emitted only when the corresponding param is present:
 *   1. Model — catalogue product label, or the generic fallback when parametric.
 *   2. Power — `thermalOutputW` rounded to whole kW (omitted when absent).
 *   3. Efficiency — `seasonalEfficiencyPercent` as `NN%` (any fuel; omitted when absent).
 *   4. ErP   — EU energy class (`resolveErpClass`); paired with efficiency, any fuel.
 *   5. Fuel  — `fuelType` resolved to a localized name (omitted when absent).
 *   6. Flue  — `flueDiameterMm` as `Ø DNxxx`, ONLY for combustion fuels (gas/oil).
 *   7. Terminal — the flue vent-terminal type (καμινάδα), ONLY for combustion fuels.
 *   8. Fuel supply — `fuelConnectorDiameterMm` as `Ø DNxx`, ONLY for combustion fuels.
 *   9. Condensate — `condensateConnectorDiameterMm` as `Ø DNxx`, ONLY for condensing boilers.
 *  10. Clearance — `serviceClearanceMm` as `NNN mm`, ONLY when `showServiceClearance` is set.
 *  11. Neutraliser — `✓`, ONLY for a condensing boiler with `condensateNeutraliser` set.
 *  12. Relief valve — `reliefValvePressureBar` as `N bar`, ONLY when `safetyReliefValve` is set.
 *  13. Expansion vessel — `expansionVesselVolumeL` as `N L`, ONLY when `expansionVessel` is set.
 *  14. Pressure gauge — `systemPressureBar` as `N bar`, ONLY when `pressureGauge` is set.
 *  15. Modulation — `min–max kW (R:1)`, ONLY when a modulating range exists (min < max).
 *
 * @param params Boiler params (SSoT).
 * @param t      Short-key translator (see {@link BoilerTagTranslator}).
 */
export function buildBoilerTagLines(
  params: MepBoilerParams,
  t: BoilerTagTranslator,
): string[] {
  const lines: string[] = [];

  // 1 — Model (literal product label, or generic fallback when parametric).
  const model = params.modelId ? resolveBoilerModel(params.modelId) : undefined;
  lines.push(model ? model.labelKey : t('modelFallback'));

  // 2 — Thermal output → whole kW.
  if (typeof params.thermalOutputW === 'number' && params.thermalOutputW > 0) {
    const kW = Math.round(params.thermalOutputW / 1000);
    lines.push(`${t('power')}: ${kW} ${t('kWUnit')}`);
  }

  // 3+4 — Seasonal efficiency + EU ErP class (any fuel, incl. electric/heat-pump).
  if (typeof params.seasonalEfficiencyPercent === 'number' && params.seasonalEfficiencyPercent > 0) {
    const pct = Math.round(params.seasonalEfficiencyPercent);
    lines.push(`${t('efficiency')}: ${pct}${PERCENT_GLYPH}`);
    const erp = resolveErpClass(params.seasonalEfficiencyPercent, params.fuelType);
    lines.push(`${t('erp')}: ${erp}`);
  }

  // 5 — Fuel type (localized enum).
  if (params.fuelType) {
    lines.push(`${t('fuel')}: ${t(`fuelTypes.${params.fuelType}`)}`);
  }

  // 6 — Flue diameter (combustion fuels only).
  if (params.fuelType && COMBUSTION_FUELS.has(params.fuelType)) {
    const dn = params.flueDiameterMm ?? defaultBoilerFlueDiameterMm(params.fuelType);
    lines.push(`${t('flue')}: ${DIAMETER_GLYPH} ${t('dnPrefix')}${dn}`);

    // 7 — Vent terminal type (καμινάδα), combustion fuels only.
    const termination = params.flueTermination ?? DEFAULT_FLUE_TERMINATION;
    lines.push(`${t('terminationLabel')}: ${t(`terminationTypes.${termination}`)}`);

    // 8 — Fuel supply diameter (τροφοδοσία καυσίμου), combustion fuels only.
    const fuelDn = params.fuelConnectorDiameterMm ?? defaultBoilerFuelDiameterMm(params.fuelType);
    lines.push(`${t('fuelSupply')}: ${DIAMETER_GLYPH} ${t('dnPrefix')}${fuelDn}`);
  }

  // 9 — Condensate drain (αποχέτευση συμπυκνωμάτων), condensing boilers only.
  // Gated by `condensing` (NOT combustion): the line follows its connector — a
  // condensing appliance seeds a `boiler-condensate` drain. Fuel-independent (no
  // per-fuel default → plain `??`, unlike flue/fuel which resolve per fuel type).
  if (params.condensing) {
    const condensateDn = params.condensateConnectorDiameterMm ?? DEFAULT_BOILER_CONDENSATE_DIAMETER_MM;
    lines.push(`${t('condensate')}: ${DIAMETER_GLYPH} ${t('dnPrefix')}${condensateDn}`);
  }

  // 10 — Service clearance (Revit «Clearances»), documented when the keep-clear zone is on.
  if (params.showServiceClearance) {
    const clearanceMm = params.serviceClearanceMm ?? DEFAULT_BOILER_SERVICE_CLEARANCE_MM;
    lines.push(`${t('clearance')}: ${clearanceMm} ${MM_GLYPH}`);
  }

  // 11 — Condensate neutraliser (εξουδετερωτής), condensing boilers that have one fitted.
  if (params.condensing && params.condensateNeutraliser) {
    lines.push(`${t('neutraliser')}: ${CHECK_GLYPH}`);
  }

  // 12 — Safety relief valve (Revit «Safety Relief Valve»), set pressure in bar. Drawn whenever
  // the valve is fitted (code-mandatory device); independent of fuel/condensing.
  if (params.safetyReliefValve) {
    const bar = params.reliefValvePressureBar ?? DEFAULT_BOILER_RELIEF_PRESSURE_BAR;
    lines.push(`${t('reliefValve')}: ${bar} ${BAR_UNIT}`);
  }

  // 13 — Expansion vessel (Revit accessory, IFC IfcTank EXPANSION), volume in litres. Drawn
  // whenever the vessel is fitted (sealed-system partner of the relief valve); independent of fuel.
  if (params.expansionVessel) {
    const litres = params.expansionVesselVolumeL ?? DEFAULT_BOILER_EXPANSION_VESSEL_L;
    lines.push(`${t('expansionVessel')}: ${litres} ${LITRE_UNIT}`);
  }

  // 14 — Pressure gauge (Revit accessory, IFC IfcSensor PRESSURE), system COLD-FILL pressure in
  // bar. Drawn whenever the gauge is fitted (third sealed-system instrument); independent of fuel.
  // Distinct from the relief valve's SET pressure — this is the system fill pressure (~1.5 bar).
  if (params.pressureGauge) {
    const bar = params.systemPressureBar ?? DEFAULT_BOILER_SYSTEM_PRESSURE_BAR;
    lines.push(`${t('pressureGauge')}: ${bar} ${BAR_UNIT}`);
  }

  // 15 — Modulation / turndown (Revit «Turndown Ratio»). Shown only for a MODULATING boiler:
  // a minimum modulating output + a nominal maximum forming a genuine range (min < max). The
  // line pairs the readable kW range with the turndown ratio, e.g. «6–24 kW (4:1)». A null
  // ratio (on/off, equal/inverted outputs) omits the line entirely.
  const minW = params.minThermalOutputW;
  const maxW = params.thermalOutputW;
  const turndown = resolveTurndownRatio(minW, maxW);
  if (turndown !== null && typeof minW === 'number' && typeof maxW === 'number') {
    const minKw = Math.round(minW / 1000);
    const maxKw = Math.round(maxW / 1000);
    lines.push(`${t('modulation')}: ${minKw}${RANGE_DASH}${maxKw} ${t('kWUnit')} (${turndown}:1)`);
  }

  return lines;
}

// ─── Live wrapper (i18n-bound) ────────────────────────────────────────────────

/**
 * Resolves the boiler tag lines against the live i18n singleton. Thin wrapper over
 * {@link buildBoilerTagLines}; used by `MepBoilerRenderer.drawTag()`.
 */
export function resolveBoilerTagLines(params: MepBoilerParams): string[] {
  return buildBoilerTagLines(params, (shortKey) =>
    i18n.t(`${TAG_KEY_PREFIX}${shortKey}`, { ns: TAG_NS }),
  );
}
