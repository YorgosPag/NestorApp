/**
 * 🏢 RAF-COALESCED THROTTLE — SSoT for zero-lag drag/grip visual updates (ADR-516)
 * ============================================================================
 *
 * A leading-edge throttle that NEVER drops the trailing frame. Used by the
 * object-drag paths (useEntityDrag, useGripMovement) so the *visual ghost*
 * follows the cursor at vsync without lagging or losing the final position.
 *
 * Behaviour (the "big players" / Revit-grade pattern):
 *  - First call (or first after a quiet gap ≥ throttleMs) applies IMMEDIATELY
 *    (leading edge) — the ghost reacts instantly.
 *  - Calls arriving inside the throttle window do NOT drop the update: the
 *    LATEST one is parked and flushed on the next animation frame (trailing
 *    edge). So the ghost is never more than one frame behind, and the very last
 *    movement before a release is always rendered.
 *
 * This replaces the previous duplicated, divergent throttles:
 *  - useEntityDrag had a correct trailing-RAF throttle (inlined).
 *  - useGripMovement had a HARD-DROP throttle with no trailing flush → the grip
 *    ghost could lag up to one frame and drop the final sub-frame movement
 *    (ADR-516 §2.5, "lag type A"). Unifying both on this helper fixes that.
 *
 * Pure (no React) and dependency-injectable for testing.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md
 * @see config/dxf-timing.ts (DXF_TIMING.frame.THROTTLE_60 — the canonical window)
 */

export interface RafCoalescedThrottle {
  /**
   * Schedule `apply`. Runs immediately on the leading edge, or coalesces to a
   * single trailing animation frame (flushing the latest `apply`) when called
   * faster than the throttle window.
   */
  run(apply: () => void): void;
  /** Cancel any pending trailing frame and clear state (call on end/cancel/unmount). */
  cancel(): void;
}

interface RafCoalescedThrottleDeps {
  /** Monotonic-ish clock in ms (default: Date.now). */
  now?: () => number;
  /** Frame scheduler (default: requestAnimationFrame). */
  raf?: (cb: () => void) => number;
  /** Frame cancel (default: cancelAnimationFrame). */
  cancelRaf?: (id: number) => void;
}

/** Safe default frame scheduler — degrades to a microtask outside the browser. */
function defaultRaf(cb: () => void): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(cb);
  }
  // Non-DOM environment (SSR/test without polyfill): run on next tick.
  return setTimeout(cb, 0) as unknown as number;
}

function defaultCancelRaf(id: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id);
}

/**
 * Create a leading-edge, trailing-flushing throttle bound to `throttleMs`.
 *
 * @param throttleMs Minimum gap between immediate applies (e.g. DXF_TIMING.frame.THROTTLE_60).
 */
export function createRafCoalescedThrottle(
  throttleMs: number,
  deps: RafCoalescedThrottleDeps = {}
): RafCoalescedThrottle {
  const now = deps.now ?? Date.now;
  const raf = deps.raf ?? defaultRaf;
  const cancelRaf = deps.cancelRaf ?? defaultCancelRaf;

  let lastTime = 0;
  let rafId: number | null = null;
  let pending: (() => void) | null = null;

  return {
    run(apply: () => void): void {
      const t = now();
      if (t - lastTime < throttleMs) {
        // Inside the window — keep only the latest, flush on the next frame.
        pending = apply;
        if (rafId === null) {
          rafId = raf(() => {
            rafId = null;
            lastTime = now();
            const flush = pending;
            pending = null;
            flush?.();
          });
        }
        return;
      }
      // Leading edge — apply instantly.
      lastTime = t;
      apply();
    },

    cancel(): void {
      if (rafId !== null) {
        cancelRaf(rafId);
        rafId = null;
      }
      pending = null;
    },
  };
}
