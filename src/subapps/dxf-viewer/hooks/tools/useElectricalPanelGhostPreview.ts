/**
 * ADR-408 Φ3 / ADR-574 Σ2 — Electrical panel 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ADR-574 Σ2: το ghost χτίζει πλέον την ΙΔΙΑ πλήρη οντότητα με τους ΙΔΙΟΥΣ commit
 * builders (`buildDefaultElectricalPanelParams` + `buildElectricalPanelEntity`, τα
 * ίδια με `useElectricalPanelTool.commitFromState`) και τη ζωγραφίζει μέσω του
 * ΠΡΑΓΜΑΤΙΚΟΥ `EntityRendererComposite` (via `renderWysiwygPlacementGhost`) —
 * byte-identical με το committed element, αντί για το legacy translucent
 * footprint. Overrides + sceneUnits έρχονται από το ίδιο bridge store που γράφει
 * το tool hook (single-writer, ίδιο state με το commit path).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Entity, ViewTransform } from '../../rendering/types/Types';
import {
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
} from '../drawing/electrical-panel-completion';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseElectricalPanelGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useElectricalPanelGhostPreview(
  props: Readonly<UseElectricalPanelGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    // ADR-574 Σ2 — build the FULL entity with the SAME commit builders + overrides
    // source (bridge `.overrides` mirrors the tool state), so preview ≡ commit.
    const h = electricalPanelToolBridgeStore.get();
    const overrides = h?.overrides ?? {};
    const sceneUnits = h?.getSceneUnits?.() ?? 'mm';
    const params = buildDefaultElectricalPanelParams(effectiveCursor, overrides, sceneUnits);
    const built = buildElectricalPanelEntity(params, getDefaultLayerId());
    if (!built.ok) return;
    renderWysiwygPlacementGhost(ctx, built.entity as unknown as Entity, t, viewport);
  }, []);

  useCanvasGhostPreview({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
