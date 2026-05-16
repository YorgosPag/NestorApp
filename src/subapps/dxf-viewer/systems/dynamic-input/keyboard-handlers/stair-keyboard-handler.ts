/**
 * ADR-358 Phase 5a + Phase 7b2b-β Stream E — Stair Tool Keyboard Handler.
 *
 * Phase 5a scope (kept): Enter confirms the current stair placement step.
 *
 * Phase 7b2b-β Stream E scope (new): inline rise/tread/width Dynamic Input.
 *   - Tab cycles `activeStairField` rise → tread → width → rise (Shift+Tab reverse).
 *   - Enter parses the current 3 values, validates against industry ranges
 *     (`validateStairField`), and dispatches `commit-stair` with
 *     `params: { rise, tread, width }`. `useStairTool` listens and calls
 *     `setParamOverrides` before triggering `confirm()`.
 *   - Industry convergence 5/5 (AutoCAD, Revit, ArchiCAD, Vectorworks, SolidWorks):
 *     params are editable from the moment the tool is activated, not gated by
 *     placement phase.
 *
 * Pattern alignment: `line-keyboard-handler.ts` / `circle-keyboard-handler.ts`.
 * Pure strategy function — no React, no DOM, no Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1 §7.2 Phase 5a + Phase 7b2b-β
 */

import type { StairField } from '../types/common-interfaces';
import type {
  KeyboardHandler,
  KeyboardHandlerActions,
  KeyboardHandlerContext,
  KeyboardHandlerRefs,
} from './types';

// ─── Validation ranges (industry / NOK / IBC convergence) ────────────────────

const STAIR_FIELD_RANGES = {
  rise: { min: 100, max: 220 },     // mm — IBC 102-178, NOK 140-200
  tread: { min: 220, max: 360 },    // mm — IBC ≥279, NOK 260-320
  width: { min: 600, max: 2400 },   // mm — NOK ≥800, ≥1200 main
} as const;

const STAIR_FIELD_CYCLE: readonly StairField[] = ['rise', 'tread', 'width'] as const;

// ─── Main handler ────────────────────────────────────────────────────────────

export const handleStairKeyboard: KeyboardHandler = (
  e,
  keyType,
  context,
  actions,
  refs,
) => {
  if (keyType === 'Tab') return handleStairTab(e, context, actions, refs);
  if (keyType === 'Enter') return handleStairEnter(context, actions);
  return false;
};

// ─── Tab — cycle rise → tread → width (Shift+Tab reverses) ───────────────────

function handleStairTab(
  e: KeyboardEvent,
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs,
): boolean {
  const currentIdx = STAIR_FIELD_CYCLE.indexOf(context.activeStairField);
  if (currentIdx < 0) return false;
  const len = STAIR_FIELD_CYCLE.length;
  const nextIdx = e.shiftKey
    ? (currentIdx - 1 + len) % len
    : (currentIdx + 1) % len;
  const nextField = STAIR_FIELD_CYCLE[nextIdx];
  actions.setActiveStairField(nextField);
  const ref =
    nextField === 'rise' ? refs.riseInputRef
    : nextField === 'tread' ? refs.treadInputRef
    : refs.widthInputRef;
  actions.focusAndSelect(ref);
  return true;
}

// ─── Enter — confirm stair placement step (parses current values) ────────────

function handleStairEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
): boolean {
  const { activeTool, riseValue, treadValue, widthValue, isValidNumber } = context;

  const rise = parseStairField('rise', riseValue, isValidNumber);
  const tread = parseStairField('tread', treadValue, isValidNumber);
  const width = parseStairField('width', widthValue, isValidNumber);

  if (rise === null || tread === null || width === null) {
    actions.CADFeedback.onError();
    return false;
  }

  actions.CADFeedback.onInputConfirm();
  actions.dispatchDynamicSubmit({
    tool: activeTool,
    action: 'commit-stair',
    rise,
    tread,
    width,
  });
  return true;
}

function parseStairField(
  field: StairField,
  raw: string,
  isValidNumber: (v: string) => boolean,
): number | null {
  if (!isValidNumber(raw)) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return validateStairField(field, n) ? n : null;
}

// ─── Range validator (exported for ribbon-panel reuse Phase 7a) ──────────────

export function validateStairField(
  field: StairField,
  valueMm: number,
): boolean {
  const range = STAIR_FIELD_RANGES[field];
  return Number.isFinite(valueMm) && valueMm >= range.min && valueMm <= range.max;
}

export { STAIR_FIELD_RANGES, STAIR_FIELD_CYCLE };
