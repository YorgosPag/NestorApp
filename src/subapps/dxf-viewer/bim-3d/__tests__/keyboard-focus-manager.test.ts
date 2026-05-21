/**
 * ADR-366 Phase 4.5 — Accessibility unit tests.
 *
 * Coverage:
 *   - KeyboardFocusManager state machine (cycle, wrap, dispose, stale focus)
 *   - status-bar-text-generator (per-type labels, delta, count, edge cases)
 *   - panStepToScreenDelta (direction × step → signed dx/dy)
 *   - keyboard-shortcuts-3d new SSoT entries (pan + focus actions, parsers)
 */

import { createKeyboardFocusManager } from '../accessibility/KeyboardFocusManager';
import {
  generateFocusStatusText,
  generateSelectionDeltaText,
  generateSelectionCountText,
  entityTypeLabel,
  normalizeEntityType,
} from '../accessibility/status-bar-text-generator';
import {
  panStepToScreenDelta,
} from '../shortcuts/shortcut-dispatcher';
import {
  PAN_STEP_NORMAL_PX,
  PAN_STEP_FINE_PX,
  pan3dAction,
  parsePan3dAction,
  ACTION_FOCUS_NEXT_3D,
  ACTION_FOCUS_PREV_3D,
  ACTION_FOCUS_SELECT_3D,
  ACTION_FOCUS_CLEAR_3D,
  FOCUS_3D_SHORTCUTS,
  PAN_3D_SHORTCUTS,
  matchView3DShortcut,
} from '../shortcuts/keyboard-shortcuts-3d';

// ── Test fakes ─────────────────────────────────────────────────────────────

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

