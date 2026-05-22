// ============================================================================
// ⌨️ BIM 3D KEYBOARD SHORTCUTS — Enterprise SSoT (ADR-366 Phase 4.4 / A.6)
// ============================================================================
//
// 🏢 Mirror SSoT of the 2D `keyboard-shortcuts.ts` — declarative, no behavior.
//    Reuses `ShortcutDefinition` interface and `matchesShortcutDef()` matcher
//    from 2D so a single matcher implementation serves both modes.
//
// Coverage:
//   - 12 canonical view jumps (Blender-style Numpad + Ctrl+Shift+Letter alias)
//   - Mode-aware Home / Fit (selection-aware F dispatch lives in dispatcher)
//
// All entries are `mode: '3D-only'` — ignored when ViewMode3DStore.mode === '2d'.
// The lone exception is `fitFrame` (F) which is `mode-aware` — its behavior is
// resolved at dispatch time (frame-selection vs fit-extents).
//
// Industry alignment: Blender 3D (Numpad-based), AutoCAD 3D (Ctrl+Shift letter).
// ============================================================================

import type { CanonicalViewId } from '../viewport/viewport-types';
import type { ShortcutDefinition, ShortcutMode } from '../../config/keyboard-shortcuts';
import { matchesShortcutDef } from '../../config/keyboard-shortcuts';

// ============================================================================
// 🧭 ACTION TAXONOMY
// ============================================================================

/** Action prefix for canonical view jumps. Dispatched via shortcut-dispatcher. */
export type View3DAction = `view3d:${CanonicalViewId}`;

/** Mode-aware fit/frame action — dispatcher picks selection vs scene at fire time. */
export const ACTION_FIT_FRAME_3D = 'view3d:fit-frame' as const;
export const ACTION_HOME_3D = 'view3d:home' as const;

// ADR-366 Phase 4.5 / A.7.Q4 — Keyboard pan (screen-space delta in CSS pixels).
export type PanDirection = 'left' | 'right' | 'up' | 'down';
export type PanStep = 'normal' | 'fine';
export const PAN_STEP_NORMAL_PX = 50;
export const PAN_STEP_FINE_PX = 10;

export type Pan3DAction = `view3d:pan-${PanDirection}` | `view3d:pan-${PanDirection}-fine`;
export function pan3dAction(direction: PanDirection, step: PanStep): Pan3DAction {
  return step === 'fine' ? `view3d:pan-${direction}-fine` : `view3d:pan-${direction}`;
}
export function parsePan3dAction(
  action: string,
): { direction: PanDirection; step: PanStep } | null {
  if (!action.startsWith('view3d:pan-')) return null;
  const rest = action.slice('view3d:pan-'.length);
  const fineMatch = /^(left|right|up|down)-fine$/.exec(rest);
  if (fineMatch) return { direction: fineMatch[1] as PanDirection, step: 'fine' };
  const normalMatch = /^(left|right|up|down)$/.exec(rest);
  if (normalMatch) return { direction: normalMatch[1] as PanDirection, step: 'normal' };
  return null;
}

// ADR-366 Phase 4.5 / A.7.Q1 — Keyboard focus navigation actions.
export const ACTION_FOCUS_NEXT_3D = 'view3d:focus-next' as const;
export const ACTION_FOCUS_PREV_3D = 'view3d:focus-prev' as const;
export const ACTION_FOCUS_SELECT_3D = 'view3d:focus-select' as const;
export const ACTION_FOCUS_CLEAR_3D = 'view3d:focus-clear' as const;

// ADR-366 Phase 9 / C.3.Q1 — Manual 3D dimensions tool activation (D3D = Ctrl+Shift+D).
export const ACTION_DIM3D_TOGGLE = 'view3d:dim3d-toggle' as const;
export const ACTION_DIM3D_CYCLE_MODE = 'view3d:dim3d-cycle-mode' as const;

/** Returns the canonical action id for a given view. */
export function view3dAction(view: CanonicalViewId): View3DAction {
  return `view3d:${view}`;
}

/** Reverse: extract `CanonicalViewId` from a `view3d:<id>` action; null otherwise. */
export function parseView3dAction(action: string): CanonicalViewId | null {
  if (!action.startsWith('view3d:')) return null;
  const id = action.slice('view3d:'.length);
  if (id === 'fit-frame' || id === 'home') return null;
  return id as CanonicalViewId;
}

// ============================================================================
// 🔢 NUMPAD CANONICAL VIEW SHORTCUTS (Blender convention)
// ============================================================================
// Numpad layout — center (5) is HOME (iso-ne). Side digits map to compass
// directions; Ctrl-modifier flips to the inverse view per Blender's pattern.
//
//   7 (top)      8 (iso-uw via Ctrl+9 alt)     9 (iso-se)
//   4 (iso-nw)   5 (HOME iso-ne)               6 (— reserved future)
//   1 (front)    2 (iso-sw)                    3 (right)
//
//   Ctrl+1 → back, Ctrl+3 → left, Ctrl+7 → bottom
//   Ctrl+5 → iso-uw (upper-west edge), Ctrl+9 → iso-ue (upper-east edge)

