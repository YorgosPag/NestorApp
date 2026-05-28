/**
 * CTRL KEY TRACKER — ADR-363 Phase 1G.4.
 *
 * Vanilla singleton SSoT for live Ctrl / Meta (⌘) modifier state. Installed
 * once at module load (SSR-safe via `typeof window` guard) and listens to
 * `window` `keydown` / `keyup` / `blur`. Consumers read via `getSnapshot()`
 * without a React subscription — used by the wall move hot-grip commit
 * (`grip-mouse-handlers.runGripMouseUp`) to decide, at the terminal click,
 * whether to MOVE the wall or COPY it (AutoCAD MOVE→COPY): Ctrl held → copy.
 *
 * Direct sibling of {@link ShiftKeyTracker}; identical lifecycle + rationale.
 * Tracks `Control` AND `Meta` so the gesture works on Windows/Linux (Ctrl) and
 * macOS (⌘). ADR-040 compliant — infrequent UI-level keyboard events, not a
 * high-frequency render-path subscription.
 *
 * Why not read `event.ctrlKey` directly? The mouseup that triggers a grip
 * commit travels `mouse-handler-up` → canvas handler → `handleMouseUp(worldPos)`
 * → grip-commit dispatch, losing the native event by design. The tracker
 * side-steps the plumbing.
 *
 * @see keyboard/ShiftKeyTracker.ts — sibling (rectilinear constraint)
 * @see hooks/grips/grip-parametric-commits.ts — `commitWallCopy` consumer
 */

type Listener = () => void;

class CtrlKeyTrackerImpl {
  private pressed = false;
  private listeners = new Set<Listener>();
  private installed = false;

  /** Live Ctrl/Meta state. Cheap read for commit-time consumers. */
  getSnapshot = (): boolean => this.pressed;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Idempotent install — safe to call from multiple module loads. */
  install(): void {
    if (this.installed) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.onBlur);
    this.installed = true;
  }

  /** Test-only teardown. Production code should never need this. */
  uninstall(): void {
    if (!this.installed) return;
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
    window.removeEventListener('blur', this.onBlur);
    this.installed = false;
    this.setPressed(false);
  }

  /** Test-only direct setter. */
  _setForTest(pressed: boolean): void {
    this.setPressed(pressed);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Control' || e.key === 'Meta') this.setPressed(true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Control' || e.key === 'Meta') this.setPressed(false);
  };

  private onBlur = (): void => {
    // Lose modifier state if window loses focus (Ctrl+Alt+Tab etc.).
    this.setPressed(false);
  };

  private setPressed(next: boolean): void {
    if (this.pressed === next) return;
    this.pressed = next;
    for (const l of this.listeners) l();
  }
}

export const CtrlKeyTracker = new CtrlKeyTrackerImpl();
CtrlKeyTracker.install();