// Fake i18n t — echoes key with vars interpolation for assertions.
const fakeT = (key: string, vars?: Record<string, unknown>): string => {
  if (!vars) return key;
  const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`).join(',');
  return `${key}{${parts}}`;
};

// ── 1. KeyboardFocusManager state machine ──────────────────────────────────

describe('KeyboardFocusManager', () => {
  it('starts with no focus and empty order', () => {
    const fm = createKeyboardFocusManager();
    expect(fm.getFocused()).toBeNull();
    expect(fm.next()).toBeNull();
    expect(fm.prev()).toBeNull();
  });

  it('next() cycles ascending, wraps to start', () => {
    const fm = createKeyboardFocusManager();
    fm.setOrder(['a', 'b', 'c']);
    expect(fm.next()).toBe('a');
    expect(fm.next()).toBe('b');
    expect(fm.next()).toBe('c');
    expect(fm.next()).toBe('a');
  });

  it('prev() cycles descending, wraps to end', () => {
    const fm = createKeyboardFocusManager();
    fm.setOrder(['a', 'b', 'c']);
    expect(fm.prev()).toBe('c'); // no prior focus → enter at LAST (Shift+Tab convention)
    expect(fm.prev()).toBe('b');
    expect(fm.prev()).toBe('a');
    expect(fm.prev()).toBe('c'); // wraps
  });

  it('setFocus emits to subscribers exactly once on change', () => {
    const fm = createKeyboardFocusManager();
    const seen: (string | null)[] = [];
    const unsub = fm.subscribe((id) => seen.push(id));
    fm.setOrder(['a', 'b']);
    fm.setFocus('a');
    fm.setFocus('a'); // idempotent → no emit
    fm.setFocus('b');
    fm.clear();
    unsub();
    fm.setFocus('a'); // after unsubscribe → no emit
    expect(seen).toEqual(['a', 'b', null]);
  });

  it('clears focus when current id drops out of new order (hidden-entity skip)', () => {
    const fm = createKeyboardFocusManager();
    fm.setOrder(['a', 'b', 'c']);
    fm.next();
    expect(fm.getFocused()).toBe('a');
    // Entity 'a' becomes hidden — caller pushes new order without it.
    fm.setOrder(['b', 'c']);
    expect(fm.getFocused()).toBeNull();
  });

  it('preserves focus when current id remains in new order', () => {
    const fm = createKeyboardFocusManager();
    fm.setOrder(['a', 'b', 'c']);
    fm.next();
    fm.next();
    expect(fm.getFocused()).toBe('b');
    fm.setOrder(['b', 'd', 'e']); // 'b' still present
    expect(fm.getFocused()).toBe('b');
  });

  it('dispose() drops listeners and resets state', () => {
    const fm = createKeyboardFocusManager();
    const seen: (string | null)[] = [];
    fm.subscribe((id) => seen.push(id));
    fm.setOrder(['a']);
    fm.setFocus('a');
    fm.dispose();
    fm.setFocus('b'); // listener gone → no notification
    expect(seen).toEqual(['a']);
    expect(fm.getFocused()).toBeNull();
  });
});

// ── 2. Status-bar text generator ───────────────────────────────────────────

describe('status-bar-text-generator', () => {
  it('normalizes raw bimType strings (singular + plural variants)', () => {
    expect(normalizeEntityType('wall')).toBe('wall');
    expect(normalizeEntityType('Walls')).toBe('wall');
    expect(normalizeEntityType('Column')).toBe('column');
    expect(normalizeEntityType('unknown')).toBeNull();
    expect(normalizeEntityType(null)).toBeNull();
    expect(normalizeEntityType(undefined)).toBeNull();
  });

  it('entityTypeLabel returns translated key for known types only', () => {
    expect(entityTypeLabel('wall', fakeT)).toBe('entityTypes.wall');
    expect(entityTypeLabel('slab', fakeT)).toBe('entityTypes.slab');
    expect(entityTypeLabel('unknown', fakeT)).toBe('');
  });

  it('generateFocusStatusText routes to the right variant per inputs', () => {
    expect(generateFocusStatusText('wall', 'W-12', fakeT)).toBe(
      'accessibility.status.focused{type=entityTypes.wall,name=W-12}',
    );
    expect(generateFocusStatusText('wall', '', fakeT)).toBe(
      'accessibility.status.focusedTypeOnly{type=entityTypes.wall}',
    );
    expect(generateFocusStatusText('', 'X', fakeT)).toBe(
      'accessibility.status.focusedNameOnly{name=X}',
    );
    expect(generateFocusStatusText(null, null, fakeT)).toBe('accessibility.status.focusCleared');
  });

  it('generateSelectionDeltaText formats add / remove / no-op', () => {
    expect(generateSelectionDeltaText(1, fakeT)).toBe('accessibility.status.selectionAdded{count=1}');
    expect(generateSelectionDeltaText(-3, fakeT)).toBe('accessibility.status.selectionRemoved{count=3}');
    expect(generateSelectionDeltaText(0, fakeT)).toBe('');
  });

  it('generateSelectionCountText distinguishes none vs count', () => {
    expect(generateSelectionCountText(0, fakeT)).toBe('accessibility.status.selectionNone');
    expect(generateSelectionCountText(5, fakeT)).toBe('accessibility.status.selectionCount{count=5}');
  });
});

// ── 3. Pan step → screen delta + action round-trip ─────────────────────────

describe('panStepToScreenDelta', () => {
  it('maps each cardinal direction at normal step', () => {
    expect(panStepToScreenDelta('left', 'normal')).toEqual({ dx: -PAN_STEP_NORMAL_PX, dy: 0 });
    expect(panStepToScreenDelta('right', 'normal')).toEqual({ dx: PAN_STEP_NORMAL_PX, dy: 0 });
    expect(panStepToScreenDelta('up', 'normal')).toEqual({ dx: 0, dy: PAN_STEP_NORMAL_PX });
    expect(panStepToScreenDelta('down', 'normal')).toEqual({ dx: 0, dy: -PAN_STEP_NORMAL_PX });
  });

  it('fine step uses the smaller magnitude across all directions', () => {
    expect(panStepToScreenDelta('left', 'fine').dx).toBe(-PAN_STEP_FINE_PX);
    expect(panStepToScreenDelta('right', 'fine').dx).toBe(PAN_STEP_FINE_PX);
    expect(panStepToScreenDelta('up', 'fine').dy).toBe(PAN_STEP_FINE_PX);
    expect(panStepToScreenDelta('down', 'fine').dy).toBe(-PAN_STEP_FINE_PX);
  });

  it('pan3dAction ↔ parsePan3dAction round-trip', () => {
    for (const d of ['left', 'right', 'up', 'down'] as const) {
      for (const s of ['normal', 'fine'] as const) {
        const a = pan3dAction(d, s);
        const parsed = parsePan3dAction(a);
        expect(parsed).toEqual({ direction: d, step: s });
      }
    }
    expect(parsePan3dAction('view3d:focus-next')).toBeNull();
    expect(parsePan3dAction('view3d:top')).toBeNull();
    expect(parsePan3dAction('tool:line')).toBeNull();
  });
});

// ── 4. Shortcut SSoT — focus + pan entries reachable ───────────────────────

describe('keyboard-shortcuts-3d (Phase 4.5 additions)', () => {
  it('FOCUS_3D_SHORTCUTS exposes 4 entries with focus actions and 3D-only mode', () => {
    expect(Object.keys(FOCUS_3D_SHORTCUTS)).toHaveLength(4);
    const actions = Object.values(FOCUS_3D_SHORTCUTS).map((s) => s.action);
    expect(actions).toContain(ACTION_FOCUS_NEXT_3D);
    expect(actions).toContain(ACTION_FOCUS_PREV_3D);
    expect(actions).toContain(ACTION_FOCUS_SELECT_3D);
    expect(actions).toContain(ACTION_FOCUS_CLEAR_3D);
    for (const def of Object.values(FOCUS_3D_SHORTCUTS)) {
      expect(def.mode).toBe('3D-only');
      expect(def.category).toBe('view3d');
    }
  });

  it('PAN_3D_SHORTCUTS exposes 8 entries (4 normal + 4 fine)', () => {
    expect(Object.keys(PAN_3D_SHORTCUTS)).toHaveLength(8);
    const fineCount = Object.values(PAN_3D_SHORTCUTS).filter(
      (s) => s.modifier === 'ctrlShift',
    ).length;
    const normalCount = Object.values(PAN_3D_SHORTCUTS).filter(
      (s) => s.modifier === 'ctrl',
    ).length;
    expect(fineCount).toBe(4);
    expect(normalCount).toBe(4);
  });

  it('matchView3DShortcut routes Tab → focus-next, Shift+Tab → focus-prev', () => {
    const next = matchView3DShortcut(mkEvent({ key: 'Tab', code: 'Tab' }));
    expect(next?.action).toBe(ACTION_FOCUS_NEXT_3D);
    const prev = matchView3DShortcut(mkEvent({ key: 'Tab', code: 'Tab', shiftKey: true }));
    expect(prev?.action).toBe(ACTION_FOCUS_PREV_3D);
  });

  it('matchView3DShortcut routes Ctrl+ArrowRight → pan-right normal', () => {
    const m = matchView3DShortcut(mkEvent({ key: 'ArrowRight', code: 'ArrowRight', ctrlKey: true }));
    expect(m?.action).toBe(pan3dAction('right', 'normal'));
  });

  it('matchView3DShortcut routes Ctrl+Shift+ArrowDown → pan-down fine', () => {
    const m = matchView3DShortcut(mkEvent({
      key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true, shiftKey: true,
    }));
    expect(m?.action).toBe(pan3dAction('down', 'fine'));
  });
});
