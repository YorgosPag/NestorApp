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
  private snapshot: GripHoverMenuSnapshot = CLOSED_SNAPSHOT;
  private listeners = new Set<Listener>();

  getSnapshot = (): GripHoverMenuSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  show(params: {
    grip: UnifiedGripInfo;
    screenPos: { x: number; y: number };
    options: ReadonlyArray<GripMenuOption>;
  }): void {
    if (params.options.length === 0) return;
    this.snapshot = Object.freeze({
      visible: true,
      screenPos: { x: params.screenPos.x, y: params.screenPos.y },
      grip: params.grip,
      options: params.options,
    });
    this.emit();
  }

  hide(): void {
    if (!this.snapshot.visible) return;
    this.snapshot = CLOSED_SNAPSHOT;
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const GripHoverMenuStore = new GripHoverMenuStoreImpl();
