import { useEffect, useRef } from 'react';

/**
 * ADR-589 — edge-triggered (transition-only) tool lifecycle SSoT.
 *
 * Sibling of {@link useToolLifecycle} (ADR-363), but with DIFFERENT semantics:
 * `useToolLifecycle` fires `activate()`/`deactivate()` on every deps change
 * (and `deactivate()` on-mount), whereas this hook fires the callbacks ONLY on
 * the boolean transitions:
 *   - `onActivate`   → runs ONLY on a `false → true` edge of `isActive`
 *   - `onDeactivate` → runs ONLY on a `true → false` edge of `isActive`
 *
 * It replaces the hand-rolled boilerplate that was byte-copied across 13 modify
 * tool hooks (trim/extend/fillet/chamfer/offset/array/array-path/array-polar/
 * wall-attach/wall-split/schedule-region-pick/stretch/wall-pick-scaffold):
 *
 * ```ts
 * const wasActiveRef = useRef(false);
 * useEffect(() => {
 *   if (isActive && !wasActiveRef.current) { ...enter... }
 *   else if (!isActive && wasActiveRef.current) { ...exit... }
 *   wasActiveRef.current = isActive;
 * }, [isActive]);
 * ```
 *
 * IMPORTANT — deps are DELIBERATELY `[isActive]` only (byte-behavior-identical
 * with the 13 originals). The callbacks are read via closure at the transition
 * render, NOT tracked as deps: adding them would re-fire the effect on every
 * callback-identity change (each render), breaking the transition-only contract.
 * Call sites may therefore pass inline arrows without `useCallback` — the effect
 * captures whichever closure existed at the render where `isActive` flipped,
 * exactly like the inline originals. This is why the exhaustive-deps lint is
 * suppressed here (the single, audited place), instead of in every call site.
 */
export function useEdgeTriggeredLifecycle(
  isActive: boolean,
  onActivate: () => void,
  onDeactivate: () => void,
): void {
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      onActivate();
    } else if (!isActive && wasActiveRef.current) {
      onDeactivate();
    }
    wasActiveRef.current = isActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
}
