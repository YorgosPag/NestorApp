/**
 * PropertiesPaletteStore — ADR-357 Phase 10
 *
 * Singleton zero-React store: tracks open/closed state of the Full Properties Palette.
 * Toggled by F11 / Ctrl+1. Follows ADR-040 micro-leaf subscriber pattern.
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface PaletteSnapshot {
  readonly open: boolean;
}

type Listener = () => void;

const CLOSED: PaletteSnapshot = { open: false };
const OPEN: PaletteSnapshot = { open: true };

class PropertiesPaletteStoreClass {
  // SSoT pub/sub via createExternalStore (WAVE 2.6). `equals: Object.is` reproduces
  // the hand-rolled open()/close() guards: CLOSED/OPEN are shared singleton refs, so
  // re-setting the same one is a no-op (no notify) — toggle() always flips to the
  // OTHER singleton, so it always notifies, same as before.
  private readonly store = createExternalStore<PaletteSnapshot>(CLOSED, { equals: Object.is });

  toggle(): void {
    this.store.set(this.store.get().open ? CLOSED : OPEN);
  }

  open(): void {
    this.store.set(OPEN);
  }

  close(): void {
    this.store.set(CLOSED);
  }

  isOpen(): boolean {
    return this.store.get().open;
  }

  getSnapshot = (): PaletteSnapshot => this.store.get();

  subscribe = (fn: Listener): (() => void) => this.store.subscribe(fn);
}

export const PropertiesPaletteStore = new PropertiesPaletteStoreClass();
