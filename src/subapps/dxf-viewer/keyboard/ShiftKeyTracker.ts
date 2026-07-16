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
 * transitions, no React deps). Built on {@link createModifierKeyTracker},
 * the shared SSoT for the install/uninstall/listener plumbing this tracker
 * shares with its siblings {@link CtrlKeyTracker} / {@link QKeyTracker}
 * (ADR-363, jscpd de-dup t258/t241). ADR-040 compliant — listeners are
 * infrequent UI-level keyboard events, not high-frequency render-path
 * subscriptions.
 *
 * Why not read `event.shiftKey` directly? The mouseup event that triggers
 * a grip commit travels through `mouse-handler-up` → canvas handler →
 * `useUnifiedGripInteraction.handleMouseUp(worldPos)` → grip-commit-adapter,
 * losing the native event by design. The tracker side-steps the plumbing.
 *
 * @see keyboard/createModifierKeyTracker.ts — shared lifecycle factory
 * @see hooks/grips/grip-parametric-commits.ts — `commitSlabGripDrag` reader
 * @see bim/slabs/slab-grips.ts — rectilinear quantization consumer
 */

import { createModifierKeyTracker } from './createModifierKeyTracker';

export const ShiftKeyTracker = createModifierKeyTracker({
  match: (e) => e.key === 'Shift',
});
ShiftKeyTracker.install();
