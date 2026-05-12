/**
 * ADR-345 Fase 5.5 — Toggle bridge helpers (Text Editor contextual tab).
 *
 * Pure functions that translate ribbon commandKeys into mutations on
 * `useTextToolbarStore`. The hook layer (`useRibbonTextEditorBridge`)
 * binds these to the store. No React, no side-effects beyond the store
 * setValue call.
 *
 * Alignment toggles are mutually exclusive: clicking `align.center`
 * while `align.left` is pressed sets `justification` to `MC` — `left`
 * automatically reports `false` next render (matches AutoCAD UX).
 *
 * Justification mapping intentionally keeps the vertical attachment
 * (`M*`) — vertical justification is not exposed in the ribbon v1.
 */

import type { TextToolbarValues } from '../../../../state/text-toolbar';
import type { TextJustification } from '../../../../text-engine/types';
import type { RibbonToggleState } from '../../context/RibbonCommandContext';
import { TEXT_RIBBON_KEYS } from './command-keys';

type StoreSetValue = <K extends keyof TextToolbarValues>(
  key: K,
  value: TextToolbarValues[K],
) => void;

const ALIGN_KEY_TO_JUSTIFICATION: Record<string, TextJustification> = {
  [TEXT_RIBBON_KEYS.align.left]: 'ML',
  [TEXT_RIBBON_KEYS.align.center]: 'MC',
  [TEXT_RIBBON_KEYS.align.right]: 'MR',
};

export function applyToggle(
  commandKey: string,
  nextValue: boolean,
  setValue: StoreSetValue,
): void {
  if (commandKey === TEXT_RIBBON_KEYS.style.bold) {
    setValue('bold', nextValue);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.style.italic) {
    setValue('italic', nextValue);
    return;
  }
  if (commandKey === TEXT_RIBBON_KEYS.style.underline) {
    setValue('underline', nextValue);
    return;
  }
  const justification = ALIGN_KEY_TO_JUSTIFICATION[commandKey];
  if (justification && nextValue) {
    setValue('justification', justification);
  }
}

export function readToggleState(
  commandKey: string,
  values: TextToolbarValues,
): RibbonToggleState {
  if (commandKey === TEXT_RIBBON_KEYS.style.bold) return values.bold;
  if (commandKey === TEXT_RIBBON_KEYS.style.italic) return values.italic;
  if (commandKey === TEXT_RIBBON_KEYS.style.underline) return values.underline;
  const justification = ALIGN_KEY_TO_JUSTIFICATION[commandKey];
  if (!justification) return false;
  if (values.justification === null) return null;
  return values.justification === justification;
}
