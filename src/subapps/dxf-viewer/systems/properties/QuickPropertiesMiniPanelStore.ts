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

import { createExternalStore } from '../../stores/createExternalStore';

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
  // SSoT pub/sub via createExternalStore (WAVE 2.6). `equals: Object.is` reproduces
  // the hand-rolled close() guard (`if (!open) return`): CLOSED_SNAPSHOT is a shared
  // singleton ref, so re-setting it is a no-op. open() always builds a brand-new
  // object literal, so it is never suppressed by the guard — matches the original
  // (open() had no guard, always notified).
  private readonly store = createExternalStore<MiniPanelSnapshot>(CLOSED_SNAPSHOT, { equals: Object.is });

  open(entityId: string, position: { x: number; y: number }): void {
    this.store.set({ entityId, position, open: true });
  }

  close(): void {
    this.store.set(CLOSED_SNAPSHOT);
  }

  getSnapshot = (): MiniPanelSnapshot => this.store.get();

  subscribe = (fn: Listener): (() => void) => this.store.subscribe(fn);
}

export const QuickPropertiesMiniPanelStore = new QuickPropertiesMiniPanelStoreClass();
