/**
 * Drawing Event Map — Topography ribbon events (ADR-662 Φάση 1).
 *
 * Extracted from drawing-event-map.ts to keep that file <500 LOC (Google SRP,
 * CLAUDE.md N.7.1). Pure type module: zero runtime logic. `DrawingEventMap`
 * extends `TopoEventMap` from here (sibling of `BimEventMap`/`MepAutoDesignEventMap`).
 *
 * ADR-662 — the permanent «Τοπογραφικό» ribbon tab dispatches every authoring
 * command as one string `action` (`topo.*`). `dispatch-DxfSpecialAction` forwards it
 * verbatim on THIS event; `TopoRibbonHost` (which mounts the existing topo hooks)
 * subscribes and routes the string to the ready hook/store call — so the topo
 * business logic stays untouched (the ribbon is a thin trigger, not a re-implementation).
 */

export interface TopoEventMap {
  // ADR-662 Φάση 1 — ribbon «Τοπογραφικό» command bridge. Payload carries the raw
  // `topo.*` action key; TopoRibbonHost owns the switch (mount-time hooks + stores +
  // section-in-dialog). One event keeps `dxf-special-actions` a thin emitter.
  'topo:ribbon-action': { action: string };
}
