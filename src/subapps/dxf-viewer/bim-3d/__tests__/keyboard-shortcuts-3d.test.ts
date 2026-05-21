/**
 * ADR-366 Phase 4.4 — 3D keyboard shortcuts unit tests.
 *
 * Coverage:
 *   - SSoT shape (12 canonical views reachable via Numpad)
 *   - matchView3DShortcut event matching (Numpad / Ctrl+Numpad / Ctrl+Shift+Letter)
 *   - dispatchShortcut routing (view snap, home, fit-frame, mode gating)
 *   - Auto-switch detection (2D-only drawing tools, select/pan exempt, mode-aware exempt)
 *   - parseView3dAction round-trip
 */

import type { CanonicalViewId } from '../viewport/viewport-types';
import {
  ALL_VIEW_3D_SHORTCUTS,
  VIEW_3D_NUMPAD_SHORTCUTS,
  VIEW_3D_LETTER_SHORTCUTS,
  matchView3DShortcut,
  parseView3dAction,
  view3dAction,
  isView3DAction,
  ACTION_FIT_FRAME_3D,
  ACTION_HOME_3D,
} from '../shortcuts/keyboard-shortcuts-3d';
import {
  dispatchShortcut,
  type ShortcutDispatchContext,
} from '../shortcuts/shortcut-dispatcher';

// ── Fake event factory (jsdom-agnostic) ────────────────────────────────────

function mkEvent(props: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    ...props,
  } as KeyboardEvent;
}

function mkCtx(overrides: Partial<ShortcutDispatchContext> = {}): ShortcutDispatchContext & {
  calls: {
    snapToView: CanonicalViewId[];
    snapHome: number;
    fitFrame: number;
    switchTo2D: number;
    toasts: string[];
  };
} {
  const calls = {
    snapToView: [] as CanonicalViewId[],
    snapHome: 0,
    fitFrame: 0,
    switchTo2D: 0,
    toasts: [] as string[],
  };
  const ctx: ShortcutDispatchContext = {
    is3D: true,
    onSnapToView: (v) => calls.snapToView.push(v),
    onSnapHome: () => { calls.snapHome += 1; },
    onFitFrame3D: () => { calls.fitFrame += 1; },
    onSwitchTo2D: () => { calls.switchTo2D += 1; },
    onAutoSwitchToast: (label) => calls.toasts.push(label),
    // Phase 4.5 — no-op defaults; specific tests override via `overrides`.
    onPan3D: () => undefined,
    onFocusNext3D: () => undefined,
    onFocusPrev3D: () => undefined,
    onFocusSelect3D: () => undefined,
    onFocusClear3D: () => undefined,
    ...overrides,
  };
  return Object.assign(ctx, { calls }) as never;
}

// ── 1. SSoT structural invariants ───────────────────────────────────────────

describe('keyboard-shortcuts-3d SSoT', () => {
  const ALL_CANONICAL_VIEWS: CanonicalViewId[] = [
    'top', 'bottom', 'front', 'back', 'left', 'right',
    'iso-ne', 'iso-nw', 'iso-se', 'iso-sw', 'iso-ue', 'iso-uw',
  ];

  it('Numpad map covers all 12 canonical views (5=home → iso-ne)', () => {
    const actions = Object.values(VIEW_3D_NUMPAD_SHORTCUTS).map((s) => s.action);
    const expected = ALL_CANONICAL_VIEWS.map(view3dAction);
    // Home action maps to iso-ne implicitly — substitute.
    const normalized = actions.map((a) => (a === ACTION_HOME_3D ? view3dAction('iso-ne') : a));
    for (const exp of expected) {
      expect(normalized).toContain(exp);
    }
  });

  it('Ctrl+Shift+Letter map covers 6 ortho face views', () => {
    expect(Object.keys(VIEW_3D_LETTER_SHORTCUTS)).toHaveLength(6);
    const actions = Object.values(VIEW_3D_LETTER_SHORTCUTS).map((s) => s.action);
    for (const v of ['top', 'bottom', 'front', 'back', 'left', 'right'] as const) {
      expect(actions).toContain(view3dAction(v));
    }
  });

  it('every entry has category=view3d and a defined mode', () => {
    for (const s of Object.values(ALL_VIEW_3D_SHORTCUTS)) {
      expect(s.category).toBe('view3d');
      expect(s.mode).toBeDefined();
    }
  });

  it('parseView3dAction round-trips for all canonical views', () => {
    for (const v of ALL_CANONICAL_VIEWS) {
      expect(parseView3dAction(view3dAction(v))).toBe(v);
    }
    expect(parseView3dAction(ACTION_HOME_3D)).toBeNull();
    expect(parseView3dAction(ACTION_FIT_FRAME_3D)).toBeNull();
    expect(parseView3dAction('tool:line')).toBeNull();
  });

  it('isView3DAction recognizes the view3d namespace only', () => {
    expect(isView3DAction(view3dAction('top'))).toBe(true);
    expect(isView3DAction(ACTION_HOME_3D)).toBe(true);
    expect(isView3DAction(ACTION_FIT_FRAME_3D)).toBe(true);
    expect(isView3DAction('tool:line')).toBe(false);
    expect(isView3DAction('action:undo')).toBe(false);
  });
});

// ── 2. Event matching ───────────────────────────────────────────────────────

