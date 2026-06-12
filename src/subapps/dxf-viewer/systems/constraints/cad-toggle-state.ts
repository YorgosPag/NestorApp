/**
 * Non-React SSoT mirror of the ORTHO (F8) / POLAR (F10) / SNAP-MODE (F9) CAD
 * toggle state.
 *
 * `useCadToggles` owns the authoritative React state (persisted to Firestore),
 * but several non-React, event-time consumers — notably the BIM tool commit
 * path in `useCanvasClickHandler` and the 2D grip-drag commit/preview path
 * (ADR-040 orchestrator-decoupled, cannot subscribe to a React hook) — need to
 * read the live toggle value synchronously at click/drag time. This module is
 * the ADR-040-style immediate store that bridges the two: `useCadToggles`
 * writes on every change, consumers read via the getters.
 *
 * Mutual exclusion (ortho XOR polar) is enforced upstream in `useCadToggles`;
 * this store merely mirrors whatever it is told, so both flags are written
 * together to stay consistent.
 *
 * @see hooks/common/useCadToggles.ts — sole writer
 * @see hooks/drawing/bim-ortho-reference.ts — primary reader (BIM commit path)
 * @see bim/grips/grip-step-quantize.ts — snap-mode reader (grip-drag step snap)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

let orthoOn = false;
let polarOn = false;
let snapOn = false;
let snapStep = 0;

export const cadToggleState = {
  /** Writer — called by `useCadToggles` on every ortho/polar state change. */
  set(ortho: boolean, polar: boolean): void {
    orthoOn = ortho;
    polarOn = polar;
  },
  /**
   * Writer — called by `useCadToggles` on every SNAP-MODE (F9) change.
   * `step` is the increment in scene units (0 / negative ⇒ no quantization).
   */
  setSnap(on: boolean, step: number): void {
    snapOn = on;
    snapStep = step;
  },
  /** F8 ORTHO live state. */
  isOrthoOn(): boolean {
    return orthoOn;
  },
  /** F10 POLAR live state. */
  isPolarOn(): boolean {
    return polarOn;
  },
  /** F9 SNAP-MODE live state. */
  isSnapOn(): boolean {
    return snapOn;
  },
  /** Snap-mode increment step (scene units). */
  getSnapStep(): number {
    return snapStep;
  },
};
