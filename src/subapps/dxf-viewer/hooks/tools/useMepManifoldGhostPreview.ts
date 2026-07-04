/**
 * ADR-408 Φ12 — Plumbing manifold 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ADR-574 Σ2 — WYSIWYG ghost: το draw closure χτίζει ΠΛΗΡΗ `MepManifoldEntity` με
 * τους ΙΔΙΟΥΣ commit builders (`buildDefaultMepManifoldParams` +
 * `buildMepManifoldEntity`, ίδιο overrides source με το commit — bridge `.overrides`)
 * και το ζωγραφίζει μέσω του κοινού `renderWysiwygPlacementGhost` (πραγματικός
 * `MepManifoldRenderer`). Έτσι το φάντασμα ΕΙΝΑΙ byte-identical με το committed
 * φρεάτιο/manifold (fill / grating / lineweight), αντί για translucent footprint +
 * anchor-dot. preview ≡ commit by identity.
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
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
} from '../drawing/mep-manifold-completion';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMepManifoldGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — kept for parent wiring parity (ADR-574: unused here). */
  getGhostFootprint?(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepManifoldGhostPreview(
  props: Readonly<UseMepManifoldGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    // ADR-574 Σ2 — build the FULL entity with the SAME commit builders + overrides
    // source (bridge `.overrides` mirrors the tool state), so preview ≡ commit.
    const h = mepManifoldToolBridgeStore.get();
    const overrides = h?.overrides ?? {};
    const sceneUnits = h?.getSceneUnits?.() ?? 'mm';
    const params = buildDefaultMepManifoldParams(effectiveCursor, overrides, sceneUnits);
    const built = buildMepManifoldEntity(params, getDefaultLayerId());
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
