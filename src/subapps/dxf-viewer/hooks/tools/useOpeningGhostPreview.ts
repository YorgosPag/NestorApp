/**
 * ADR-363 Phase 2 (canvas-wiring follow-up, 2026-05-25) — Opening placement
 * ghost preview hook (RAF-driven).
 *
 * ADR-574 Σ2 (WYSIWYG migration, 2026-07-05): το φάντασμα πλέον χτίζει την
 * ΠΛΗΡΗ synthetic `OpeningEntity` με τους ΙΔΙΟΥΣ commit builders του tool
 * (`buildDefaultOpeningParams` + `buildOpeningEntity`, ίδιο overrides source —
 * `overrides` + `kind` merged — ακριβώς όπως το `useOpeningTool.commitOpeningFromState`)
 * και τη ζωγραφίζει μέσω του ΠΡΑΓΜΑΤΙΚΟΥ `OpeningRenderer` (via
 * `renderWysiwygPlacementGhost` → `BimPreviewRenderer` → `EntityRendererComposite`).
 * Έτσι το ghost είναι byte-identical με το committed opening (poché jambs + swing
 * arc / glazing), αντί για το legacy translucent rectangle + crosshair. Ίδιο
 * pattern με το column WYSIWYG ghost.
 *
 * Activates only όταν ο opening tool βρίσκεται σε phase `awaitingPosition`
 * (host wall locked). Snapped cursor όταν OSNAP.
 *
 * ADR-040 compliance:
 *   - NO `useSyncExternalStore` σε orchestrators (CanvasSection)
 *   - `getImmediateSnap()` imperative read inside RAF callback (harness)
 *   - Ghost renders to preview canvas only (bitmap cache unchanged)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see bim/ghosts/wysiwyg-placement-ghost — shared real-renderer paint SSoT
 */

import { useCallback } from 'react';
import type { Entity, ViewTransform } from '../../rendering/types/Types';
import type { OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  buildDefaultOpeningParams,
  buildOpeningEntity,
  type OpeningParamOverrides,
} from '../drawing/opening-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseOpeningGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: OpeningKind;
  readonly overrides: OpeningParamOverrides;
  /** Resolver για locked host wall (null όταν `isAwaitingPosition === false`). */
  readonly getHostWall: () => WallEntity | null;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /** ADR-370 — active scene units για mm→scene conversion. */
  getSceneUnits?(): SceneUnits;
}

export function useOpeningGhostPreview(props: Readonly<UseOpeningGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, overrides, getHostWall, transform, getCanvas, getViewportElement, getSceneUnits } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const hostWall = getHostWall();
    if (!hostWall) return;

    // ADR-574 Σ2 — build the FULL entity with the SAME commit builders + overrides
    // source (kind merged in, exactly like `useOpeningTool.commitOpeningFromState`),
    // so preview ≡ commit. Projection / snap / clamp live inside
    // `buildDefaultOpeningParams` → the ghost sits at the exact commit offset.
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const overridesWithKind: OpeningParamOverrides = { ...overrides, kind };
    const params = buildDefaultOpeningParams(hostWall, effectiveCursor, overridesWithKind, sceneUnits);
    const built = buildOpeningEntity(params, hostWall, getDefaultLayerId(), sceneUnits);
    if (!built.ok) return;

    renderWysiwygPlacementGhost(ctx, built.entity as unknown as Entity, t, viewport);
  }, [kind, overrides, getHostWall, getSceneUnits]);

  useCanvasGhostPreview({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
