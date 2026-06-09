/**
 * GRIP ALT-MOVE STORE — ADR-363 Phase 1G.5 (2Δ «Move-from-Characteristic-Point»).
 *
 * Vanilla singleton SSoT that decides, per grip drag, whether the gesture is an
 * AutoCAD-style **whole-entity move from a base point** (the grabbed
 * characteristic point) instead of the grip's parametric edit. Activated by
 * holding **Alt** while pressing a grip.
 *
 * Why a mouse-driven store and not a keyboard tracker? An earlier attempt read
 * Alt from `window` keydown/keyup, but on Windows pressing Alt arms the browser
 * menu and can fire `blur`/`keyup` mid-gesture → the modifier was "lost" before
 * the drag committed. The reliable signal is the modifier carried by the
 * **mousedown event itself**: this store captures `e.altKey` from a `window`
 * `mousedown` capture listener (fires BEFORE the React/canvas handler chain), so
 * when the grip mousedown logic runs, `wasAltAtMouseDown()` is fresh and exact.
 *
 * Lifecycle (per drag session):
 *   - window mousedown (capture) → `altAtDown = e.altKey` (just records)
 *   - grip mousedown decides to start a drag with Alt → `arm()` sets `active`
 *   - the live ghost (`buildDxfDragPreview`) + the commit (`commitDxfGripDrag…`)
 *     read `getActive()` → whole-entity translate instead of parametric edit
 *   - drag end / `resetToIdle` → `clear()` disarms
 *
 * ADR-040 compliant: LOW-frequency transitions (one per drag). The 60fps readers
 * (ghost + commit) read via `getActive()`, not `useSyncExternalStore`.
 *
 * @see hooks/grips/grip-mouse-handlers.ts — arms on Alt grip mousedown
 * @see hooks/grips/grip-projections.ts — `buildDxfDragPreview` reads it for the ghost
 * @see hooks/grips/grip-commit-adapters.ts — `commitDxfGripDragModeAware` reads it
 */

class GripAltMoveStoreImpl {
  private altAtDown = false;
  private active = false;
  private installed = false;

  /** Idempotent install — captures Alt from the native mousedown (capture phase). */
  install(): void {
    if (this.installed) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('mousedown', this.onMouseDown, { capture: true });
    window.addEventListener('blur', this.onBlur);
    this.installed = true;
  }

  /** Test-only teardown. */
  uninstall(): void {
    if (!this.installed) return;
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousedown', this.onMouseDown, { capture: true });
    window.removeEventListener('blur', this.onBlur);
    this.installed = false;
    this.altAtDown = false;
    this.active = false;
  }

  /** Alt state at the most recent mousedown — read by the grip mousedown logic. */
  wasAltAtMouseDown(): boolean {
    return this.altAtDown;
  }

  /** Arm the current drag as a whole-entity move (called when a grip is grabbed with Alt). */
  arm(): void {
    this.active = true;
  }

  /** Is the active grip drag a whole-entity move? Read by the ghost + commit. */
  getActive(): boolean {
    return this.active;
  }

  /** Disarm (drag end / session reset). */
  clear(): void {
    this.active = false;
  }

  /** Test-only direct setter for `altAtDown`. */
  _setAltForTest(alt: boolean): void {
    this.altAtDown = alt;
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.altAtDown = e.altKey;
  };

  private onBlur = (): void => {
    this.altAtDown = false;
    this.active = false;
  };
}

export const GripAltMoveStore = new GripAltMoveStoreImpl();
GripAltMoveStore.install();
