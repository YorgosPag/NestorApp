/**
 * GRIP MODE STORE — ADR-349 Phase 1c-A
 *
 * Pub/sub micro-leaf SSoT for the currently active grip-hot mode (spacebar
 * cycle: Stretch / Move / Rotate / Scale / Mirror). ADR-040 compliant —
 * transitions are LOW-frequency (one per key press), not 60fps.
 *
 * Lifecycle:
 *   - resets to DEFAULT_GRIP_MODE whenever the grip phase returns to `idle`
 *   - spacebar cycles forward through the ORDER
 *   - commit handlers read the current mode from this store
 *
 * @see grip-mode-cycle.ts — order + metadata SSoT
 */

import { DEFAULT_GRIP_MODE, type GripMode } from './grip-mode-cycle';

type Listener = () => void;

class GripModeStoreImpl {
  private mode: GripMode = DEFAULT_GRIP_MODE;
  private listeners = new Set<Listener>();

  getSnapshot = (): GripMode => this.mode;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  set(mode: GripMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.emit();
  }

  reset(): void {
    this.set(DEFAULT_GRIP_MODE);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const GripModeStore = new GripModeStoreImpl();
