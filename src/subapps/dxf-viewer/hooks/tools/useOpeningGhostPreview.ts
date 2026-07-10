/**
 * ADR-363 Phase 2 / ADR-574 Σ2 — Opening placement ghost preview hook (RAF-driven).
 *
 * WYSIWYG variant του placement-ghost primitive (ADR-624): το bespoke build χτίζει
 * την ΠΛΗΡΗ synthetic `OpeningEntity` με τους ΙΔΙΟΥΣ commit builders
 * (`buildDefaultOpeningParams` + `buildOpeningEntity`, ίδιο overrides source —
 * `overrides` + `kind` merged — ακριβώς όπως το `useOpeningTool.commitOpeningFromState`)
 * πάνω στο locked host wall, και το primitive τη ζωγραφίζει WYSIWYG μέσω του ΠΡΑΓΜΑΤΙΚΟΥ
 * `OpeningRenderer` (`renderWysiwygPlacementGhost`) — byte-identical με το committed
 * opening. RAF/clear/viewport/cursor → `useCanvasGhostPreview` harness (ADR-398 §4).
 *
 * Activates only όταν ο opening tool βρίσκεται σε phase `awaitingPosition` (host wall
 * locked). Snapped cursor όταν OSNAP.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

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
import { useWysiwygPlacementGhost } from './use-wysiwyg-placement-ghost';

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

  useWysiwygPlacementGhost({
    isActive: isAwaitingPosition,
    transform,
    getCanvas,
    getViewportElement,
    buildGhostEntity: ({ effectiveCursor }): Entity | null => {
      if (!effectiveCursor) return null;
      const hostWall = getHostWall();
      if (!hostWall) return null;
      // ADR-574 Σ2 — build the FULL entity with the SAME commit builders + overrides
      // source (kind merged in, exactly like `commitOpeningFromState`), so preview ≡
      // commit. Projection / snap / clamp live inside `buildDefaultOpeningParams`.
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
      const overridesWithKind: OpeningParamOverrides = { ...overrides, kind };
      const params = buildDefaultOpeningParams(hostWall, effectiveCursor, overridesWithKind, sceneUnits);
      const built = buildOpeningEntity(params, hostWall, getDefaultLayerId(), sceneUnits);
      return built.ok ? (built.entity as unknown as Entity) : null;
    },
    drawDeps: [kind, overrides, getHostWall, getSceneUnits],
  });
}
