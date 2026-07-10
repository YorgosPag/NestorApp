/**
 * ADR-408 DHW / ADR-574 Σ2 — Domestic hot water heater 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `MepWaterHeaterEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepWaterHeaterParams` + `buildMepWaterHeaterEntity`) + overrides/
 * sceneUnits από το bridge store, και τη ζωγραφίζει WYSIWYG
 * (`renderWysiwygPlacementGhost`) — byte-identical με τον committed θερμοσίφωνα.
 * RAF/clear/viewport/cursor → harness (ADR-398 §4)· build→paint skeleton → factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultMepWaterHeaterParams,
  buildMepWaterHeaterEntity,
} from '../drawing/mep-water-heater-completion';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useMepWaterHeaterGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: mepWaterHeaterToolBridgeStore,
  buildDefaultParams: buildDefaultMepWaterHeaterParams,
  buildEntity: buildMepWaterHeaterEntity,
});
