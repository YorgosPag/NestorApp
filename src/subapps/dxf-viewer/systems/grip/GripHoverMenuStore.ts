/**
 * GRIP HOVER MENU STORE — ADR-349 Phase 1b.2
 *
 * Pub/sub micro-leaf store driving the multifunctional grip hover menu.
 * ADR-040 compliant: orchestrator components never subscribe; only the
 * floating menu leaf reads via `useSyncExternalStore`. State transitions
 * are LOW-frequency (open / close), not 60fps.
 *
 * @see ADR-349 §Multifunctional Grip Menu
 * @see ADR-040 — Preview Canvas Performance (micro-leaf pattern)
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import { createExternalStore } from '../../stores/createExternalStore';

export interface GripMenuOption {
  readonly id: string;
  readonly labelKey: string;
  readonly labelParams?: Readonly<Record<string, string | number>>;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export interface GripHoverMenuSnapshot {
  readonly visible: boolean;
  readonly screenPos: { readonly x: number; readonly y: number } | null;
  readonly grip: UnifiedGripInfo | null;
  readonly options: ReadonlyArray<GripMenuOption>;
}

const EMPTY_OPTIONS: ReadonlyArray<GripMenuOption> = [];

const CLOSED_SNAPSHOT: GripHoverMenuSnapshot = Object.freeze({
  visible: false,
  screenPos: null,
  grip: null,
  options: EMPTY_OPTIONS,
});

type Listener = () => void;

class GripHoverMenuStoreImpl {
  private readonly store = createExternalStore<GripHoverMenuSnapshot>(CLOSED_SNAPSHOT);

  getSnapshot = (): GripHoverMenuSnapshot => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  show(params: {
    grip: UnifiedGripInfo;
    screenPos: { x: number; y: number };
    options: ReadonlyArray<GripMenuOption>;
  }): void {
    if (params.options.length === 0) return;
    this.store.set(Object.freeze({
      visible: true,
      screenPos: { x: params.screenPos.x, y: params.screenPos.y },
      grip: params.grip,
      options: params.options,
    }));
  }

  hide(): void {
    if (!this.store.get().visible) return;
    this.store.set(CLOSED_SNAPSHOT);
  }
}

export const GripHoverMenuStore = new GripHoverMenuStoreImpl();