const NUMPAD_3D_MODE: ShortcutMode = '3D-only';

export const VIEW_3D_NUMPAD_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // ── Primary numpad: 7 entries ─────────────────────────────────────────────
  numpadFront: {
    key: 'Numpad1',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.front',
    action: view3dAction('front'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadIsoSw: {
    key: 'Numpad2',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.isoSw',
    action: view3dAction('iso-sw'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadRight: {
    key: 'Numpad3',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.right',
    action: view3dAction('right'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadIsoNw: {
    key: 'Numpad4',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.isoNw',
    action: view3dAction('iso-nw'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadHome: {
    key: 'Numpad5',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.home',
    // Numpad5 = HOME → resolves to iso-ne via canonical-views.HOME_CANONICAL_VIEW_ID
    action: ACTION_HOME_3D,
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadTop: {
    key: 'Numpad7',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.top',
    action: view3dAction('top'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadIsoSe: {
    key: 'Numpad9',
    modifier: 'none',
    descriptionKey: 'shortcuts.view3d.isoSe',
    action: view3dAction('iso-se'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  // ── Ctrl+Numpad: inverse face views + edge isos — 5 entries ───────────────
  numpadBack: {
    key: 'Numpad1',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.back',
    action: view3dAction('back'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadLeft: {
    key: 'Numpad3',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.left',
    action: view3dAction('left'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadIsoUw: {
    key: 'Numpad5',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.isoUw',
    action: view3dAction('iso-uw'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadBottom: {
    key: 'Numpad7',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.bottom',
    action: view3dAction('bottom'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  numpadIsoUe: {
    key: 'Numpad9',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.isoUe',
    action: view3dAction('iso-ue'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
} as const;

// ============================================================================
// 🔤 CTRL+SHIFT+LETTER ALIASES (AutoCAD-style mnemonic)
// ============================================================================
// Alternative shortcuts for laptops without numpads — 6 ortho face views only.
// Iso views remain Numpad-exclusive (no natural letter mnemonic).
//
//   Ctrl+Shift+T → Top      Ctrl+Shift+F → Front     Ctrl+Shift+B → Back
//   Ctrl+Shift+L → Left     Ctrl+Shift+R → Right     Ctrl+Shift+U → Under (Bottom)

export const VIEW_3D_LETTER_SHORTCUTS: Record<string, ShortcutDefinition> = {
  letterTop: {
    key: 'T',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.top',
    action: view3dAction('top'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  letterFront: {
    key: 'F',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.front',
    action: view3dAction('front'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  letterBack: {
    key: 'B',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.back',
    action: view3dAction('back'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  letterLeft: {
    key: 'L',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.left',
    action: view3dAction('left'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  letterRight: {
    key: 'R',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.right',
    action: view3dAction('right'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
  letterBottom: {
    key: 'U',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.bottom',
    action: view3dAction('bottom'),
    category: 'view3d',
    mode: NUMPAD_3D_MODE,
  },
} as const;

// ============================================================================
// 🎯 MODE-AWARE FIT/FRAME (selection-aware F)
// ============================================================================
// In 3D mode: F frames the current selection if non-empty, else fit-extents.
// The 2D viewer's existing F shortcut (`zoomExtents`) stays unchanged — its
// `mode` field is tagged `mode-aware` and the dispatcher resolves which one fires.

export const VIEW_3D_FIT_SHORTCUT: ShortcutDefinition = {
  key: 'F',
  modifier: 'none',
  descriptionKey: 'shortcuts.view3d.fitFrame',
  action: ACTION_FIT_FRAME_3D,
  category: 'view3d',
  mode: 'mode-aware',
} as const;

// Home key in 3D mode → snap to HOME view (NE iso, ViewCube parity).
// In 2D, the same key is `fitToViewHome` (mode-aware) → 2D fit-to-extents.
export const VIEW_3D_HOME_SHORTCUT: ShortcutDefinition = {
  key: 'Home',
  modifier: 'none',
  descriptionKey: 'shortcuts.view3d.home',
  action: ACTION_HOME_3D,
  category: 'view3d',
  mode: '3D-only',
} as const;

// ============================================================================
// 🖐️ KEYBOARD PAN — ADR-366 Phase 4.5 / A.7.Q4 (Blender-extended)
// ============================================================================
// 8 entries — Ctrl+Arrow (50px screen-space) + Shift+Ctrl+Arrow (10px fine).
// Mirrors A.6.Q2 Alt+Arrow orbit pattern. Ctrl+Arrows are FREE in the 2D SSoT
// (verified) so no conflict. 2D-mode Ctrl+Arrows remain reserved for future use.

const PAN_3D_MODE: ShortcutMode = '3D-only';

export const PAN_3D_SHORTCUTS: Record<string, ShortcutDefinition> = {
  panLeft: {
    key: 'ArrowLeft', modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.panLeft',
    action: pan3dAction('left', 'normal'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panRight: {
    key: 'ArrowRight', modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.panRight',
    action: pan3dAction('right', 'normal'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panUp: {
    key: 'ArrowUp', modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.panUp',
    action: pan3dAction('up', 'normal'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panDown: {
    key: 'ArrowDown', modifier: 'ctrl',
    descriptionKey: 'shortcuts.view3d.panDown',
    action: pan3dAction('down', 'normal'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panLeftFine: {
    key: 'ArrowLeft', modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.panLeftFine',
    action: pan3dAction('left', 'fine'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panRightFine: {
    key: 'ArrowRight', modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.panRightFine',
    action: pan3dAction('right', 'fine'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panUpFine: {
    key: 'ArrowUp', modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.panUpFine',
    action: pan3dAction('up', 'fine'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
  panDownFine: {
    key: 'ArrowDown', modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.panDownFine',
    action: pan3dAction('down', 'fine'),
    category: 'view3d', mode: PAN_3D_MODE,
  },
} as const;

// ============================================================================
// ♿ KEYBOARD FOCUS NAVIGATION — ADR-366 Phase 4.5 / A.7.Q1
// ============================================================================
// Tab cycles visible entities (sorted closest-to-camera), Shift+Tab reverses,
// Enter toggles selection on focused entity, Escape clears focus.

export const FOCUS_3D_SHORTCUTS: Record<string, ShortcutDefinition> = {
  focusNext: {
    key: 'Tab', modifier: 'none',
    descriptionKey: 'shortcuts.view3d.focusNext',
    action: ACTION_FOCUS_NEXT_3D,
    category: 'view3d', mode: '3D-only',
  },
  focusPrev: {
    key: 'Tab', modifier: 'shift',
    descriptionKey: 'shortcuts.view3d.focusPrev',
    action: ACTION_FOCUS_PREV_3D,
    category: 'view3d', mode: '3D-only',
  },
  focusSelect: {
    key: 'Enter', modifier: 'none',
    descriptionKey: 'shortcuts.view3d.focusSelect',
    action: ACTION_FOCUS_SELECT_3D,
    category: 'view3d', mode: '3D-only',
  },
  focusClear: {
    key: 'Escape', modifier: 'none',
    descriptionKey: 'shortcuts.view3d.focusClear',
    action: ACTION_FOCUS_CLEAR_3D,
    category: 'view3d', mode: '3D-only',
  },
} as const;

// ============================================================================
// 📏 DIMENSION TOOL SHORTCUTS — ADR-366 Phase 9 / C.3.Q1
// ============================================================================
// Mirror ADR-362 2D dim activation. D3D = Ctrl+Shift+D (does not conflict with
// browser Ctrl+D bookmark when combined with Shift). Tab cycles mode mid-tool.

export const DIM3D_SHORTCUTS: Record<string, ShortcutDefinition> = {
  toggleTool: {
    key: 'D',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.view3d.dim3dToggle',
    action: ACTION_DIM3D_TOGGLE,
    category: 'view3d',
    mode: '3D-only',
  },
} as const;

// ============================================================================
// 🔗 COMBINED MAP + DERIVED INDICES
// ============================================================================

export const ALL_VIEW_3D_SHORTCUTS = {
  ...VIEW_3D_NUMPAD_SHORTCUTS,
  ...VIEW_3D_LETTER_SHORTCUTS,
  ...PAN_3D_SHORTCUTS,
  ...FOCUS_3D_SHORTCUTS,
  ...DIM3D_SHORTCUTS,
  fitFrame: VIEW_3D_FIT_SHORTCUT,
  homeKey: VIEW_3D_HOME_SHORTCUT,
} as const;

/** Ordered list of every 3D shortcut definition — iteration source for dispatcher. */
export const VIEW_3D_SHORTCUT_LIST: readonly ShortcutDefinition[] =
  Object.values(ALL_VIEW_3D_SHORTCUTS);

// ============================================================================
// 🔧 HELPERS
// ============================================================================

/**
 * Match a keyboard event against any 3D shortcut. Returns the matched
 * definition (first match wins, by insertion order) or null.
 *
 * Mode gating is intentionally NOT applied here — callers decide whether the
 * current viewport is 3D. This keeps the matcher pure and testable.
 */
export function matchView3DShortcut(event: KeyboardEvent): ShortcutDefinition | null {
  for (const def of VIEW_3D_SHORTCUT_LIST) {
    if (matchesShortcutDef(event, def)) return def;
  }
  return null;
}

/** Returns true if `action` belongs to the view3d action namespace. */
export function isView3DAction(action: string): boolean {
  return action.startsWith('view3d:');
}

export type View3DShortcutId = keyof typeof ALL_VIEW_3D_SHORTCUTS;
