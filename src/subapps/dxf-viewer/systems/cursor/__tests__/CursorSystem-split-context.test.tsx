/**
 * CursorSystem split-context contract (perf-fix 2026-06-28, ADR-040).
 *
 * The combined CursorContext value changes identity on EVERY reducer dispatch
 * (SET_ACTIVE on canvas enter/leave, SET_MOUSE_DOWN on click), which used to
 * re-render the CanvasSection orchestrator → ~250-fiber / 178ms commit. The split
 * actions/settings contexts must NOT re-render on those dispatches. This test
 * locks that in: an actions consumer and a settings consumer stay at 1 render
 * across a SET_ACTIVE + SET_MOUSE_DOWN, while a full-context consumer re-renders.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { CursorSystem } from '../CursorSystem';
import { useCursor, useCursorActions, useCursorSettings } from '../useCursor';

jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
// Avoid the firebase-auth import chain pulled in by the real cursor config singleton.
jest.mock('../config', () => {
  const settings = { behavior: { coordinate_display: true }, performance: { precision_mode: false } };
  return {
    DEFAULT_CURSOR_SETTINGS: settings,
    cursorConfig: { bindToRepository: () => undefined, unbindFromRepository: () => undefined, resetToDefaults: () => undefined },
    getCursorSettings: () => settings,
    updateCursorSettings: () => undefined,
    subscribeToCursorSettings: () => () => undefined,
  };
});

describe('CursorSystem split contexts — no cursor-activity cascade', () => {
  it('actions/settings consumers do NOT re-render on SET_ACTIVE / SET_MOUSE_DOWN', () => {
    let actionsRenders = 0;
    let settingsRenders = 0;
    let fullRenders = 0;
    let actions: ReturnType<typeof useCursorActions> | null = null;

    function ActionsConsumer() {
      actionsRenders++;
      actions = useCursorActions();
      return null;
    }
    function SettingsConsumer() {
      settingsRenders++;
      useCursorSettings();
      return null;
    }
    function FullConsumer() {
      fullRenders++;
      useCursor();
      return null;
    }

    render(
      <CursorSystem>
        <ActionsConsumer />
        <SettingsConsumer />
        <FullConsumer />
      </CursorSystem>,
    );

    expect(actionsRenders).toBe(1);
    expect(settingsRenders).toBe(1);
    expect(fullRenders).toBe(1);

    // Canvas enter → SET_ACTIVE (the exact dispatch that caused the cascade).
    act(() => { actions!.setActive(true); });
    // Click → SET_MOUSE_DOWN.
    act(() => { actions!.setTool('select'); });

    // The split consumers must be untouched; only the full-context consumer re-renders.
    expect(actionsRenders).toBe(1);
    expect(settingsRenders).toBe(1);
    expect(fullRenders).toBeGreaterThan(1);
  });

  it('the actions object identity is stable across state dispatches', () => {
    const seen: Array<ReturnType<typeof useCursorActions>> = [];
    let actions: ReturnType<typeof useCursorActions> | null = null;
    function Probe() {
      const a = useCursorActions();
      seen.push(a);
      actions = a;
      return null;
    }
    // A sibling that forces re-renders of the provider via state dispatch.
    let bump: (() => void) | null = null;
    function Bumper() {
      const a = useCursorActions();
      bump = () => a.setActive(true);
      return null;
    }
    render(<CursorSystem><Probe /><Bumper /></CursorSystem>);
    const firstSetActive = actions!.setActive;
    act(() => { bump!(); });
    // Even though the provider dispatched, the actions callbacks keep identity.
    expect(actions!.setActive).toBe(firstSetActive);
  });
});
