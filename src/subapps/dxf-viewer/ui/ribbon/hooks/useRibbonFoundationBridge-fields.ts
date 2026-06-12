/**
 * ADR-436 Slice 1 — Foundation ribbon-bridge field read/write helpers.
 *
 * Extracted from useRibbonFoundationBridge.ts to keep that file <500 LOC (Google
 * SRP, CLAUDE.md N.7.1). Pure, discriminated-union-safe accessors over
 * `FoundationParams` (selected entity) and `FoundationToolBridgeHandle` (drawing
 * mode). No React — the bridge hook calls these.
 */

import {
  DEFAULT_STRIP_JUSTIFICATION,
  type FoundationAnchor,
  type FoundationParams,
  type StripJustification,
} from '../../../bim/types/foundation-types';
import { FOUNDATION_RIBBON_KEYS } from './bridge/foundation-command-keys';
import type { FoundationToolBridgeHandle } from './bridge/foundation-tool-bridge-store';

// ─── String-field read/write helpers (discriminated-union-safe) ──────────────

/** Selected-entity string-combobox value. null = combobox δεν ισχύει για το kind. */
export function readSelectedStringField(params: FoundationParams, commandKey: string): string | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return params.kind;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    return params.kind === 'pad' ? params.anchor : 'center';
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) return params.material ?? 'rc';
  // ADR-441 Slice 5a-control — justification μόνο για strip/tie-beam (pad → anchor).
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    return params.kind === 'pad' ? null : (params.justification ?? DEFAULT_STRIP_JUSTIFICATION);
  }
  return null;
}

/** Drawing-mode (tool handle) string-combobox value. null = δεν ισχύει για το kind. */
export function readToolStringField(handle: FoundationToolBridgeHandle, commandKey: string): string | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return handle.kind;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) return handle.anchor;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    return typeof handle.overrides.material === 'string' ? handle.overrides.material : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    return handle.kind === 'pad' ? null : (handle.overrides.justification ?? DEFAULT_STRIP_JUSTIFICATION);
  }
  return null;
}

/** Next params for a string-combobox change on a selected foundation. null = no-op. */
export function nextParamsForStringChange(
  params: FoundationParams,
  commandKey: string,
  value: string,
): FoundationParams | null {
  // ADR-436 Slice 2 — kind = DISPLAY-ONLY (pad↔line geometrically invalid). No-op.
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return null;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    return params.kind === 'pad' ? { ...params, anchor: value as FoundationAnchor } : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    return { ...params, material: value };
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    // ADR-441 5a-grid — χειροκίνητη υπεροχή: flag ώστε το managed reconcile να μην το επαναφέρει.
    return params.kind === 'pad'
      ? null
      : { ...params, justification: value as StripJustification, justificationManual: true };
  }
  return null;
}

/** Apply a string-combobox change to the active tool handle (drawing-mode overrides). */
export function applyStringChangeToHandle(
  handle: FoundationToolBridgeHandle,
  commandKey: string,
  value: string,
): void {
  // ADR-436 Slice 2 — kind fixed by tool id (DISPLAY-ONLY). No-op.
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.kind) return;
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.anchor) {
    handle.setAnchor(value as FoundationAnchor);
    return;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.material) {
    handle.setParamOverrides({ material: value });
    return;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.stringParams.justification) {
    handle.setParamOverrides({ justification: value as StripJustification });
  }
}

// ─── Number-field read/write helpers (discriminated-union-safe) ──────────────

export function readNumberField(params: FoundationParams, commandKey: string): number | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.width) return params.width;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.thickness) return params.thicknessMm;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.topElevation) return params.topElevationMm;
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.length) {
    return params.kind === 'pad' ? params.length : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.rotation) {
    return params.kind === 'pad' ? params.rotation : null;
  }
  return null;
}

export function writeNumberField(
  params: FoundationParams,
  commandKey: string,
  value: number,
): FoundationParams | null {
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.width) return { ...params, width: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.thickness) return { ...params, thicknessMm: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.topElevation) return { ...params, topElevationMm: value };
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.length) {
    return params.kind === 'pad' ? { ...params, length: value } : null;
  }
  if (commandKey === FOUNDATION_RIBBON_KEYS.params.rotation) {
    return params.kind === 'pad' ? { ...params, rotation: value } : null;
  }
  return null;
}
