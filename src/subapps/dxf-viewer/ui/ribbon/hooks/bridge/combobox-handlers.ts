/**
 * ADR-345 Fase 5.5 — Combobox bridge helpers (Text Editor contextual tab).
 *
 * Translates ribbon commandKeys into store mutations + builds dynamic
 * option lists for fonts / layers / annotation scales. Static option
 * lists (heights, line-spacing presets) live on the data declaration.
 */

import type { TextToolbarValues } from '../../../../state/text-toolbar';
import type { AnnotationScale } from '../../../../text-engine/types';
import type { LayerSelectorEntry } from '../../../text-toolbar/controls';
import type {
  RibbonComboboxOption,
  RibbonComboboxState,
} from '../../types/ribbon-types';
import { TEXT_RIBBON_KEYS } from './command-keys';

export interface ComboboxSources {
  readonly fonts: readonly string[];
  readonly layers: readonly LayerSelectorEntry[];
  readonly scales: readonly AnnotationScale[];
  readonly activeScale: string;
}

function literalOption(value: string): RibbonComboboxOption {
  return { value, labelKey: value, isLiteralLabel: true };
}

function buildFontOptions(fonts: readonly string[]): readonly RibbonComboboxOption[] {
  return fonts.map(literalOption);
}

function buildLayerOptions(
  layers: readonly LayerSelectorEntry[],
): readonly RibbonComboboxOption[] {
  return layers.map((l) => literalOption(l.name));
}

function buildScaleOptions(
  scales: readonly AnnotationScale[],
): readonly RibbonComboboxOption[] {
  return scales.map((s) => literalOption(s.name));
}

export function readComboboxState(
  commandKey: string,
  values: TextToolbarValues,
  sources: ComboboxSources,
): RibbonComboboxState | null {
  if (commandKey === TEXT_RIBBON_KEYS.font.family) {
    return { value: values.fontFamily, options: buildFontOptions(sources.fonts) };
  }
  if (commandKey === TEXT_RIBBON_KEYS.font.height) {
    const raw = values.fontHeight;
    return { value: raw === null ? null : String(raw), options: [] };
  }
  if (commandKey === TEXT_RIBBON_KEYS.paragraph.lineSpacing) {
    const raw = values.lineSpacingFactor;
    return { value: raw === null ? null : raw.toFixed(2), options: [] };
  }
  if (commandKey === TEXT_RIBBON_KEYS.properties.layer) {
    return { value: values.layerId, options: buildLayerOptions(sources.layers) };
  }
  if (commandKey === TEXT_RIBBON_KEYS.properties.annotationScale) {
    return {
      value: values.currentScale ?? sources.activeScale,
      options: buildScaleOptions(sources.scales),
    };
  }
  return null;
}
