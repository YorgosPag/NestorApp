/**
 * ADR-408 Εύρος Β #1 / ADR-574 Σ2 — Radiator 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `MepRadiatorEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepRadiatorParams` + `buildMepRadiatorEntity`) + overrides/sceneUnits
 * από το bridge store, και τη ζωγραφίζει WYSIWYG (`renderWysiwygPlacementGhost`) —
 * byte-identical με το committed σώμα καλοριφέρ. RAF/clear/viewport/cursor → harness
 * (ADR-398 §4)· build→paint skeleton → factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultMepRadiatorParams,
  buildMepRadiatorEntity,
} from '../drawing/mep-radiator-completion';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useMepRadiatorGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: mepRadiatorToolBridgeStore,
  buildDefaultParams: buildDefaultMepRadiatorParams,
  buildEntity: buildMepRadiatorEntity,
});
