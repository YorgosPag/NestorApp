/**
 * ADR-408 Φ3 / ADR-574 Σ2 — Electrical panel 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ οντότητα με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultElectricalPanelParams` + `buildElectricalPanelEntity`) + overrides/
 * sceneUnits από το ίδιο bridge store που γράφει το tool hook, και τη ζωγραφίζει
 * WYSIWYG μέσω του `renderWysiwygPlacementGhost` — byte-identical με το committed
 * element. Το RAF/clear/viewport/cursor scaffolding ζει στο `useCanvasGhostPreview`
 * harness (ADR-398 §4)· το build→paint skeleton στο factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
} from '../drawing/electrical-panel-completion';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useElectricalPanelGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: electricalPanelToolBridgeStore,
  buildDefaultParams: buildDefaultElectricalPanelParams,
  buildEntity: buildElectricalPanelEntity,
});
