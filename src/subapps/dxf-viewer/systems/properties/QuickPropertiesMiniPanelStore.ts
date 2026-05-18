/**
 * QUICK PROPERTIES MINI-PANEL STORE — ADR-357 §4 G9 Phase 9
 *
 * Singleton SSoT for double-click triggered Quick Properties mini-panel.
 * Opened by CanvasSection on double-click over a LINE entity (activeTool='select').
 * Closed by the panel on Esc / Enter / click-outside, or by CanvasSection
 * when activeTool leaves 'select'.
 *
 * Pattern mirrors QuickPropertiesStore / GripHoverMenuStore (ADR-040 micro-leaf).
 * Zero React state — useSyncExternalStore consumers only.
 */

export interface MiniPanelSnapshot {
  readonly entityId: string | null;
  readonly position: { readonly x: number; readonly y: number } | null;
  readonly open: boolean;
}

const CLOSED_SNAPSHOT: MiniPanelSnapshot = {
  entityId: null,
  position: null,
  open: false,
};

type Listener = () => void;

class QuickPropertiesMiniPanelStoreClass {
  private snapshot: MiniPanelSnapshot = CLOSED_SNAPSHOT;
  private readonly listeners = new Set<Listener>();

  open(entityId: string, position: { x: number; y: number }): void {
    this.snapshot = { entityId, position, open: true };
    this.notify();
  }

  close(): void {
    if (!this.snapshot.open) return;
    this.snapshot = CLOSED_SNAPSHOT;
    this.notify();
  }

  getSnapshot = (): MiniPanelSnapshot => this.snapshot;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error('QuickPropertiesMiniPanelStore listener error:', e); }
    });
  }
}

export const QuickPropertiesMiniPanelStore = new QuickPropertiesMiniPanelStoreClass();
