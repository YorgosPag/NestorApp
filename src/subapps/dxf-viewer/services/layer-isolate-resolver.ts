/**
 * Layer Isolate Resolver — ADR-358 §5.6.bis (Q10 FULL Enterprise Configurable).
 *
 * Pure cascade resolver for the Layer Isolate UX defaults (mode + dim opacity).
 * Resolution priority (high → low):
 *   1. Project override   — Firestore `projects/{projectId}/dxfSettings.layerIsolate`.
 *   2. User preference    — localStorage `dxf:layerIsolate` (cross-project).
 *   3. System default     — `DEFAULT_LAYER_ISOLATE_SETTINGS` (mode='dim', 30% opacity).
 *
 * Pre-commit ratchet `layer-isolate-system` (in `.ssot-registry.json`) forbids
 * hardcoded `dimOpacityPercent` numeric literals outside this resolver — call
 * sites MUST use `resolveLayerIsolateSettings()` to honour project/user override.
 */

import type {
  LayerIsolateSettings,
  LayerIsolateMode
} from '../settings-core/types/domain';
import { DEFAULT_LAYER_ISOLATE_SETTINGS } from '../settings-core/defaults';

export { DEFAULT_LAYER_ISOLATE_SETTINGS };
export type { LayerIsolateSettings, LayerIsolateMode };

/** Slider step for `dimOpacityPercent` (UI grid 5%). */
export const DIM_OPACITY_STEP = 5;
/** Minimum allowed `dimOpacityPercent` (anything lower is indistinguishable from freeze). */
export const DIM_OPACITY_MIN = 5;
/** Maximum allowed `dimOpacityPercent` (above is indistinguishable from no-dim). */
export const DIM_OPACITY_MAX = 90;
/** Maximum DXF transparency (`0..90` per §5.1 / `AcCmTransparency` group 1071). */
export const TRANSPARENCY_MAX = 90;
/** Minimum DXF transparency. */
export const TRANSPARENCY_MIN = 0;

export interface LayerIsolateResolverInput {
  /** Per-project override from Firestore `dxfSettings.layerIsolate`. */
  projectSetting?: Partial<LayerIsolateSettings> | null;
  /** User preference from localStorage `dxf:layerIsolate`. */
  userPreference?: Partial<LayerIsolateSettings> | null;
}

/** Snap `dimOpacityPercent` to the allowed grid (5..90, step 5). */
export function clampDimOpacityPercent(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_LAYER_ISOLATE_SETTINGS.dimOpacityPercent;
  const stepped = Math.round(raw / DIM_OPACITY_STEP) * DIM_OPACITY_STEP;
  return Math.max(DIM_OPACITY_MIN, Math.min(DIM_OPACITY_MAX, stepped));
}

/**
 * Convert display-side opacity percentage (5..90) to DXF transparency (0..90).
 * Convention: `opacity 30% → transparency 70` (entity drawn at 30% solid).
 * Output clamped to the DXF group-1071 valid range.
 */
export function dimOpacityToTransparency(percent: number): number {
  const inverted = 100 - clampDimOpacityPercent(percent);
  return Math.max(TRANSPARENCY_MIN, Math.min(TRANSPARENCY_MAX, inverted));
}

function isMode(value: unknown): value is LayerIsolateMode {
  return value === 'dim' || value === 'freeze';
}

function pickLevel(input: Partial<LayerIsolateSettings> | null | undefined): Partial<LayerIsolateSettings> {
  if (!input || typeof input !== 'object') return {};
  return input;
}

/**
 * Resolve concrete LayerIsolateSettings via the 3-level cascade.
 * Always returns a concrete settings object (no partials, no nulls).
 */
export function resolveLayerIsolateSettings(
  input: LayerIsolateResolverInput
): LayerIsolateSettings {
  const project = pickLevel(input.projectSetting);
  const user = pickLevel(input.userPreference);

  const mode: LayerIsolateMode = isMode(project.mode)
    ? project.mode
    : isMode(user.mode)
      ? user.mode
      : DEFAULT_LAYER_ISOLATE_SETTINGS.mode;

  const rawOpacity =
    typeof project.dimOpacityPercent === 'number'
      ? project.dimOpacityPercent
      : typeof user.dimOpacityPercent === 'number'
        ? user.dimOpacityPercent
        : DEFAULT_LAYER_ISOLATE_SETTINGS.dimOpacityPercent;

  return {
    mode,
    dimOpacityPercent: clampDimOpacityPercent(rawOpacity)
  };
}

/** Return the inverse mode for `LayerIsolateInverseCommand` (Ctrl+Alt+I). */
export function inverseMode(mode: LayerIsolateMode): LayerIsolateMode {
  return mode === 'dim' ? 'freeze' : 'dim';
}
