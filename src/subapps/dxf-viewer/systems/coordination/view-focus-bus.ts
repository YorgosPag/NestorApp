/**
 * ADR-435 / ADR-650 M5α.2 — View focus bus: «frame the 3D camera on THIS point».
 *
 * A tiny, THREE-free pub/sub that carries a focus request from a DOM report panel to whichever
 * VIEW driver is listening. Decoupled like the report stores: a panel is mode-agnostic and never
 * imports a viewport — it just announces the point; the active view layer reacts.
 *
 * ### Why the payload is THREE-WORLD metres, not domain coordinates
 * This bus was born as `clash-focus-bus` and carried a clash point in **plan-space metres**, which
 * only worked because clashes were the sole producer. The topography QA report (ADR-650 M5α.2) is the
 * second producer and its flags live in a DIFFERENT frame — ΕΓΣΑ'87 WORLD canonical mm, additionally
 * re-seated by the geo-reference projector and the project vertical datum. A shared bus carrying
 * «some domain's coordinates» would have made the single subscriber apply ONE domain's transform to
 * BOTH — silently framing the camera on empty space for the other.
 *
 * So the contract is deliberately narrow: **each producer converts to three-world metres itself**
 * (via its own pure math module — `clashPointToWorld` / `topoQaFlagToWorld`) and the bus carries the
 * finished point. That keeps the panels free of any viewport import (they call a pure function, not
 * a camera) while making the frame unambiguous — the one thing two producers cannot disagree about.
 *
 * `halfExtentM` travels with the point because «how close» is a domain judgement: a clash is a
 * centimetre-scale intersection (0.6 m), a survey blunder is a metres-wide neighbourhood (15 m).
 * A single constant in the subscriber would zoom one of them uselessly wrong.
 *
 * Click-driven only ⇒ ADR-040-safe (no per-frame traffic).
 *
 * @see ../../bim-3d/viewport/use-view-focus-3d.ts (the sole subscriber — frames the camera)
 * @see ../../bim-3d/coordination/clash-marker-math.ts (clash producer's conversion)
 * @see ../../bim-3d/coordination/topo-qa-marker-math.ts (topo QA producer's conversion)
 */

import type { Point3D } from '../../bim/types/bim-base';
import { createExternalStore } from '../../stores/createExternalStore';

/** What a panel row click asks the active 3D view to do. */
export interface ViewFocusRequest {
  /** The spot to frame, in three-world metres (Y-up) — already out of any domain frame. */
  readonly point: Point3D;
  /** Half-size (metres) of the box framed around it — the domain's idea of «close enough». */
  readonly halfExtentM: number;
  /**
   * ADR-650 M5α.2 — keep the user's current zoom and only slide the view over (`centerOn`), instead
   * of re-framing to `halfExtentM`.
   *
   * The producer decides, because only it knows whether this is the FIRST jump of a review pass
   * (nothing to preserve yet — frame it) or a subsequent one (the engineer has since chosen a
   * working scale, and re-fitting would throw it away on every row click). `halfExtentM` still
   * travels, so a later caller can fall back to framing without re-deriving it.
   */
  readonly preserveZoom?: boolean;
}

type FocusListener = (request: ViewFocusRequest) => void;

/**
 * ADR-294 / SSoT `create-external-store` — the listener set + notify plumbing is NOT re-implemented
 * here; the pub/sub cell is the shared factory. This bus is payload-carrying, so it keeps the
 * request itself as the store value (the registry's «lastEvent side-channel + wrapper» form) and
 * the thin wrappers below re-expose the domain-shaped `subscribe(request => …)` signature.
 *
 * `null` = «no request has been made yet»; every `requestViewFocus` writes a FRESH object, so the
 * default (no `equals`) notify-always semantics fire on repeat clicks of the SAME row too.
 */
const focusRequest = createExternalStore<ViewFocusRequest | null>(null);

/** Subscribe a view driver to focus requests. Returns an unsubscribe fn. */
export function subscribeViewFocus(listener: FocusListener): () => void {
  return focusRequest.subscribe(() => {
    const request = focusRequest.get();
    if (request) listener(request);
  });
}

/** Ask the active view to frame a point (three-world metres). */
export function requestViewFocus(request: ViewFocusRequest): void {
  focusRequest.set(request);
}
