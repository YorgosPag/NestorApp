// ============================================================================
// ⌨️ 3D SHORTCUT DISPATCHER — ADR-366 Phase 4.4 / A.6.Q2-Q4
// ============================================================================
//
// Pure dispatch logic — no DOM, no React, no Three.js. Takes a keyboard event
// plus a context of callbacks/state and routes it. The hook (`use3DShortcuts`)
// owns the event subscription; this module decides what to do with the event.
//
// Three branches:
//   1. Event matches a 3D shortcut (canonical view / home / fit-frame)
//        → dispatch via context callbacks, gated by `is3D`.
//   2. Event matches a 2D-only drawing tool while in 3D mode
//        → trigger auto-switch toast + `onSwitchTo2D()`.
//   3. Otherwise → unhandled, parent listener (2D `useKeyboardShortcuts`) wins.
// ============================================================================

import type { ShortcutDefinition } from '../../config/keyboard-shortcuts';
import {
  DXF_TOOL_SHORTCUTS,
  matchesShortcutDef,
  getShortcutDisplayLabel,
} from '../../config/keyboard-shortcuts';
import {
  ACTION_FIT_FRAME_3D,
  ACTION_HOME_3D,
  ACTION_FOCUS_NEXT_3D,
  ACTION_FOCUS_PREV_3D,
  ACTION_FOCUS_SELECT_3D,
  ACTION_FOCUS_CLEAR_3D,
  ACTION_CROP_REGION_TOGGLE,
  PAN_STEP_NORMAL_PX,
  PAN_STEP_FINE_PX,
  matchView3DShortcut,
  parsePan3dAction,
  parseView3dAction,
  type PanDirection,
  type PanStep,
} from './keyboard-shortcuts-3d';
import type { CanonicalViewId } from '../viewport/viewport-types';

// ============================================================================
// 📋 TYPES
// ============================================================================

export interface ShortcutDispatchContext {
  /** Current viewport mode — `true` for any 3D variant (raster/preview/final). */
  readonly is3D: boolean;
  /** Snap camera to a canonical face/iso view (ortho or iso). */
  readonly onSnapToView: (view: CanonicalViewId) => void;
  /** Snap camera to HOME view (NE iso per A.5 decision). */
  readonly onSnapHome: () => void;
  /** Selection-aware F in 3D — frame selection if non-empty, else fit-extents. */
  readonly onFitFrame3D: () => void;
  /** Auto-switch viewport mode to 2D (consumer = ViewMode3DStore.toggle2D3D). */
  readonly onSwitchTo2D: () => void;
  /** Toast UI hook ("Αλλαγή σε 2D για συντόμευση X"). */
  readonly onAutoSwitchToast: (shortcutLabel: string) => void;
  /** ADR-366 Phase 4.5 / A.7.Q4 — screen-space pan (Ctrl+Arrow / Ctrl+Shift+Arrow). */
  readonly onPan3D: (direction: PanDirection, step: PanStep) => void;
  /** ADR-366 Phase 4.5 / A.7.Q1 — keyboard focus navigation (Tab cycle / Enter / Esc). */
  readonly onFocusNext3D: () => void;
  readonly onFocusPrev3D: () => void;
  readonly onFocusSelect3D: () => void;
  readonly onFocusClear3D: () => void;
  /** ADR-366 §C.6.Q4 — Crop region tool toggle (Ctrl+Alt+R). Optional. */
  readonly onCropRegionToggle?: () => void;
}

export interface DispatchResult {
  /** True when the dispatcher consumed the event — caller should preventDefault. */
  readonly handled: boolean;
  /** Diagnostic — true when handling triggered a mode auto-switch. */
  readonly autoSwitched: boolean;
}

const NOT_HANDLED: DispatchResult = Object.freeze({ handled: false, autoSwitched: false });
const HANDLED: DispatchResult = Object.freeze({ handled: true, autoSwitched: false });
const HANDLED_AUTOSWITCH: DispatchResult = Object.freeze({ handled: true, autoSwitched: true });

// ============================================================================
// 🚪 PUBLIC ENTRY POINT
// ============================================================================

/**
 * Dispatch a keyboard event against the 3D shortcut system.
 *
 * The dispatcher is pure: it never reads `window`, `document`, or stores —
 * all dependencies arrive through `ctx`. Safe to unit-test with a fake context.
 */
export function dispatchShortcut(
  event: KeyboardEvent,
  ctx: ShortcutDispatchContext,
): DispatchResult {
  // ── Branch 1: 3D shortcut match ───────────────────────────────────────────
  const matched = matchView3DShortcut(event);
  if (matched) {
    return dispatchMatched3D(matched, ctx);
  }

  // ── Branch 2: 2D-only drawing tool while in 3D → auto-switch ──────────────
  if (ctx.is3D) {
    const drawingTool = match2DOnlyDrawingTool(event);
    if (drawingTool) {
      ctx.onAutoSwitchToast(formatShortcutLabel(drawingTool));
      ctx.onSwitchTo2D();
      return HANDLED_AUTOSWITCH;
    }
  }

  // ── Branch 3: unhandled — let other listeners process the event ──────────
  return NOT_HANDLED;
}

