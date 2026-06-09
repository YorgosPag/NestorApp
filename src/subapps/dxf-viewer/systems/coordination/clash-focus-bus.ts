/**
 * ADR-435 — Clash focus bus (Slice 1b).
 *
 * A tiny, THREE-free pub/sub that carries a "focus on this clash point" request
 * (world metres) from the DOM report panel to whichever VIEW driver is listening.
 * Decoupled like the report store: the panel is mode-agnostic and never imports a
 * viewport — it just announces the point; the active view layer reacts.
 *
 * Today's only subscriber is the 3D markers driver (`use-bim3d-clash-markers.ts`),
 * which frames the camera on the point (Navisworks "zoom to clash"). The 2D path
 * does NOT go through here — the panel reuses the existing `canvas-fit-to-view-
 * selected` EventBus SSoT directly (same path as the Z key), so no 2D wiring is
 * duplicated. Click-driven only ⇒ ADR-040-safe (no per-frame traffic).
 *
 * @see ./clash-types.ts (Vec3)
 * @see ../../bim-3d/viewport/use-bim3d-clash-markers.ts (3D subscriber)
 * @see ../../components/dxf-layout/ClashReportPanel.tsx (producer)
 */

import type { Vec3 } from './clash-types';

type FocusListener = (point: Vec3) => void;

const listeners = new Set<FocusListener>();

/** Subscribe a view driver to focus requests. Returns an unsubscribe fn. */
export function subscribeClashFocus(listener: FocusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the active view to focus on a clash point (world metres). */
export function requestClashFocus(point: Vec3): void {
  for (const l of listeners) l(point);
}
