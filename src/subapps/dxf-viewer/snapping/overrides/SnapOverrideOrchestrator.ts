/**
 * SNAP OVERRIDE ORCHESTRATOR — ADR-357 §4 G8 (Object Snap Overrides)
 *
 * Singleton SSoT for single-use snap override state. Mirrors the
 * TrackingPointStore / HoverStore pattern: zero React state, mutable
 * internal state, `useSyncExternalStore`-compatible subscribe pair.
 *
 * Override lifecycle:
 *   setOverride(mode) → override is "pending"
 *   onDrawingHover    → preview filters to override engine
 *   onDrawingPoint    → consumeOverride() clears after first commit
 *   ESC / tool change → clearOverride()
 *
 * Special modes:
 *   'from' — click reference point → next click commits destination (simplified Phase 7)
 *   'm2p'  — accumulates 2 clicks → commits their midpoint (2-phase state machine)
 *   'app'  — apparent intersection (routes to INTERSECTION engine, single-use)
 *   string — any ExtendedSnapType value (e.g. 'endpoint', 'midpoint') → single-use engine override
 *
 * Architecture: Tier-3 micro-leaf SSoT (ADR-040). No React imports.
 */

export type SpecialOverride = 'from' | 'm2p' | 'app';
export type SnapOverrideMode = SpecialOverride | string; // string = ExtendedSnapType value

type Point2D = { x: number; y: number };
type FromState = { phase: 'idle' } | { phase: 'has-reference'; ref: Point2D };
type M2PState = { phase: 'idle' } | { phase: 'waiting-second'; firstPoint: Point2D };
type Listener = () => void;

class SnapOverrideOrchestratorClass {
  private activeOverride: SnapOverrideMode | null = null;
  private fromState: FromState = { phase: 'idle' };
  private m2pState: M2PState = { phase: 'idle' };
  private listeners = new Set<Listener>();

  /** Activate a new override. Clears any in-progress M2P / From accumulation. */
  setOverride(mode: SnapOverrideMode): void {
    this.activeOverride = mode;
    this.fromState = { phase: 'idle' };
    this.m2pState = { phase: 'idle' };
    this.notify();
  }

  /** Read the current override without consuming it. */
  getOverride(): SnapOverrideMode | null {
    return this.activeOverride;
  }

  /**
   * Read + clear the current override (single-use semantics).
   * Also resets From / M2P accumulation state.
   */
  consumeOverride(): SnapOverrideMode | null {
    const prev = this.activeOverride;
    this.activeOverride = null;
    this.fromState = { phase: 'idle' };
    this.m2pState = { phase: 'idle' };
    if (prev !== null) this.notify();
    return prev;
  }

  /** Clear override unconditionally — ESC, tool change, drawing cancel. */
  clearOverride(): void {
    if (this.activeOverride === null && this.fromState.phase === 'idle' && this.m2pState.phase === 'idle') return;
    this.activeOverride = null;
    this.fromState = { phase: 'idle' };
    this.m2pState = { phase: 'idle' };
    this.notify();
  }

  // ─── M2P (Mid Between 2 Points) ───────────────────────────────────────────

  /**
   * Advance the M2P state machine.
   * First call:  stores firstPoint, returns null  (caller: do NOT commit to drawing).
   * Second call: computes midpoint, resets state,  returns midPoint (caller: commit this).
   */
  advanceM2P(point: Point2D): Point2D | null {
    if (this.m2pState.phase === 'idle') {
      this.m2pState = { phase: 'waiting-second', firstPoint: { x: point.x, y: point.y } };
      this.notify();
      return null;
    }
    const first = this.m2pState.firstPoint;
    const mid: Point2D = { x: (first.x + point.x) / 2, y: (first.y + point.y) / 2 };
    this.m2pState = { phase: 'idle' };
    this.notify();
    return mid;
  }

  getM2PState(): M2PState {
    return this.m2pState;
  }

  // ─── From (Reference Point) ───────────────────────────────────────────────

  /**
   * Advance the From state machine.
   * First call:  stores reference point, returns false (caller: do NOT commit to drawing).
   * Subsequent calls: returns true (caller: commit normally, then call consumeOverride()).
   */
  advanceFrom(point: Point2D): boolean {
    if (this.fromState.phase === 'idle') {
      this.fromState = { phase: 'has-reference', ref: { x: point.x, y: point.y } };
      this.notify();
      return false;
    }
    return true;
  }

  getFromReference(): Point2D | null {
    return this.fromState.phase === 'has-reference' ? this.fromState.ref : null;
  }

  getFromState(): FromState {
    return this.fromState;
  }

  // ─── useSyncExternalStore compatibility ───────────────────────────────────

  getSnapshot = (): SnapOverrideMode | null => this.activeOverride;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch (err) { console.error('[SnapOverrideOrchestrator] listener error:', err); }
    });
  }
}

export const SnapOverrideOrchestrator = new SnapOverrideOrchestratorClass();
