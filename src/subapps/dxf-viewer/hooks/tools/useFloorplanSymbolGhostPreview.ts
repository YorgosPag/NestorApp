/**
 * ADR-415 / ADR-574 / ADR-624 — Floorplan-symbol 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `FloorplanSymbolEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultFloorplanSymbolParams` + `buildFloorplanSymbolEntity`) + overrides
 * (incl. picked `assetId`) / sceneUnits από το bridge store, και τη ζωγραφίζει
 * WYSIWYG (`renderWysiwygPlacementGhost`) — byte-identical με το committed σύμβολο.
 * RAF/clear/viewport/cursor → harness (ADR-398 §4)· build→paint skeleton → factory.
 *
 * Mirror του `useMepFixtureGhostPreview` (ίδιο single-point family).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
} from '../drawing/floorplan-symbol-completion';
import { floorplanSymbolToolBridgeStore } from '../../ui/ribbon/hooks/bridge/floorplan-symbol-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useFloorplanSymbolGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: floorplanSymbolToolBridgeStore,
  buildDefaultParams: buildDefaultFloorplanSymbolParams,
  buildEntity: buildFloorplanSymbolEntity,
  // ADR-624 — free-point placement: the commit uses the RAW cursor (canvas-click-mep-dispatch
  // «RAW worldPoint; free-point placement»), so the ghost follows the raw 60fps cursor too →
  // ghost ≡ commit + zero lag when Snap/Grid is ON (the ~30fps snap point no longer gates it).
  useImmediateSnap: false,
});
