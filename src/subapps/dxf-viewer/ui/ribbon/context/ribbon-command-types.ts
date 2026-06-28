/**
 * ribbon-command-types — shared value types for the ribbon command surface.
 *
 * Extracted from `RibbonCommandContext.tsx` (ADR-547 Stage 4 Option B) so the
 * zero-React `RibbonFieldStore` can reference them WITHOUT importing the React
 * context module (avoids a context ↔ store import cycle). `RibbonCommandContext`
 * re-exports these for backward compatibility — existing imports are unchanged.
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';

export type RibbonActionPayload = number | string | Record<string, unknown>;

/** ADR-345 §4.4 — toggle runtime state. `null` = mixed/indeterminate. */
export type RibbonToggleState = boolean | null;

/** ADR-345 §4.5 — combobox runtime state (value + dynamic options). */
export interface RibbonComboboxState {
  value: string | null; // null = mixed
  options: readonly RibbonComboboxOption[];
  /**
   * ADR-421 SLICE C follow-up (a) — when `true`, the combobox renders read-only
   * (value still visible) because its value is governed elsewhere (e.g. a typed
   * BIM family Type, Revit-style). Owning bridge decides; bridges that omit it
   * keep the field fully editable (no breaking change).
   */
  disabled?: boolean;
}
