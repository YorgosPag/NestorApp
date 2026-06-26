/**
 * Grip3DContextMenuStore — micro-store for the 3D viewport per-vertex grip context
 * menu (ADR-535 Φ4).
 *
 * Holds the tiny low-frequency UI state the right-click vertex menu needs: whether it
 * is open, where on screen, and which reshape `GripInfo` it targets (its `*GripKind` +
 * `type` decide delete-corner vs insert-corner). The (non-React) interaction handler
 * writes it on `contextmenu` over a grip; the React `Grip3DVertexContextMenu` leaf
 * reads it. Zero high-frequency data (no pointer positions) — mirror of
 * `Bim3DEditStore`'s micro-leaf role (ADR-040: orchestrators never subscribe to it).
 */

import { create } from 'zustand';
import type { GripInfo } from '../../hooks/grip-types';

interface Grip3DContextMenuState {
  /** True while the vertex menu is open. */
  readonly open: boolean;
  /** Screen position (client px) the menu anchors at, or null when closed. */
  readonly screen: { readonly x: number; readonly y: number } | null;
  /** The reshape grip the menu acts on, or null when closed. */
  readonly grip: GripInfo | null;
  /** Open the menu at `screen` for `grip` (right-click on a 3D reshape grip). */
  show(grip: GripInfo, screen: { x: number; y: number }): void;
  /** Close the menu. */
  hide(): void;
}

export const useGrip3DContextMenuStore = create<Grip3DContextMenuState>((set) => ({
  open: false,
  screen: null,
  grip: null,
  show: (grip, screen) => set({ open: true, grip, screen }),
  hide: () => set({ open: false, grip: null, screen: null }),
}));
