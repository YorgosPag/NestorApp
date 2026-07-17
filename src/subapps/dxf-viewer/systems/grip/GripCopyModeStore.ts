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
 *   - `scale` / `rotate` / `mirror` mode + copy
 *        → `GripHandoffStore.set(mode, anchor, { copyMode })`
 *        → the tool hook commits via `createScale/Rotate/MirrorCommand({copy: true})`
 *        → `CloneWithTransformCommand` (ADR-507 §8 — clone with the transform baked in)
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

import { createExternalStore } from '../../stores/createExternalStore';

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
  private readonly store = createExternalStore<GripCopyModeSnapshot>(DISABLED_SNAPSHOT);

  getSnapshot = (): GripCopyModeSnapshot => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  /** Toggle the copy mode on/off. Resets `count` when turning off. */
  toggle(): void {
    const next = !this.store.get().enabled;
    this.store.set(Object.freeze({
      enabled: next,
      count: next ? this.store.get().count : 0,
    }));
  }

  /** Increment the in-session copy counter — called after each successful copy commit. */
  bumpCount(): void {
    if (!this.store.get().enabled) return;
    this.store.set(Object.freeze({
      enabled: true,
      count: this.store.get().count + 1,
    }));
  }

  /** Reset to disabled (selection change / Escape to idle). */
  clear(): void {
    if (this.store.get() === DISABLED_SNAPSHOT) return;
    this.store.set(DISABLED_SNAPSHOT);
  }
}

export const GripCopyModeStore = new GripCopyModeStoreImpl();
