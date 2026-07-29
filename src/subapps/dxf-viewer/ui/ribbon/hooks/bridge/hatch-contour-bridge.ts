/**
 * ADR-507 — Hatch contour-pen (περίγραμμα) bridge slice.
 *
 * Εξήχθη από το `useRibbonHatchBridge` (N.7.1 όριο 500 γρ.). Τα 4 πεδία του
 * `HatchContourPen` (visible/color/lineweightMm/linetypeName) ακολουθούν το ΙΔΙΟ
 * dual-mode pattern με gradient/image (επιλεγμένο hatch → nested-object immutable
 * merge· καμία επιλογή → flat draw-defaults) — μόνο πιο απλά (2 write πράξεις
 * κοινές, `applyContourFieldPatch`). Το πραγματικό nested-object build/merge ζει
 * στο `hatch-contour-build.ts` (pure, μηδέν React) — εδώ μόνο η σύνδεση
 * commandKey ⇄ πεδίο + το dual-mode dispatch.
 *
 * @see ../../../../bim/hatch/hatch-contour-build.ts — pure nested-object build SSoT
 * @see ../../../../bim/hatch/hatch-properties.ts — `isHatchContourVisible` (read SSoT)
 * @see ../useRibbonHatchBridge.ts — ο consumer
 */

import type { HatchEntity, LineweightMm } from '../../../../types/entities';
import type { HatchDrawDefaults } from '../../../../bim/hatch/hatch-draw-defaults-store';
import type { RibbonComboboxState, RibbonToggleState } from '../../context/RibbonCommandContext';
import type { RibbonComboboxOption } from '../../types/ribbon-types';
import { isHatchContourVisible } from '../../../../bim/hatch/hatch-properties';
import {
  withContourPenPatch,
  type ContourFieldPatch,
} from '../../../../bim/hatch/hatch-contour-build';
import { LINEWEIGHT_BYLAYER_VALUE } from '../../data/lineweight-ribbon-options';
import { LINEWEIGHT_SPECIAL, parseDxfCode370 } from '../../../../config/lineweight-iso-catalog';
import { DEFAULT_LINETYPE_NAME } from '../../../../config/linetype-iso-catalog';
import { lineweightToOptionValue } from './hatch-bridge-read';
import { HATCH_RIBBON_KEYS } from './hatch-command-keys';
import type { PatchHatchFn, SetHatchDrawDefaultsFn } from './hatch-bridge-write-types';

/** Read-side: contour combobox state (color/lineweight/linetype), or `null` if unmapped. */
export function readHatchContourComboboxState(
  commandKey: string,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  linetypeOptions: readonly RibbonComboboxOption[],
): RibbonComboboxState | null {
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourColor) {
    // Απόν ⇒ κληρονομεί το fillColor (entity: του ίδιου hatch· draft: του draft fillColor).
    const fallbackFill = hatch?.fillColor ?? defaults.fillColor;
    const value = hatch
      ? (hatch.contourPen?.color ?? fallbackFill)
      : (defaults.contourColor !== '' ? defaults.contourColor : fallbackFill);
    return { value, options: [] };
  }
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourLineweight) {
    const lw = hatch ? hatch.contourPen?.lineweightMm : defaults.contourLineweightMm;
    return { value: lineweightToOptionValue(lw), options: [] };
  }
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourLinetype) {
    const value = hatch
      ? (hatch.contourPen?.linetypeName ?? DEFAULT_LINETYPE_NAME)
      : (defaults.contourLinetypeName !== '' ? defaults.contourLinetypeName : DEFAULT_LINETYPE_NAME);
    return { value, options: linetypeOptions };
  }
  return null;
}

/** Toggle-side: contour visibility, or `null` if unmapped (mirrors `isHatchContourVisible` SSoT). */
export function getHatchContourToggleState(
  commandKey: string,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
): RibbonToggleState | null {
  if (commandKey !== HATCH_RIBBON_KEYS.toggles.contourVisible) return null;
  return hatch ? isHatchContourVisible(hatch) : defaults.contourVisible;
}

/** Map a contour string-field command key + raw value → a `ContourFieldPatch`, or `null`. */
function parseContourStringPatch(commandKey: string, value: string): ContourFieldPatch | null {
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourColor) {
    return { field: 'color', value };
  }
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourLineweight) {
    const lineweightMm: LineweightMm =
      value === LINEWEIGHT_BYLAYER_VALUE
        ? LINEWEIGHT_SPECIAL.BYLAYER
        : parseDxfCode370(Math.round(Number.parseFloat(value) * 100));
    return { field: 'lineweightMm', value: lineweightMm };
  }
  if (commandKey === HATCH_RIBBON_KEYS.stringParams.contourLinetype) {
    return { field: 'linetypeName', value };
  }
  return null;
}

/** Flat draw-default patch for a contour field change (no-selection mode). */
function contourDefaultPatch(patch: ContourFieldPatch): Partial<HatchDrawDefaults> {
  switch (patch.field) {
    case 'visible': return { contourVisible: patch.value };
    case 'color': return { contourColor: patch.value };
    case 'lineweightMm': return { contourLineweightMm: patch.value };
    case 'linetypeName': return { contourLinetypeName: patch.value };
  }
}

/** Dual-mode write: selected hatch → nested `UpdateEntityCommand` patch· none → flat defaults. */
function applyContourFieldPatch(
  fieldPatch: ContourFieldPatch,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  patchHatch: PatchHatchFn,
  setDrawDefaults: SetHatchDrawDefaultsFn,
): void {
  if (hatch) {
    patchHatch(hatch, { contourPen: withContourPenPatch(hatch.contourPen, defaults, fieldPatch) });
  } else {
    setDrawDefaults(contourDefaultPatch(fieldPatch));
  }
}

/**
 * Write-side dispatcher for a contour string/color/select field. Returns `true` when
 * `commandKey` was a contour field (caller returns immediately after) — `false` for any
 * other key (caller falls through to its own dispatch).
 */
export function applyHatchContourStringChange(
  commandKey: string,
  value: string,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  patchHatch: PatchHatchFn,
  setDrawDefaults: SetHatchDrawDefaultsFn,
): boolean {
  const fieldPatch = parseContourStringPatch(commandKey, value);
  if (!fieldPatch) return false;
  applyContourFieldPatch(fieldPatch, hatch, defaults, patchHatch, setDrawDefaults);
  return true;
}

/**
 * Write-side dispatcher for the contour visibility toggle. Returns `true` when handled
 * (caller returns immediately after) — `false` for any other toggle key.
 */
export function applyHatchContourToggleChange(
  commandKey: string,
  nextValue: boolean,
  hatch: HatchEntity | null,
  defaults: HatchDrawDefaults,
  patchHatch: PatchHatchFn,
  setDrawDefaults: SetHatchDrawDefaultsFn,
): boolean {
  if (commandKey !== HATCH_RIBBON_KEYS.toggles.contourVisible) return false;
  applyContourFieldPatch({ field: 'visible', value: nextValue }, hatch, defaults, patchHatch, setDrawDefaults);
  return true;
}
