/**
 * ADR-406 / ADR-574 Σ2 — MEP fixture 2D placement ghost preview hook.
 *
 * Thin binding του single-point bridge-store placement-ghost factory (ADR-624):
 * χτίζει την ΠΛΗΡΗ `MepFixtureEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultMepFixtureParams` + `buildMepFixtureEntity`) + overrides/sceneUnits
 * από το bridge store, και τη ζωγραφίζει WYSIWYG (`renderWysiwygPlacementGhost`) —
 * byte-identical με το committed fixture. RAF/clear/viewport/cursor → harness
 * (ADR-398 §4)· build→paint skeleton → factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 */

import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
} from '../drawing/mep-fixture-completion';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';
import { createBridgeStorePlacementGhostHook } from './use-wysiwyg-placement-ghost';

export const useMepFixtureGhostPreview = createBridgeStorePlacementGhostHook({
  bridgeStore: mepFixtureToolBridgeStore,
  buildDefaultParams: buildDefaultMepFixtureParams,
  buildEntity: buildMepFixtureEntity,
});
