/**
 * GRIP CONTEXT MENU STORE — ADR-357 Phase 11 / G10.A
 *
 * Pub/sub micro-leaf SSoT for the right-click context menu that appears on a
 * hot DXF grip (AutoCAD-style multifunctional grip menu, full variant). Sister
 * store of {@link GripHoverMenuStore} — same architecture, distinct concern:
 *
 *   - {@link GripHoverMenuStore}: 400ms hold-time → entity-specific actions
 *     (e.g. line endpoint = `Stretch / Lengthen`).
 *   - GripContextMenuStore (this one): right-click on grip → universal modes
 *     (`Stretch / Move / Rotate / Scale / Mirror`) with check-mark on the
 *     currently active mode, plus an `Exit` row that cancels the drag.
 *
 * ADR-040 compliant: orchestrators never subscribe; only the floating menu
 * leaf (`components/grip/GripContextMenu.tsx`) reads via `useSyncExternalStore`.
 * Transitions are LOW-frequency (open / close on user input), not 60fps.
 *
 * @see GripHoverMenuStore — sister store (hover hold-menu)
 * @see grip-context-menu-resolver — pure resolver
 * @see grip-context-menu-actions — action bindings
 * @see ADR-349 §Multifunctional Grip Menu
 * @see ADR-357 §14 G10 Grip Editing — Phase 11 deliverable
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';

/** A single row in the context menu (mode toggle or terminal action). */
export interface GripContextMenuItem {
  readonly id: string;
  readonly labelKey: string;
  readonly labelParams?: Readonly<Record<string, string | number>>;
  readonly onSelect: () => void;
  /** Render as disabled (deferred / not applicable). */
  readonly disabled?: boolean;
  /** Render with leading check-mark — used for the currently active grip mode. */
  readonly checked?: boolean;
  /** Render with destructive styling (red text) — used for `Exit`. */
  readonly destructive?: boolean;
}

/** A visually-separated group of items (e.g. modes vs terminal actions). */
export interface GripContextMenuSection {
  readonly id: string;
  /** Optional translation key for the section header — omit to render unlabeled. */
  readonly titleKey?: string;
  readonly items: ReadonlyArray<GripContextMenuItem>;
}

export interface GripContextMenuSnapshot {
  readonly visible: boolean;
  readonly screenPos: { readonly x: number; readonly y: number } | null;
  readonly grip: UnifiedGripInfo | null;
  readonly sections: ReadonlyArray<GripContextMenuSection>;
}

const EMPTY_SECTIONS: ReadonlyArray<GripContextMenuSection> = [];

const CLOSED_SNAPSHOT: GripContextMenuSnapshot = Object.freeze({
  visible: false,
  screenPos: null,
  grip: null,
  sections: EMPTY_SECTIONS,
});

type Listener = () => void;

class GripContextMenuStoreImpl {
  private snapshot: GripContextMenuSnapshot = CLOSED_SNAPSHOT;
  private listeners = new Set<Listener>();

  getSnapshot = (): GripContextMenuSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  show(params: {
    grip: UnifiedGripInfo;
    screenPos: { x: number; y: number };
    sections: ReadonlyArray<GripContextMenuSection>;
  }): void {
    const hasAnyItem = params.sections.some((s) => s.items.length > 0);
    if (!hasAnyItem) return;
    this.snapshot = Object.freeze({
      visible: true,
      screenPos: { x: params.screenPos.x, y: params.screenPos.y },
      grip: params.grip,
      sections: params.sections,
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

export const GripContextMenuStore = new GripContextMenuStoreImpl();
