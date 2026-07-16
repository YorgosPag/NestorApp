/**
 * Q KEY TRACKER — SNAP-MODE momentary step override (ADR-363).
 *
 * Vanilla singleton SSoT for live `Q` key state, sibling of {@link CtrlKeyTracker}
 * / {@link ShiftKeyTracker} (identical lifecycle, SSR-safe, capture-phase window
 * listeners, `blur` reset) — all three built on {@link createModifierKeyTracker},
 * the shared SSoT for that plumbing (ADR-363, jscpd de-dup t258/t241). Consumers
 * read via `getSnapshot()` without a React subscription.
 *
 * Purpose: while SNAP-MODE (F9) is armed, holding `Q` DURING a 2D grip drag turns
 * on step quantization for that drag (default = free movement; hold Q → step). The
 * grip path reads it in `grip-step-quantize.applyGripStepSnap`.
 *
 * Context-sensitivity: `Q` is normally the Arc tool shortcut (`tool:arc-3p`). To
 * avoid switching tools mid-drag, this tracker swallows the `Q` keydown (capture
 * preventDefault + stopPropagation) ONLY while a grip drag is active
 * (`getActiveDragGrip()` non-null) — so outside a drag `Q` still opens the Arc tool.
 * That gating is the one piece of behavior this tracker does NOT share with its
 * siblings, so it is passed to the factory as `onKeyDownExtra`.
 *
 * @see keyboard/CtrlKeyTracker.ts — sibling (move→copy)
 * @see keyboard/createModifierKeyTracker.ts — shared lifecycle factory
 * @see bim/grips/grip-step-quantize.ts — reader (step override)
 * @see systems/cursor/GripDragStore.ts — active-drag signal
 */

import { getActiveDragGrip } from '../systems/cursor/GripDragStore';
import { createModifierKeyTracker } from './createModifierKeyTracker';

// Match the PHYSICAL Q key position (`e.code`) so the step override works
// regardless of the active keyboard layout. A Greek (or any non-Latin)
// layout maps the physical Q key to a different `e.key` (e.g. ';'), which
// a `e.key === 'q'` check would miss — leaving the user holding Q with no
// effect. `e.code` is layout-independent (US-physical position). The `e.key`
// checks remain as a fallback for synthetic events that omit `code`.
const isQ = (e: KeyboardEvent): boolean =>
  e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q';

export const QKeyTracker = createModifierKeyTracker({
  match: isQ,
  onKeyDownExtra: (e) => {
    const dragging = !!getActiveDragGrip();
    // Swallow the Arc-tool shortcut ONLY during an active grip drag, so Q acts as
    // the step override there and still opens the Arc tool everywhere else.
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
});
QKeyTracker.install();
