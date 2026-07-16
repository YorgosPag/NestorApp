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
 * Direct sibling of {@link ShiftKeyTracker}; identical lifecycle + rationale —
 * both built on {@link createModifierKeyTracker}, the shared SSoT for the
 * install/uninstall/listener plumbing (ADR-363, jscpd de-dup t258/t241).
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
 * @see keyboard/createModifierKeyTracker.ts — shared lifecycle factory
 * @see hooks/grips/grip-parametric-commits.ts — `commitWallCopy` consumer
 */

import { createModifierKeyTracker } from './createModifierKeyTracker';

export const CtrlKeyTracker = createModifierKeyTracker({
  match: (e) => e.key === 'Control' || e.key === 'Meta',
});
CtrlKeyTracker.install();
