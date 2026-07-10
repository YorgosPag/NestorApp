/**
 * ADR-408 Εύρος Β #2 / ADR-574 Σ2 — Heating boiler 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `MepBoilerEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepBoilerParams` + `buildMepBoilerEntity`) + overrides/sceneUnits από
 * το bridge store, και τη ζωγραφίζει WYSIWYG (`renderWysiwygPlacementGhost`) —
 * byte-identical με τον committed λέβητα. RAF/clear/viewport/cursor → harness
 * (ADR-398 §4)· build→paint skeleton → factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultMepBoilerParams,
  buildMepBoilerEntity,
} from '../drawing/mep-boiler-completion';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useMepBoilerGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: mepBoilerToolBridgeStore,
  buildDefaultParams: buildDefaultMepBoilerParams,
  buildEntity: buildMepBoilerEntity,
});
