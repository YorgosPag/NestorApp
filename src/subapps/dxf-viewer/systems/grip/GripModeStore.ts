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
import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

class GripModeStoreImpl {
  private readonly store = createExternalStore<GripMode>(DEFAULT_GRIP_MODE);

  getSnapshot = (): GripMode => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  set(mode: GripMode): void {
    if (this.store.get() === mode) return;
    this.store.set(mode);
  }

  reset(): void {
    this.set(DEFAULT_GRIP_MODE);
  }
}

export const GripModeStore = new GripModeStoreImpl();