// ============================================================================
// 🔀 INTERNAL — 3D MATCH DISPATCH
// ============================================================================

function dispatchMatched3D(
  shortcut: ShortcutDefinition,
  ctx: ShortcutDispatchContext,
): DispatchResult {
  // Gate by mode. 3D-only is silently ignored in 2D (per A.6.Q3 spec).
  if (shortcut.mode === '3D-only' && !ctx.is3D) {
    return NOT_HANDLED;
  }

  // Mode-aware F shortcut: only fires its 3D branch when in 3D mode.
  // In 2D it falls through to the existing 2D `zoomExtents` (F) handler.
  if (shortcut.action === ACTION_FIT_FRAME_3D) {
    if (!ctx.is3D) return NOT_HANDLED;
    ctx.onFitFrame3D();
    return HANDLED;
  }

  if (shortcut.action === ACTION_HOME_3D) {
    ctx.onSnapHome();
    return HANDLED;
  }

  // ADR-366 Phase 4.5 / A.7.Q1 — keyboard focus navigation.
  if (shortcut.action === ACTION_FOCUS_NEXT_3D) {
    ctx.onFocusNext3D();
    return HANDLED;
  }
  if (shortcut.action === ACTION_FOCUS_PREV_3D) {
    ctx.onFocusPrev3D();
    return HANDLED;
  }
  if (shortcut.action === ACTION_FOCUS_SELECT_3D) {
    ctx.onFocusSelect3D();
    return HANDLED;
  }
  if (shortcut.action === ACTION_FOCUS_CLEAR_3D) {
    ctx.onFocusClear3D();
    return HANDLED;
  }

  // ADR-366 Phase 4.5 / A.7.Q4 — keyboard pan (Ctrl+Arrow / Ctrl+Shift+Arrow).
  const pan = parsePan3dAction(shortcut.action);
  if (pan) {
    ctx.onPan3D(pan.direction, pan.step);
    return HANDLED;
  }

  const view = parseView3dAction(shortcut.action);
  if (view) {
    ctx.onSnapToView(view);
    return HANDLED;
  }

  // ADR-366 §C.6.Q4 — crop region toggle (Ctrl+Alt+R).
  if (shortcut.action === ACTION_CROP_REGION_TOGGLE) {
    ctx.onCropRegionToggle?.();
    return HANDLED;
  }

  // Defensive: matched a 3D shortcut but action format is unrecognized.
  return NOT_HANDLED;
}

// ============================================================================
// 🖐️ PAN STEP HELPER (exposed for ThreeJsSceneManager direction → dx/dy)
// ============================================================================

/**
 * Convert a (direction, step) pair into a 2-axis screen-space delta. Positive
 * dx = view right, positive dy = view up. Magnitudes come from the SSoT
 * constants in `keyboard-shortcuts-3d.ts`.
 */
export function panStepToScreenDelta(
  direction: PanDirection,
  step: PanStep,
): { dx: number; dy: number } {
  const magnitude = step === 'fine' ? PAN_STEP_FINE_PX : PAN_STEP_NORMAL_PX;
  switch (direction) {
    case 'left': return { dx: -magnitude, dy: 0 };
    case 'right': return { dx: magnitude, dy: 0 };
    case 'up': return { dx: 0, dy: magnitude };
    case 'down': return { dx: 0, dy: -magnitude };
  }
}

// ============================================================================
// 🔍 INTERNAL — 2D-ONLY DRAWING TOOL DETECTION (auto-switch trigger)
// ============================================================================

// `select` and `pan` are universal — they remain navigation tools in 3D and
// must NOT trigger auto-switch (orbit/pan camera in 3D mode).
const UNIVERSAL_TOOL_IDS: ReadonlySet<string> = new Set([
  'select',
  'pan',
]);

function match2DOnlyDrawingTool(event: KeyboardEvent): ShortcutDefinition | null {
  for (const [id, def] of Object.entries(DXF_TOOL_SHORTCUTS)) {
    if (UNIVERSAL_TOOL_IDS.has(id)) continue;
    // Explicit override: shortcut.mode set to 'universal'/'mode-aware' → skip auto-switch.
    if (def.mode === 'universal' || def.mode === 'mode-aware') continue;
    if (matchesShortcutDef(event, def)) return def;
  }
  return null;
}

function formatShortcutLabel(def: ShortcutDefinition): string {
  // Find the registry id for the shortcut so getShortcutDisplayLabel resolves the prefix.
  const entry = Object.entries(DXF_TOOL_SHORTCUTS).find(([, v]) => v === def);
  return entry ? getShortcutDisplayLabel(entry[0]) : def.key;
}

// Exposed for unit tests — internal pieces, not for consumer code.
export const _internals = {
  match2DOnlyDrawingTool,
  dispatchMatched3D,
} as const;
