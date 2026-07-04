/**
 * ADR-408 Εύρος Β #1 — Heating radiator 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ADR-574 Σ2 — WYSIWYG ghost: το draw closure χτίζει ΠΛΗΡΗ `MepRadiatorEntity` με
 * τους ΙΔΙΟΥΣ commit builders (`buildDefaultMepRadiatorParams` +
 * `buildMepRadiatorEntity`, ίδιο overrides source με το commit — bridge `.overrides`)
 * και το ζωγραφίζει μέσω του κοινού `renderWysiwygPlacementGhost` (πραγματικός
 * entity renderer). Έτσι το φάντασμα ΕΙΝΑΙ byte-identical με το committed σώμα
 * καλοριφέρ (fill / lineweight / σύμβολο), αντί για translucent footprint.
 * preview ≡ commit by identity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see bim/ghosts/wysiwyg-placement-ghost — renderWysiwygPlacementGhost SSoT
 */

import { useCallback } from 'react';
import type { Entity, Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepRadiatorParams,
  buildMepRadiatorEntity,
} from '../drawing/mep-radiator-completion';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMepRadiatorGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — kept for parent wiring parity (ADR-574: unused here). */
  getGhostFootprint?(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepRadiatorGhostPreview(
  props: Readonly<UseMepRadiatorGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    // ADR-574 Σ2 — build the FULL entity with the SAME commit builders + overrides
    // source (bridge `.overrides` mirrors the tool state), so preview ≡ commit.
    const h = mepRadiatorToolBridgeStore.get();
    const overrides = h?.overrides ?? {};
    const sceneUnits = h?.getSceneUnits?.() ?? 'mm';
    const params = buildDefaultMepRadiatorParams(effectiveCursor, overrides, sceneUnits);
    const built = buildMepRadiatorEntity(params, getDefaultLayerId());
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
