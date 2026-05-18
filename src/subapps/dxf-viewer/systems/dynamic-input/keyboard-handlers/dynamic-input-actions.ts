/**
 * ADR-364 §3.4 Group 3 follow-up (2026-05-19) — Dynamic Input shared actions.
 *
 * Single Source of Truth for "close the Dynamic Input overlay + clear ALL
 * field values". Consumers:
 *   - `handleDefaultEscape` in `default-keyboard-handler.ts` (legacy fall-back
 *     Strategy path when no tool-specific handler claims Escape).
 *   - The DYNAMIC_INPUT slot of the EscapeCommandBus in
 *     `useDynamicInputKeyboard.ts` (belt-and-suspenders cleanup for the
 *     line/circle/stair strategies that return `false` for Escape).
 *
 * Industry parallel: AutoCAD Dynamic Input "abort field" command; Revit
 * temporary parameter editor cancel. One central reset, called from every
 * Escape path.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-364-escape-command-bus.md
 */

import type { KeyboardHandlerActions } from './types';

/**
 * Clear ALL Dynamic Input field values (coordinate + radius/diameter + stair
 * rise/tread/width) and hide the overlay. Idempotent — safe to call when the
 * overlay is already hidden or values are already empty.
 */
export function closeDynamicInput(actions: KeyboardHandlerActions): void {
  actions.setXValue('');
  actions.setYValue('');
  actions.setAngleValue('');
  actions.setLengthValue('');
  actions.setRadiusValue('');
  actions.setDiameterValue('');
  actions.setRiseValue('');
  actions.setTreadValue('');
  actions.setWidthValue('');
  actions.setShowInput(false);
}
