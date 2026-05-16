/**
 * ADR-358 Phase 5a — Stair Tool Keyboard Handler.
 *
 * Phase 5a scope: Enter confirms the current stair placement step. Field
 * navigation (rise / tread / width inline editing) lands the contextual ribbon
 * Phase 7a — the Dynamic Input common context (`x`, `y`, `angle`, `length`,
 * `radius`, `diameter`) does not yet expose `rise/tread/width` slots, so we
 * keep the keyboard contract minimal here and route param overrides through
 * the contextual panel later.
 *
 * Pattern alignment: `line-keyboard-handler.ts` / `circle-keyboard-handler.ts`.
 * Pure strategy function — no React, no DOM, no Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1 §7.2 Phase 5a
 */

import type {
  KeyboardHandler,
  KeyboardHandlerActions,
  KeyboardHandlerContext,
} from './types';

// ─── Validation ranges (industry / NOK / IBC convergence) ────────────────────

const STAIR_FIELD_RANGES = {
  rise: { min: 100, max: 220 },     // mm — IBC 102-178, NOK 140-200
  tread: { min: 220, max: 360 },    // mm — IBC ≥279, NOK 260-320
  width: { min: 600, max: 2400 },   // mm — NOK ≥800, ≥1200 main
} as const;

// ─── Main handler ────────────────────────────────────────────────────────────

export const handleStairKeyboard: KeyboardHandler = (
  _e,
  keyType,
  context,
  actions,
) => {
  if (keyType === 'Enter') return handleStairEnter(context, actions);
  // Tab/Escape default-handler fallback. Inline rise/tread/width editing lands
  // Phase 7a — the contextual ribbon ships its own panel widget there.
  return false;
};

// ─── Enter — confirm stair placement step ────────────────────────────────────

function handleStairEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
): boolean {
  const { activeTool } = context;
  actions.CADFeedback.onInputConfirm();
  actions.dispatchDynamicSubmit({
    tool: activeTool,
    action: 'commit-stair',
  });
  return true;
}

// ─── Range validator (exported for ribbon-panel reuse Phase 7a) ──────────────

export function validateStairField(
  field: 'rise' | 'tread' | 'width',
  valueMm: number,
): boolean {
  const range = STAIR_FIELD_RANGES[field];
  return Number.isFinite(valueMm) && valueMm >= range.min && valueMm <= range.max;
}

export { STAIR_FIELD_RANGES };
