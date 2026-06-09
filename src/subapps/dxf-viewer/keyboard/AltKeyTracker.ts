/**
 * ALT KEY TRACKER — ADR-363 Phase 1G.5 (2Δ «Move-from-Characteristic-Point»).
 *
 * Vanilla singleton SSoT for live Alt (⌥ Option) modifier state. Installed once
 * at module load (SSR-safe via `typeof window` guard) and listens to `window`
 * `keydown` / `keyup` / `blur`. Consumers read via `getSnapshot()` without a
 * React subscription — used by the grip commit dispatcher
 * (`commitDxfGripDragModeAware`) to decide, at the terminal click, whether to
 * MOVE the WHOLE entity from the grabbed characteristic point (AutoCAD «move
 * from base point») instead of running the entity's parametric grip edit
 * (stretch / thickness / resize). Alt held → whole-entity move.
 *
 * Direct sibling of {@link CtrlKeyTracker} / {@link ShiftKeyTracker}; identical
 * lifecycle + rationale. The 2D canvas owns no native menu bar, so Alt-keydown
 * carries no browser menu-focus side effect to suppress here.
 *
 * Why Alt (not Ctrl/Shift/Space)? In the 2D view Ctrl = COPY (grip MOVE→COPY,
 * ADR-397), Shift = ortho / multi-grip, Space = pan + grip-mode cycle — all
 * booked. Alt is the only free modifier on the 2D canvas (only `Ctrl+Alt+I`
 * keyboard layer-isolate uses it, never an Alt+mouse-drag binding).
 *
 * Why not read `event.altKey` directly? The mouseup that triggers a grip commit
 * travels `mouse-handler-up` → canvas handler → `handleMouseUp(worldPos)` →
 * grip-commit dispatch, losing the native event by design. The tracker
 * side-steps the plumbing. ADR-040 compliant — infrequent UI-level keyboard
 * events, not a high-frequency render-path subscription.
 *
 * @see keyboard/CtrlKeyTracker.ts — sibling (MOVE→COPY)
 * @see keyboard/ShiftKeyTracker.ts — sibling (rectilinear constraint)
 * @see hooks/grips/grip-commit-adapters.ts — `commitDxfGripDragModeAware` consumer
 */

type Listener = () => void;

class AltKeyTrackerImpl {
  private pressed = false;
  private listeners = new Set<Listener>();
  private installed = false;

  /** Live Alt state. Cheap read for commit-time consumers. */
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
    if (e.key === 'Alt') this.setPressed(true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Alt') this.setPressed(false);
  };

  private onBlur = (): void => {
    // Lose modifier state if window loses focus (Alt+Tab etc.).
    this.setPressed(false);
  };

  private setPressed(next: boolean): void {
    if (this.pressed === next) return;
    this.pressed = next;
    for (const l of this.listeners) l();
  }
}

export const AltKeyTracker = new AltKeyTrackerImpl();
AltKeyTracker.install();
