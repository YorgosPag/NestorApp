/**
 * ADR-408 Φ12 / ADR-574 Σ2 — Plumbing manifold 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `MepManifoldEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepManifoldParams` + `buildMepManifoldEntity`) + overrides/sceneUnits
 * από το bridge store, και τη ζωγραφίζει WYSIWYG (`renderWysiwygPlacementGhost`) —
 * byte-identical με το committed φρεάτιο/manifold. RAF/clear/viewport/cursor → harness
 * (ADR-398 §4)· build→paint skeleton → factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
} from '../drawing/mep-manifold-completion';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useMepManifoldGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: mepManifoldToolBridgeStore,
  buildDefaultParams: buildDefaultMepManifoldParams,
  buildEntity: buildMepManifoldEntity,
});
