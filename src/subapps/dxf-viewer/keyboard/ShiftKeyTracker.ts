/**
 * SHIFT KEY TRACKER — ADR-363 Phase 3.6.
 *
 * Vanilla singleton SSoT for live Shift modifier state. Installed once at
 * module load (SSR-safe via `typeof window` guard) and listens to
 * `window` `keydown` / `keyup` / `blur`. Consumers read via `getSnapshot()`
 * without React subscription — used by commit-time grip handlers (e.g.
 * `commitSlabGripDrag`) that need the modifier without plumbing it through
 * 4-5 layers of handler signatures (`useUnifiedGripInteraction.handleMouseUp`
 * receives only worldPos).
 *
 * Pattern mirrors {@link GripCopyModeStore} (vanilla store, low-frequency
 * transitions, no React deps). ADR-040 compliant — listeners are infrequent
 * UI-level keyboard events, not high-frequency render-path subscriptions.
 *
 * Why not read `event.shiftKey` directly? The mouseup event that triggers
 * a grip commit travels through `mouse-handler-up` → canvas handler →
 * `useUnifiedGripInteraction.handleMouseUp(worldPos)` → grip-commit-adapter,
 * losing the native event by design. The tracker side-steps the plumbing.
 *
 * @see hooks/grips/grip-parametric-commits.ts — `commitSlabGripDrag` reader
 * @see bim/slabs/slab-grips.ts — rectilinear quantization consumer
 */

type Listener = () => void;

class ShiftKeyTrackerImpl {
  private pressed = false;
  private listeners = new Set<Listener>();
  private installed = false;

  /** Live Shift state. Cheap read for commit-time consumers. */
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
    if (e.key === 'Shift') this.setPressed(true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') this.setPressed(false);
  };

  private onBlur = (): void => {
    // Lose modifier state if window loses focus (Shift+Alt+Tab etc.).
    this.setPressed(false);
  };

  private setPressed(next: boolean): void {
    if (this.pressed === next) return;
    this.pressed = next;
    for (const l of this.listeners) l();
  }
}

export const ShiftKeyTracker = new ShiftKeyTrackerImpl();
ShiftKeyTracker.install();
