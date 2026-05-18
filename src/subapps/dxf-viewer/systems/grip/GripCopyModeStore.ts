/**
 * GRIP COPY MODE STORE — ADR-357 Phase 12 / G10 extras
 *
 * Pub/sub micro-leaf SSoT for AutoCAD-style "Copy" toggle inside the grip
 * right-click context menu. When `enabled`, every grip commit duplicates the
 * source entity (preserving the original) and applies the transform to the
 * clone instead of mutating in place. The flag persists across consecutive
 * grip drags in the same grip-hot session (selection-scoped — cleared by
 * `useUnifiedGripInteraction` on selection change / Escape-to-idle).
 *
 * Routing at commit time:
 *   - `stretch` mode + copy → `CopyEntityCommand` with vertex/anchor displacement
 *   - `move` mode    + copy → `CopyEntityCommand` (anchor displacement, all moves)
 *   - `scale` mode   + copy → `GripHandoffStore.set('scale', anchor, { copyMode })`
 *                              → `ScaleEntityCommand`'s native `copyMode=true`
 *   - `rotate` mode  + copy → `GripHandoffStore.set('rotate', anchor, { copyMode })`
 *                              → `RotateEntityCommand`'s extended `copyMode=true`
 *   - `mirror` mode  + copy → `GripHandoffStore.set('mirror', anchor, { copyMode })`
 *                              → `MirrorEntityCommand`'s `keepOriginals=true`
 *
 * Industry reference: AutoCAD `MULTIPLE` grip-extra / `Copy` subcommand —
 * persistent toggle until user explicitly disables or session resets.
 *
 * ADR-040 compliant: LOW-frequency transitions (one per user toggle).
 *
 * @see GripContextMenuStore — surfaces the "Copy" toggle entry
 * @see CopyEntityCommand    — stretch/move + copy commit path
 * @see GripHandoffStore     — scale/rotate/mirror handoff
 */

export interface GripCopyModeSnapshot {
  readonly enabled: boolean;
  /** Number of copies created in the current grip-hot session — UX feedback. */
  readonly count: number;
}

const DISABLED_SNAPSHOT: GripCopyModeSnapshot = Object.freeze({
  enabled: false,
  count: 0,
});

type Listener = () => void;

class GripCopyModeStoreImpl {
  private snapshot: GripCopyModeSnapshot = DISABLED_SNAPSHOT;
  private listeners = new Set<Listener>();

  getSnapshot = (): GripCopyModeSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Toggle the copy mode on/off. Resets `count` when turning off. */
  toggle(): void {
    const next = !this.snapshot.enabled;
    this.snapshot = Object.freeze({
      enabled: next,
      count: next ? this.snapshot.count : 0,
    });
    this.emit();
  }

  /** Increment the in-session copy counter — called after each successful copy commit. */
  bumpCount(): void {
    if (!this.snapshot.enabled) return;
    this.snapshot = Object.freeze({
      enabled: true,
      count: this.snapshot.count + 1,
    });
    this.emit();
  }

  /** Reset to disabled (selection change / Escape to idle). */
  clear(): void {
    if (this.snapshot === DISABLED_SNAPSHOT) return;
    this.snapshot = DISABLED_SNAPSHOT;
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const GripCopyModeStore = new GripCopyModeStoreImpl();
