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
import { DEFAULT_BOILER_FLUE_DIAMETER_MM } from '../types/mep-boiler-types';
import { resolveBoilerModel, type BoilerFuelType } from './boiler-model-catalog';

/** i18n key prefix for every boiler-tag string (namespace `dxf-viewer-shell`). */
const TAG_KEY_PREFIX = 'ribbon.commands.mepBoilerTag.';

/** Namespace owning the boiler-tag keys (ADR-280 split). */
const TAG_NS = 'dxf-viewer-shell';

/** Diameter glyph prefix for the flue line — non-translatable annotation symbol. */
const DIAMETER_GLYPH = 'Ø';

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
 *   3. Fuel  — `fuelType` resolved to a localized name (omitted when absent).
 *   4. Flue  — `flueDiameterMm` as `Ø DNxxx`, ONLY for combustion fuels (gas/oil).
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

  // 3 — Fuel type (localized enum).
  if (params.fuelType) {
    lines.push(`${t('fuel')}: ${t(`fuelTypes.${params.fuelType}`)}`);
  }

  // 4 — Flue diameter (combustion fuels only).
  if (params.fuelType && COMBUSTION_FUELS.has(params.fuelType)) {
    const dn = params.flueDiameterMm ?? DEFAULT_BOILER_FLUE_DIAMETER_MM;
    lines.push(`${t('flue')}: ${DIAMETER_GLYPH} ${t('dnPrefix')}${dn}`);
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
