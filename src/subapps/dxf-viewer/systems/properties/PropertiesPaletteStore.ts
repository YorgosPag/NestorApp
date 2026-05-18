/**
 * PropertiesPaletteStore — ADR-357 Phase 10
 *
 * Singleton zero-React store: tracks open/closed state of the Full Properties Palette.
 * Toggled by F11 / Ctrl+1. Follows ADR-040 micro-leaf subscriber pattern.
 */

export interface PaletteSnapshot {
  readonly open: boolean;
}

type Listener = () => void;

const CLOSED: PaletteSnapshot = { open: false };
const OPEN: PaletteSnapshot = { open: true };

class PropertiesPaletteStoreClass {
  private snapshot: PaletteSnapshot = CLOSED;
  private readonly listeners = new Set<Listener>();

  toggle(): void {
    this.snapshot = this.snapshot.open ? CLOSED : OPEN;
    this.notify();
  }

  open(): void {
    if (this.snapshot.open) return;
    this.snapshot = OPEN;
    this.notify();
  }

  close(): void {
    if (!this.snapshot.open) return;
    this.snapshot = CLOSED;
    this.notify();
  }

  isOpen(): boolean {
    return this.snapshot.open;
  }

  getSnapshot = (): PaletteSnapshot => this.snapshot;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }
}

export const PropertiesPaletteStore = new PropertiesPaletteStoreClass();
