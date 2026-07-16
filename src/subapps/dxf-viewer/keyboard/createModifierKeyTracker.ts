/**
 * MODIFIER KEY TRACKER FACTORY — ADR-363 (SSoT, jscpd de-dup t258/t241).
 *
 * Shared lifecycle for the vanilla singleton modifier-key trackers
 * ({@link CtrlKeyTracker}, {@link ShiftKeyTracker}, {@link QKeyTracker}).
 * All three are SSR-safe singletons installed once at module load, listen
 * to `window` `keydown` / `keyup` / `blur` in the capture phase, and expose
 * `getSnapshot()` for commit-time reads without a React subscription (see
 * each tracker's own header for its specific consumer rationale — this
 * factory only owns the identical plumbing, not the "why").
 *
 * Only two things vary per tracker:
 * - `match(e)` — which physical/logical key(s) this tracker watches.
 * - `onKeyDownExtra(e)` — optional side-effect run after a matching keydown
 *   (used by {@link QKeyTracker} to swallow the Arc-tool shortcut while a
 *   grip drag is active).
 *
 * @see keyboard/CtrlKeyTracker.ts
 * @see keyboard/ShiftKeyTracker.ts
 * @see keyboard/QKeyTracker.ts
 * @see stores/createExternalStore.ts — underlying pub/sub primitive
 */

import { createExternalStore } from '../stores/createExternalStore';

type Listener = () => void;

export interface ModifierKeyTracker {
  /** Live pressed state. Cheap read for commit-time consumers. */
  getSnapshot: () => boolean;
  subscribe: (listener: Listener) => () => void;
  /** Idempotent install — safe to call from multiple module loads. */
  install: () => void;
  /** Test-only teardown. Production code should never need this. */
  uninstall: () => void;
  /** Test-only direct setter. */
  _setForTest: (pressed: boolean) => void;
}

export interface CreateModifierKeyTrackerOptions {
  /** Predicate deciding whether a `keydown`/`keyup` event is this tracker's key. */
  match: (e: KeyboardEvent) => boolean;
  /** Optional side-effect run after a matching `keydown` sets pressed=true. */
  onKeyDownExtra?: (e: KeyboardEvent) => void;
}

/** Builds a vanilla singleton-shaped modifier-key tracker sharing the SSoT lifecycle. */
export function createModifierKeyTracker(
  options: CreateModifierKeyTrackerOptions
): ModifierKeyTracker {
  const { match, onKeyDownExtra } = options;
  const store = createExternalStore<boolean>(false, { equals: Object.is });
  let installed = false;

  const setPressed = (next: boolean): void => {
    store.set(next);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!match(e)) return;
    setPressed(true);
    onKeyDownExtra?.(e);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (match(e)) setPressed(false);
  };

  const onBlur = (): void => {
    // Lose modifier state if window loses focus (e.g. Alt+Tab).
    setPressed(false);
  };

  const install = (): void => {
    if (installed) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    installed = true;
  };

  const uninstall = (): void => {
    if (!installed) return;
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeyDown, { capture: true });
    window.removeEventListener('keyup', onKeyUp, { capture: true });
    window.removeEventListener('blur', onBlur);
    installed = false;
    setPressed(false);
  };

  return {
    getSnapshot: () => store.get(),
    subscribe: (listener: Listener) => store.subscribe(listener),
    install,
    uninstall,
    _setForTest: (pressed: boolean) => setPressed(pressed),
  };
}
