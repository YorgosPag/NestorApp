/**
 * ADR-345 Fase 5.5 — Combobox mutation helper.
 *
 * `applyCombobox` translates the ribbon's (commandKey, value) tuple into
 * a store setValue call. Number parsing for height / line spacing is
 * defensive — invalid input is rejected silently so the UI never falls
 * into a broken numeric state.
 *
 * Annotation scale also writes the global `ViewportStore.activeScale`
 * via `setActiveScale` so the viewport overlay re-renders consistently
 * with the entity's currentScale (ADR-344 Phase 11).
 */

import type { TextToolbarValues } from '../../../../state/text-toolbar';
import { setActiveScale } from '../../../../systems/viewport';
import { TEXT_RIBBON_KEYS } from './command-keys';

type StoreSetValue = <K extends keyof TextToolbarValues>(
  key: K,
  value: TextToolbarValues[K],
) => void;

function parseFiniteNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function applyCombobox(
  commandKey: string,
  value: string,
  setValue: StoreSetValue,
): void {
  if (commandKey === TEXT_RIBBON_KEYS.font.family) {
    setValue('fontFamily', value);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.font.height) {
    const n = parseFiniteNumber(value);
    if (n !== null && n > 0) setValue('fontHeight', n);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.paragraph.lineSpacing) {
    const n = parseFiniteNumber(value);
    if (n !== null && n > 0) setValue('lineSpacingFactor', n);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.properties.layer) {
    setValue('layerId', value);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.properties.annotationScale) {
    setValue('currentScale', value);
    setActiveScale(value);
  }
}
