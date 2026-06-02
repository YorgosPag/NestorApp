/**
 * placement-cursor — SSoT for the 3D placement cursor (crosshair).
 *
 * ADR-403 / ADR-406. Several placement hooks (column, MEP fixture, … and future
 * BIM placement tools) arm/disarm on the SAME renderer canvas. Each one used to
 * write `canvasEl.style.cursor` directly: the arming hook set `'crosshair'` and
 * the disarming hook reset it to `''`. When the active tool switched
 * (e.g. column → fixture) BOTH a `setup()` and a `teardown()` fired for the same
 * store change, and the final cursor depended on hook firing order — so one tool
 * showed the crosshair while the other leaked the orbit-grab "hand" through.
 *
 * This module is the single owner of that cursor. It ref-counts the active
 * placement tools per canvas: the crosshair is applied while AT LEAST ONE tool
 * holds it and cleared exactly once when the last one releases — independent of
 * the order `acquire`/`release` are called in. Callers MUST pair every
 * `acquirePlacementCursor` with exactly one `releasePlacementCursor`.
 */

/** Active placement-cursor holders per canvas (ref count). */
const holders = new WeakMap<HTMLElement, number>();

/** The cursor a placement tool shows — mirrors the 2D DXF canvas crosshair. */
const PLACEMENT_CURSOR = 'crosshair';

/** Arm the placement cursor on `el` (idempotent per holder via ref count). */
export function acquirePlacementCursor(el: HTMLElement): void {
  holders.set(el, (holders.get(el) ?? 0) + 1);
  el.style.cursor = PLACEMENT_CURSOR;
}

/**
 * Release one hold on `el`'s placement cursor. The cursor is restored to the
 * viewport default (`''` → orbit-grab) ONLY when the last holder releases.
 */
export function releasePlacementCursor(el: HTMLElement): void {
  const next = (holders.get(el) ?? 0) - 1;
  if (next <= 0) {
    holders.delete(el);
    el.style.cursor = '';
  } else {
    holders.set(el, next);
  }
}
