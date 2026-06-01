/**
 * ADR-363 «Δοκάρι από τοίχο» — beam tool 3D-ghost bridge store.
 *
 * Module-level mutable cell που δημοσιεύει ο `useBeamTool` (2D, ζει στο
 * `CanvasSection` via `useSpecialTools`) ώστε ο 3D ghost (`BeamFromWallGhost`,
 * ζει στο `BimViewport3D` subtree) να διαβάζει ΑΚΡΙΒΩΣ τα overrides + scene
 * units που θα χρησιμοποιήσει και το commit — άρα ghost === committed beam
 * (WYSIWYG). Mirror του `columnToolBridgeStore` (ADR-403).
 *
 * Why module store instead of context: `useBeamTool` και το 3D ghost ζουν σε
 * sibling subtrees· shared context θα απαιτούσε lift-up πάνω από το
 * `DxfViewerContent` (intrusive, ADR-040 micro-leaf risk).
 *
 * Single writer (`useBeamTool` effect) → single reader (`BeamFromWallGhost`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 * @see ui/ribbon/hooks/bridge/column-tool-bridge-store.ts — mirror pattern
 */

import type { BeamParamOverrides, SceneUnits } from '../../hooks/drawing/beam-completion';

/**
 * Snapshot των πεδίων που χρειάζεται ο 3D ghost για να χτίσει το προς-δημιουργία
 * δοκάρι με το ίδιο geometry που θα παράξει το commit.
 */
export interface BeamToolBridgeHandle {
  /** Ribbon overrides (width / depth / topElevation / kind …) — ίδια με το commit. */
  readonly overrides: BeamParamOverrides;
  /** Active scene units, ώστε το ghost build να κλιμακώνεται σωστά (mm/m). */
  getSceneUnits(): SceneUnits;
}

let handle: BeamToolBridgeHandle | null = null;

export const beamToolBridgeStore = {
  /** Writer — called by the `useBeamTool` effect on overrides/units change. */
  set(next: BeamToolBridgeHandle | null): void {
    handle = next;
  },
  get(): BeamToolBridgeHandle | null {
    return handle;
  },
};