describe('matchView3DShortcut', () => {
  it('matches Numpad 1 → front', () => {
    const m = matchView3DShortcut(mkEvent({ key: '1', code: 'Numpad1' }));
    expect(m?.action).toBe(view3dAction('front'));
  });

  it('matches Numpad 5 → HOME action', () => {
    const m = matchView3DShortcut(mkEvent({ key: '5', code: 'Numpad5' }));
    expect(m?.action).toBe(ACTION_HOME_3D);
  });

  it('matches Ctrl+Numpad 7 → bottom', () => {
    const m = matchView3DShortcut(mkEvent({ key: '7', code: 'Numpad7', ctrlKey: true }));
    expect(m?.action).toBe(view3dAction('bottom'));
  });

  it('matches Ctrl+Shift+T → top (letter alias)', () => {
    const m = matchView3DShortcut(mkEvent({ key: 'T', code: 'KeyT', ctrlKey: true, shiftKey: true }));
    expect(m?.action).toBe(view3dAction('top'));
  });

  it('returns null for unrelated keys', () => {
    expect(matchView3DShortcut(mkEvent({ key: 'a', code: 'KeyA' }))).toBeNull();
    // Phase 4.5: Escape now matches focusClear — use a key with no 3D binding instead.
    expect(matchView3DShortcut(mkEvent({ key: 'q', code: 'KeyQ' }))).toBeNull();
  });

  it('does not match Numpad 1 when irrelevant modifier present', () => {
    const m = matchView3DShortcut(mkEvent({ key: '1', code: 'Numpad1', altKey: true }));
    expect(m).toBeNull();
  });
});

// ── 3. dispatchShortcut routing ─────────────────────────────────────────────

describe('dispatchShortcut — 3D mode', () => {
  it('snaps to canonical view on Numpad 7 (top)', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: '7', code: 'Numpad7' }), ctx);
    expect(r.handled).toBe(true);
    expect(r.autoSwitched).toBe(false);
    expect(ctx.calls.snapToView).toEqual(['top']);
  });

  it('calls snapHome for Numpad 5', () => {
    const ctx = mkCtx();
    dispatchShortcut(mkEvent({ key: '5', code: 'Numpad5' }), ctx);
    expect(ctx.calls.snapHome).toBe(1);
  });

  it('calls snapHome for Home key in 3D', () => {
    const ctx = mkCtx();
    dispatchShortcut(mkEvent({ key: 'Home', code: 'Home' }), ctx);
    expect(ctx.calls.snapHome).toBe(1);
  });

  it('calls fitFrame3D for F key in 3D (selection-aware)', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 'f', code: 'KeyF' }), ctx);
    expect(r.handled).toBe(true);
    expect(ctx.calls.fitFrame).toBe(1);
  });

  it('letter-alias Ctrl+Shift+L snaps to left', () => {
    const ctx = mkCtx();
    dispatchShortcut(mkEvent({ key: 'l', code: 'KeyL', ctrlKey: true, shiftKey: true }), ctx);
    expect(ctx.calls.snapToView).toEqual(['left']);
  });
});

describe('dispatchShortcut — 2D mode gating', () => {
  it('ignores 3D-only Numpad shortcuts when is3D=false', () => {
    const ctx = mkCtx({ is3D: false });
    const r = dispatchShortcut(mkEvent({ key: '1', code: 'Numpad1' }), ctx);
    expect(r.handled).toBe(false);
    expect(ctx.calls.snapToView).toEqual([]);
  });

  it('mode-aware F does NOT fire 3D fitFrame in 2D mode', () => {
    const ctx = mkCtx({ is3D: false });
    const r = dispatchShortcut(mkEvent({ key: 'f', code: 'KeyF' }), ctx);
    expect(r.handled).toBe(false);
    expect(ctx.calls.fitFrame).toBe(0);
  });

  it('does not auto-switch in 2D mode (no toast, no switchTo2D)', () => {
    const ctx = mkCtx({ is3D: false });
    dispatchShortcut(mkEvent({ key: 'l', code: 'KeyL' }), ctx);
    expect(ctx.calls.switchTo2D).toBe(0);
    expect(ctx.calls.toasts).toEqual([]);
  });
});

// ── 4. Auto-switch behavior ─────────────────────────────────────────────────

describe('dispatchShortcut — auto-switch from 3D to 2D', () => {
  it('triggers auto-switch when pressing L (line tool) in 3D', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 'l', code: 'KeyL' }), ctx);
    expect(r.handled).toBe(true);
    expect(r.autoSwitched).toBe(true);
    expect(ctx.calls.switchTo2D).toBe(1);
    expect(ctx.calls.toasts).toHaveLength(1);
    expect(ctx.calls.toasts[0]).toContain('L');
  });

  it('triggers auto-switch when pressing R (rectangle) in 3D', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 'r', code: 'KeyR' }), ctx);
    expect(r.autoSwitched).toBe(true);
    expect(ctx.calls.switchTo2D).toBe(1);
  });

  it('does NOT auto-switch for S (select — universal)', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 's', code: 'KeyS' }), ctx);
    expect(r.handled).toBe(false);
    expect(ctx.calls.switchTo2D).toBe(0);
  });

  it('does NOT auto-switch for P (pan — universal)', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 'p', code: 'KeyP' }), ctx);
    expect(r.handled).toBe(false);
    expect(ctx.calls.switchTo2D).toBe(0);
  });

  it('does NOT auto-switch for F (mode-aware — fires 3D fitFrame instead)', () => {
    const ctx = mkCtx();
    const r = dispatchShortcut(mkEvent({ key: 'f', code: 'KeyF' }), ctx);
    expect(r.autoSwitched).toBe(false);
    expect(ctx.calls.switchTo2D).toBe(0);
    expect(ctx.calls.fitFrame).toBe(1);
  });
});
