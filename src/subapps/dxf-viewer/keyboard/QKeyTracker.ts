/**
 * Q KEY TRACKER — SNAP-MODE momentary step override (ADR-363).
 *
 * Vanilla singleton SSoT for live `Q` key state, sibling of {@link CtrlKeyTracker}
 * / {@link ShiftKeyTracker} (identical lifecycle, SSR-safe, capture-phase window
 * listeners, `blur` reset). Consumers read via `getSnapshot()` without a React
 * subscription.
 *
 * Purpose: while SNAP-MODE (F9) is armed, holding `Q` DURING a 2D grip drag turns
 * on step quantization for that drag (default = free movement; hold Q → step). The
 * grip path reads it in `grip-step-quantize.applyGripStepSnap`.
 *
 * Context-sensitivity: `Q` is normally the Arc tool shortcut (`tool:arc-3p`). To
 * avoid switching tools mid-drag, this tracker swallows the `Q` keydown (capture
 * preventDefault + stopPropagation) ONLY while a grip drag is active
 * (`getActiveDragGrip()` non-null) — so outside a drag `Q` still opens the Arc tool.
 *
 * @see keyboard/CtrlKeyTracker.ts — sibling (move→copy)
 * @see bim/grips/grip-step-quantize.ts — reader (step override)
 * @see systems/cursor/GripDragStore.ts — active-drag signal
 */

import { getActiveDragGrip } from '../systems/cursor/GripDragStore';
import { createExternalStore } from '../stores/createExternalStore';

type Listener = () => void;

class QKeyTrackerImpl {
  private readonly store = createExternalStore<boolean>(false, { equals: Object.is });
  private installed = false;

  /** Live Q state. Cheap read for the grip step-snap consumer. */
  getSnapshot = (): boolean => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  install(): void {
    if (this.installed) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.onBlur);
    this.installed = true;
  }

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

  private isQ(e: KeyboardEvent): boolean {
    // Match the PHYSICAL Q key position (`e.code`) so the step override works
    // regardless of the active keyboard layout. A Greek (or any non-Latin)
    // layout maps the physical Q key to a different `e.key` (e.g. ';'), which
    // a `e.key === 'q'` check would miss — leaving the user holding Q with no
    // effect. `e.code` is layout-independent (US-physical position). The `e.key`
    // checks remain as a fallback for synthetic events that omit `code`.
    return e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q';
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isQ(e)) return;
    this.setPressed(true);
    const dragging = !!getActiveDragGrip();
    // Swallow the Arc-tool shortcut ONLY during an active grip drag, so Q acts as
    // the step override there and still opens the Arc tool everywhere else.
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.isQ(e)) {
      this.setPressed(false);
    }
  };

  private onBlur = (): void => {
    this.setPressed(false);
  };

  private setPressed(next: boolean): void {
    this.store.set(next);
  }
}

export const QKeyTracker = new QKeyTrackerImpl();
QKeyTracker.install();
